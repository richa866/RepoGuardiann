"""FastAPI application for RepoGuardian (PS-04).
Mounts all modular routers from app.api and orchestrates background scheduler.
"""
from __future__ import annotations

import logging
import os
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.api.health import router as health_router
from app.api.issues import router as issues_router
from app.api.monitor import router as monitor_router
from app.config import settings
from app.db.database import get_active_repo, get_conn, get_repo_row, init_db
from app.monitor.poller import start_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("repoguardian")


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(os.path.dirname(settings.database_path) or ".", exist_ok=True)
    os.makedirs(settings.chroma_path, exist_ok=True)
    init_db()

    start_scheduler()

    # Optional auto-connect repository from .env on boot
    if settings.github_repo and not get_active_repo():
        def _bootstrap():
            try:
                from app.repos import connect_repo
                logger.info("Auto-connecting configured repository: %s", settings.github_repo)
                connect_repo(settings.github_repo, settings.github_token)
            except Exception as exc:
                logger.warning("Auto-connect of .env repo %s failed: %s", settings.github_repo, exc)

        threading.Thread(target=_bootstrap, daemon=True).start()

    yield


app = FastAPI(
    title="RepoGuardian",
    description="Agentic Open-Source Maintainer Assistant",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount modular API routers. POST /issues/{number}/feedback lives in
# issues_router alongside the other /issues routes -- it used to ALSO be
# defined in a separate feedback_router mounted after this one, which meant
# FastAPI silently served the issues_router copy and the other file was dead
# code. That shadowed copy was the one that set escalations.human_override
# and validated the vote value, so both silently stopped happening.
app.include_router(health_router)
app.include_router(issues_router)
app.include_router(monitor_router)


# Multi-Repo & Live Connect Endpoints
class ConnectIn(BaseModel):
    repo: str
    token: str | None = None


@app.post("/connect", tags=["repos"])
def connect_endpoint(body: ConnectIn):
    from app.repos import ConnectError, connect_repo

    try:
        return connect_repo(body.repo, body.token)
    except ConnectError as exc:
        raise HTTPException(exc.status, {"error": exc.code, "message": exc.message}) from exc


@app.get("/sync/status", tags=["repos"])
def sync_status_endpoint(repo: str | None = None):
    from app.repos import ConnectError, get_sync_status

    target = repo or get_active_repo()
    if not target:
        raise HTTPException(400, "no repo specified")
    try:
        return get_sync_status(target)
    except ConnectError as exc:
        raise HTTPException(exc.status, {"error": exc.code, "message": exc.message}) from exc


@app.get("/repos", tags=["repos"])
def list_repos():
    conn = get_conn()
    rows = [dict(r) for r in conn.execute("SELECT * FROM repos ORDER BY added_at DESC").fetchall()]
    for r in rows:
        r["has_token"] = bool(r.pop("token", None))
    return {"repos": rows, "active_repo": get_active_repo()}


@app.post("/sync", tags=["repos"])
def sync_endpoint(repo: str | None = None):
    from app.github.fetch import run_sync

    target = repo or get_active_repo()
    if not target:
        raise HTTPException(400, "no active repo")
    row = get_repo_row(target)
    token = row["token"] if row else None
    return run_sync(target, token, max_items=settings.full_sync_max_items)


@app.get("/brief", tags=["brief"])
def weekly_brief(repo: str | None = None):
    from app.brief import generate_brief

    target = repo or get_active_repo()
    if not target:
        raise HTTPException(400, "no active repo")
    return generate_brief(target)
