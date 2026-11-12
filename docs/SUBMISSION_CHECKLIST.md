# iConcierge: final project submission checklist

Checked against the requirements page on **2026-11-08**; updated **2026-11-10** (Daily Update, Guest / Beta mode, demo video). **Due: Monday, Nov 23, 2026, 11:59 PM on Canvas.**
Submit on Canvas: the repo link, `report.html`, `slides.html` (and, optionally, a demo video).

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Repo public, **or** private with GitHub user `zlisto` added | ⏳ **To do** | Repo is private (`nsteinyale/mgt409-iconcierge`); invite `zlisto` before submitting |
| 2 | `README.md` explains the app and step-by-step run instructions | ✅ | README: run steps, data, tests, safety, layout |
| 3 | `.env.example` lists keys with no real values; no real `.env` or key committed | ✅ | `.env` is in `.gitignore`; secret scan found only the placeholder |
| 4 | Course key `PORTKEY_API_KEY` with `gpt-6-luna` only; exact key names | ✅ | `backend/config.py` |
| 5 | `.env` checked in the repo folder first, then one folder up | ✅ | Dry runs Nov 8 and Nov 12 with `.env` one folder up: key found |
| 6 | Fresh-clone dry run, running within 10 minutes | ✅ | Nov 12 (clone from GitHub, README only): install 2 min 3 s, 45 tests passing, Guest mode works, first answer 28 s later ($0.0018), Daily Update 7 tips; 2 min 40 s in all |
| 7 | Small test dataset if the real data is large | ✅ n/a | No large dataset. Demo files included: `output/demo_lease_with_hidden_text.pdf` |
| 8 | `report.html`: sections 1–8 in order, 10–15 printed pages, self-contained | ✅ | 15 printed pages (letter), the maximum: trim before adding anything; all screenshots embedded |
| 9 | `slides.html`: reveal.js, 10 slides max, self-contained | ✅ | 10 slides; reveal.js 6.0.2 inlined so it opens offline by double-click (the page suggests a CDN; inlining is the same library and avoids a blank deck without internet) |
| 10 | Real evidence in each report row | ✅ | See below |
| 11 | Optional demo video (2–3 min) | ✅ | `docs/video/iconcierge_demo-2.mp4` (2:04, 1080p, narrated, captions burned in + `.srt`); script in `docs/video/narration.json` |

## Evidence by report row (the half-credit rule)

| Row (points) | Required evidence | Status |
|---|---|---|
| Motivation + what is new (8) | Named existing products | ✅ ChatGPT/Claude/Gemini, TurboTax, H&R Block, LegalZoom, Betterment, Wealthfront, Zillow, NerdWallet, 211, findhelp, New Haven Navigator |
| Agent design (10) | Traced real run with screenshots | ✅ Run 3 traced step by step; round-table, answer and drafts screenshots |
| Tokenomics (8) | Real token counts; cost per run, per user/month, at 100 and 10,000 users; cost cuts with evidence | ✅ 9 measured runs from the usage log; $1.83/month at 100 users, $183 at 10,000; −59% cost from reasoning-off + search cap |
| Safety (8) | Screenshot or test of a defense working | ✅ Hidden-text and injection screenshots; 39 offline tests (Nov 10); live red team 9/9 (re-run Nov 12: 9/9) |
| Impact + metrics (5) | A real user (quote, screenshot or before/after time) | ✅ Tester 1 (Nov 12, Spanish, Guest / Beta mode): quote, before/after ("a few more weeks" of Google vs. 27–166 s per answer), 5/5 useful, 5/5 trust; logged run data in `docs/user_tests/results/` (not committed) |
| Design (2) | Clean, readable, sharp screenshots | ✅ |

## Before submitting
1. ~~Run a real-user test~~ Done Nov 12 (tester 1). More testers are optional: Guest / Beta mode records them; run `python docs/user_tests/export_beta.py` and paste the results into section 7 of `docs/report_src.html`, then run `python docs/build.py`.
2. ~~Re-run the red team and tests~~ Done Nov 12: 9/9 and 45/45. Re-run only if code changes again.
3. Invite `zlisto` (or make the repo public).
4. ~~Last dry run~~ Done Nov 12 (see row 6).
5. Open `report.html` and `slides.html` by double-click on a computer without the repo; check that every image shows.
6. Upload the repo link, `report.html` and `slides.html` to Canvas.
