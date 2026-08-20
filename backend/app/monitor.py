"""Continuous monitoring: a real background scheduler polls GitHub on an
interval (plus a manual /monitor/check-now for demo reliability), and a
subtask queue processor works through autonomously-created subtasks,
logging every step so the whole loop is inspectable during a demo.

Multi-repo note: the scheduler always polls the *active* repo (app.database
get_active_repo/set_active_repo, set via POST /connect or the .env
auto-bootstrap at startup). All subtask/health-snapshot/log rows are scoped
by repo so switching repos never mixes data.

Subtask division of labor (deliberate, to avoid duplicate escalation rows
per issue):
  - "duplicate_check" subtask   -> runs the FULL multi-tool agent synthesis
                                    (app.agent.evaluate_issue), which itself
                                    calls all 6 tools including missing_info_check.
                                    This is what creates the escalation record.
  - "missing_info_check" subtask -> runs tools.missing_info_check standalone,
                                    for demo visibility into the queue (the
                                    combined synthesis above already covers it
                                    for the actual escalation decision).
  - "health_trend_check" subtask -> computes and stores a health snapshot.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.background import BackgroundScheduler

from app.config import ConfigError, settings
from app.database import get_active_repo, get_conn, get_repo_row, log_monitor_event, now_iso, tx

logger = logging.getLogger("repoguardian.monitor")

_scheduler: BackgroundScheduler | None = None


def _process_one_subtask(row: dict) -> None:
    from app.agent import evaluate_issue
    from app.tools import missing_info_check

    task_id = row["id"]
    repo = row["repo"]
    task_type = row["task_type"]
    issue_number = row["issue_number"]

    with tx() as conn:
        conn.execute(
            "UPDATE subtasks SET status='running', started_at=? WHERE id=?",
            (now_iso(), task_id),
        )

    log_lines = [f"[{now_iso()}] picked up {task_type} for {repo}#{issue_number}"]
    try:
        if task_type == "duplicate_check":
            result = evaluate_issue(repo, issue_number)
            log_lines.append(
                f"ran full agent synthesis -> escalate={result.get('escalate')} "
                f"categories={result.get('categories')} via {result.get('synthesis_method')}"
            )
        elif task_type == "missing_info_check":
            result = missing_info_check(repo, issue_number)
            log_lines.append(f"needs_more_info={result.get('needs_more_info')}")
        elif task_type == "health_trend_check":
            result = _compute_health_snapshot(repo)
            log_lines.append(
                f"backlog={result['backlog_size']} avg_response_h={result['avg_response_time_hours']} "
                f"dup_rate={result['duplicate_rate']}"
            )
        else:
            raise ValueError(f"unknown task_type {task_type}")

        with tx() as conn:
            conn.execute(
                "UPDATE subtasks SET status='done', finished_at=?, result_json=?, log=? WHERE id=?",
                (now_iso(), json.dumps(result, default=str), "\n".join(log_lines), task_id),
            )
    except Exception as exc:
        logger.exception("subtask %s failed", task_id)
        log_lines.append(f"ERROR: {exc}")
        with tx() as conn:
            conn.execute(
                "UPDATE subtasks SET status='error', finished_at=?, log=? WHERE id=?",
                (now_iso(), "\n".join(log_lines), task_id),
            )


def process_subtask_queue(repo: str | None = None, limit: int = 25) -> int:
    """Drains up to `limit` pending subtasks, optionally scoped to one repo.
    Returns count processed."""
    conn = get_conn()
    if repo:
        rows = [
            dict(r)
            for r in conn.execute(
                "SELECT * FROM subtasks WHERE status='pending' AND repo=? ORDER BY created_at ASC LIMIT ?",
                (repo, limit),
            ).fetchall()
        ]
    else:
        rows = [
            dict(r)
            for r in conn.execute(
                "SELECT * FROM subtasks WHERE status='pending' ORDER BY created_at ASC LIMIT ?",
                (limit,),
            ).fetchall()
        ]
    for row in rows:
        _process_one_subtask(row)
    if rows:
        log_monitor_event("subtask_queue_drained", f"processed={len(rows)}", repo=repo)
    return len(rows)


def _contributor_activity(conn, repo: str, window_days: int = 30) -> dict:
    """Project Health Analysis: contributor activity trend. 'Active' = anyone
    who opened an issue or posted a comment in the last `window_days`.
    'New' = active contributors whose earliest-ever activity in this repo
    (issue or comment) also falls inside that same window -- i.e. first-time
    contributors, not just recently-active regulars."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=window_days)

    first_seen: dict[str, datetime] = {}
    last_seen_in_window: set[str] = set()

    rows = conn.execute(
        "SELECT author, created_at FROM issues WHERE repo=? AND author IS NOT NULL", (repo,)
    ).fetchall()
    rows += conn.execute(
        "SELECT author, created_at FROM comments WHERE repo=? AND author IS NOT NULL", (repo,)
    ).fetchall()

    for r in rows:
        author = r["author"]
        ts = r["created_at"]
        if not author or not ts:
            continue
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except Exception:
            continue
        if author not in first_seen or dt < first_seen[author]:
            first_seen[author] = dt
        if dt >= cutoff:
            last_seen_in_window.add(author)

    new_contributors = {a for a in last_seen_in_window if first_seen.get(a, cutoff) >= cutoff}

    return {
        "active_contributors_30d": len(last_seen_in_window),
        "new_contributors_30d": len(new_contributors),
    }


def _compute_health_snapshot(repo: str) -> dict:
    conn = get_conn()
    open_count = conn.execute(
        "SELECT COUNT(*) c FROM issues WHERE repo=? AND state='open'", (repo,)
    ).fetchone()["c"]
    closed_count = conn.execute(
        "SELECT COUNT(*) c FROM issues WHERE repo=? AND state='closed'", (repo,)
    ).fetchone()["c"]

    rows = conn.execute(
        "SELECT created_at, updated_at FROM issues WHERE repo=? AND comments_count > 0 LIMIT 500",
        (repo,),
    ).fetchall()
    diffs = []
    for r in rows:
        try:
            c = datetime.fromisoformat(r["created_at"].replace("Z", "+00:00"))
            u = datetime.fromisoformat(r["updated_at"].replace("Z", "+00:00"))
            diffs.append((u - c).total_seconds() / 3600)
        except Exception:
            continue
    avg_response = round(sum(diffs) / len(diffs), 2) if diffs else None

    total_escalations = conn.execute(
        "SELECT COUNT(*) c FROM escalations WHERE repo=?", (repo,)
    ).fetchone()["c"]
    dup_escalations = conn.execute(
        "SELECT COUNT(*) c FROM escalations WHERE repo=? AND categories LIKE '%duplicate%'", (repo,)
    ).fetchone()["c"]
    dup_rate = round(dup_escalations / total_escalations, 4) if total_escalations else 0.0
    contributors = _contributor_activity(conn, repo)

    snapshot = {
        "backlog_size": open_count,
        "open_count": open_count,
        "closed_count": closed_count,
        "avg_response_time_hours": avg_response,
        "duplicate_rate": dup_rate,
        **contributors,
    }

    with tx() as c:
        c.execute(
            """INSERT INTO health_snapshots
               (repo, taken_at, backlog_size, avg_response_time_hours, duplicate_rate, open_count, closed_count,
                active_contributors_30d, new_contributors_30d)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                repo, now_iso(), open_count, avg_response, dup_rate, open_count, closed_count,
                contributors["active_contributors_30d"], contributors["new_contributors_30d"],
            ),
        )

    return snapshot


def check_now(repo: str | None = None) -> dict:
    """Manual trigger: poll GitHub for changes to the active repo (or `repo`
    if given), then always drain that repo's subtask queue regardless --
    duplicate_check/missing_info_check/health_trend_check only need local
    DB + RAG, not GitHub, so queued work must still be processed even if the
    GitHub call is skipped. This is the button the demo uses instead of
    waiting for the timer."""
    from app.sync import run_sync

    target_repo = repo or get_active_repo()
    if not target_repo:
        return {"skipped": True, "reason": "No repo connected yet. POST /connect first."}

    row = get_repo_row(target_repo)
    token = row["token"] if row else None

    log_monitor_event("manual_check_now_triggered", repo=target_repo)
    sync_result = None
    sync_skipped_reason = None
    try:
        sync_result = run_sync(target_repo, token, max_items=100)
    except ConfigError as exc:
        sync_skipped_reason = str(exc)
        log_monitor_event("sync_skipped_not_configured", sync_skipped_reason, repo=target_repo)
    except Exception as exc:
        sync_skipped_reason = str(exc)
        log_monitor_event("sync_failed", sync_skipped_reason, repo=target_repo)

    processed = process_subtask_queue(repo=target_repo)
    return {
        "repo": target_repo,
        "sync_skipped": sync_skipped_reason is not None,
        "sync_skipped_reason": sync_skipped_reason,
        "sync": sync_result,
        "subtasks_processed": processed,
    }


def _poll_tick():
    repo = get_active_repo()
    log_monitor_event("poll_tick", repo=repo)
    if not repo:
        return
    try:
        check_now(repo)
    except Exception as exc:
        logger.exception("poll tick failed")
        log_monitor_event("poll_tick_error", str(exc), repo=repo)


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(
        _poll_tick,
        "interval",
        seconds=settings.monitor_poll_interval_seconds,
        id="repo_poll",
        next_run_time=datetime.now(timezone.utc) + timedelta(seconds=5),
    )
    _scheduler.start()
    log_monitor_event("scheduler_started", f"interval_s={settings.monitor_poll_interval_seconds}")


def get_status(repo: str | None = None) -> dict:
    target_repo = repo or get_active_repo()
    conn = get_conn()

    if target_repo:
        counts = {
            r["status"]: r["c"]
            for r in conn.execute(
                "SELECT status, COUNT(*) c FROM subtasks WHERE repo=? GROUP BY status", (target_repo,)
            ).fetchall()
        }
        recent_subtasks = [
            dict(r)
            for r in conn.execute(
                "SELECT * FROM subtasks WHERE repo=? ORDER BY id DESC LIMIT 20", (target_repo,)
            ).fetchall()
        ]
        recent_log = [
            dict(r)
            for r in conn.execute(
                "SELECT * FROM monitor_log WHERE repo=? OR repo IS NULL ORDER BY id DESC LIMIT 30",
                (target_repo,),
            ).fetchall()
        ]
    else:
        counts, recent_subtasks, recent_log = {}, [], [
            dict(r) for r in conn.execute("SELECT * FROM monitor_log ORDER BY id DESC LIMIT 30").fetchall()
        ]

    return {
        "repo": target_repo,
        "scheduler_running": _scheduler is not None and _scheduler.running,
        "poll_interval_seconds": settings.monitor_poll_interval_seconds,
        "subtask_counts": counts,
        "recent_subtasks": recent_subtasks,
        "recent_log": recent_log,
    }
