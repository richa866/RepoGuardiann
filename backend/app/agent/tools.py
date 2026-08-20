"""The 6 independent, callable evidence-gathering tools used by the RepoGuardian agent.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone

from app.db.database import get_conn
from app.rag.retrieval import find_similar, get_decision_context

# Calibrated against real httpie/cli data (100 issues, see backend/scripts/test_rag.py),
# not guessed. 0.80 was too strict: it missed real duplicate PR clusters that use
# different wording for the same fix -- e.g. #1936 "Fixed URL-encoded characters in
# basic auth credentials" vs #1931 "Fix #1623: Decode percent-encoded characters in
# URL credentials" both fix the exact same bug (#1623) but only scored 75.2%/74.6%.
# Same pattern for the SSL/CA-cert fallback cluster (#1871/#1933/#1915, all fixing
# #1632/#480, 74-83%) and the pipx-install-docs cluster (#1892/#1905/#1907, #1907
# literally says "Closes #1905", 70.9-79.6%). 0.75 catches all of these while still
# staying above the one confirmed non-duplicate pair found in the same dataset --
# #1849 ("Fix option parsing after request arguments") vs #1852 ("Handle ASCII help
# output streams"), two genuinely different bugs that happen to share vocabulary
# (argparse, options) and sit at 72-73%.
DUPLICATE_SIMILARITY_THRESHOLD = 0.75
REGRESSION_SIMILARITY_THRESHOLD = 0.85
UNRESPONDED_URGENT_DAYS = 5
STALENESS_DAYS = 30

SECURITY_KEYWORDS = [
    r"\bcve-\d{4}-\d+\b",
    r"\brce\b",
    r"\bremote\s+code\s+execution\b",
    r"\barbitrary\s+code\b",
    r"\bsql\s*injection\b",
    r"\bxss\b",
    r"\bpath\s+traversal\b",
    r"\bcommand\s+injection\b",
    r"\bsecret\s+leak\b",
    r"\bcredential\b",
    r"\bauth\s+bypass\b",
    r"\bprivilege\s+escalation\b",
    r"\bdenial\s+of\s+service\b",
    r"\bzip\s*slip\b",
]
SECURITY_REGEX = re.compile("|".join(SECURITY_KEYWORDS), re.IGNORECASE)

CONTENTIOUS_TRIGGER_KEYWORDS = [
    r"\bdisagree\b",
    r"\bwontfix\b",
    r"\bwon't\s+fix\b",
    r"\bbreaking\s+change\b",
    r"\bdeprecat\w+\b",
    r"\brevert\b",
    r"\bnack\b",
    r"\bpushback\b",
    r"\bout\s+of\s+scope\b",
    r"\bnot\s+planned\b",
]
CONTENTIOUS_REGEX = re.compile("|".join(CONTENTIOUS_TRIGGER_KEYWORDS), re.IGNORECASE)


def _load_issue(repo: str, issue_number: int) -> dict | None:
    row = get_conn().execute(
        "SELECT * FROM issues WHERE repo = ? AND number = ?", (repo, issue_number)
    ).fetchone()
    if not row:
        return None
    d = dict(row)
    d["labels"] = json.loads(d["labels"] or "[]")
    return d


def _load_comments(repo: str, issue_number: int) -> list[dict]:
    rows = get_conn().execute(
        "SELECT * FROM comments WHERE repo = ? AND issue_number = ? ORDER BY created_at ASC",
        (repo, issue_number),
    ).fetchall()
    return [dict(r) for r in rows]


def duplicate_check(repo: str, issue_number: int, top_k: int = 5) -> dict:
    issue = _load_issue(repo, issue_number)
    if not issue:
        return {"error": f"issue #{issue_number} not found in {repo}", "is_duplicate": False, "matches": []}

    query = f"{issue['title']}\n\n{issue['body'] or ''}"
    raw_matches = find_similar(repo, query, top_k=top_k, exclude_number=issue_number)

    matches = []
    has_likely_dup = False
    has_regression = False

    decision_contexts = {
        c["number"]: c for c in get_decision_context(repo, [m["number"] for m in raw_matches])
    }

    for m in raw_matches:
        sim = m["similarity"]
        is_dup = sim >= DUPLICATE_SIMILARITY_THRESHOLD and m["state"] == "open"
        is_regr = sim >= REGRESSION_SIMILARITY_THRESHOLD and m["state"] == "closed"
        if is_dup:
            has_likely_dup = True
        if is_regr:
            has_regression = True
        ctx = decision_contexts.get(m["number"])
        matches.append({
            **m,
            "is_likely_duplicate": is_dup,
            "is_possible_regression": is_regr,
            "decision_excerpts": ctx["excerpts"] if ctx else [],
        })

    return {
        "repo": repo,
        "issue_number": issue_number,
        "is_likely_duplicate": has_likely_dup,
        "is_possible_regression": has_regression,
        "threshold_used": DUPLICATE_SIMILARITY_THRESHOLD,
        "matches": matches,
    }


def response_time_check(repo: str, issue_number: int) -> dict:
    issue = _load_issue(repo, issue_number)
    if not issue:
        return {"error": f"issue #{issue_number} not found in {repo}"}

    created_at_str = issue.get("created_at")
    if not created_at_str:
        return {"unresponded_days": 0, "is_urgent": False}

    created_at = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    days_open = (now - created_at).total_seconds() / 86400.0

    comments = _load_comments(repo, issue_number)
    author = issue.get("author")
    non_author_comments = [c for c in comments if c.get("author") != author]

    has_maintainer_reply = len(non_author_comments) > 0
    is_urgent = (
        days_open >= UNRESPONDED_URGENT_DAYS
        and not has_maintainer_reply
        and issue.get("state") == "open"
    )

    return {
        "repo": repo,
        "issue_number": issue_number,
        "days_open": round(days_open, 2),
        "total_comments": len(comments),
        "non_author_comments": len(non_author_comments),
        "has_maintainer_reply": has_maintainer_reply,
        "is_urgent": is_urgent,
    }


def security_keyword_check(repo: str, issue_number: int) -> dict:
    issue = _load_issue(repo, issue_number)
    if not issue:
        return {"error": f"issue #{issue_number} not found in {repo}", "is_security_sensitive": False}

    comments = _load_comments(repo, issue_number)
    texts = [issue.get("title", ""), issue.get("body") or ""] + [c.get("body") or "" for c in comments]
    combined = "\n".join(texts)

    found = list(set(m.group(0).lower() for m in SECURITY_REGEX.finditer(combined)))
    is_sec = len(found) > 0

    return {
        "repo": repo,
        "issue_number": issue_number,
        "is_security_sensitive": is_sec,
        "matched_keywords": found,
    }


def staleness_check(repo: str, issue_number: int) -> dict:
    issue = _load_issue(repo, issue_number)
    if not issue:
        return {"error": f"issue #{issue_number} not found in {repo}", "is_stale": False}

    updated_at_str = issue.get("updated_at") or issue.get("created_at")
    if not updated_at_str:
        return {"is_stale": False, "days_since_update": 0}

    updated_at = datetime.fromisoformat(updated_at_str.replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    days_since_update = (now - updated_at).total_seconds() / 86400.0

    labels = issue.get("labels", [])
    comments = _load_comments(repo, issue_number)

    is_stale = (
        days_since_update >= STALENESS_DAYS
        and len(labels) == 0
        and len(comments) == 0
        and issue.get("state") == "open"
    )

    return {
        "repo": repo,
        "issue_number": issue_number,
        "days_since_update": round(days_since_update, 2),
        "label_count": len(labels),
        "comment_count": len(comments),
        "is_stale": is_stale,
    }


def missing_info_check(repo: str, issue_number: int) -> dict:
    issue = _load_issue(repo, issue_number)
    if not issue:
        return {"error": f"issue #{issue_number} not found in {repo}", "is_missing_info": False}

    body = (issue.get("body") or "").lower()
    title = issue.get("title", "").lower()

    is_bug = "bug" in title or any("bug" in str(lbl).lower() for lbl in issue.get("labels", []))
    has_repro = any(k in body for k in ["reproduce", "repro", "steps to", "expected", "actual", "stack trace", "traceback"])
    has_env = any(k in body for k in ["os", "version", "python", "node", "environment", "browser", "commit", "build"])

    is_missing = is_bug and (not has_repro or not has_env)
    drafted = None
    if is_missing:
        missing_parts = []
        if not has_repro:
            missing_parts.append("minimal reproduction steps / expected vs actual behavior")
        if not has_env:
            missing_parts.append("environment details (OS, version, dependency list)")
        drafted = (
            f"Hi @{issue.get('author')}, thanks for opening this issue! To help maintainers investigate, "
            f"could you please provide: {' and '.join(missing_parts)}?"
        )

    return {
        "repo": repo,
        "issue_number": issue_number,
        "is_bug_report": is_bug,
        "has_reproduction_steps": has_repro,
        "has_environment_details": has_env,
        "is_missing_info": is_missing,
        "drafted_comment": drafted,
    }


def contentiousness_check(repo: str, issue_number: int) -> dict:
    issue = _load_issue(repo, issue_number)
    if not issue:
        return {"error": f"issue #{issue_number} not found in {repo}", "is_contentious": False}

    comments = _load_comments(repo, issue_number)
    participants = set()
    if issue.get("author"):
        participants.add(issue["author"])

    pushback_keywords_found = set()
    for c in comments:
        if c.get("author"):
            participants.add(c["author"])
        body = c.get("body") or ""
        for m in CONTENTIOUS_REGEX.finditer(body):
            pushback_keywords_found.add(m.group(0).lower())

    comment_count = len(comments)
    participant_count = len(participants)
    has_pushback = len(pushback_keywords_found) > 0

    is_contentious = (
        (comment_count >= 5 and participant_count >= 3)
        or (comment_count >= 3 and has_pushback)
        or len(pushback_keywords_found) >= 2
    )

    return {
        "repo": repo,
        "issue_number": issue_number,
        "comment_count": comment_count,
        "participant_count": participant_count,
        "has_pushback_language": has_pushback,
        "matched_pushback_keywords": list(pushback_keywords_found),
        "is_contentious": is_contentious,
    }


TOOL_REGISTRY = {
    "duplicate_check": duplicate_check,
    "response_time_check": response_time_check,
    "security_keyword_check": security_keyword_check,
    "staleness_check": staleness_check,
    "missing_info_check": missing_info_check,
    "contentiousness_check": contentiousness_check,
}
