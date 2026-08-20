"""SQLite access layer. Plain sqlite3 (no ORM) -- kept deliberately simple
so it is easy to extend tomorrow (new columns/tables) without fighting a
migration framework during a hackathon. All writes go through helper
functions here so the schema lives in one place.

Multi-repo note: `issue.number` is only unique *within* a repo (GitHub reuses
numbers across repos), so every table that references an issue carries an
explicit `repo` ("owner/name") column and callers must always scope reads/
writes by repo. SCHEMA_VERSION exists because SQLite can't cheaply migrate a
primary key shape (issues.number -> (repo, number)); on a version bump we
drop and recreate tables rather than hand-rolling a migration for a
single-writer hackathon DB -- acceptable data loss for dev/demo data.
"""
from __future__ import annotations

import json
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone

from app.config import settings

_local = threading.local()

SCHEMA_VERSION = 2

SCHEMA = """
CREATE TABLE IF NOT EXISTS repos (
    repo TEXT PRIMARY KEY,
    token TEXT,
    added_at TEXT NOT NULL,
    last_sync_at TEXT,
    sync_id TEXT,
    sync_status TEXT NOT NULL DEFAULT 'idle',   -- idle | running | done | error
    sync_stage TEXT,                             -- fetching_issues | embedding_history | running_initial_analysis | done
    sync_progress_current INTEGER NOT NULL DEFAULT 0,
    sync_progress_total INTEGER NOT NULL DEFAULT 0,
    sync_error TEXT
);

CREATE TABLE IF NOT EXISTS issues (
    repo TEXT NOT NULL,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    state TEXT NOT NULL,
    is_pr INTEGER NOT NULL DEFAULT 0,
    author TEXT,
    labels TEXT NOT NULL DEFAULT '[]',
    comments_count INTEGER NOT NULL DEFAULT 0,
    url TEXT,
    created_at TEXT,
    updated_at TEXT,
    closed_at TEXT,
    last_synced_at TEXT,
    PRIMARY KEY (repo, number)
);

CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo TEXT NOT NULL,
    issue_number INTEGER NOT NULL,
    github_comment_id INTEGER,
    author TEXT,
    body TEXT,
    created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_comments_issue ON comments(repo, issue_number);

CREATE TABLE IF NOT EXISTS subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo TEXT NOT NULL,
    issue_number INTEGER,
    task_type TEXT NOT NULL,           -- duplicate_check | missing_info_check | health_trend_check
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | running | done | error
    result_json TEXT,
    log TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_subtasks_status ON subtasks(status);
CREATE INDEX IF NOT EXISTS idx_subtasks_repo_issue ON subtasks(repo, issue_number);

CREATE TABLE IF NOT EXISTS escalations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo TEXT NOT NULL,
    issue_number INTEGER NOT NULL,
    escalate INTEGER NOT NULL,
    categories TEXT NOT NULL DEFAULT '[]',   -- json list, e.g. ["security-sensitive","stale"]
    explanation TEXT,
    evidence_json TEXT NOT NULL DEFAULT '{}',
    drafted_comment TEXT,
    human_override TEXT,                     -- null | 'confirmed' | 'dismissed'
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_escalations_repo_issue ON escalations(repo, issue_number);

CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo TEXT NOT NULL,
    issue_number INTEGER NOT NULL,
    escalation_id INTEGER,
    vote TEXT NOT NULL,   -- up | down
    note TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_repo_issue ON feedback(repo, issue_number);

CREATE TABLE IF NOT EXISTS sync_meta (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS health_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo TEXT NOT NULL,
    taken_at TEXT NOT NULL,
    backlog_size INTEGER NOT NULL,
    avg_response_time_hours REAL,
    duplicate_rate REAL,
    open_count INTEGER,
    closed_count INTEGER,
    active_contributors_30d INTEGER,
    new_contributors_30d INTEGER
);
CREATE INDEX IF NOT EXISTS idx_health_repo ON health_snapshots(repo);

CREATE TABLE IF NOT EXISTS monitor_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo TEXT,
    ts TEXT NOT NULL,
    event TEXT NOT NULL,
    detail TEXT
);
CREATE INDEX IF NOT EXISTS idx_monitor_log_repo ON monitor_log(repo);
"""

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
        # Multi-repo schema reshapes issues' primary key -- not worth hand
        # migrating for a hackathon single-writer SQLite file. Drop and
        # recreate; dev/seed/demo data is expected to be reseeded via
        # POST /connect or seed_dummy_data.py after an upgrade like this.
        conn.execute("PRAGMA foreign_keys = OFF")
        for table in DATA_TABLES:
            conn.execute(f"DROP TABLE IF EXISTS {table}")
        conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
        conn.commit()
        conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA)
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
    """Insert or update an issue row scoped to `repo`. Returns True if the row
    is new or changed (compared to updated_at), driving "new/updated"
    detection for the monitoring loop."""
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
