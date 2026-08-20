"""Bonus feature: maintainer weekly brief -- one auto-generated summary
paragraph over recent escalations and health trend, backed by real DB data.
Degrades to a templated (non-LLM) paragraph if Gemini isn't configured or
errors, same pattern as app/agent.py.
"""
from __future__ import annotations

import json
import logging

from app.config import ConfigError, settings
from app.db.database import get_conn

logger = logging.getLogger("repoguardian.brief")


def _gather_stats(repo: str) -> dict:
    conn = get_conn()
    open_count = conn.execute(
        "SELECT COUNT(*) c FROM issues WHERE repo=? AND state='open'", (repo,)
    ).fetchone()["c"]
    closed_count = conn.execute(
        "SELECT COUNT(*) c FROM issues WHERE repo=? AND state='closed'", (repo,)
    ).fetchone()["c"]

    recent = [
        dict(r)
        for r in conn.execute(
            """SELECT e.*, i.title FROM escalations e
               JOIN issues i ON i.repo = e.repo AND i.number = e.issue_number
               WHERE e.repo = ? AND e.escalate = 1
               ORDER BY e.id DESC LIMIT 15""",
            (repo,),
        ).fetchall()
    ]
    for r in recent:
        r["categories"] = json.loads(r["categories"] or "[]")

    category_counts: dict[str, int] = {}
    for r in recent:
        for c in r["categories"]:
            category_counts[c] = category_counts.get(c, 0) + 1

    snapshot = conn.execute(
        "SELECT * FROM health_snapshots WHERE repo=? ORDER BY id DESC LIMIT 1", (repo,)
    ).fetchone()

    return {
        "repo": repo,
        "open_count": open_count,
        "closed_count": closed_count,
        "recent_escalations": recent,
        "category_counts": category_counts,
        "latest_snapshot": dict(snapshot) if snapshot else None,
    }


def _template_brief(stats: dict) -> str:
    cats = stats["category_counts"]
    cat_str = ", ".join(f"{v} {k}" for k, v in cats.items()) or "no active escalations"
    top = stats["recent_escalations"][:3]
    examples = "; ".join(f"#{r['issue_number']} ({r['title'][:40]})" for r in top) or "none"
    snap = stats["latest_snapshot"]
    trend = (
        f"Backlog is at {snap['backlog_size']} open issues with an average response time of "
        f"{snap['avg_response_time_hours']}h and a {snap['duplicate_rate']*100:.1f}% duplicate rate."
        if snap else "No health snapshot recorded yet."
    )
    return (
        f"This week: {stats['open_count']} open / {stats['closed_count']} closed issues tracked. "
        f"{len(stats['recent_escalations'])} recent escalations ({cat_str}). "
        f"Notable: {examples}. {trend}"
    )


def _llm_brief(stats: dict) -> str:
    from app.llm import synthesize_json

    prompt = f"""You are writing a one-paragraph weekly brief for open-source maintainers,
based on this real repository data (JSON):
{json.dumps(stats, indent=2, default=str)}

Write ONE plain-English paragraph (4-6 sentences) summarizing repo health and the most
important escalated issues this week. Cite specific issue numbers and numbers/metrics from
the data. Do not invent facts. Respond ONLY as JSON: {{"brief": "..."}}"""
    result = synthesize_json(prompt)
    return result["brief"]


def generate_brief(repo: str) -> dict:
    stats = _gather_stats(repo)
    try:
        settings.require_gemini()
        text = _llm_brief(stats)
        method = "gemini"
    except ConfigError:
        text = _template_brief(stats)
        method = "template-fallback"
    except Exception as exc:
        logger.warning("Gemini brief generation failed: %s", exc)
        text = _template_brief(stats)
        method = "template-fallback"

    return {"brief": text, "method": method, "stats": stats}
