# iConcierge: final project submission checklist

Checked against the requirements page on **2026-11-08**; updated **2026-11-10** (Daily Update, Guest mode, demo video); **2026-11-12** (real users, final checks; beta recording now off by default). **Due: Monday, Nov 23, 2026, 11:59 PM on Canvas.**
Submit on Canvas: the repo link, `report.html`, `slides.html` (and, optionally, a demo video).

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Repo public, **or** private with GitHub user `zlisto` added | ✅ | Public since 2026-11-19: https://github.com/nsteinyale/mgt409-iconcierge (history scanned first: no secrets or private data) |
| 2 | `README.md` explains the app and step-by-step run instructions | ✅ | README: run steps, data, tests, safety, layout |
| 3 | `.env.example` lists keys with no real values; no real `.env` or key committed | ✅ | `.env` is in `.gitignore`; secret scan found only the placeholder |
| 4 | Course key `PORTKEY_API_KEY` with `gpt-6-luna` only; exact key names | ✅ | `backend/config.py` |
| 5 | `.env` checked in the repo folder first, then one folder up | ✅ | Dry runs Nov 8 and Nov 12 with `.env` one folder up: key found |
| 6 | Fresh-clone dry run, running within 10 minutes | ✅ | Nov 12 (clone from GitHub, README only): install 2 min 3 s, all tests passing, Guest mode works, first answer 28 s later ($0.0018), Daily Update 7 tips; 2 min 40 s in all |
| 7 | Small test dataset if the real data is large | ✅ n/a | No large dataset. Demo files included: `output/demo_lease_with_hidden_text.pdf` |
| 8 | `report.html`: sections 1–8 in order, 10–15 printed pages, self-contained | ✅ | 13 printed pages (letter; sections flow without forced page breaks); all screenshots embedded |
| 9 | `slides.html`: reveal.js loaded from a CDN, 10 slides max, self-contained | ✅ | 10 slides; reveal.js 6.0.2 loads from the jsDelivr CDN, with an embedded copy of the same files as an offline fallback (tested both ways Nov 12) |
| 10 | Real evidence in each report row | ✅ | See below |
| 11 | Optional demo video (2–3 min) | ✅ | `docs/video/iconcierge_demo-5.mp4` (2:08, 1080p, narrated, captions burned in + `.srt`; recorded Nov 19 on the final version with Guest mode); script in `docs/video/narration.json` |

## Evidence by report row (the half-credit rule)

| Row (points) | Required evidence | Status |
|---|---|---|
| Motivation + what is new (8) | Named existing products | ✅ ChatGPT/Claude/Gemini, TurboTax, H&R Block, LegalZoom, Betterment, Wealthfront, Zillow, NerdWallet, 211, findhelp, New Haven Navigator |
| Agent design (10) | Traced real run with screenshots | ✅ Run 3 re-traced on the final version (Nov 12) with matching screenshots (13, 14); blind test team vs. one agent vs. plain model in section 7 and `docs/eval/` |
| Tokenomics (8) | Real token counts; cost per run, per user/month, at 100 and 10,000 users; cost cuts with evidence | ✅ 9 measured runs from the usage log; $1.83/month at 100 users, $183 at 10,000; −59% cost from reasoning-off + search cap; a "did any cut hurt performance?" row (numbers no, safety no, depth possibly, from the real user) |
| Safety (8) | Screenshot or test of a defense working | ✅ Hidden-text and injection screenshots; 46 offline tests (Nov 19); live red team 9/9 (final re-run Nov 19: 9/9) |
| Impact + metrics (5) | A real user (quote, screenshot or before/after time) | ✅ Two real users (Nov 12, Spanish, Guest mode with beta logging on): quotes, before/after times, both 5/5 useful and 5/5 trust; logged runs and interviews in `docs/user_tests/results/` (not committed) |
| Design (2) | Clean, readable, sharp screenshots | ✅ |

## Before submitting
1. ~~Run a real-user test~~ Done Nov 12 (tester 1). Done Nov 12 (tester 2) too. More testers are optional: set `ICONCIERGE_BETA=1`, restart, and Guest mode records them; run `python docs/user_tests/export_beta.py` and paste the results into section 7 of `docs/report_src.html`, then run `python docs/build.py`.
2. ~~Re-run the red team and tests~~ Done Nov 12: 9/9 and all tests. Re-run only if code changes again.
3. Invite `zlisto` (or make the repo public).
4. ~~Last dry run~~ Done Nov 12 (see row 6).
5. Open `report.html` and `slides.html` by double-click on a computer without the repo; check that every image shows.
6. Upload the repo link, `report.html` and `slides.html` to Canvas.
