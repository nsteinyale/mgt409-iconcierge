"""Settings shared by the whole app: paths, the model, limits and prices."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND = Path(__file__).resolve().parent
APP_ROOT = BACKEND.parent
FRONTEND = APP_ROOT / "frontend"
DATA_DIR = Path(os.getenv("ICONCIERGE_DATA_DIR", APP_ROOT / "data"))
DB_PATH = DATA_DIR / "iconcierge.sqlite3"
SOURCES_PATH = BACKEND / "sources.json"

# .env in the repo folder first, then the folder one level above it.
# load_dotenv never overrides a value that is already set, so the repo copy wins.
load_dotenv(APP_ROOT / ".env")
load_dotenv(APP_ROOT.parent / ".env")

PORTKEY_BASE_URL = "https://api.portkey.ai/v1"
# The course allows one model through the course key. A personal OpenAI key may pick its own.
MODEL_NAME = os.getenv("OPENAI_MODEL", "").strip() or "gpt-6-luna"

# Limits for one question, across the whole team.
MAX_SPECIALISTS_PER_QUESTION = 3
MAX_TOOL_ROUNDS = 4            # tool-call loops per specialist
MAX_SEARCHES = 2               # source-library searches per specialist
MAX_OUTPUT_TOKENS = 1200       # per model response
HISTORY_TURNS = 6              # earlier user/Captain turns the Captain sees
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_QUESTIONS_PER_HOUR = 30    # per family, protects against runaway cost
MAX_UPLOADS_PER_DAY = 30
MAX_DOC_CHARS = 12000          # characters of a document a specialist can read at once

# Course price list (Lecture 11), dollars per 1M tokens.
PRICE_IN = 0.10
PRICE_CACHED_IN = 0.01
PRICE_CACHE_WRITE = 0.125
PRICE_OUT = 0.50
MAX_COST_PER_QUESTION = 0.01   # dollars; the team stops if one question would cost more (worst measured run: $0.0036)
HEDGE_AFTER_SECONDS = (12, 24)    # send a backup request if a call is still waiting at these marks

SESSION_COOKIE = "ic_session"
SESSION_DAYS = 14
MAX_GUESTS_PER_HOUR = 10          # Guest / Beta mode sign-ins per address per hour
MAX_BETA_EVENTS_PER_HOUR = 300    # beta clicks and ratings a guest can log per hour
BETA_MODE = os.getenv("ICONCIERGE_BETA") == "1"   # user tests: record guest sessions + show a rating box (off by default)

LANGUAGES = {
    "en": "English",
    "es": "Spanish",
    "zh": "Simplified Chinese",
    "pt": "Brazilian Portuguese",
    "fr": "French",
    "bn": "Bengali",
}


def api_settings() -> tuple[str, str | None, dict]:
    """Return (api_key, base_url, headers). Prefers the course Portkey key."""
    portkey = os.getenv("PORTKEY_API_KEY", "").strip()
    if portkey:
        return portkey, PORTKEY_BASE_URL, {"x-portkey-provider": "openai"}
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    if openai_key:
        return openai_key, None, {}
    raise RuntimeError(
        "No API key found. Put PORTKEY_API_KEY (or OPENAI_API_KEY) in a .env file "
        "in the iConcierge folder or the folder above it."
    )
