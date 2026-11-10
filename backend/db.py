"""SQLite storage: families, sign-in sessions, chat, runs, to-dos, documents and token use."""

from __future__ import annotations

import json
import sqlite3
import time
from contextlib import contextmanager
from typing import Any, Iterator

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS families (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    handle TEXT NOT NULL UNIQUE,
    pass_salt TEXT NOT NULL,
    pass_hash TEXT NOT NULL,
    settings_json TEXT NOT NULL DEFAULT '{}',
    profile_json TEXT NOT NULL DEFAULT '{}',
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    expires_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS login_failures (
    handle TEXT NOT NULL,
    at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    run_id INTEGER,
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    events_json TEXT NOT NULL DEFAULT '[]',
    totals_json TEXT NOT NULL DEFAULT '{}',
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    owner TEXT NOT NULL DEFAULT '',
    due_hint TEXT NOT NULL DEFAULT '',
    done INTEGER NOT NULL DEFAULT 0,
    run_id INTEGER,
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS daily_updates (
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    lang TEXT NOT NULL,
    level TEXT NOT NULL,
    data_json TEXT NOT NULL,
    PRIMARY KEY (family_id, day, lang, level)
);
CREATE TABLE IF NOT EXISTS drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    run_id INTEGER,
    to_text TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT '',
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS safety_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id INTEGER,
    run_id INTEGER,
    layer TEXT NOT NULL,
    kind TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER,
    family_id INTEGER,
    agent TEXT NOT NULL,
    step TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL,
    cached_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    cost REAL NOT NULL,
    seconds REAL NOT NULL,
    created_at REAL NOT NULL
);
"""


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(config.DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init() -> None:
    with connect() as conn:
        conn.executescript(SCHEMA)
        cols = {r["name"] for r in conn.execute("PRAGMA table_info(documents)")}
        for col in ("hidden_json", "flags_json"):
            if col not in cols:  # databases created before the safety layer
                conn.execute(f"ALTER TABLE documents ADD COLUMN {col} TEXT NOT NULL DEFAULT '[]'")


# --- families -----------------------------------------------------------------

def purge_guests(older_than: float) -> int:
    """Delete Guest / Beta spaces created before `older_than` (their to-dos, documents and drafts cascade)."""
    with connect() as conn:
        return conn.execute("DELETE FROM families WHERE handle LIKE 'guest-%' AND created_at < ?", (older_than,)).rowcount


def create_family(handle: str, salt: str, pw_hash: str, settings: dict, profile: dict) -> int:
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO families (handle, pass_salt, pass_hash, settings_json, profile_json, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (handle, salt, pw_hash, json.dumps(settings), json.dumps(profile), time.time()),
        )
        return int(cur.lastrowid)


def family_by_handle(handle: str) -> sqlite3.Row | None:
    with connect() as conn:
        return conn.execute("SELECT * FROM families WHERE handle = ?", (handle,)).fetchone()


def family_by_id(family_id: int) -> sqlite3.Row | None:
    with connect() as conn:
        return conn.execute("SELECT * FROM families WHERE id = ?", (family_id,)).fetchone()


def update_family(family_id: int, settings: dict | None = None, profile: dict | None = None) -> None:
    with connect() as conn:
        if settings is not None:
            conn.execute("UPDATE families SET settings_json = ? WHERE id = ?", (json.dumps(settings), family_id))
        if profile is not None:
            conn.execute("UPDATE families SET profile_json = ? WHERE id = ?", (json.dumps(profile), family_id))


def delete_family(family_id: int) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM families WHERE id = ?", (family_id,))


# --- sessions and sign-in throttling -------------------------------------------

def add_session(token: str, family_id: int, expires_at: float) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM sessions WHERE expires_at < ?", (time.time(),))
        conn.execute("INSERT INTO sessions VALUES (?, ?, ?)", (token, family_id, expires_at))


def session_family(token: str) -> int | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT family_id FROM sessions WHERE token = ? AND expires_at > ?", (token, time.time())
        ).fetchone()
        return int(row["family_id"]) if row else None


def drop_session(token: str) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))


def record_login_failure(handle: str) -> None:
    with connect() as conn:
        conn.execute("INSERT INTO login_failures VALUES (?, ?)", (handle, time.time()))


def recent_login_failures(handle: str, window_seconds: float) -> int:
    with connect() as conn:
        conn.execute("DELETE FROM login_failures WHERE at < ?", (time.time() - 86400,))
        row = conn.execute(
            "SELECT COUNT(*) AS n FROM login_failures WHERE handle = ? AND at > ?",
            (handle, time.time() - window_seconds),
        ).fetchone()
        return int(row["n"])


def clear_login_failures(handle: str) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM login_failures WHERE handle = ?", (handle,))


# --- chat and runs -------------------------------------------------------------

def add_message(family_id: int, role: str, content: str, run_id: int | None = None) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO messages (family_id, role, content, run_id, created_at) VALUES (?, ?, ?, ?, ?)",
            (family_id, role, content, run_id, time.time()),
        )


def recent_messages(family_id: int, limit: int) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT role, content, run_id, created_at FROM messages WHERE family_id = ? ORDER BY id DESC LIMIT ?",
            (family_id, limit),
        ).fetchall()
    return [dict(r) for r in reversed(rows)]


def start_run(family_id: int, question: str) -> int:
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO runs (family_id, question, created_at) VALUES (?, ?, ?)",
            (family_id, question, time.time()),
        )
        return int(cur.lastrowid)


def finish_run(run_id: int, events: list[dict], totals: dict) -> None:
    with connect() as conn:
        conn.execute(
            "UPDATE runs SET events_json = ?, totals_json = ? WHERE id = ?",
            (json.dumps(events), json.dumps(totals), run_id),
        )


def get_run(family_id: int, run_id: int) -> dict | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM runs WHERE id = ? AND family_id = ?", (run_id, family_id)).fetchone()
    if not row:
        return None
    return {
        "id": row["id"],
        "question": row["question"],
        "events": json.loads(row["events_json"]),
        "totals": json.loads(row["totals_json"]),
        "created_at": row["created_at"],
    }


# --- to-dos --------------------------------------------------------------------

def add_todo(family_id: int, title: str, owner: str, due_hint: str, run_id: int | None) -> dict:
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO todos (family_id, title, owner, due_hint, run_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (family_id, title, owner, due_hint, run_id, time.time()),
        )
        return {"id": int(cur.lastrowid), "title": title, "owner": owner, "due_hint": due_hint, "done": False}


def list_todos(family_id: int) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT id, title, owner, due_hint, done FROM todos WHERE family_id = ? ORDER BY done, id DESC",
            (family_id,),
        ).fetchall()
    return [{**dict(r), "done": bool(r["done"])} for r in rows]


def set_todo_done(family_id: int, todo_id: int, done: bool) -> bool:
    with connect() as conn:
        cur = conn.execute(
            "UPDATE todos SET done = ? WHERE id = ? AND family_id = ?", (int(done), todo_id, family_id)
        )
        return cur.rowcount > 0


def delete_todo(family_id: int, todo_id: int) -> bool:
    with connect() as conn:
        cur = conn.execute("DELETE FROM todos WHERE id = ? AND family_id = ?", (todo_id, family_id))
        return cur.rowcount > 0


# --- documents -----------------------------------------------------------------

def add_document(family_id: int, name: str, kind: str, text: str,
                 hidden: list | None = None, flags: list | None = None) -> int:
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO documents (family_id, name, kind, text, hidden_json, flags_json, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (family_id, name, kind, text, json.dumps(hidden or []), json.dumps(flags or []), time.time()),
        )
        return int(cur.lastrowid)


def list_documents(family_id: int) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT id, name, kind, LENGTH(text) AS chars, hidden_json, flags_json, created_at FROM documents "
            "WHERE family_id = ? ORDER BY id DESC",
            (family_id,),
        ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["hidden"] = json.loads(d.pop("hidden_json") or "[]")
        d["flagged"] = json.loads(d.pop("flags_json") or "[]")
        out.append(d)
    return out


def document_flags(family_id: int) -> list[str]:
    """Every flagged line across the family's documents (used by the output guard)."""
    return [line for d in list_documents(family_id) for line in d["flagged"]] +            [h["text"] for d in list_documents(family_id) for h in d["hidden"]]


def get_document(family_id: int, doc_id: int) -> dict | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT id, name, kind, text FROM documents WHERE id = ? AND family_id = ?", (doc_id, family_id)
        ).fetchone()
    return dict(row) if row else None


def delete_document(family_id: int, doc_id: int) -> bool:
    with connect() as conn:
        cur = conn.execute("DELETE FROM documents WHERE id = ? AND family_id = ?", (doc_id, family_id))
        return cur.rowcount > 0


# --- daily update cache ----------------------------------------------------------------

def get_daily(family_id: int, day: str, lang: str, level: str) -> dict | None:
    with connect() as conn:
        row = conn.execute("SELECT data_json FROM daily_updates WHERE family_id = ? AND day = ? AND lang = ? AND level = ?",
                           (family_id, day, lang, level)).fetchone()
    return json.loads(row["data_json"]) if row else None


def save_daily(family_id: int, day: str, lang: str, level: str, data: dict) -> None:
    with connect() as conn:
        conn.execute("INSERT OR REPLACE INTO daily_updates VALUES (?, ?, ?, ?, ?)",
                     (family_id, day, lang, level, json.dumps(data, ensure_ascii=False)))


# --- drafts (never sent by the app) ----------------------------------------------------

def add_draft(family_id: int, run_id: int | None, to: str, subject: str, body: str, purpose: str) -> dict:
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO drafts (family_id, run_id, to_text, subject, body, purpose, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)", (family_id, run_id, to, subject, body, purpose, time.time()))
        return {"id": int(cur.lastrowid), "to": to, "subject": subject, "body": body, "purpose": purpose}


def list_drafts(family_id: int) -> list[dict]:
    with connect() as conn:
        rows = conn.execute("SELECT id, to_text, subject, body, purpose, created_at FROM drafts "
                            "WHERE family_id = ? ORDER BY id DESC", (family_id,)).fetchall()
    return [{"id": r["id"], "to": r["to_text"], "subject": r["subject"], "body": r["body"],
             "purpose": r["purpose"], "created_at": r["created_at"]} for r in rows]


def update_draft(family_id: int, draft_id: int, to: str, subject: str, body: str) -> bool:
    with connect() as conn:
        cur = conn.execute("UPDATE drafts SET to_text = ?, subject = ?, body = ? WHERE id = ? AND family_id = ?",
                           (to, subject, body, draft_id, family_id))
        return cur.rowcount > 0


def delete_draft(family_id: int, draft_id: int) -> bool:
    with connect() as conn:
        return conn.execute("DELETE FROM drafts WHERE id = ? AND family_id = ?", (draft_id, family_id)).rowcount > 0


# --- safety log and rate limits -------------------------------------------------------

def log_safety(family_id: int | None, run_id: int | None, layer: str, kind: str, detail: str) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO safety_events (family_id, run_id, layer, kind, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (family_id, run_id, layer, kind, detail, time.time()),
        )


def list_safety(family_id: int, limit: int = 100) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT run_id, layer, kind, detail, created_at FROM safety_events WHERE family_id = ? "
            "ORDER BY id DESC LIMIT ?", (family_id, limit)).fetchall()
    return [dict(r) for r in rows]


def count_since(table: str, family_id: int, seconds: float) -> int:
    assert table in ("runs", "documents")
    with connect() as conn:
        row = conn.execute(f"SELECT COUNT(*) AS n FROM {table} WHERE family_id = ? AND created_at > ?",
                           (family_id, time.time() - seconds)).fetchone()
    return int(row["n"])


# --- token use -----------------------------------------------------------------

def log_usage(run_id: int | None, family_id: int | None, agent: str, step: str, usage: dict[str, Any]) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO usage (run_id, family_id, agent, step, prompt_tokens, cached_tokens, completion_tokens, "
            "cost, seconds, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                run_id, family_id, agent, step,
                usage["prompt_tokens"], usage["cached_tokens"], usage["completion_tokens"],
                usage["cost"], usage["seconds"], time.time(),
            ),
        )
