"""Subtask queue CRUD and status management in SQLite.
"""
from __future__ import annotations

import json
from app.db.database import get_conn, now_iso, tx


def get_pending_subtasks(repo: str | None = None, limit: int = 10) -> list[dict]:
    conn = get_conn()
    if repo:
        rows = conn.execute(
            "SELECT * FROM subtasks WHERE repo = ? AND status = 'pending' ORDER BY id ASC LIMIT ?",
            (repo, limit),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM subtasks WHERE status = 'pending' ORDER BY id ASC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]


def mark_subtask_started(subtask_id: int) -> None:
    with tx() as c:
        c.execute("UPDATE subtasks SET status = 'running', started_at = ? WHERE id = ?", (now_iso(), subtask_id))


def mark_subtask_done(subtask_id: int, result: dict, log: str = "") -> None:
    with tx() as c:
        c.execute(
            "UPDATE subtasks SET status = 'done', finished_at = ?, result_json = ?, log = ? WHERE id = ?",
            (now_iso(), json.dumps(result), log, subtask_id),
        )


def mark_subtask_failed(subtask_id: int, error_msg: str) -> None:
    # Some exceptions (a raw API error response, in particular) run to many
    # lines -- log is meant to be a short, specific message someone can read
    # at a glance, not another JSON dump by another name. Truncate defensively
    # here so no future caller has to remember to.
    short_msg = error_msg if len(error_msg) <= 300 else error_msg[:300] + "... (truncated)"
    with tx() as c:
        c.execute(
            "UPDATE subtasks SET status = 'error', finished_at = ?, log = ? WHERE id = ?",
            (now_iso(), short_msg, subtask_id),
        )
