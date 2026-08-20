"""Continuous background poller loop: polls GitHub, diffs, enqueues subtasks, and processes queue.
"""
from __future__ import annotations

import logging
from apscheduler.schedulers.background import BackgroundScheduler

from app.config import settings
from app.db.database import get_active_repo, get_conn, get_meta, get_repo_row, log_monitor_event
from app.github.fetch import run_sync
from app.monitor.processor import process_pending_subtasks

logger = logging.getLogger("repoguardian.monitor.poller")

_scheduler: BackgroundScheduler | None = None


def poll_cycle() -> None:
    active_repo = get_active_repo()
    if not active_repo:
        logger.debug("[monitor] no active repo connected, skipping cycle")
        return

    logger.info("[monitor] starting poll cycle for %s", active_repo)
    log_monitor_event("poll_tick", f"Background scheduler tick for {active_repo}", repo=active_repo)

    row = get_repo_row(active_repo)
    token = row["token"] if row else None
    since = get_meta(f"last_sync_{active_repo}")

    if settings.github_configured or token:
        try:
            run_sync(active_repo, token=token, since=since, max_items=50)
        except Exception as exc:
            logger.warning("[monitor] poll sync failed: %s", exc)

    # Drain pending subtasks
    processed = process_pending_subtasks(active_repo, limit=20)
    logger.info("[monitor] poll cycle finished, processed %d subtasks", processed)


def start_scheduler() -> BackgroundScheduler:
    global _scheduler
    if _scheduler is None or not _scheduler.running:
        _scheduler = BackgroundScheduler(daemon=True)
        _scheduler.add_job(
            poll_cycle,
            "interval",
            seconds=settings.monitor_poll_interval_seconds,
            id="repo_monitor_job",
            replace_existing=True,
        )
        _scheduler.start()
        logger.info("[monitor] scheduler started, interval %ds", settings.monitor_poll_interval_seconds)
    return _scheduler


def get_monitor_status(repo: str | None = None) -> dict:
    active_repo = repo or get_active_repo()
    conn = get_conn()

    pending_count = conn.execute("SELECT COUNT(*) c FROM subtasks WHERE status = 'pending'").fetchone()["c"]
    recent_subtasks = [dict(r) for r in conn.execute(
        "SELECT * FROM subtasks ORDER BY id DESC LIMIT 15"
    ).fetchall()]
    recent_log = [dict(r) for r in conn.execute(
        "SELECT * FROM monitor_log ORDER BY id DESC LIMIT 15"
    ).fetchall()]

    return {
        "scheduler_running": bool(_scheduler and _scheduler.running),
        "poll_interval_seconds": settings.monitor_poll_interval_seconds,
        "active_repo": active_repo,
        "pending_subtasks": pending_count,
        "recent_subtasks": recent_subtasks,
        "recent_log": recent_log,
    }


def trigger_check_now(repo: str | None = None) -> dict:
    target = repo or get_active_repo()
    log_monitor_event("manual_check_triggered", f"Manual trigger for {target}", repo=target)
    poll_cycle()
    return {"status": "ok", "message": f"Poll cycle triggered for {target}"}
