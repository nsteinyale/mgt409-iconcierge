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

    def test_beta_log_records_guests_only(self):
        guest, member = TestClient(main.app), TestClient(main.app)
        g = guest.post("/api/guest", json={}).json()
        member.post("/api/signup", json={"handle": f"beta-member-{time.time_ns() % 10**8}", "passcode": "secret123"})
        since = time.time() - 1
        ok = guest.post("/api/beta", json={"kind": "feedback", "data": {"run_id": 7, "rating": 5,
                                                                      "comment": "Great. Card 4111 1111 1111 1111", "quote_ok": True}}).json()
        self.assertTrue(ok["ok"])
        self.assertFalse(guest.post("/api/beta", json={"kind": "anything", "data": {}}).json()["ok"])   # unknown kinds ignored
        self.assertFalse(member.post("/api/beta", json={"kind": "tab", "data": {"tab": "docs"}}).json()["ok"])  # accounts are not tracked
        logged = [r for r in db.list_beta(since) if r["kind"] == "feedback" and r["family_id"] == g["id"]]
        self.assertEqual(len(logged), 1)
        self.assertNotIn("4111", logged[0]["data"]["comment"])                   # private numbers masked
        self.assertEqual(logged[0]["run_id"], 7)

    def test_beta_log_survives_guest_purge(self):
        c = TestClient(main.app)
        g = c.post("/api/guest", json={}).json()
        c.post("/api/beta", json={"kind": "tab", "data": {"tab": "daily"}})
        db.purge_guests(time.time() + 1)
        self.assertIsNone(db.family_by_id(g["id"]))
        self.assertTrue(any(r["family_id"] == g["id"] for r in db.list_beta()))


if __name__ == "__main__":
    unittest.main()
