"""Summarize Guest / Beta test sessions from the app's log into a Markdown file for the report.

Run from the iConcierge folder:
    python docs/user_tests/export_beta.py                      # every guest session
    python docs/user_tests/export_beta.py --since "2026-11-12 05:00"

Writes docs/user_tests/results/beta_sessions-N.md (a new number each time; results/ is not committed to Git).
The log stays on this computer. It holds no names; private numbers in comments are masked when saved.
"""

from __future__ import annotations

import argparse
import datetime as dt
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from backend import db  # noqa: E402

ROLES = {"attorney": "Ava (Attorney)", "accountant": "Marcus (Accountant)", "investor": "Priya (Investor)",
         "housing": "Leo (Housing)", "benefits": "Grace (Benefits)", "assistant": "Ari (AI Assistant)"}


def when(ts: float) -> str:
    return dt.datetime.fromtimestamp(ts).strftime("%b %d, %I:%M %p").replace(" 0", " ")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", help='local time, e.g. "2026-11-12 05:00"')
    args = ap.parse_args()
    since = dt.datetime.strptime(args.since, "%Y-%m-%d %H:%M").timestamp() if args.since else 0
    db.init()
    rows = db.list_beta(since)
    sessions: dict[int, list[dict]] = defaultdict(list)
    for r in rows:
        sessions[r["family_id"]].append(r)

    out_dir = ROOT / "docs" / "user_tests" / "results"
    out_dir.mkdir(parents=True, exist_ok=True)
    k = 1
    while (out_dir / f"beta_sessions-{k}.md").exists():
        k += 1
    out = out_dir / f"beta_sessions-{k}.md"

    runs = [r for r in rows if r["kind"] == "run"]
    ratings = [r["data"].get("rating") for r in rows if r["kind"] == "feedback" and r["data"].get("rating")]
    secs = [r["data"].get("totals", {}).get("seconds") for r in runs if r["data"].get("totals", {}).get("seconds")]
    costs = [r["data"].get("totals", {}).get("cost") for r in runs if r["data"].get("totals", {}).get("cost") is not None]
    lines = [f"# iConcierge Guest / Beta sessions", "",
             f"Exported {dt.datetime.now():%B %d, %Y %I:%M %p}" + (f" · since {args.since}" if args.since else ""), "",
             "| Sessions | Questions | Avg. time to answer | Avg. cost per answer | Ratings (avg.) |",
             "|---|---|---|---|---|",
             f"| {len(sessions)} | {len(runs)} | {statistics.mean(secs):.1f} s | ${statistics.mean(costs):.4f} | "
             f"{(f'{statistics.mean(ratings):.1f} / 5 from {len(ratings)}' if ratings else 'none yet')} |" if runs else
             f"| {len(sessions)} | 0 | – | – | – |", ""]

    quotes = [r for r in rows if r["kind"] == "feedback" and r["data"].get("comment")]
    if quotes:
        lines += ["## Comments", ""]
        for q in quotes:
            ok = "OK to quote anonymously" if q["data"].get("quote_ok") else "not for quoting"
            lines.append(f"- {'★' * int(q['data'].get('rating') or 0)} “{q['data']['comment']}” ({ok}; tester {list(sessions).index(q['family_id']) + 1})")
        lines.append("")

    for n, (fid, events) in enumerate(sessions.items(), 1):
        start, end = events[0]["created_at"], events[-1]["created_at"]
        clicks = Counter(e["kind"] if e["kind"] != "tab" else "tab: " + str(e["data"].get("tab")) for e in events
                         if e["kind"] not in ("run", "feedback", "session_start"))
        lines += [f"## Tester {n} · {when(start)} · {round((end - start) / 60, 1)} min in the app", ""]
        fb = {e["run_id"]: e["data"] for e in events if e["kind"] == "feedback"}
        for q, e in enumerate([e for e in events if e["kind"] == "run"], 1):
            d, tot = e["data"], e["data"].get("totals", {})
            caught = sum(1 for c in d.get("checks", []) if c.get("status") == "caught")
            lines += [f"### Question {q}", "", f"> {d.get('question', '').strip()}", "",
                      f"- Team: Rosa + {', '.join(ROLES.get(s, s) for s in d.get('specialists', [])) or 'Captain only'}",
                      f"- {tot.get('seconds', d.get('wall_seconds', '?'))} s · {tot.get('calls', '?')} AI calls · ${tot.get('cost', 0):.4f} · "
                      f"{len(d.get('sources', []))} sources · {d.get('todos', 0)} to-dos · safety checks: {len(d.get('checks', []))} ran, {caught} caught something",
                      f"- Language {d.get('language')}, level {d.get('level')}"]
            f = fb.get(e["run_id"])
            if f:
                lines.append(f"- **Rating {f.get('rating')}/5**" + (f": “{f['comment']}”" if f.get("comment") else "") +
                             (" (OK to quote)" if f.get("quote_ok") else ""))
            answer = (d.get("answer") or "").strip()
            lines += ["", "<details><summary>Answer</summary>", "", answer, "", "</details>", ""]
        if clicks:
            lines += ["Also did: " + ", ".join(f"{k} ×{v}" for k, v in clicks.most_common()), ""]
    out.write_text("\n".join(lines), encoding="utf-8")
    print(out)


if __name__ == "__main__":
    main()
