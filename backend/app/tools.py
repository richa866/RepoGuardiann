"""Agent tools. Each function is an independent, callable check against real
data (DB + RAG) that returns structured evidence -- never a vague verdict.
app/agent.py calls these individually (real multi-step tool use) and only
then asks the LLM to synthesize their outputs into one decision.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone

from app.database import get_conn
from app.rag import find_similar

SECURITY_KEYWORDS = [
    "security", "vulnerability", "cve", "exploit", "rce",
    "remote code execution", "injection", "xss", "csrf", "privilege escalation",
    "credential", "secrets leak", "arbitrary code",
]

STALE_DAYS = 30
NO_RESPONSE_DAYS = 5
DUPLICATE_SIMILARITY_THRESHOLD = 0.80
REGRESSION_SIMILARITY_THRESHOLD = 0.85

REPRO_HINTS = ["steps to reproduce", "repro", "how to reproduce", "expected", "actual"]
ENV_HINTS = ["version", "os:", "environment", "node", "python", "browser", "os "]

CONTENTIOUS_MIN_COMMENTS = 5
CONTENTIOUS_MIN_PARTICIPANTS = 3
CONTENTIOUS_KEYWORDS = [
    "disagree", "strongly oppose", "strongly disagree", "-1", "nack",
    "wontfix", "won't fix", "push back", "pushback", "not a fan of this",
    "against this", "hard no", "close this", "this is wrong", "i object",
]


def _parse_dt(s: str | None) -> datetime | None:
    if not s:
        return None
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def _get_issue(repo: str, number: int) -> dict | None:
    row = get_conn().execute(
        "SELECT * FROM issues WHERE repo = ? AND number = ?", (repo, number)
    ).fetchone()
    return dict(row) if row else None


def _get_comments(repo: str, number: int) -> list[dict]:
    rows = get_conn().execute(
        "SELECT * FROM comments WHERE repo = ? AND issue_number = ? ORDER BY created_at ASC",
        (repo, number),
    ).fetchall()
    return [dict(r) for r in rows]


def duplicate_check(repo: str, issue_number: int, top_k: int = 5) -> dict:
    """Embedding similarity search against historical issues in the same repo.
    Flags possible duplicate/regression and surfaces maintainer resolution
    notes on matches."""
    issue = _get_issue(repo, issue_number)
    if not issue:
        return {"tool": "duplicate_check", "error": "issue not found"}

    matches = find_similar(repo, issue_number, issue["title"], issue["body"], top_k=top_k)
    best = matches[0] if matches else None

    is_duplicate = bool(best and best["similarity"] >= DUPLICATE_SIMILARITY_THRESHOLD)
    is_regression = bool(
        best
        and best["state"] == "closed"
        and best["similarity"] >= REGRESSION_SIMILARITY_THRESHOLD
    )

    return {
        "tool": "duplicate_check",
        "matches": matches,
        "best_match": best,
        "is_likely_duplicate": is_duplicate,
        "is_possible_regression": is_regression,
        "threshold_duplicate": DUPLICATE_SIMILARITY_THRESHOLD,
        "threshold_regression": REGRESSION_SIMILARITY_THRESHOLD,
    }


def response_time_check(repo: str, issue_number: int) -> dict:
    """Time since last maintainer/community activity, and whether multiple
    similar reports exist with no reply -- the 'urgent' escalation signal."""
    issue = _get_issue(repo, issue_number)
    if not issue:
        return {"tool": "response_time_check", "error": "issue not found"}

    comments = _get_comments(repo, issue_number)
    created = _parse_dt(issue["created_at"])
    now = datetime.now(timezone.utc)

    last_activity = _parse_dt(issue["updated_at"]) or created
    days_since_activity = (now - last_activity).days if last_activity else None
    has_comments = len(comments) > 0

    similar = find_similar(repo, issue_number, issue["title"], issue["body"], top_k=5)
    similar_open_reports = [
        m for m in similar if m["similarity"] >= DUPLICATE_SIMILARITY_THRESHOLD and m["state"] == "open"
    ]

    no_response_days = (now - created).days if (not has_comments and created) else 0
    is_urgent = (
        not has_comments
        and no_response_days >= NO_RESPONSE_DAYS
        and len(similar_open_reports) >= 1
        and issue["state"] == "open"
    )

    return {
        "tool": "response_time_check",
        "days_since_last_activity": days_since_activity,
        "days_without_response": no_response_days,
        "comment_count": len(comments),
        "similar_open_report_numbers": [m["number"] for m in similar_open_reports],
        "is_urgent_no_response": is_urgent,
        "threshold_days": NO_RESPONSE_DAYS,
    }


def security_keyword_check(repo: str, issue_number: int) -> dict:
    """Keyword scan over title+body+comments. Security signals override
    everything else regardless of other checks."""
    issue = _get_issue(repo, issue_number)
    if not issue:
        return {"tool": "security_keyword_check", "error": "issue not found"}

    comments = _get_comments(repo, issue_number)
    haystacks = {
        "title": issue["title"] or "",
        "body": issue["body"] or "",
        **{f"comment_{i}": c["body"] or "" for i, c in enumerate(comments)},
    }

    hits = []
    for field, text in haystacks.items():
        low = text.lower()
        for kw in SECURITY_KEYWORDS:
            if kw in low:
                idx = low.find(kw)
                snippet = text[max(0, idx - 30): idx + len(kw) + 30]
                hits.append({"field": field, "keyword": kw, "snippet": snippet.strip()})

    return {
        "tool": "security_keyword_check",
        "is_security_sensitive": len(hits) > 0,
        "hits": hits,
    }


def staleness_check(repo: str, issue_number: int) -> dict:
    """Open 30+ days, no labels, no comments -> needs-triage signal."""
    issue = _get_issue(repo, issue_number)
    if not issue:
        return {"tool": "staleness_check", "error": "issue not found"}

    import json as _json
    labels = _json.loads(issue["labels"] or "[]")
    comments = _get_comments(repo, issue_number)
    created = _parse_dt(issue["created_at"])
    age_days = (datetime.now(timezone.utc) - created).days if created else 0

    is_stale = (
        issue["state"] == "open"
        and age_days >= STALE_DAYS
        and len(labels) == 0
        and len(comments) == 0
    )

    return {
        "tool": "staleness_check",
        "age_days": age_days,
        "label_count": len(labels),
        "comment_count": len(comments),
        "is_stale_needs_triage": is_stale,
        "threshold_days": STALE_DAYS,
    }


def missing_info_check(repo: str, issue_number: int) -> dict:
    """Checks whether a bug report is missing repro steps or env/version info,
    and drafts (never sends) a follow-up comment asking for it."""
    issue = _get_issue(repo, issue_number)
    if not issue:
        return {"tool": "missing_info_check", "error": "issue not found"}

    import json as _json
    labels = [l.lower() for l in _json.loads(issue["labels"] or "[]")]
    body_low = (issue["body"] or "").lower()
    looks_like_bug = "bug" in labels or bool(
        re.search(r"\b(bug|error|crash|fails?|broken|exception)\b", (issue["title"] or "").lower())
    )

    has_repro = any(h in body_low for h in REPRO_HINTS)
    has_env = any(h in body_low for h in ENV_HINTS)

    missing_repro = looks_like_bug and not has_repro
    missing_env = looks_like_bug and not has_env
    needs_more_info = missing_repro or missing_env

    draft = None
    if needs_more_info:
        asks = []
        if missing_repro:
            asks.append("clear steps to reproduce (what you did, what you expected, what happened instead)")
        if missing_env:
            asks.append("environment/version details (OS, package/app version, browser if relevant)")
        draft = (
            f"Thanks for the report! To help us triage this, could you share {', and '.join(asks)}? "
            "This will let a maintainer reproduce and fix the issue faster."
        )

    return {
        "tool": "missing_info_check",
        "looks_like_bug_report": looks_like_bug,
        "has_repro_steps": has_repro,
        "has_env_info": has_env,
        "needs_more_info": needs_more_info,
        "drafted_followup_comment": draft,
    }


def contentiousness_check(repo: str, issue_number: int) -> dict:
    """Flags issues with active maintainer/community disagreement: many
    distinct participants going back and forth, or explicit pushback
    language (disagree, wontfix, nack, ...) in the discussion."""
    issue = _get_issue(repo, issue_number)
    if not issue:
        return {"tool": "contentiousness_check", "error": "issue not found"}

    comments = _get_comments(repo, issue_number)
    participants = {c["author"] for c in comments if c["author"]} | ({issue["author"]} if issue["author"] else set())
    distinct_participants = len(participants)

    hits = []
    for i, c in enumerate(comments):
        text = c["body"] or ""
        low = text.lower()
        for kw in CONTENTIOUS_KEYWORDS:
            if kw in low:
                idx = low.find(kw)
                snippet = text[max(0, idx - 30): idx + len(kw) + 30]
                hits.append({"comment_index": i, "author": c["author"], "keyword": kw, "snippet": snippet.strip()})

    has_volume_signal = (
        len(comments) >= CONTENTIOUS_MIN_COMMENTS and distinct_participants >= CONTENTIOUS_MIN_PARTICIPANTS
    )
    is_contentious = has_volume_signal or len(hits) > 0

    return {
        "tool": "contentiousness_check",
        "comment_count": len(comments),
        "distinct_participants": distinct_participants,
        "participants": sorted(participants),
        "pushback_hits": hits,
        "is_contentious": is_contentious,
        "threshold_comments": CONTENTIOUS_MIN_COMMENTS,
        "threshold_participants": CONTENTIOUS_MIN_PARTICIPANTS,
    }


ALL_TOOLS = {
    "duplicate_check": duplicate_check,
    "response_time_check": response_time_check,
    "security_keyword_check": security_keyword_check,
    "staleness_check": staleness_check,
    "missing_info_check": missing_info_check,
    "contentiousness_check": contentiousness_check,
}
