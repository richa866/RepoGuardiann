"""Issues API router: GET /issues, GET /issues/{number}, POST /issues/{number}/feedback.
Implements exact CONTRACTS.md REST specifications with Pydantic response validation.
"""
from __future__ import annotations

import json
from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.db.database import get_active_repo, get_conn, now_iso, tx

router = APIRouter(tags=["issues"])


# --- Pydantic Models ---

class EscalationSummary(BaseModel):
    id: Optional[int] = None
    escalate: Optional[int] = None
    categories: list[str] = Field(default_factory=list)
    explanation: Optional[str] = None
    explanation_excerpt: Optional[str] = None
    drafted_comment: Optional[str] = None
    human_override: Optional[str] = None
    created_at: Optional[str] = None


class IssueListItem(BaseModel):
    number: int
    title: str
    state: str
    category: Optional[str] = None
    categories: list[str] = Field(default_factory=list)
    escalate: Optional[int] = None
    explanation_excerpt: Optional[str] = None
    updated_at: Optional[str] = None
    created_at: Optional[str] = None
    closed_at: Optional[str] = None
    repo: str
    is_pr: bool = False
    author: Optional[str] = "unknown"
    labels: list[str] = Field(default_factory=list)
    comments_count: int = 0
    url: Optional[str] = None
    escalation: Optional[EscalationSummary] = None


class IssueListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    repo: str
    issues: list[IssueListItem]


class CommentModel(BaseModel):
    id: Optional[int] = None
    github_comment_id: Optional[int] = None
    author: str
    body: str
    created_at: Optional[str] = None
    is_maintainer: int = 0


class SubtaskModel(BaseModel):
    id: int
    task_type: str
    status: str
    result: Optional[dict[str, Any]] = None
    finished_at: Optional[str] = None
    created_at: Optional[str] = None


class FeedbackModel(BaseModel):
    id: int
    escalation_id: Optional[int] = None
    vote: str
    note: Optional[str] = None
    created_at: Optional[str] = None


class IssueDetailRecord(BaseModel):
    repo: str
    number: int
    title: str
    body: Optional[str] = ""
    state: str
    is_pr: bool = False
    author: Optional[str] = "unknown"
    labels: list[str] = Field(default_factory=list)
    comments_count: int = 0
    url: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    closed_at: Optional[str] = None


class IssueDetailResponse(BaseModel):
    issue: IssueDetailRecord
    comments: list[CommentModel] = Field(default_factory=list)
    escalation: Optional[EscalationSummary] = None
    escalations: list[EscalationSummary] = Field(default_factory=list)
    subtasks: list[SubtaskModel] = Field(default_factory=list)
    feedback: list[FeedbackModel] = Field(default_factory=list)
    similar_issues: list[dict[str, Any]] = Field(default_factory=list)


class FeedbackCreateRequest(BaseModel):
    repo: Optional[str] = None
    escalation_id: Optional[int] = None
    vote: str  # "up" | "down"
    note: Optional[str] = None


class FeedbackCreateResponse(BaseModel):
    status: str = "ok"
    feedback_id: int
    message: str = "Feedback successfully recorded"


# --- Helpers ---

def _require_active_repo(explicit: str | None = None) -> str:
    repo = explicit or get_active_repo()
    if not repo:
        repo = "encode/httpx"
    return repo


def _parse_json_field(val: Any, default: Any) -> Any:
    if not val:
        return default
    if isinstance(val, (list, dict)):
        return val
    try:
        return json.loads(val)
    except Exception:
        return default


# --- Endpoints ---

@router.get("/issues", response_model=IssueListResponse)
def list_issues(
    repo: Optional[str] = None,
    state: Optional[str] = Query(default="all", description="'open', 'closed', or 'all'"),
    category: Optional[str] = Query(default=None, description="Filter by escalation category"),
    escalated: Optional[int] = Query(default=None, description="1 for escalated, 0 for non-escalated"),
    sort: Optional[str] = Query(default="updated_at desc", description="Sort order (e.g., 'updated_at desc', 'created_at desc', 'escalated_first')"),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """GET /issues
    Returns paginated, filterable issues with LEFT JOIN to latest escalations row.
    """
    target = _require_active_repo(repo)
    conn = get_conn()

    # Base query with LEFT JOIN on the latest escalation row
    query = """
        SELECT
            i.repo,
            i.number,
            i.title,
            i.body,
            i.state,
            i.is_pr,
            i.author,
            i.labels,
            i.comments_count,
            i.url,
            i.created_at,
            i.updated_at,
            i.closed_at,
            e.id AS escalation_id,
            e.escalate AS escalation_escalate,
            e.categories AS escalation_categories,
            e.explanation AS escalation_explanation,
            e.drafted_comment AS escalation_drafted_comment,
            e.human_override AS escalation_human_override,
            e.created_at AS escalation_created_at
        FROM issues i
        LEFT JOIN (
            SELECT e1.*
            FROM escalations e1
            INNER JOIN (
                SELECT repo, issue_number, MAX(id) AS max_id
                FROM escalations
                GROUP BY repo, issue_number
            ) e2 ON e1.repo = e2.repo AND e1.issue_number = e2.issue_number AND e1.id = e2.max_id
        ) e ON i.repo = e.repo AND i.number = e.issue_number
        WHERE i.repo = ?
    """
    params: list[Any] = [target]

    if state and state.lower() != "all":
        query += " AND i.state = ?"
        params.append(state.lower())

    if escalated is not None:
        if escalated == 1:
            query += " AND e.escalate = 1"
        else:
            query += " AND (e.escalate = 0 OR e.escalate IS NULL)"

    # Sorting
    sort_clean = (sort or "").lower().strip()
    if sort_clean in ("escalated_first", "escalated"):
        query += " ORDER BY COALESCE(e.escalate, 0) DESC, i.updated_at DESC"
    elif sort_clean in ("created_desc", "created_at desc", "newest"):
        query += " ORDER BY i.created_at DESC"
    elif sort_clean in ("created_asc", "created_at asc", "oldest"):
        query += " ORDER BY i.created_at ASC"
    elif sort_clean in ("comments_desc", "comment_count desc", "most_discussed"):
        query += " ORDER BY i.comments_count DESC"
    else:  # default updated_at desc
        query += " ORDER BY i.updated_at DESC"

    # Query all matching for category post-filtering / count
    all_rows = [dict(r) for r in conn.execute(query, params).fetchall()]

    # Process rows
    processed_items: list[IssueListItem] = []
    for r in all_rows:
        cats = _parse_json_field(r.get("escalation_categories"), [])
        if category and category not in cats:
            continue

        raw_labels = _parse_json_field(r.get("labels"), [])
        expl = r.get("escalation_explanation")
        expl_excerpt = None
        if expl:
            first_line = expl.strip().split("\n")[0]
            expl_excerpt = (first_line[:120] + "...") if len(first_line) > 120 else first_line

        escalation_obj = None
        if r.get("escalation_id") is not None:
            escalation_obj = EscalationSummary(
                id=r["escalation_id"],
                escalate=r.get("escalation_escalate"),
                categories=cats,
                explanation=expl,
                explanation_excerpt=expl_excerpt,
                drafted_comment=r.get("escalation_drafted_comment"),
                human_override=r.get("escalation_human_override"),
                created_at=r.get("escalation_created_at"),
            )

        item = IssueListItem(
            number=r["number"],
            title=r["title"] or "",
            state=r["state"] or "open",
            category=cats[0] if cats else None,
            categories=cats,
            escalate=r.get("escalation_escalate"),
            explanation_excerpt=expl_excerpt,
            updated_at=r.get("updated_at"),
            created_at=r.get("created_at"),
            closed_at=r.get("closed_at"),
            repo=r["repo"],
            is_pr=bool(r.get("is_pr", False)),
            author=r.get("author") or "unknown",
            labels=raw_labels,
            comments_count=int(r.get("comments_count", 0)),
            url=r.get("url"),
            escalation=escalation_obj,
        )
        processed_items.append(item)

    total_count = len(processed_items)
    paginated_items = processed_items[offset : offset + limit]

    return IssueListResponse(
        total=total_count,
        limit=limit,
        offset=offset,
        repo=target,
        issues=paginated_items,
    )


@router.get("/issues/{number}", response_model=IssueDetailResponse)
def get_issue_detail(number: int, repo: Optional[str] = None):
    """GET /issues/{number}
    Full issue record + latest escalation + subtask history ordered by created_at.
    """
    target = _require_active_repo(repo)
    conn = get_conn()

    issue_row = conn.execute(
        "SELECT * FROM issues WHERE repo = ? AND number = ?", (target, number)
    ).fetchone()
    if not issue_row:
        raise HTTPException(status_code=404, detail=f"Issue #{number} not found in {target}")

    r = dict(issue_row)
    issue_model = IssueDetailRecord(
        repo=r["repo"],
        number=r["number"],
        title=r["title"] or "",
        body=r.get("body") or "",
        state=r["state"] or "open",
        is_pr=bool(r.get("is_pr", False)),
        author=r.get("author") or "unknown",
        labels=_parse_json_field(r.get("labels"), []),
        comments_count=int(r.get("comments_count", 0)),
        url=r.get("url"),
        created_at=r.get("created_at"),
        updated_at=r.get("updated_at"),
        closed_at=r.get("closed_at"),
    )

    # Comments
    comments_rows = conn.execute(
        "SELECT id, github_comment_id, author, body, created_at, is_maintainer FROM comments WHERE repo = ? AND issue_number = ? ORDER BY created_at ASC",
        (target, number),
    ).fetchall()
    comments = [CommentModel(**dict(c)) for c in comments_rows]

    # Escalations
    escalations_rows = conn.execute(
        "SELECT id, escalate, categories, explanation, drafted_comment, human_override, created_at, evidence_json FROM escalations WHERE repo = ? AND issue_number = ? ORDER BY id DESC",
        (target, number),
    ).fetchall()
    escalations_list: list[EscalationSummary] = []
    similar_issues: list[dict[str, Any]] = []

    for er in escalations_rows:
        er_dict = dict(er)
        cats = _parse_json_field(er_dict.get("categories"), [])
        expl = er_dict.get("explanation")
        expl_excerpt = (expl.strip().split("\n")[0][:120] + "...") if expl else None
        esc_summary = EscalationSummary(
            id=er_dict["id"],
            escalate=er_dict.get("escalate"),
            categories=cats,
            explanation=expl,
            explanation_excerpt=expl_excerpt,
            drafted_comment=er_dict.get("drafted_comment"),
            human_override=er_dict.get("human_override"),
            created_at=er_dict.get("created_at"),
        )
        escalations_list.append(esc_summary)

        evidence = _parse_json_field(er_dict.get("evidence_json"), {})
        if "duplicate_check" in evidence:
            matches = evidence["duplicate_check"].get("matches", [])
            if matches and not similar_issues:
                similar_issues = matches

    latest_escalation = escalations_list[0] if escalations_list else None

    # Subtasks history ordered by created_at
    subtasks_rows = conn.execute(
        "SELECT id, task_type, status, result_json, finished_at, created_at FROM subtasks WHERE repo = ? AND issue_number = ? ORDER BY created_at ASC",
        (target, number),
    ).fetchall()
    subtasks = [
        SubtaskModel(
            id=sr["id"],
            task_type=sr["task_type"],
            status=sr["status"],
            result=_parse_json_field(sr["result_json"], None),
            finished_at=sr["finished_at"],
            created_at=sr["created_at"],
        )
        for sr in subtasks_rows
    ]

    # Feedback
    feedback_rows = conn.execute(
        "SELECT id, escalation_id, vote, note, created_at FROM feedback WHERE repo = ? AND issue_number = ? ORDER BY id DESC",
        (target, number),
    ).fetchall()
    feedback = [FeedbackModel(**dict(fr)) for fr in feedback_rows]

    return IssueDetailResponse(
        issue=issue_model,
        comments=comments,
        escalation=latest_escalation,
        escalations=escalations_list,
        subtasks=subtasks,
        feedback=feedback,
        similar_issues=similar_issues,
    )


@router.post("/issues/{number}/feedback", response_model=FeedbackCreateResponse)
def create_issue_feedback(number: int, payload: FeedbackCreateRequest):
    """POST /issues/{number}/feedback
    Records human-in-the-loop maintainer feedback, and stamps the referenced
    escalation as confirmed/dismissed so the verdict itself carries the
    human decision -- not just a separate feedback row nobody joins to.
    """
    if payload.vote not in ("up", "down"):
        raise HTTPException(status_code=400, detail="vote must be 'up' or 'down'")

    target = _require_active_repo(payload.repo)
    conn = get_conn()

    # Validate issue exists
    exists = conn.execute(
        "SELECT 1 FROM issues WHERE repo = ? AND number = ?", (target, number)
    ).fetchone()
    if not exists:
        raise HTTPException(status_code=404, detail=f"Issue #{number} not found in {target}")

    with tx() as c:
        cur = c.execute(
            """
            INSERT INTO feedback (repo, issue_number, escalation_id, vote, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                target,
                number,
                payload.escalation_id,
                payload.vote,
                payload.note or "",
                now_iso(),
            ),
        )
        feedback_id = cur.lastrowid

        if payload.escalation_id is not None:
            override = "confirmed" if payload.vote == "up" else "dismissed"
            c.execute(
                "UPDATE escalations SET human_override = ? WHERE id = ? AND repo = ?",
                (override, payload.escalation_id, target),
            )

    return FeedbackCreateResponse(
        status="ok",
        feedback_id=feedback_id,
        message="Feedback successfully recorded",
    )
