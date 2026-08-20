"""Feedback API router: POST /issues/{number}/feedback, GET /issues/{number}/feedback.
Supports maintainer human-in-the-loop validation and structured override reasons.

Override reasons (from the Override Reason modal):
  - false_positive    → AI escalated an issue that is actually fine
  - wrong_category    → Escalated for the wrong reason/category
  - not_a_duplicate   → AI thought it was a duplicate, but it is not
  - low_priority      → Escalation is technically correct but not urgent right now
"""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.db.database import get_active_repo, get_effective_repo, get_conn, now_iso, tx

router = APIRouter(tags=["feedback"])

# Valid override reasons matching the UI modal buttons
OVERRIDE_REASONS = {
    "false_positive",
    "wrong_category",
    "not_a_duplicate",
    "low_priority",
}


# ─── Models ───────────────────────────────────────────────────────────────────

class FeedbackInput(BaseModel):
    verdict: Optional[str] = Field(default=None, description="'up', 'down', 'confirmed', 'dismissed'")
    vote: Optional[str] = Field(default=None, description="Alias for verdict ('up' or 'down')")
    note: Optional[str] = Field(default=None, description="Optional maintainer note")
    override_reason: Optional[str] = Field(
        default=None,
        description=(
            "Structured reason when overriding (vote='down'). "
            "One of: 'false_positive', 'wrong_category', 'not_a_duplicate', 'low_priority'"
        ),
    )
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
    override_reason: Optional[str] = None
    created_at: str


class OverrideStats(BaseModel):
    """Analytics breakdown of override reasons for the repo."""
    repo: str
    total_overrides: int
    breakdown: dict


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/issues/{number}/feedback", response_model=FeedbackRecord)
def submit_feedback(number: int, body: FeedbackInput):
    """POST /issues/{number}/feedback

    Handles two flows from the frontend:

    1. Simple thumbs-up confirm:
       { "vote": "up" }

    2. Override with reason (from the Override Reason modal):
       { "vote": "down", "override_reason": "false_positive", "note": "Looks fine to me" }

    Automatically:
    - Migrates the DB if override_reason column is missing.
    - Looks up the latest escalation_id if not provided.
    - Sets escalations.human_override to a rich status string:
        - "confirmed"                  → thumbs up
        - "overridden:false_positive"  → override with reason
        - "dismissed"                  → thumbs down, no reason
    """
    _ensure_override_reason_column()

    raw_vote = body.verdict or body.vote
    if not raw_vote or raw_vote.lower() not in ("up", "down", "confirmed", "dismissed", "+1", "-1"):
        raise HTTPException(
            status_code=400,
            detail="Feedback verdict must be 'up', 'down', 'confirmed', or 'dismissed'",
        )

    normalized_vote = "up" if raw_vote.lower() in ("up", "confirmed", "+1") else "down"

    # Validate override_reason if provided
    override_reason = body.override_reason
    if override_reason is not None:
        override_reason = override_reason.lower().replace(" ", "_")
        if override_reason not in OVERRIDE_REASONS:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Invalid override_reason '{override_reason}'. "
                    f"Must be one of: {sorted(OVERRIDE_REASONS)}"
                ),
            )
        # Override reasons always imply a down vote
        normalized_vote = "down"

    # Build human_override status string
    if normalized_vote == "up":
        override_status = "confirmed"
    elif override_reason:
        override_status = f"overridden:{override_reason}"   # e.g. "overridden:false_positive"
    else:
        override_status = "dismissed"

    target = get_effective_repo(body.repo)
    conn = get_conn()

    issue_exists = conn.execute(
        "SELECT 1 FROM issues WHERE repo = ? AND number = ?", (target, number)
    ).fetchone()
    if not issue_exists:
        raise HTTPException(status_code=404, detail=f"Issue #{number} not found in {target}")

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
            INSERT INTO feedback (repo, issue_number, escalation_id, vote, note, override_reason, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (target, number, escalation_id, normalized_vote, body.note or "", override_reason, created_ts),
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
        override_reason=override_reason,
        created_at=created_ts,
    )


@router.get("/issues/{number}/feedback", response_model=list[FeedbackRecord])
def get_issue_feedback(number: int, repo: Optional[str] = None):
    """GET /issues/{number}/feedback — returns all feedback records for an issue."""
    _ensure_override_reason_column()

    target = get_effective_repo(repo)
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT id, repo, issue_number, escalation_id, vote, note, override_reason, created_at
        FROM feedback
        WHERE repo = ? AND issue_number = ?
        ORDER BY id DESC
        """,
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
            override_reason=r["override_reason"],
            created_at=r["created_at"],
        )
        for r in rows
    ]


@router.get("/feedback/override-stats", response_model=OverrideStats)
def get_override_stats(repo: Optional[str] = None):
    """GET /feedback/override-stats

    Returns a breakdown of how often each override reason has been used.
    Useful for calibrating the AI — if 'false_positive' dominates,
    the triage thresholds are too aggressive.
    """
    _ensure_override_reason_column()

    target = get_effective_repo(repo)
    conn = get_conn()

    rows = conn.execute(
        """
        SELECT override_reason, COUNT(*) as cnt
        FROM feedback
        WHERE repo = ? AND override_reason IS NOT NULL
        GROUP BY override_reason
        ORDER BY cnt DESC
        """,
        (target,),
    ).fetchall()

    breakdown = {r["override_reason"]: r["cnt"] for r in rows}
    total = sum(breakdown.values())

    return OverrideStats(repo=target, total_overrides=total, breakdown=breakdown)


# ─── DB Migration Helper ──────────────────────────────────────────────────────

def _ensure_override_reason_column() -> None:
    """Add override_reason column to feedback table if it does not exist yet.
    Safe to call on every request — checks PRAGMA before ALTER TABLE.
    """
    conn = get_conn()
    cols = [row[1] for row in conn.execute("PRAGMA table_info(feedback)").fetchall()]
    if "override_reason" not in cols:
        with tx() as c:
            c.execute("ALTER TABLE feedback ADD COLUMN override_reason TEXT")
