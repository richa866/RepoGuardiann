"""Continuous background poller loop: polls GitHub, diffs, enqueues subtasks, and processes queue.
"""
from __future__ import annotations

import logging
from apscheduler.schedulers.background import BackgroundScheduler

from app.config import settings
from app.db.database import (
    finish_monitor_run,
    get_active_repo,
    get_conn,
    get_meta,
    get_repo_row,
    list_all_repos,
    log_monitor_event,
    now_iso,
    start_monitor_run,
)
from app.github.fetch import run_sync
from app.monitor.processor import process_pending_subtasks

logger = logging.getLogger("repoguardian.monitor.poller")

_scheduler: BackgroundScheduler | None = None
# Set at the end of every poll_cycle(), success or failure -- proof the loop
# is actually iterating, not just that the scheduler thread is alive
# (scheduler_running only tells you the thread exists, not that cycles are
# still completing).
_last_heartbeat: str | None = None


def _poll_one_repo(repo: str) -> dict:
    """Sync one repo incrementally (since its last sync) and drain its
    pending subtasks. Returns what the cycle found -- POST /monitor/trigger
    returns this directly for a single repo so a demo presenter sees real
    counts, not a bare ack."""
    logger.info("[monitor] starting poll cycle for %s", repo)
    log_monitor_event("poll_tick", f"Background scheduler tick for {repo}", repo=repo)

    row = get_repo_row(repo)
    token = row["token"] if row else None
    since = get_meta(f"last_sync_{repo}")

    # No gate on settings.github_configured/token here -- GitHubClient works
    # fine unauthenticated (60/hr limit) and public repos are the documented
    # no-token path (.env.example: "public repos work with GITHUB_TOKEN left
    # blank"). Gating on a token being present meant a connected repo
    # without one would silently never actually poll.
    run_id = start_monitor_run(repo)
    sync_status = "success"
    new_issues = updated_issues = subtasks_created = 0
    sync_error: str | None = None
    try:
        result = run_sync(repo, token=token, since=since, max_items=50)
        if result.get("status") == "error":
            sync_status = "failed"
            sync_error = result.get("error")
            finish_monitor_run(run_id, status="failed", error=sync_error)
        else:
            new_issues = result.get("new_issues", 0)
            updated_issues = result.get("updated_issues", 0)
            subtasks_created = result.get("subtasks_created", 0)
            finish_monitor_run(
                run_id,
                status="success",
                new_issues=new_issues,
                updated_issues=updated_issues,
                subtasks_created=subtasks_created,
            )
    except Exception as exc:
        logger.warning("[monitor] poll sync failed for %s: %s", repo, exc)
        sync_status = "failed"
        sync_error = str(exc)
        finish_monitor_run(run_id, status="failed", error=sync_error)

    # Drain pending subtasks. process_pending_subtasks already protects itself
    # (a bad DB read or one crashed subtask won't abort the batch) -- this is
    # a last line of defense so even an unanticipated failure here can't
    # crash the cycle after the sync phase above already succeeded.
    try:
        processed = process_pending_subtasks(repo, limit=20)
    except Exception as exc:
        logger.warning("[monitor] subtask draining failed for %s: %s", repo, exc)
        processed = 0
    logger.info("[monitor] poll cycle finished for %s, processed %d subtasks", repo, processed)

    return {
        "repo": repo,
        "run_id": run_id,
        "status": sync_status,
        "new_issues": new_issues,
        "updated_issues": updated_issues,
        "subtasks_created": subtasks_created,
        "subtasks_processed": processed,
        "error": sync_error,
    }


def poll_cycle() -> dict:
    """Scheduler entry point. Polls EVERY connected repo, not just the
    active one -- a repo that isn't currently selected in the UI still needs
    to stay in sync with GitHub, otherwise switching to it shows whatever
    state it was frozen at the last time it happened to be active. One
    repo's sync failing doesn't stop the others from being polled."""
    global _last_heartbeat
    repos = list_all_repos()
    if not repos:
        logger.debug("[monitor] no repos connected, skipping cycle")
        return {"repos": [], "status": "skipped", "reason": "no repos connected"}

    results = []
    for repo in repos:
        try:
            results.append(_poll_one_repo(repo))
        except Exception as exc:
            # _poll_one_repo already catches everything from its own sync/
            # drain work -- this is only reached if something outside that
            # blows up. Log and keep polling the rest of the connected repos.
            logger.warning("[monitor] poll cycle crashed outside its own handler for %s: %s", repo, exc)
            results.append({"repo": repo, "status": "failed", "error": str(exc)})

    _last_heartbeat = now_iso()

    failed = [r["repo"] for r in results if r.get("status") not in ("success", "skipped")]
    return {
        "repos": results,
        "repos_polled": len(results),
        "repos_failed": failed,
        "status": "success" if not failed else "partial",
    }


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

    if active_repo:
        pending_count = conn.execute(
            "SELECT COUNT(*) c FROM subtasks WHERE status = 'pending' AND repo = ?", (active_repo,)
        ).fetchone()["c"]
        recent_monitor_runs = [dict(r) for r in conn.execute(
            "SELECT * FROM monitor_runs WHERE repo = ? ORDER BY id DESC LIMIT 10", (active_repo,)
        ).fetchall()]
        # Deliberately not "SELECT *": result_json is a full raw tool-output
        # blob (nested match lists, decision context, snippets) that reads as
        # noise in a status glance view, not a demo-clean summary. `log` is
        # already the short human line each subtask was marked done/failed
        # with (e.g. "Ran duplicate_check for #3764") -- that's what belongs
        # here. The full result is still in the DB for anyone who needs it.
        recent_subtasks = [dict(r) for r in conn.execute(
            "SELECT id, issue_number, task_type, status, log, created_at, started_at, finished_at "
            "FROM subtasks WHERE repo = ? ORDER BY id DESC LIMIT 20", (active_repo,)
        ).fetchall()]
        recent_log = [dict(r) for r in conn.execute(
            "SELECT * FROM monitor_log WHERE repo = ? OR repo IS NULL ORDER BY id DESC LIMIT 15", (active_repo,)
        ).fetchall()]
    else:
        pending_count = 0
        recent_monitor_runs = []
        recent_subtasks = []
        recent_log = [dict(r) for r in conn.execute(
            "SELECT * FROM monitor_log ORDER BY id DESC LIMIT 15"
        ).fetchall()]

    return {
        "scheduler_running": bool(_scheduler and _scheduler.running),
        "last_heartbeat": _last_heartbeat,
        "poll_interval_seconds": settings.monitor_poll_interval_seconds,
        "active_repo": active_repo,
        "pending_subtasks": pending_count,
        "recent_monitor_runs": recent_monitor_runs,
        "recent_subtasks": recent_subtasks,
        "recent_log": recent_log,
    }


def trigger_check_now(repo: str | None = None) -> dict:
    """Manual single-repo check (the "Check" button), as opposed to
    poll_cycle()'s all-repos scheduled sweep. Previously computed `target`
    and then called poll_cycle() anyway, which ignored `target` entirely and
    always polled get_active_repo() -- passing an explicit repo here did
    nothing. Now actually checks the repo that was asked for."""
    target = repo or get_active_repo()
    if not target:
        return {"repo": None, "status": "skipped", "reason": "no repo specified and no active repo connected"}
    log_monitor_event("manual_check_triggered", f"Manual trigger for {target}", repo=target)
    return _poll_one_repo(target)
