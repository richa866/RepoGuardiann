"""SQLite database access layer.
Plain stdlib sqlite3 connection helper (WAL mode, row_factory = sqlite3.Row) — no ORM.
Matches CONTRACTS.md specification.
"""
from __future__ import annotations

import json
import sqlite3
import threading
import uuid
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
    try:
        conn.execute("ALTER TABLE escalations ADD COLUMN tool_calls TEXT NOT NULL DEFAULT '[]';")
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


def start_monitor_run(repo: str) -> int:
    """monitor_runs is the structured per-cycle audit trail (new/updated issue
    counts, subtasks created, status) that GET /monitor/status is meant to
    show -- distinct from monitor_log, which is just a flat event stream with
    no counts. Call this at the start of a poll cycle, then finish_monitor_run
    once it's known whether the cycle succeeded."""
    with tx() as c:
        cur = c.execute(
            "INSERT INTO monitor_runs (repo, started_at, status) VALUES (?, ?, 'running')",
            (repo, now_iso()),
        )
        return cur.lastrowid


def finish_monitor_run(
    run_id: int,
    status: str,
    new_issues: int = 0,
    updated_issues: int = 0,
    subtasks_created: int = 0,
    error: str | None = None,
) -> None:
    with tx() as c:
        c.execute(
            "UPDATE monitor_runs SET finished_at = ?, status = ?, new_issues_count = ?, "
            "updated_issues_count = ?, subtasks_created_count = ?, error = ? WHERE id = ?",
            (now_iso(), status, new_issues, updated_issues, subtasks_created, error, run_id),
        )


def get_active_repo() -> str | None:
    return get_meta("active_repo")


def set_active_repo(repo: str) -> None:
    set_meta("active_repo", repo)


def get_effective_repo(explicit: str | None = None) -> str:
    """Returns the requested repo, the current active repo from sync_meta,
    or the most recently added repo from the repos table.
    """
    if explicit:
        return explicit
    active = get_active_repo()
    if active:
        return active
    try:
        conn = get_conn()
        row = conn.execute("SELECT repo FROM repos ORDER BY added_at DESC LIMIT 1").fetchone()
        if row:
            set_active_repo(row["repo"])
            return row["repo"]
    except Exception:
        pass
    return "demo/repoguardian-seed"


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
) -> tuple[int, bool]:
    """Idempotent: re-polling the same unchanged issue (or re-triggering a repo-wide
    check within the same UTC day) is a no-op instead of piling up duplicate rows.
    Returns (id, created) -- id of the queued subtask (either the one just
    inserted, or the existing one that made this call a no-op), and whether
    this call actually inserted a new row. Callers counting "subtasks
    created" for a summary/audit trail need created, not just an id -- an id
    is returned either way, so counting calls instead of checking created
    silently overcounts by the number of no-op dedupe hits.

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
            return (existing["id"] if existing else -1), False
        return cur.lastrowid, True


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


# ==============================================================================
# Users & Sessions Management
# ==============================================================================

def upsert_user(github_data: dict, token_preview: str | None = None) -> dict:
    """Insert or update user record from GitHub API user profile payload."""
    now = now_iso()
    github_id = github_data.get("id")
    login = github_data.get("login") or ""
    name = github_data.get("name")
    avatar_url = github_data.get("avatar_url")
    email = github_data.get("email")
    html_url = github_data.get("html_url")
    bio = github_data.get("bio")
    company = github_data.get("company")
    location = github_data.get("location")
    public_repos = int(github_data.get("public_repos") or 0)
    followers = int(github_data.get("followers") or 0)

    with tx() as c:
        c.execute(
            """
            INSERT INTO users (
                github_id, login, name, avatar_url, email, html_url,
                bio, company, location, public_repos, followers,
                created_at, last_login_at, token_preview
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(login) DO UPDATE SET
                github_id = excluded.github_id,
                name = excluded.name,
                avatar_url = excluded.avatar_url,
                email = excluded.email,
                html_url = excluded.html_url,
                bio = excluded.bio,
                company = excluded.company,
                location = excluded.location,
                public_repos = excluded.public_repos,
                followers = excluded.followers,
                last_login_at = excluded.last_login_at,
                token_preview = COALESCE(excluded.token_preview, users.token_preview)
            """,
            (
                github_id, login, name, avatar_url, email, html_url,
                bio, company, location, public_repos, followers,
                now, now, token_preview
            ),
        )
        row = c.execute("SELECT * FROM users WHERE login = ?", (login,)).fetchone()
        return dict(row) if row else {}


def get_user_by_login(login: str) -> dict | None:
    row = get_conn().execute("SELECT * FROM users WHERE login = ?", (login,)).fetchone()
    return dict(row) if row else None


def get_user_by_id(user_id: int) -> dict | None:
    row = get_conn().execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return dict(row) if row else None


def get_latest_user() -> dict | None:
    row = get_conn().execute("SELECT * FROM users ORDER BY last_login_at DESC LIMIT 1").fetchone()
    return dict(row) if row else None


def create_session(user_id: int, github_token: str | None = None, session_token: str | None = None, expires_at: str | None = None) -> dict:
    token = session_token or str(uuid.uuid4())
    now = now_iso()
    with tx() as c:
        c.execute(
            """
            INSERT INTO sessions (session_token, user_id, github_token, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (token, user_id, github_token, now, expires_at),
        )
        row = c.execute("SELECT * FROM sessions WHERE session_token = ?", (token,)).fetchone()
        return dict(row) if row else {"session_token": token, "user_id": user_id}


def get_session(session_token: str) -> dict | None:
    row = get_conn().execute("SELECT * FROM sessions WHERE session_token = ?", (session_token,)).fetchone()
    return dict(row) if row else None


def get_session_user(session_token: str) -> tuple[dict | None, dict | None]:
    """Returns (user_dict, session_dict) for a given session token."""
    conn = get_conn()
    s_row = conn.execute("SELECT * FROM sessions WHERE session_token = ?", (session_token,)).fetchone()
    if not s_row:
        return None, None
    s_dict = dict(s_row)
    u_row = conn.execute("SELECT * FROM users WHERE id = ?", (s_dict["user_id"],)).fetchone()
    return (dict(u_row) if u_row else None), s_dict


def delete_session(session_token: str) -> bool:
    with tx() as c:
        cur = c.execute("DELETE FROM sessions WHERE session_token = ?", (session_token,))
        return cur.rowcount > 0
