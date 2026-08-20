"""Feedback API router: POST /issues/{number}/feedback, GET /issues/{number}/feedback.
Supports maintainer human-in-the-loop validation of agent escalations.
"""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.db.database import get_active_repo, get_conn, now_iso, tx

router = APIRouter(tags=["feedback"])


class FeedbackInput(BaseModel):
    verdict: Optional[str] = Field(default=None, description="'up', 'down', 'confirmed', 'dismissed'")
    vote: Optional[str] = Field(default=None, description="Alias for verdict ('up' or 'down')")
    note: Optional[str] = Field(default=None, description="Optional maintainer feedback note")
    escalation_id: Optional[int] = Field(default=None, description="Target escalation ID; looked up automatically if omitted")
    repo: Optional[str] = Field(default=None, description="Repository identifier")


class FeedbackRecord(BaseModel):
    id: int
    repo: str
    issue_number: int
    escalation_id: Optional[int] = None
    vote: str
    verdict: str
    note: Optional[str] = ""
    created_at: str


@router.post("/issues/{number}/feedback", response_model=FeedbackRecord)
def submit_feedback(number: int, body: FeedbackInput):
    """POST /issues/{number}/feedback
    Looks up the issue's latest escalation_id if omitted, inserts into feedback,
    updates escalations.human_override, and returns the full stored row.
    """
    # Accept verdict or vote
    raw_vote = body.verdict or body.vote
    if not raw_vote or raw_vote.lower() not in ("up", "down", "confirmed", "dismissed", "+1", "-1"):
        raise HTTPException(
            status_code=400,
            detail="Feedback verdict must be 'up', 'down', 'confirmed', or 'dismissed'",
        )

    # Normalize vote to 'up' or 'down'
    normalized_vote = "up" if raw_vote.lower() in ("up", "confirmed", "+1") else "down"
    override_status = "confirmed" if normalized_vote == "up" else "dismissed"

    target = body.repo or get_active_repo() or "encode/httpx"
    conn = get_conn()

    # Validate issue exists in repository
    issue_exists = conn.execute(
        "SELECT 1 FROM issues WHERE repo = ? AND number = ?", (target, number)
    ).fetchone()
    if not issue_exists:
        raise HTTPException(status_code=404, detail=f"Issue #{number} not found in {target}")

    # Look up latest escalation_id if not explicitly provided
    escalation_id = body.escalation_id
    if escalation_id is None:
        esc_row = conn.execute(
            "SELECT id FROM escalations WHERE repo = ? AND issue_number = ? ORDER BY id DESC LIMIT 1",
            (target, number),
        ).fetchone()
        if esc_row:
            escalation_id = esc_row["id"]

    created_ts = now_iso()
    with tx() as c:
        cur = c.execute(
            """
            INSERT INTO feedback (repo, issue_number, escalation_id, vote, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (target, number, escalation_id, normalized_vote, body.note or "", created_ts),
        )
        feedback_id = cur.lastrowid

        if escalation_id is not None:
            c.execute(
                "UPDATE escalations SET human_override = ? WHERE id = ? AND repo = ?",
                (override_status, escalation_id, target),
            )

    return FeedbackRecord(
        id=feedback_id,
        repo=target,
        issue_number=number,
        escalation_id=escalation_id,
        vote=normalized_vote,
        verdict=normalized_vote,
        note=body.note or "",
        created_at=created_ts,
    )


@router.get("/issues/{number}/feedback", response_model=list[FeedbackRecord])
def get_issue_feedback(number: int, repo: Optional[str] = None):
    """GET /issues/{number}/feedback
    Returns all feedback records recorded for a given issue.
    """
    target = repo or get_active_repo() or "encode/httpx"
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, repo, issue_number, escalation_id, vote, note, created_at FROM feedback WHERE repo = ? AND issue_number = ? ORDER BY id DESC",
        (target, number),
    ).fetchall()

    return [
        FeedbackRecord(
            id=r["id"],
            repo=r["repo"],
            issue_number=r["issue_number"],
            escalation_id=r["escalation_id"],
            vote=r["vote"],
            verdict=r["vote"],
            note=r["note"] or "",
            created_at=r["created_at"],
        )
        for r in rows
    ]
