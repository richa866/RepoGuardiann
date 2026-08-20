"""Feedback API router: POST /issues/{number}/feedback
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.database import get_active_repo, get_conn, now_iso, tx

router = APIRouter(tags=["feedback"])


class FeedbackIn(BaseModel):
    vote: str  # "up" | "down"
    escalation_id: int | None = None
    note: str | None = None
    repo: str | None = None


@router.post("/issues/{number}/feedback")
def submit_feedback(number: int, body: FeedbackIn):
    if body.vote not in ("up", "down"):
        raise HTTPException(400, "vote must be 'up' or 'down'")

    target = body.repo or get_active_repo()
    if not target:
        raise HTTPException(400, "no repo specified and no active repo configured")

    conn = get_conn()
    issue_exists = conn.execute(
        "SELECT 1 FROM issues WHERE repo = ? AND number = ?", (target, number)
    ).fetchone()
    if not issue_exists:
        with tx() as c:
            c.execute(
                "INSERT OR IGNORE INTO issues (repo, number, title, body, state, author, labels, comments_count, created_at, updated_at, last_synced_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (target, number, f"Issue #{number}", "", "open", "maintainer", "[]", 0, now_iso(), now_iso(), now_iso())
            )

    with tx() as c:
        cur = c.execute(
            "INSERT INTO feedback (repo, issue_number, escalation_id, vote, note, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (target, number, body.escalation_id, body.vote, body.note, now_iso()),
        )
        if body.escalation_id is not None:
            override = "confirmed" if body.vote == "up" else "dismissed"
            c.execute(
                "UPDATE escalations SET human_override = ? WHERE id = ? AND repo = ?",
                (override, body.escalation_id, target),
            )
        feedback_id = cur.lastrowid

    return {"id": feedback_id, "repo": target, "issue_number": number, "vote": body.vote, "recorded_at": now_iso()}
