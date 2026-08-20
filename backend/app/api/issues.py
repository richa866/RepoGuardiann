"""Issues API router: GET /issues, GET /issues/{number}
"""
from __future__ import annotations

import json
from fastapi import APIRouter, HTTPException

from app.db.database import get_active_repo, get_conn

router = APIRouter(tags=["issues"])


def _require_active_repo(explicit: str | None = None) -> str:
    repo = explicit or get_active_repo()
    if not repo:
        raise HTTPException(400, "no repo specified and no active repo configured")
    return repo


@router.get("/issues")
def list_issues(
    repo: str | None = None,
    state: str | None = None,
    category: str | None = None,
    sort: str = "updated_at",
    limit: int = 100,
    offset: int = 0,
):
    target = _require_active_repo(repo)
    conn = get_conn()
    query = """
        SELECT i.*,
               (SELECT categories FROM escalations e WHERE e.repo = i.repo AND e.issue_number = i.number
                ORDER BY e.id DESC LIMIT 1) AS latest_categories,
               (SELECT escalate FROM escalations e WHERE e.repo = i.repo AND e.issue_number = i.number
                ORDER BY e.id DESC LIMIT 1) AS latest_escalate,
               (SELECT explanation FROM escalations e WHERE e.repo = i.repo AND e.issue_number = i.number
                ORDER BY e.id DESC LIMIT 1) AS latest_explanation
        FROM issues i
        WHERE i.repo = ?
    """
    params: list = [target]
    if state:
        query += " AND i.state = ?"
        params.append(state)

    query += " ORDER BY i.updated_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    rows = [dict(r) for r in conn.execute(query, params).fetchall()]
    for r in rows:
        r["labels"] = json.loads(r["labels"] or "[]")
        r["latest_categories"] = json.loads(r["latest_categories"] or "[]")

    if category:
        rows = [r for r in rows if category in r["latest_categories"]]

    return {"repo": target, "issues": rows, "count": len(rows)}


@router.get("/issues/{number}")
def get_issue(number: int, repo: str | None = None):
    target = _require_active_repo(repo)
    conn = get_conn()
    issue_row = conn.execute(
        "SELECT * FROM issues WHERE repo = ? AND number = ?", (target, number)
    ).fetchone()
    if not issue_row:
        raise HTTPException(404, f"issue #{number} not found in {target}")
    issue = dict(issue_row)
    issue["labels"] = json.loads(issue["labels"] or "[]")

    comments = [dict(r) for r in conn.execute(
        "SELECT * FROM comments WHERE repo = ? AND issue_number = ? ORDER BY created_at ASC", (target, number)
    ).fetchall()]

    escalations = [dict(r) for r in conn.execute(
        "SELECT * FROM escalations WHERE repo = ? AND issue_number = ? ORDER BY id DESC", (target, number)
    ).fetchall()]
    for e in escalations:
        e["categories"] = json.loads(e["categories"] or "[]")
        e["evidence"] = json.loads(e["evidence_json"] or "{}")

    subtasks = [dict(r) for r in conn.execute(
        "SELECT * FROM subtasks WHERE repo = ? AND issue_number = ? ORDER BY id DESC", (target, number)
    ).fetchall()]

    feedback = [dict(r) for r in conn.execute(
        "SELECT * FROM feedback WHERE repo = ? AND issue_number = ? ORDER BY id DESC", (target, number)
    ).fetchall()]

    similar = []
    latest_escalation = escalations[0] if escalations else None
    if latest_escalation:
        similar = latest_escalation["evidence"].get("duplicate_check", {}).get("matches", [])

    return {
        "repo": target,
        "issue": issue,
        "comments": comments,
        "escalations": escalations,
        "similar_issues": similar,
        "subtasks": subtasks,
        "feedback": feedback,
    }
