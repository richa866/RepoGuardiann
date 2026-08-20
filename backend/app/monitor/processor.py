"""Worker that pulls queued subtasks, runs the right check, and stores results.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from app.agent.synthesis import evaluate_issue
from app.agent.tools import repo_avg_response_hours
from app.db.database import get_conn, log_monitor_event, now_iso, tx
from app.monitor.queue import (
    get_pending_subtasks,
    mark_subtask_done,
    mark_subtask_failed,
    mark_subtask_started,
)

logger = logging.getLogger("repoguardian.monitor.processor")


def _compute_health_snapshot(repo: str) -> dict:
    conn = get_conn()
    open_count = conn.execute(
        "SELECT COUNT(*) c FROM issues WHERE repo = ? AND state = 'open' AND is_pr = 0", (repo,)
    ).fetchone()["c"]
    closed_count = conn.execute(
        "SELECT COUNT(*) c FROM issues WHERE repo = ? AND state = 'closed' AND is_pr = 0", (repo,)
    ).fetchone()["c"]

    total_escalations = conn.execute(
        "SELECT COUNT(*) c FROM escalations WHERE repo = ? AND escalate = 1", (repo,)
    ).fetchone()["c"]
    total_issues = open_count + closed_count
    duplicate_rate = (total_escalations / total_issues) if total_issues > 0 else 0.0

    # 30-day contributor activity
    since_30d = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    issue_authors = {
        r["author"] for r in conn.execute(
            "SELECT DISTINCT author FROM issues WHERE repo = ? AND created_at >= ?", (repo, since_30d)
        ).fetchall() if r["author"]
    }
    comment_authors = {
        r["author"] for r in conn.execute(
            "SELECT DISTINCT author FROM comments WHERE repo = ? AND created_at >= ?", (repo, since_30d)
        ).fetchall() if r["author"]
    }
    recent_authors = issue_authors | comment_authors
    active_contributors = len(recent_authors)

    # "New" means genuinely first seen in this window -- anyone with any
    # issue or comment before it doesn't count. (Was max(1, active // 3),
    # a made-up ratio that also could never report zero.)
    prior_authors = {
        r["author"] for r in conn.execute(
            "SELECT DISTINCT author FROM issues WHERE repo = ? AND created_at < ?", (repo, since_30d)
        ).fetchall() if r["author"]
    } | {
        r["author"] for r in conn.execute(
            "SELECT DISTINCT author FROM comments WHERE repo = ? AND created_at < ?", (repo, since_30d)
        ).fetchall() if r["author"]
    }
    new_contributors = len(recent_authors - prior_authors)

    # Real computed average (creation -> first non-author reply, across every
    # issue in the repo that got one), not the hardcoded 14.5 placeholder that
    # used to sit here and surface verbatim in GET /brief and /health-metrics
    # as if it were measured. Same helper response_time_check already uses, so
    # the number a maintainer reads in the brief matches the one the agent
    # reasons with.
    avg_response_hours = repo_avg_response_hours(repo)

    snapshot = {
        "repo": repo,
        "taken_at": now_iso(),
        "backlog_size": open_count,
        "avg_response_time_hours": round(avg_response_hours, 2),
        "duplicate_rate": round(duplicate_rate, 3),
        "open_count": open_count,
        "closed_count": closed_count,
        "active_contributors_30d": active_contributors,
        "new_contributors_30d": new_contributors,
    }

    with tx() as c:
        c.execute(
            """
            INSERT INTO health_snapshots
                (repo, taken_at, backlog_size, avg_response_time_hours, duplicate_rate,
                 open_count, closed_count, active_contributors_30d, new_contributors_30d)
            VALUES (:repo, :taken_at, :backlog_size, :avg_response_time_hours, :duplicate_rate,
                    :open_count, :closed_count, :active_contributors_30d, :new_contributors_30d)
            """,
            snapshot,
        )

    return snapshot


def process_one_subtask(subtask: dict) -> dict:
    subtask_id = subtask["id"]
    repo = subtask["repo"]
    issue_number = subtask["issue_number"]
    task_type = subtask["task_type"]

    try:
        mark_subtask_started(subtask_id)
        if task_type in ("duplicate_check", "missing_info_check") and issue_number:
            # evaluate_issue() runs all 6 tools + synthesis for this issue and
            # caches the result briefly -- a poll cycle enqueues both
            # duplicate_check and missing_info_check for the same changed
            # issue, so whichever is processed first does the real work
            # (including missing_info_check's Gemini call) and the other
            # reuses it instead of re-running everything from scratch.
            full = evaluate_issue(repo, issue_number)
            res = full["evidence"].get(task_type, {})
            mark_subtask_done(subtask_id, res, f"Ran {task_type} for #{issue_number}")
            return res

        elif task_type == "health_trend_check":
            res = _compute_health_snapshot(repo)
            mark_subtask_done(subtask_id, res, f"Recorded health snapshot for {repo}")
            return res

        else:
            if issue_number:
                res = evaluate_issue(repo, issue_number)
                mark_subtask_done(subtask_id, res, f"Evaluated #{issue_number}")
                return res
            mark_subtask_done(subtask_id, {}, "No-op")
            return {}

    except Exception as exc:
        # .warning(), not .exception(): a full traceback per failed subtask
        # is exactly the noise a screen-shared /monitor/status is supposed
        # to be free of. The real error text is still in the message and in
        # subtasks.log for anyone who needs to dig in.
        logger.warning("[processor] subtask %s (%s) failed: %s", subtask_id, task_type, exc)
        try:
            mark_subtask_failed(subtask_id, str(exc))
        except Exception:
            # DB itself is the thing failing (disk full, locked, etc.) --
            # nothing more we can do here, but this must not propagate: the
            # caller's per-item loop needs to move on to the next subtask.
            logger.warning("[processor] subtask %s: also failed to record the failure", subtask_id)
        return {"error": str(exc)}


def process_pending_subtasks(repo: str | None = None, limit: int = 10) -> int:
    try:
        pending = get_pending_subtasks(repo, limit=limit)
    except Exception as exc:
        logger.warning("[processor] failed to fetch pending subtasks: %s", exc)
        return 0

    processed = 0
    for st in pending:
        try:
            process_one_subtask(st)
        except Exception as exc:
            # process_one_subtask already catches everything from its own
            # work -- this is only reached if something outside that (e.g.
            # a malformed subtask row) blows up. Log and keep draining the
            # rest of the batch rather than losing it.
            logger.warning("[processor] subtask %s crashed outside its own handler: %s", st.get("id"), exc)
        processed += 1
    return processed
