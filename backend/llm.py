"""One place that talks to the model, so every call is limited, timed and costed."""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any

from openai import AsyncOpenAI, BadRequestError

from . import config, db

_client: AsyncOpenAI | None = None


class BudgetExceeded(Exception):
    """One question's spend passed MAX_COST_PER_QUESTION; the team stops."""


class ContentFiltered(Exception):
    """The model provider's own safety filter refused the request (e.g. a jailbreak attempt)."""


def client() -> AsyncOpenAI:
    global _client
    if _client is None:
        key, base_url, headers = config.api_settings()
        _client = AsyncOpenAI(api_key=key, base_url=base_url, default_headers=headers, timeout=90, max_retries=2)
    return _client


def _is_filtered(exc: BaseException) -> bool:
    return isinstance(exc, BadRequestError) and ("content_filter" in str(exc) or "content management policy" in str(exc))


async def _hedged(kwargs: dict) -> tuple[Any, int]:
    """Send the request; if it hasn't answered after each HEDGE_AFTER_SECONDS mark, send an identical backup.

    The first good reply wins and the others are cancelled. Returns (response, number of backups sent).
    Provider latency has a long tail (the same call took 5 s or 55 s in the first real-user test), so a
    backup request cuts the worst waits for a small, counted cost. Measured on the tester's four questions (x2):
    average 102 s -> 41 s, slowest 166 s -> 72 s, 6 backups in 66 calls. Earlier marks (8 s) added cost without
    saving time when the provider was slow overall.
    """
    tasks: list[asyncio.Task] = [asyncio.create_task(client().chat.completions.create(**kwargs))]
    marks = list(config.HEDGE_AFTER_SECONDS)
    started = time.perf_counter()
    last_error: BaseException | None = None
    try:
        while True:
            pending = [t for t in tasks if not t.done()]
            timeout = None
            if marks:
                timeout = max(0.0, marks[0] - (time.perf_counter() - started))
            if pending:
                done, _ = await asyncio.wait(pending, timeout=timeout, return_when=asyncio.FIRST_COMPLETED)
            else:
                done = set()
            for t in done:
                exc = t.exception()
                if exc is None:
                    return t.result(), len(tasks) - 1
                if _is_filtered(exc):
                    raise exc                       # the provider will refuse every copy; stop now
                last_error = exc
            if marks and time.perf_counter() - started >= marks[0]:
                marks.pop(0)
                tasks.append(asyncio.create_task(client().chat.completions.create(**kwargs)))
            elif not any(not t.done() for t in tasks):
                if marks:                           # everything failed early: try once more right away
                    marks.pop(0)
                    tasks.append(asyncio.create_task(client().chat.completions.create(**kwargs)))
                else:
                    raise last_error or RuntimeError("no reply")
    finally:
        for t in tasks:
            if not t.done():
                t.cancel()


def usage_of(response: Any, seconds: float) -> dict:
    u = getattr(response, "usage", None)
    prompt = getattr(u, "prompt_tokens", 0) or 0
    completion = getattr(u, "completion_tokens", 0) or 0
    details = getattr(u, "prompt_tokens_details", None)
    cached = getattr(details, "cached_tokens", 0) or 0
    written = getattr(details, "cache_write_tokens", 0) or 0
    # Input tokens include cached reads and cache writes; only the remainder is billed at the plain rate.
    uncached = max(0, prompt - cached - written)
    cost = (uncached * config.PRICE_IN + cached * config.PRICE_CACHED_IN + written * config.PRICE_CACHE_WRITE
            + completion * config.PRICE_OUT) / 1_000_000
    return {"prompt_tokens": prompt, "cached_tokens": cached, "cache_write_tokens": written,
            "completion_tokens": completion, "cost": cost, "seconds": round(seconds, 2)}


async def chat(messages: list[dict], *, agent: str, step: str, run_id: int | None, family_id: int | None,
               tools: list[dict] | None = None, json_mode: bool = False,
               max_tokens: int = config.MAX_OUTPUT_TOKENS, reasoning: str = "none") -> tuple[Any, dict]:
    """Return (assistant message, usage dict). Usage is also saved to the database."""
    kwargs: dict[str, Any] = {"model": config.MODEL_NAME, "messages": messages,
                              "max_completion_tokens": max_tokens}
    if tools:
        kwargs["tools"] = tools
        # The course model only allows function tools with reasoning turned off.
        reasoning = "none"
    # Reasoning tokens count against max_tokens, so most steps run with reasoning off.
    kwargs["reasoning_effort"] = reasoning
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    started = time.perf_counter()
    try:
        response, backups = await _hedged(kwargs)
    except BadRequestError as exc:
        if _is_filtered(exc):
            db.log_usage(run_id, family_id, agent, step, {"prompt_tokens": 0, "cached_tokens": 0,
                         "completion_tokens": 0, "cost": 0.0, "seconds": round(time.perf_counter() - started, 2)})
            raise ContentFiltered(str(exc)[:200]) from exc
        raise
    usage = usage_of(response, time.perf_counter() - started)
    db.log_usage(run_id, family_id, agent, step, usage)
    if backups:
        # Cancelled requests may still be billed. Count each at the winner's cost (an upper bound) so the
        # spend meter and the budget cap stay honest.
        extra = usage["cost"] * backups
        db.log_usage(run_id, family_id, agent, f"{step} backup x{backups}", {"prompt_tokens": 0, "cached_tokens": 0,
                     "completion_tokens": 0, "cost": extra, "seconds": 0.0})
        usage["cost"] += extra
    usage["backups"] = backups
    return response.choices[0].message, usage


def parse_json(text: str | None) -> dict:
    """Parse a JSON reply, tolerating code fences or stray text around the object."""
    if not text:
        return {}
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text[text.find("{"):]
    try:
        value = json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end <= start:
            return {}
        try:
            value = json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            return {}
    return value if isinstance(value, dict) else {}
