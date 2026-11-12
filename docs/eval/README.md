# Team vs. one agent vs. plain model: blind test (Nov 12, 2026)

The report's 9 measured questions, answered three ways on gpt-6-luna:
**team** (iConcierge), **solo** (one agent with every calculator, the source library and the same output guard) and
**plain** (the bare model with the question and the family's details; no tools, no guards).

- `compare_run.py` runs all three and records answers plus code checks (cost, time, links, figures not traced to a
  tool or the family, planted-text echoes). Run from the repo with the app running: `python docs/eval/compare_run.py`
  (it uses the course key; about $0.03).
- `make_packet.py` shuffles each question's answers into A/B/C for a blind grader and keeps the key apart.
- `results_round1.json`, `results_round2.json`: all 54 answers and their code checks.
- `scores_round*.json` + `key_round*.json`: the blind grades and the label key.

| | Team | One agent, same tools | Plain model |
|---|---|---|---|
| Blind score /25 (round 1 / 2) | 19.9 / 19.7 | **22.2 / 22.0** | 20.3 / 19.3 |
| Best of three, of 9 questions | 0 / 1 | **5 / 5** | 4 / 3 |
| Cost per question (round 1) | $0.0020 | $0.0005 | $0.0007 |

Between the rounds three bugs found by round 1 were fixed (answer in the question's language; the Captain may not do
its own arithmetic; the payoff calculator overstated interest on a partial last payment). The plain model's round-2
replies came from the gateway's cache (identical prompts), so its timings use round 1. Nine questions and one grader
per round are a small test.
