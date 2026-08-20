"""SQLite database access layer.
Plain stdlib sqlite3 connection helper (WAL mode, row_factory = sqlite3.Row) — no ORM.
Matches CONTRACTS.md specification.
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
SCHEMA_FILE = Path(__file__).resolve().parent / "schema.sql"


def get_db_path() -> str:
    """Resolve database path from settings.database_path -- the single source
    of truth every other module (and tests, via monkeypatching this exact
    attribute) already relies on. config.py resolves it to an absolute path
    and creates its parent dir at import time; re-reading DATABASE_PATH from
    the environment here directly, instead of through settings, would silently
    ignore any runtime override of settings.database_path (e.g. test
    isolation fixtures) since env vars don't change after the process starts."""
    p = Path(settings.database_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    return str(p)


def get_conn(db_path: str | None = None) -> sqlite3.Connection:
    """Get thread-local SQLite connection with WAL mode and sqlite3.Row factory."""
    conn = getattr(_local, "conn", None)
    if conn is None:
        target_path = db_path or get_db_path()
        Path(target_path).parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(target_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA foreign_keys = ON;")
        _local.conn = conn
    return conn


@contextmanager
def tx(db_path: str | None = None):
    """Transaction context manager for atomic database operations."""
    conn = get_conn(db_path)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def init_db(db_path: str | None = None) -> sqlite3.Connection:
    """Initialize database tables and indexes from schema.sql if they do not exist yet."""
    conn = get_conn(db_path)
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA foreign_keys = ON;")

    # Additive migration for a column added after a table may already exist on
    # disk (schema.sql's CREATE TABLE IF NOT EXISTS is a no-op for those).
    # Must run BEFORE executescript: schema.sql's own
    # "CREATE INDEX idx_subtasks_dedupe ON subtasks(dedupe_key)" would raise
    # "no such column" against a pre-existing subtasks table that predates
    # this column. ALTER TABLE can't add UNIQUE directly, so a separate
    # unique index enforces it -- required for enqueue_subtask's
    # INSERT OR IGNORE dedup to actually work on a migrated (not fresh) DB.
    # Both statements are no-ops on a brand-new DB (table doesn't exist yet;
    # executescript's CREATE TABLE defines the column correctly from scratch).
    try:
        conn.execute("ALTER TABLE subtasks ADD COLUMN dedupe_key TEXT;")
    except sqlite3.OperationalError:
        pass
    try:
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_subtasks_dedupe_key_unique ON subtasks(dedupe_key);")
    except sqlite3.OperationalError:
        pass

    if SCHEMA_FILE.exists():
        schema_sql = SCHEMA_FILE.read_text(encoding="utf-8")
    else:
        raise FileNotFoundError(f"schema.sql not found at {SCHEMA_FILE}")

    conn.executescript(schema_sql)
    try:
        conn.execute("ALTER TABLE comments ADD COLUMN is_maintainer INTEGER NOT NULL DEFAULT 0;")
    except sqlite3.OperationalError:
        pass
    conn.commit()
    return conn


def now_iso() -> str:
    """Return current UTC timestamp in ISO 8601 format."""
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
            "INSERT INTO comments (repo, issue_number, github_comment_id, author, body, created_at, is_maintainer) "
            "VALUES (:repo, :issue_number, :github_comment_id, :author, :body, :created_at, :is_maintainer)",
            [{**cm, "repo": repo, "issue_number": issue_number, "is_maintainer": int(cm.get("is_maintainer", 0))} for cm in comments],
        )


def enqueue_subtask(
    repo: str,
    task_type: str,
    issue_number: int | None = None,
    issue_updated_at: str | None = None,
) -> int:
    """Idempotent: re-polling the same unchanged issue (or re-triggering a repo-wide
    check within the same UTC day) is a no-op instead of piling up duplicate rows.
    Returns the id of the queued subtask -- either the one just inserted, or the
    existing one that made this call a no-op.

    dedupe_key is always computed here, never accepted from the caller -- an
    earlier version of this on another branch defaulted to
    f"...#{now_iso()}" when no key was passed, which is unique on every call
    and silently defeats deduplication entirely for any caller that doesn't
    thread a key through by hand."""
    if issue_number is not None:
        dedupe_key = f"{repo}|{issue_number}|{task_type}|{issue_updated_at or ''}"
    else:
        day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        dedupe_key = f"{repo}|None|{task_type}|{day}"

    with tx() as c:
        cur = c.execute(
            "INSERT OR IGNORE INTO subtasks (repo, issue_number, task_type, status, created_at, dedupe_key) "
            "VALUES (?, ?, ?, 'pending', ?, ?)",
            (repo, issue_number, task_type, now_iso(), dedupe_key),
        )
        if cur.rowcount == 0:
            existing = c.execute(
                "SELECT id FROM subtasks WHERE dedupe_key = ?", (dedupe_key,)
            ).fetchone()
            return existing["id"] if existing else -1
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
