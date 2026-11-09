"""Daily Update: one short tip from each member of the round table, made once per family per day.

One AI call writes all seven tips (cheaper than seven calls). Tips are grounded in the vetted source library and the
family's profile, pass the same output guard as answers, and are cached until the date, language or
explanation level changes.
"""

from __future__ import annotations

import datetime
import json

from . import config, db, llm, safety, team, tools

MEMBERS = ["captain", *team.ROSTER]          # Captain + Ava, Marcus, Priya, Leo, Grace, Ari


def _sources_for(member: str) -> list[dict]:
    if member == "captain":
        return [s for s in tools.sources() if s["id"] in {"usa-benefits", "lsc-legal-aid", "irs-vita", "cfpb-ask",
                                                          "hud-housing-counselor", "investor-gov"}]
    return [s for s in tools.sources() if member in s["specialists"]]


async def daily_update(family: dict) -> dict:
    settings, profile = family["settings"], family["profile"]
    day = datetime.date.today().isoformat()
    lang = settings.get("language", "en")
    level = settings.get("explain_level", "beginner")
    cached = db.get_daily(family["id"], day, lang, level)
    if cached:
        return cached

    captain = settings.get("captain_name") or "Captain"
    members = "\n".join(
        f"- {m}: {captain if m == 'captain' else team.ROSTER[m]['name']}, "
        f"{'the Captain who coordinates the team' if m == 'captain' else team.ROSTER[m]['role'] + ' (' + team.ROSTER[m]['focus'][:140] + ')'}"
        f"\n  sources: " + "; ".join(f"[{s['id']}] {s['title']}: {s['summary']}" for s in _sources_for(m)[:8])
        for m in MEMBERS)
    level_rule = team.EXPLAIN_LEVELS.get(level, team.EXPLAIN_LEVELS["beginner"])
    system = f"""You write the Daily Update for a family's advisory team in the iConcierge app. Today is {day}.
Each team member offers ONE short, practical tip for this family today.
Team:
{members}

Rules:
- Options, not orders: phrase tips as ideas the family may consider ("One option is…", "It can help to…"); never "you should/must".
- Ground every tip in that member's listed sources and cite exactly one of them by id. Never invent programs, links or deadlines.
- Use only numbers that appear in the family profile or a listed source summary; otherwise use no numbers.
- Tie a tip to the time of year only if the listed source supports it. Do not claim news or recent events.
- Make tips fit the family profile when it helps; vary topics across members.
- {level_rule}
- Write in {config.LANGUAGES.get(lang, 'English')}. Title under 8 words, tip under 45 words.
Reply with JSON only: {{"tips": [{{"member": "<id>", "title": "...", "tip": "...", "source_id": "<id>"}}]}} with one tip per member, in this order: {", ".join(MEMBERS)}."""
    user = f"Family profile: {json.dumps(profile, ensure_ascii=False) or '{}'}"
    msg, usage = await llm.chat([{"role": "system", "content": system}, {"role": "user", "content": user}],
                                agent="daily", step="daily", run_id=None, family_id=family["id"],
                                json_mode=True, max_tokens=1800)
    data = llm.parse_json(msg.content)

    allowed = {u for s in tools.sources() for u in [s["url"], *s.get("aliases", [])]}
    blocked = safety.flagged_tokens(db.document_flags(family["id"]))
    by_member = {str(t.get("member", "")).lower(): t for t in data.get("tips") or [] if isinstance(t, dict)}
    tips = []
    for m in MEMBERS:
        t = by_member.get(m)
        if not t or not str(t.get("tip", "")).strip():
            continue
        title, _ = safety.check_output(str(t.get("title", ""))[:120], allowed, blocked, "daily title")
        text, findings = safety.check_output(str(t["tip"])[:600], allowed, blocked, "daily tip")
        for f in findings:
            db.log_safety(family["id"], None, f.layer, f.kind, f.detail)
        src = tools.source_by_id(str(t.get("source_id", "")))
        tips.append({"member": m, "title": title.strip(), "tip": text.strip(),
                     "source": {k: src[k] for k in ("id", "title", "agency", "url")} if src else None})
    result = {"day": day, "tips": tips, "cost": round(usage["cost"], 6), "seconds": usage["seconds"]}
    if tips:
        db.save_daily(family["id"], day, lang, level, result)
    return result
