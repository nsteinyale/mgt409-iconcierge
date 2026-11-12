"""Backup requests for slow AI calls, with a fake provider (no API key needed). Run: python -m unittest discover tests"""

import asyncio
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace

os.environ.setdefault("ICONCIERGE_DATA_DIR", tempfile.mkdtemp())
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from openai import BadRequestError  # noqa: E402

from backend import config, db, llm  # noqa: E402


def reply(text):
    usage = SimpleNamespace(prompt_tokens=1000, completion_tokens=200, prompt_tokens_details=SimpleNamespace(cached_tokens=0, cache_write_tokens=0))
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=text))], usage=usage)


class FakeProvider:
    """Each call takes the next scripted behavior: ("ok", delay) or ("error", exc)."""

    def __init__(self, script):
        self.script, self.calls, self.cancelled = list(script), 0, 0
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self.create))

    async def create(self, **kwargs):
        kind, arg = self.script[min(self.calls, len(self.script) - 1)]
        n = self.calls = self.calls + 1
        if kind == "error":
            raise arg
        try:
            await asyncio.sleep(arg)
        except asyncio.CancelledError:
            self.cancelled += 1
            raise
        return reply(f"call {n}")


def filtered():
    exc = BadRequestError.__new__(BadRequestError)       # skip the HTTP plumbing; only the message matters
    Exception.__init__(exc, "content_filter: blocked")
    return exc


class Hedging(unittest.TestCase):
    def setUp(self):
        db.init()
        self._marks, config.HEDGE_AFTER_SECONDS = config.HEDGE_AFTER_SECONDS, (0.2, 0.4)

    def tearDown(self):
        config.HEDGE_AFTER_SECONDS = self._marks
        llm._client = None

    def run_chat(self, provider):
        llm._client = provider
        t = time.perf_counter()
        msg, usage = asyncio.run(llm.chat([{"role": "user", "content": "hi"}], agent="test", step="t", run_id=None, family_id=None))
        return msg, usage, time.perf_counter() - t

    def test_fast_call_sends_no_backup(self):
        p = FakeProvider([("ok", 0.01)])
        msg, usage, _ = self.run_chat(p)
        self.assertEqual((p.calls, usage["backups"]), (1, 0))

    def test_stalled_call_is_beaten_by_backup(self):
        p = FakeProvider([("ok", 5.0), ("ok", 0.05)])
        msg, usage, took = self.run_chat(p)
        self.assertEqual(msg.content, "call 2")
        self.assertLess(took, 1.0)                              # did not wait 5 s for the stalled call
        self.assertEqual((usage["backups"], p.cancelled), (1, 1))
        single = llm.usage_of(reply(""), 0)["cost"]
        self.assertAlmostEqual(usage["cost"], 2 * single)       # the abandoned call is counted too

    def test_error_then_backup_succeeds(self):
        p = FakeProvider([("error", RuntimeError("network")), ("ok", 0.01)])
        msg, usage, _ = self.run_chat(p)
        self.assertEqual(msg.content, "call 2")

    def test_content_filter_is_not_retried(self):
        p = FakeProvider([("error", filtered())])
        llm._client = p
        with self.assertRaises(llm.ContentFiltered):
            asyncio.run(llm.chat([{"role": "user", "content": "x"}], agent="t", step="t", run_id=None, family_id=None))
        self.assertEqual(p.calls, 1)


if __name__ == "__main__":
    unittest.main()
