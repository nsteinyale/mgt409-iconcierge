# iConcierge: Your Personal Family Office

Your family's team of AI advisors, one conversation away.

Sign in, talk to your **Captain**, and watch a team of AI specialists work on your question live:

| | Specialist | Works on | Tools |
|---|---|---|---|
| 🧭 | **Captain** (you pick the name, look and style) | Plans the work, assigns it, writes the final answer and to-dos | — |
| ⚖️ | Ava, Attorney | Leases, contracts, consumer rights, wills, free legal help | Official sources, family profile, documents |
| 🧮 | Marcus, Accountant | Taxes, budgets, debt payoff, emergency funds | 2026 tax estimator, budget, debt payoff, savings, mortgage |
| 📈 | Priya, Investor | Saving, retirement accounts, investing basics | Savings growth, emergency fund, debt payoff |
| 🏠 | Leo, Housing & Lifestyle | Rent vs. buy, mortgages, affordability, moving | Mortgage, affordability, rent vs. buy, budget |
| 🛡️ | Grace, Insurance & Benefits | Insurance, SNAP, Medicaid, Social Security, unemployment | Emergency fund, budget, official sources |
| ✉️ | Ari, My AI Assistant | Emails, letters and replies built on the team's findings | `draft_email` (drafts only: there is no send tool) |

**How a question moves:** the Captain plans and assigns up to 3 specialists → they work in parallel with their tools
→ each sends findings → teammates leave each other short notes (the "huddle") → the Captain combines everything
into options with numbers, trade-offs, sources and suggested to-dos. If the family wants something written, the
advisors hand their findings to **Ari**, who saves email drafts.

Every team member has a fictional, AI-generated portrait with an "AI" badge (sources in
`frontend/portraits/CREDITS.md`); drop a new photo named after an avatar id into `frontend/portraits/` to change one.

**The office** is a 3D round table: the team sits facing each other and every real event travels across the table
as a colored ping (assign = gold, calculator = blue, findings = green, huddle note = orange, hand-off to Ari =
purple) with speech bubbles. Teammates not on the question are dimmed, and **Replay** re-runs the last question's
events. The step-by-step feed stays underneath.

**Drafts** (✉️ tab): edit Ari's draft, then open it in Gmail, Outlook or your email app, copy it, or copy a ready
prompt for your own Claude or ChatGPT. **The app never sends email.** Direct Gmail/Outlook/Claude connections are
designed (sign-in, never a password) but marked "coming soon" because the course allows only the course key unless
the professor approves another.

Design rules: **options, not orders** (the family decides); **every number comes from code**, not the model;
**only vetted official sources can be cited** (`backend/sources.json`); uploaded documents are treated as data, never
as instructions. English, Español, 中文, Português, Français and বাংলা.

## Run it (about 5 minutes)

Needs Python 3.10+ (no Node). From this folder:

```bash
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

Put your key in a `.env` file **in this folder or the folder one level above it** (see `.env.example`):

```
PORTKEY_API_KEY=your-course-key
```

Then start it:

```bash
python run.py
```

Your browser opens http://127.0.0.1:8765. Click **Create a family account**, finish the 3 setup steps, then pick
a topic under **"What do you want help with?"** (starting a company, planning a move, investing, taxes, buying a
home, debt, insurance, legal letters) and send one of its example questions. A fresh-clone dry run on Nov 8, 2026
took 4 min 13 s to install and answered its first question 17 s later. (Set `ICONCIERGE_NO_BROWSER=1` to skip opening the browser.)

The app uses `gpt-6-luna` through the course Portkey key. With a personal `OPENAI_API_KEY` instead, set
`OPENAI_MODEL` too.

## Safety (Lecture 12)

Lecture 12's lesson: the model's training is "a soft defense, not a guarantee"; real defenses live in code and
are tested with booby-trapped inputs. iConcierge has four layers in `backend/safety.py`, and every time one
steps in, it shows live in **The office**, in a footer under each answer and in the **Safety** tab.

| Layer | What it stops | How |
|---|---|---|
| **1. Input guard** (before anything is stored or sent to the AI) | Social Security, card and account numbers, passwords | Redacted with patterns (cards checked with the Luhn test) |
| | Crisis messages | 988 / 911 / domestic-violence hotline answer **from code, with zero AI calls**, in 6 languages |
| | "Ignore your instructions" / system-prompt extraction | Flagged; the Captain is told its rules never change. The provider's own filter is a second layer, handled as a polite refusal |
| | Requests for fraud or tax evasion | Captain classifies the request; harmful ones get a refusal and no specialists |
| **2. Document guard** (at upload) | Hidden text in PDFs (the Froggy attack: white, tiny, transparent or off-page text) | Only text a person can see is kept (PyMuPDF reads each span's color and size); the hidden text is shown to the family, never to the AI |
| | Zero-width characters that hide instructions from filters | Stripped |
| | Visible instructions planted in a document ("wire $2,000 to…") | Line flagged and labeled as untrusted; document text is wrapped in random one-time markers so it can't fake its own end |
| **3. Output guard** (before anything is shown) | Links that could leak family data | Only the 42 vetted official sources can appear; any other link is removed |
| | Flagged document content echoed back | Sentences repeating amounts, account numbers, emails or links from flagged lines are dropped |
| | Private numbers in answers | Redacted again |
| **4. Audit** | Made-up numbers (the model "reward hacking" with plausible figures) | Every number in the answer is traced to a calculator result or the family's own figures; untraced ones are flagged for review |
| | "You should…" orders | Counted and flagged ("options, not orders") |
| **Containment** | Runaway cost or abuse | No internet or payment tools at all; each specialist only gets its own tools; limits per question (3 specialists, 4 tool rounds, 2 searches), 30 questions/hour and 30 uploads/day per family |

**Tested two ways:**

```bash
python -m unittest discover tests      # 31 tests, no API key: calculators, sign-in, drafts and attacks on every guard
python tests/redteam.py                # live attacks through the real AI team -> output/redteam_report.md
```

Live red-team result on 2026-11-07: **9 of 9 attacks stopped**, including a scam address planted for Ari's email
and a control question with no false alarms (full table in `output/redteam_report.md`). The red team caught two real
bugs: the "list documents" tool was handing the AI the hidden text it had just removed, and the number audit flagged
the family's own profile income range as made up. Both fixed, then re-tested. Try it yourself with
`output/demo_lease_with_hidden_text.pdf`, a lease with white text, 1.5-point text and a planted instruction.

## Data

Everything is stored locally in `data/iconcierge.sqlite3` (created on first run, not committed). Passcodes are
salted and hashed (PBKDF2, 200,000 rounds); five wrong passcodes lock a name for 15 minutes. To start over, stop the
app and delete the `data` folder. Test data only: the profile asks for ranges, never Social Security or account
numbers.

## Tests (no API key needed)

```bash
python -m unittest discover tests
```

Covers the 2026 tax brackets, mortgage, affordability and payoff math, tool permissions, sign-in (hashing,
lockout, validation) and attacks on every safety guard.

## Cost and speed (measured)

Each AI call is logged with its tokens and cost in the `usage` table (course prices: $0.10 / 1M input,
$0.01 / 1M cached input, $0.50 / 1M output). Measured runs on 2026-11-07:

| Question | Specialists | AI calls | Cost | Time |
|---|---|---|---|---|
| Can we afford a $350k home, and taxes? | 2 | 11 | $0.0019 | 24 s |
| Card debt vs. Roth IRA + renters insurance | 3 | 14 | $0.0027 | 22 s |
| Lease question with an uploaded document | 1 | 4 | $0.0010 | 14 s |

## Project layout

```
backend/
  main.py      web server: sign-in, profile, streamed team runs, to-dos, documents, usage
  team.py      Captain plan -> specialists with tools -> huddle -> Captain summary (event stream)
  tools.py     calculators, official-source search, profile and document tools, per-specialist permissions
  llm.py       the one place that calls the model; logs tokens, cost and time
  safety.py    input, document and output guards plus the number audit
  auth.py      passcode hashing, sessions, lockout
  db.py        SQLite tables
  sources.json vetted official sources (IRS, CFPB, HUD, SSA, legal aid...) with check dates
frontend/      plain HTML/CSS/JS: sign-in, setup wizard, chat, live office, to-dos, documents, profile
tests/         unit and attack tests (test_*.py) and the live red-team script (redteam.py)
output/        red-team report and a booby-trapped demo lease
docs/          report and slide sources (python docs/build.py rebuilds report.html and slides.html),
               screenshots, SUBMISSION_CHECKLIST.md, demo_video_script.md, real_user_test_kit.md
```

General information, not legal, tax or investment advice.
