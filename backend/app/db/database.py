"""SQLite access layer. Plain sqlite3 (no ORM) -- matches CONTRACTS.md.
"""
from __future__ import annotations

import json
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from app.config import settings

_local = threading.local()
SCHEMA_VERSION = 2
SCHEMA_FILE = Path(__file__).resolve().parent / "schema.sql"

DATA_TABLES = [
    "issues", "comments", "subtasks", "escalations", "feedback",
    "health_snapshots", "monitor_log", "repos",
]


def get_conn() -> sqlite3.Connection:
    conn = getattr(_local, "conn", None)
    if conn is None:
        conn = sqlite3.connect(settings.database_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        _local.conn = conn
    return conn


@contextmanager
def tx():
    conn = get_conn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def init_db() -> None:
    conn = get_conn()
    current_version = conn.execute("PRAGMA user_version").fetchone()[0]
    if current_version != SCHEMA_VERSION:
        conn.execute("PRAGMA foreign_keys = OFF")
        for table in DATA_TABLES:
            conn.execute(f"DROP TABLE IF EXISTS {table}")
        conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
        conn.commit()
        conn.execute("PRAGMA foreign_keys = ON")

    schema_sql = SCHEMA_FILE.read_text()
    conn.executescript(schema_sql)
    conn.commit()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_meta(key: str, default: str | None = None) -> str | None:
    row = get_conn().execute("SELECT value FROM sync_meta WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


def set_meta(key: str, value: str) -> None:
    with tx() as conn:
        conn.execute(
            "INSERT INTO sync_meta (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )


def get_active_repo() -> str | None:
    return get_meta("active_repo")


def set_active_repo(repo: str) -> None:
    set_meta("active_repo", repo)


def log_monitor_event(event: str, detail: str = "", repo: str | None = None) -> None:
    with tx() as conn:
        conn.execute(
            "INSERT INTO monitor_log (repo, ts, event, detail) VALUES (?, ?, ?, ?)",
            (repo, now_iso(), event, detail),
        )


def upsert_issue(repo: str, issue: dict) -> bool:
    conn = get_conn()
    existing = conn.execute(
        "SELECT updated_at FROM issues WHERE repo = ? AND number = ?", (repo, issue["number"])
    ).fetchone()
    changed = existing is None or existing["updated_at"] != issue["updated_at"]

    with tx() as c:
        c.execute(
            """
            INSERT INTO issues
                (repo, number, title, body, state, is_pr, author, labels, comments_count,
                 url, created_at, updated_at, closed_at, last_synced_at)
            VALUES (:repo, :number, :title, :body, :state, :is_pr, :author, :labels, :comments_count,
                    :url, :created_at, :updated_at, :closed_at, :last_synced_at)
            ON CONFLICT(repo, number) DO UPDATE SET
                title=excluded.title, body=excluded.body, state=excluded.state,
                is_pr=excluded.is_pr, author=excluded.author, labels=excluded.labels,
                comments_count=excluded.comments_count, url=excluded.url,
                updated_at=excluded.updated_at, closed_at=excluded.closed_at,
                last_synced_at=excluded.last_synced_at
            """,
            {
                **issue,
                "repo": repo,
                "labels": json.dumps(issue.get("labels", [])),
                "last_synced_at": now_iso(),
            },
        )
    return changed


def replace_comments(repo: str, issue_number: int, comments: list[dict]) -> None:
    with tx() as c:
        c.execute("DELETE FROM comments WHERE repo = ? AND issue_number = ?", (repo, issue_number))
        c.executemany(
            "INSERT INTO comments (repo, issue_number, github_comment_id, author, body, created_at) "
            "VALUES (:repo, :issue_number, :github_comment_id, :author, :body, :created_at)",
            [{**cm, "repo": repo, "issue_number": issue_number} for cm in comments],
        )


def enqueue_subtask(repo: str, task_type: str, issue_number: int | None = None) -> int:
    with tx() as c:
        cur = c.execute(
            "INSERT INTO subtasks (repo, issue_number, task_type, status, created_at) "
            "VALUES (?, ?, ?, 'pending', ?)",
            (repo, issue_number, task_type, now_iso()),
        )
        return cur.lastrowid


def upsert_repo(repo: str, token: str | None) -> None:
    with tx() as c:
        c.execute(
            """
            INSERT INTO repos (repo, token, added_at, sync_status)
            VALUES (?, ?, ?, 'idle')
            ON CONFLICT(repo) DO UPDATE SET token = excluded.token
            """,
            (repo, token, now_iso()),
        )


def get_repo_row(repo: str) -> dict | None:
    row = get_conn().execute("SELECT * FROM repos WHERE repo = ?", (repo,)).fetchone()
    return dict(row) if row else None


def set_sync_state(
    repo: str,
    *,
    sync_id: str | None = None,
    status: str | None = None,
    stage: str | None = None,
    current: int | None = None,
    total: int | None = None,
    error: str | None = None,
    clear_error: bool = False,
) -> None:
    fields, values = [], []
    if sync_id is not None:
        fields.append("sync_id = ?"); values.append(sync_id)
    if status is not None:
        fields.append("sync_status = ?"); values.append(status)
    if stage is not None:
        fields.append("sync_stage = ?"); values.append(stage)
    if current is not None:
        fields.append("sync_progress_current = ?"); values.append(current)
    if total is not None:
        fields.append("sync_progress_total = ?"); values.append(total)
    if error is not None:
        fields.append("sync_error = ?"); values.append(error)
    if clear_error:
        fields.append("sync_error = NULL")
    if status == "done" or stage == "done":
        fields.append("last_sync_at = ?"); values.append(now_iso())
    if not fields:
        return
    values.append(repo)
    with tx() as c:
        c.execute(f"UPDATE repos SET {', '.join(fields)} WHERE repo = ?", values)
