"""Daily Update tests with a fake model (no API key needed). Run: python -m unittest discover tests"""

import asyncio
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

os.environ.setdefault("ICONCIERGE_DATA_DIR", tempfile.mkdtemp())
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend import auth, daily, db, llm  # noqa: E402

FAKE_TIPS = {"tips": [
    {"member": "captain", "opener": "Here is your plan for today:", "title": "Meet a counselor", "tip": "One option is a HUD-approved housing counselor.", "source_id": "hud-housing-counselor"},
    {"member": "accountant", "title": "Check withholding",
     "tip": "It can help to check withholding. Details at https://evil.example.com/claim now.", "source_id": "irs-withholding-estimator"},
    {"member": "investor", "title": "Compare savings", "tip": "One option is to compare savings choices.", "source_id": "made-up-source"},
    {"member": "intruder", "title": "Not on the team", "tip": "Wire money today.", "source_id": "cfpb-ask"},
]}


class DailyUpdate(unittest.TestCase):
    def setUp(self):
        db.init()
        self.calls = 0

        async def fake_chat(messages, **kw):
            self.calls += 1
            self.system = messages[0]["content"]
            return type("Msg", (), {"content": json.dumps(FAKE_TIPS)})(), {"cost": 0.0004, "seconds": 1.0}

        self._real = llm.chat
        llm.chat = fake_chat
        fid = auth.sign_up(f"daily-test-{id(self)}", "secret123", {"language": "en", "explain_level": "beginner"}, {"state": "CT"})
        row = db.family_by_id(fid)
        self.family = {"id": fid, "settings": json.loads(row["settings_json"]), "profile": json.loads(row["profile_json"])}

    def tearDown(self):
        llm.chat = self._real

    def test_guarded_and_cached(self):
        r = asyncio.run(daily.daily_update(self.family))
        members = [t["member"] for t in r["tips"]]
        self.assertEqual(members, ["captain", "accountant", "investor"])          # only real team members, in seat order
        tip = {t["member"]: t for t in r["tips"]}
        self.assertNotIn("evil.example.com", tip["accountant"]["tip"])              # output guard drops unvetted links
        self.assertEqual(tip["captain"]["source"]["id"], "hud-housing-counselor")
        self.assertIsNone(tip["investor"]["source"])                                 # unknown source ids are not shown
        self.assertIn("Options, not orders", self.system)
        self.assertEqual(tip["captain"]["opener"], "Here is your plan for today:")   # in-character first line
        self.assertIn("personality:", self.system)
        again = asyncio.run(daily.daily_update(self.family))
        self.assertEqual(self.calls, 1)                                              # one AI call per family per day
        self.assertEqual(again, r)

    def test_new_language_gets_its_own_update(self):
        asyncio.run(daily.daily_update(self.family))
        self.family["settings"]["language"] = "es"
        asyncio.run(daily.daily_update(self.family))
        self.assertEqual(self.calls, 2)
        self.assertIn("Spanish", self.system)


if __name__ == "__main__":
    unittest.main()
