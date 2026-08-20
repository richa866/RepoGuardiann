"""Health API router: GET /health, GET /health-metrics
"""
from __future__ import annotations

import json
from fastapi import APIRouter

from app.config import settings
from app.db.database import get_active_repo, get_conn
from app.rag.embeddings import collection_size

router = APIRouter(tags=["health"])


@router.get("/health")
def health(repo: str | None = None):
    active_repo = repo or get_active_repo()
    return {
        "status": "ok",
        "github_configured": settings.github_configured,
        "gemini_configured": settings.gemini_configured,
        "active_repo": active_repo,
        "embedding_count": collection_size(active_repo) if active_repo else 0,
    }


@router.get("/health-metrics")
def health_metrics(repo: str | None = None, limit: int = 60):
    target = repo or get_active_repo()
    if not target:
        return {"repo": None, "snapshots": [], "total_escalations": 0, "category_counts": {}}

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
