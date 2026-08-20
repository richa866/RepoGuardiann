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
                ORDER BY e.id DESC LIMIT 1) AS latest_explanation,
               (SELECT vote FROM feedback f WHERE f.repo = i.repo AND f.issue_number = i.number
                ORDER BY f.id DESC LIMIT 1) AS latest_feedback,
               (SELECT human_override FROM escalations e WHERE e.repo = i.repo AND e.issue_number = i.number
                ORDER BY e.id DESC LIMIT 1) AS latest_human_override
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


class PostCommentIn(BaseModel):
    body: str
    repo: str | None = None


class AddLabelsIn(BaseModel):
    labels: list[str]
    repo: str | None = None


class CloseIssueIn(BaseModel):
    reason: str = "completed"
    comment: str | None = None
    repo: str | None = None


@router.post("/issues/{number}/comment")
def post_comment_endpoint(number: int, body: PostCommentIn):
    target = _require_active_repo(body.repo)
    row = get_repo_row(target)
    token = row["token"] if row else None

    posted_on_github = False
    gh_comment_id = None
    if token:
        try:
            client = GitHubClient(token=token)
            gh_res = client.post_comment(target, number, body.body)
            posted_on_github = True
            gh_comment_id = gh_res.get("id")
        except Exception:
            pass

    with tx() as c:
        cur = c.execute(
            "INSERT INTO comments (repo, issue_number, author, body, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (target, number, "repoguardian-bot", body.body, now_iso(), now_iso()),
        )
        local_id = cur.lastrowid

    return {
        "status": "success",
        "posted_on_github": posted_on_github,
        "comment_id": gh_comment_id or local_id,
        "repo": target,
        "issue_number": number,
        "body": body.body,
        "created_at": now_iso(),
    }


@router.post("/issues/{number}/labels")
def add_labels_endpoint(number: int, body: AddLabelsIn):
    target = _require_active_repo(body.repo)
    row = get_repo_row(target)
    token = row["token"] if row else None

    posted_on_github = False
    if token:
        try:
            client = GitHubClient(token=token)
            client.add_labels(target, number, body.labels)
            posted_on_github = True
        except Exception:
            pass

    conn = get_conn()
    issue_row = conn.execute("SELECT labels FROM issues WHERE repo = ? AND number = ?", (target, number)).fetchone()
    if issue_row:
        current_labels = set(json.loads(issue_row["labels"] or "[]"))
        current_labels.update(body.labels)
        with tx() as c:
            c.execute(
                "UPDATE issues SET labels = ?, updated_at = ? WHERE repo = ? AND number = ?",
                (json.dumps(list(current_labels)), now_iso(), target, number),
            )

    return {"status": "success", "posted_on_github": posted_on_github, "labels": body.labels}


@router.post("/issues/{number}/close")
def close_issue_endpoint(number: int, body: CloseIssueIn):
    target = _require_active_repo(body.repo)
    row = get_repo_row(target)
    token = row["token"] if row else None

    posted_on_github = False
    if token:
        try:
            client = GitHubClient(token=token)
            if body.comment:
                client.post_comment(target, number, body.comment)
            client.close_issue(target, number, body.reason)
            posted_on_github = True
        except Exception:
            pass

    with tx() as c:
        if body.comment:
            c.execute(
                "INSERT INTO comments (repo, issue_number, author, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                (target, number, "repoguardian-bot", body.comment, now_iso(), now_iso()),
            )
        c.execute(
            "UPDATE issues SET state = 'closed', updated_at = ? WHERE repo = ? AND number = ?",
            (now_iso(), target, number),
        )

    return {"status": "closed", "posted_on_github": posted_on_github, "issue_number": number}

