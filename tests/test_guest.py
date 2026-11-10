"""Guest / Beta mode tests (no API key needed). Run: python -m unittest discover tests"""

import os
import sys
import tempfile
import time
import unittest
from pathlib import Path

os.environ.setdefault("ICONCIERGE_DATA_DIR", tempfile.mkdtemp())
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

from backend import auth, config, db, main  # noqa: E402


class GuestMode(unittest.TestCase):
    def setUp(self):
        db.init()
        main.GUEST_STARTS.clear()

    def test_guest_gets_own_space_without_signing_in(self):
        a, b = TestClient(main.app), TestClient(main.app)
        me_a = a.post("/api/guest", json={"language": "es"}).json()
        me_b = b.post("/api/guest", json={}).json()
        self.assertTrue(me_a["guest"] and me_a["handle"].startswith("guest-"))
        self.assertEqual(me_a["settings"]["language"], "es")
        self.assertNotEqual(me_a["id"], me_b["id"])                       # each guest is private
        self.assertEqual(a.get("/api/me").json()["id"], me_a["id"])       # the cookie keeps them signed in
        a.post("/api/todos", json={"title": "Guest A only"})
        self.assertEqual(b.get("/api/todos").json()["todos"], [])

    def test_guest_names_are_reserved(self):
        with self.assertRaises(auth.AuthError):
            auth.sign_up("guest-1234", "secret123", {}, {})

    def test_rate_limited_per_address(self):
        c = TestClient(main.app)
        codes = [c.post("/api/guest", json={}).status_code for _ in range(config.MAX_GUESTS_PER_HOUR + 1)]
        self.assertEqual(codes[-1], 429)
        self.assertTrue(all(code == 200 for code in codes[:-1]))

    def test_old_guest_spaces_are_purged(self):
        fid = auth.sign_up_guest({"language": "en"})
        db.purge_guests(time.time() + 1)                                  # pretend a week has passed
        self.assertIsNone(db.family_by_id(fid))


if __name__ == "__main__":
    unittest.main()
