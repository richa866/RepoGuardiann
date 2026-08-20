from __future__ import annotations

import json
import logging
import threading

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.config import ConfigError, settings
from app.database import get_active_repo, get_conn, get_repo_row, init_db, now_iso, tx
from app.monitor import check_now, get_status, start_scheduler
from app.rag import collection_size

logging.basicConfig(level=settings.log_level)
logger = logging.getLogger("repoguardian.main")

app = FastAPI(title="RepoGuardian API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ConfigError)
async def config_error_handler(request, exc: ConfigError):
    return JSONResponse(
        status_code=503,
        content={
            "error": "not_configured",
            "feature": exc.feature,
            "missing": exc.missing,
            "message": str(exc),
        },
    )


def _resolve_repo(repo: str | None) -> str | None:
    return repo or get_active_repo()


def _require_active_repo(repo: str | None) -> str:
    resolved = _resolve_repo(repo)
    if not resolved:
        raise HTTPException(409, "No repo connected yet. POST /connect first.")
    return resolved


@app.on_event("startup")
def on_startup():
    init_db()
    start_scheduler()
    logger.info(
        "RepoGuardian started. github_env_configured=%s gemini_configured=%s",
        settings.github_configured,
        settings.gemini_configured,
    )

    if settings.github_configured and not get_active_repo():
        # .env auto-bootstrap: if GITHUB_TOKEN + GITHUB_REPO are set, connect
        # and sync that repo automatically so "fill .env, restart" is enough
        # -- the live /connect flow below is additive on top of this, not a
        # replacement for it.
        from app.repos import connect_repo

        def _bootstrap():
            try:
                connect_repo(settings.github_repo, settings.github_token)
                logger.info("Auto-connected .env repo %s", settings.github_repo)
            except Exception as exc:
                logger.warning("Auto-connect of .env repo %s failed: %s", settings.github_repo, exc)

        threading.Thread(target=_bootstrap, daemon=True).start()


@app.get("/health")
def health():
    active_repo = get_active_repo()
    return {
        "status": "ok",
        "github_configured": settings.github_configured,
        "gemini_configured": settings.gemini_configured,
        "active_repo": active_repo,
        "embedding_count": collection_size(active_repo) if active_repo else 0,
    }


class ConnectIn(BaseModel):
    repo: str
    token: str | None = None


@app.post("/connect")
def connect_endpoint(body: ConnectIn):
    from app.repos import ConnectError, connect_repo

    try:
        return connect_repo(body.repo, body.token)
    except ConnectError as exc:
        raise HTTPException(exc.status, {"error": exc.code, "message": exc.message}) from exc


@app.get("/sync/status")
def sync_status_endpoint(repo: str | None = None):
    from app.repos import ConnectError, get_sync_status

    target = _require_active_repo(repo)
    try:
        return get_sync_status(target)
    except ConnectError as exc:
        raise HTTPException(exc.status, {"error": exc.code, "message": exc.message}) from exc


@app.get("/repos")
def list_repos():
    conn = get_conn()
    rows = [dict(r) for r in conn.execute("SELECT * FROM repos ORDER BY added_at DESC").fetchall()]
    for r in rows:
        r["has_token"] = bool(r.pop("token", None))  # never return stored tokens to the frontend
    return {"repos": rows, "active_repo": get_active_repo()}


@app.post("/sync")
def sync_endpoint(repo: str | None = None):
    from app.sync import run_sync

    target = _require_active_repo(repo)
    row = get_repo_row(target)
    token = row["token"] if row else None
    return run_sync(target, token, max_items=settings.full_sync_max_items)


@app.get("/issues")
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

    allowed_sorts = {"updated_at", "created_at", "number", "comments_count"}
    sort_col = sort if sort in allowed_sorts else "updated_at"
    query += f" ORDER BY i.{sort_col} DESC LIMIT ? OFFSET ?"
    params += [limit, offset]

    rows = [dict(r) for r in conn.execute(query, params).fetchall()]
    for r in rows:
        r["labels"] = json.loads(r["labels"] or "[]")
        r["latest_categories"] = json.loads(r["latest_categories"] or "[]") if r["latest_categories"] else []

    if category:
        rows = [r for r in rows if category in r["latest_categories"]]

    return {"repo": target, "issues": rows, "count": len(rows)}


@app.get("/issues/{number}")
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


class FeedbackIn(BaseModel):
    vote: str  # "up" | "down"
    escalation_id: int | None = None
    note: str | None = None
    repo: str | None = None


@app.post("/issues/{number}/feedback")
def submit_feedback(number: int, body: FeedbackIn):
    if body.vote not in ("up", "down"):
        raise HTTPException(400, "vote must be 'up' or 'down'")

    target = _require_active_repo(body.repo)
    conn = get_conn()
    issue_exists = conn.execute(
        "SELECT 1 FROM issues WHERE repo = ? AND number = ?", (target, number)
    ).fetchone()
    if not issue_exists:
        raise HTTPException(404, f"issue #{number} not found in {target}")

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


@app.get("/health-metrics")
def health_metrics(repo: str | None = None, limit: int = 60):
    target = _require_active_repo(repo)
    conn = get_conn()
    rows = [dict(r) for r in conn.execute(
        "SELECT * FROM health_snapshots WHERE repo = ? ORDER BY id DESC LIMIT ?", (target, limit)
    ).fetchall()]
    rows.reverse()

    total_escalations = conn.execute(
        "SELECT COUNT(*) c FROM escalations WHERE repo = ? AND escalate=1", (target,)
    ).fetchone()["c"]
    category_counts: dict[str, int] = {}
    for r in conn.execute(
        "SELECT categories FROM escalations WHERE repo = ? AND escalate=1", (target,)
    ).fetchall():
        for cat in json.loads(r["categories"] or "[]"):
            category_counts[cat] = category_counts.get(cat, 0) + 1

    return {
        "repo": target,
        "snapshots": rows,
        "total_escalations": total_escalations,
        "category_counts": category_counts,
    }


@app.get("/monitor/status")
def monitor_status(repo: str | None = None):
    return get_status(repo)


@app.post("/monitor/check-now")
def monitor_check_now(repo: str | None = None):
    return check_now(repo)


@app.get("/brief")
def weekly_brief(repo: str | None = None):
    from app.brief import generate_brief

    target = _require_active_repo(repo)
    return generate_brief(target)
