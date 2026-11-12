# Real-user test kit (about 15 minutes per person)

The rubric's Impact row needs a real user: a quote, a screenshot, or a before-and-after time. One to three people is
enough. Good testers: a family member, a classmate who rents, a friend starting a side business.

**Simplest way: let the app record it.** Testers click **🎟️ Guest / Beta mode** and ask their questions; nothing else
is needed. For guests only, the app saves on this computer: each question (private numbers masked), the answer, the
team, time and cost, the safety checks, what they clicked (tabs, topics, Daily Update, drafts, language, level) and
a 1–5 rating with an optional comment and "OK to quote" box shown under every answer. The guest screen says so. Then:

```bash
python docs/user_tests/export_beta.py --since "2026-11-12 05:30"
```

writes `docs/user_tests/results/beta_sessions-N.md` (not committed): a summary table, every comment, and each tester's
questions and answers. The log is kept even after guest spaces are deleted at 7 days.

**Optional, for before/after times:** `docs/user_tests/tester_sheet.html` has timers for the same question with and
without iConcierge, plus the follow-up questions. The steps below are that longer version.

## Before you start
- Start the app (`python run.py`) and open http://localhost:8765 on your computer.
- Each tester clicks **🎟️ Guest / Beta mode**: a fresh private space in one click, no account. Don't sign them out
  afterward; their run stays in the app's log, so the exact question, answer, time and cost can be pulled for the report.
- Tell them: "This is a class prototype. It gives general information, not legal, tax or investment advice. Please
  don't type real Social Security, account or card numbers; ranges and made-up numbers are fine."
- Ask: "May I quote you by first name (or anonymously) in my class report?"

## Task (before/after timing)
Pick one real question they actually have (examples: "Can I afford to move out?", "How much should I set aside for
taxes on my side gig?", "Should I pay off my card or save first?").

1. **Before (no iConcierge):** give them 5 minutes with a normal web search or a general chatbot. Start a timer.
   Stop when they say "I have an answer I'd act on," or at 5 minutes. Note what they found.
2. **After (iConcierge):** they ask the same question in iConcierge. Time from pressing Send to finishing reading the
   answer.

| Tester | Question | Before: time / confident? | After: time / confident? | Used a draft or to-do? |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

## Three questions afterward
1. "On a scale of 1–5, how useful was the answer? Why?"
2. "Was anything confusing or wrong?"
3. "Would you use this for a real decision? What would make you trust it more?"

Write down one sentence they say, word for word, and take one screenshot of their answer screen.

## Put it in the report
Add a short table and one or two quotes to section 7 (Impact) of `docs/report_src.html`, replace the "Real-user
evidence: not yet" paragraph, and run `python docs/build.py`. Keep it honest: report what didn't work, too.
