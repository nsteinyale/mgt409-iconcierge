"""Family sign-in: passcode hashing, session tokens and a lockout after repeated wrong passcodes."""

from __future__ import annotations

import hashlib
import hmac
import re
import secrets
import time

from . import config, db

PBKDF2_ROUNDS = 200_000
MIN_PASSCODE = 6
LOCKOUT_FAILURES = 5
LOCKOUT_WINDOW = 15 * 60  # seconds
HANDLE_RE = re.compile(r"^[a-z0-9][a-z0-9_.-]{2,31}$")


class AuthError(Exception):
    """A sign-in problem the user can fix; the message is a short code the frontend translates."""


def normalize_handle(handle: str) -> str:
    return (handle or "").strip().lower()


def check_new_credentials(handle: str, passcode: str) -> None:
    if not HANDLE_RE.match(handle):
        raise AuthError("bad_handle")
    if len(passcode or "") < MIN_PASSCODE:
        raise AuthError("short_passcode")


def hash_passcode(passcode: str, salt: str | None = None) -> tuple[str, str]:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", passcode.encode("utf-8"), bytes.fromhex(salt), PBKDF2_ROUNDS)
    return salt, digest.hex()


def verify_passcode(passcode: str, salt: str, expected_hash: str) -> bool:
    _, got = hash_passcode(passcode, salt)
    return hmac.compare_digest(got, expected_hash)


def new_session(family_id: int) -> str:
    token = secrets.token_urlsafe(32)
    db.add_session(token, family_id, time.time() + config.SESSION_DAYS * 86400)
    return token


def sign_up(handle: str, passcode: str, settings: dict, profile: dict) -> int:
    handle = normalize_handle(handle)
    check_new_credentials(handle, passcode)
    if db.family_by_handle(handle):
        raise AuthError("handle_taken")
    salt, pw_hash = hash_passcode(passcode)
    return db.create_family(handle, salt, pw_hash, settings, profile)


def sign_in(handle: str, passcode: str) -> int:
    handle = normalize_handle(handle)
    if db.recent_login_failures(handle, LOCKOUT_WINDOW) >= LOCKOUT_FAILURES:
        raise AuthError("locked_out")
    row = db.family_by_handle(handle)
    if not row or not verify_passcode(passcode or "", row["pass_salt"], row["pass_hash"]):
        db.record_login_failure(handle)
        raise AuthError("wrong_login")
    db.clear_login_failures(handle)
    return int(row["id"])
