"""Checks that need no API key: calculators, sign-in, tool permissions. Run: python -m unittest discover tests"""

import os
import sys
import tempfile
import unittest
from pathlib import Path

os.environ["ICONCIERGE_DATA_DIR"] = tempfile.mkdtemp(prefix="iconcierge-test-")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend import auth, db, tools  # noqa: E402

CTX = tools.ToolContext(family_id=0, profile={})


class Calculators(unittest.TestCase):
    def test_tax_single_2026(self):
        # $45,000 - $16,100 standard deduction = $28,900 taxable
        # 10% of 12,400 + 12% of 16,500 = 1,240 + 1,980 = 3,220
        r = tools.estimate_federal_income_tax(CTX, 45_000, "single")
        self.assertEqual(r["taxable_income"], 28_900)
        self.assertEqual(r["federal_income_tax_before_credits"], 3_220)
        self.assertEqual(r["marginal_rate"], "12%")

    def test_tax_married_joint_2026(self):
        # $120,000 - $32,200 = $87,800 -> 10% of 24,800 + 12% of 63,000 = 2,480 + 7,560 = 10,040
        r = tools.estimate_federal_income_tax(CTX, 120_000, "married_joint")
        self.assertEqual(r["federal_income_tax_before_credits"], 10_040)

    def test_tax_rejects_unknown_status(self):
        self.assertIn("error", tools.estimate_federal_income_tax(CTX, 50_000, "head_of_household"))

    def test_mortgage_payment(self):
        # $320,000 at 6.5% for 30 years -> about $2,022.62 principal and interest
        r = tools.mortgage_payment(CTX, 350_000, 30_000, 6.5, 30)
        self.assertAlmostEqual(r["monthly_principal_and_interest"], 2022.62, places=1)
        self.assertGreater(r["monthly_pmi"], 0)  # under 20% down

    def test_rate_given_as_fraction(self):
        a = tools.mortgage_payment(CTX, 350_000, 30_000, 6.5)
        b = tools.mortgage_payment(CTX, 350_000, 30_000, 0.065)
        self.assertEqual(a["monthly_total"], b["monthly_total"])

    def test_affordability_fits_budget(self):
        r = tools.home_affordability(CTX, 7_333, 0, 30_000, 6.5)
        pay = tools.mortgage_payment(CTX, r["max_home_price"], 30_000, 6.5)["monthly_total"]
        self.assertLessEqual(pay, r["max_monthly_housing_payment"] + 5)

    def test_loan_payoff(self):
        r = tools.loan_payoff(CTX, 8_000, 24, 350)
        self.assertEqual(r["months_to_pay_off"], 31)
        self.assertIn("error", tools.loan_payoff(CTX, 8_000, 24, 100))

    def test_savings_growth_zero_rate(self):
        r = tools.savings_growth(CTX, 1_000, 100, 0, 1)
        self.assertEqual(r["future_value"], 2_200)


class ToolPermissions(unittest.TestCase):
    def test_attorney_cannot_use_tax_tool(self):
        out = tools.run_tool("attorney", "estimate_federal_income_tax", '{"gross_income": 1}', CTX)
        self.assertIn("error", out)

    def test_only_the_assistant_may_draft(self):
        self.assertIn("error", tools.run_tool("attorney", "draft_email", '{"to": "x", "subject": "s", "body": "b"}', CTX))
        self.assertIn("draft_email", tools.TOOLSETS["assistant"])
        self.assertNotIn("estimate_federal_income_tax", tools.TOOLSETS["assistant"])

    def test_bad_arguments_become_error(self):
        out = tools.run_tool("accountant", "loan_payoff", "not json", CTX)
        self.assertIn("error", out)

    def test_every_source_has_https_url(self):
        for s in tools.sources():
            self.assertTrue(s["url"].startswith("https://"), s["id"])


class SignIn(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        db.init()

    def test_sign_up_and_in(self):
        fid = auth.sign_up("unit-family", "secret123", {}, {})
        self.assertEqual(auth.sign_in("Unit-Family", "secret123"), fid)
        with self.assertRaises(auth.AuthError):
            auth.sign_in("unit-family", "wrong-pass")

    def test_passcode_is_hashed(self):
        auth.sign_up("hash-check", "secret123", {}, {})
        row = db.family_by_handle("hash-check")
        self.assertNotIn("secret123", row["pass_hash"])

    def test_lockout_after_failures(self):
        auth.sign_up("lock-check", "secret123", {}, {})
        for _ in range(auth.LOCKOUT_FAILURES):
            with self.assertRaises(auth.AuthError):
                auth.sign_in("lock-check", "nope-nope")
        with self.assertRaises(auth.AuthError) as ctx:
            auth.sign_in("lock-check", "secret123")
        self.assertEqual(str(ctx.exception), "locked_out")

    def test_rejects_short_passcode_and_bad_handle(self):
        with self.assertRaises(auth.AuthError):
            auth.sign_up("ok-name", "123", {}, {})
        with self.assertRaises(auth.AuthError):
            auth.sign_up("x", "secret123", {}, {})


if __name__ == "__main__":
    unittest.main()
