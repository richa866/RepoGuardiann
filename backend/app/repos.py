"""Connect-a-repo orchestration: validates a repo, kicks off its sync as a
background thread, and tracks progress so the frontend can poll it instead
of blocking on one long request.

Concurrency choice: only one sync runs at a time, globally. If POST /connect
is called while a sync is already running, it's rejected with 409 and a
clear "sync already in progress for X" message rather than queued or
cancelled -- simplest thing that's still correct for a single-operator demo
tool, and it avoids two GitHub API budgets (rate limits) being spent at once
by accident.
"""
from __future__ import annotations

import logging
import re
import threading
import uuid

from app.config import settings
from app.db.database import (
    get_repo_row,
    log_monitor_event,
    set_active_repo,
    set_sync_state,
    upsert_repo,
)
from app.github.client import (
    GitHubClient,
    RateLimitError,
    RepoNotFoundError,
    RepoPrivateError,
    TokenInvalidError,
)
from app.github.fetch import run_sync
from app.monitor.processor import process_pending_subtasks

logger = logging.getLogger("repoguardian.repos")

_sync_lock = threading.Lock()
_sync_in_progress: str | None = None

REPO_PATTERN = re.compile(r"^[A-Za-z0-9_.\-]+/[A-Za-z0-9_.\-]+$")


class ConnectError(Exception):
    """Carries an HTTP status + machine-readable code for POST /connect."""

    def __init__(self, status: int, code: str, message: str):
        self.status = status
        self.code = code
        self.message = message
        super().__init__(message)


def _run_background_sync(repo: str, token: str | None, sync_id: str) -> None:
    global _sync_in_progress
    try:
        run_sync(repo, token=token, max_items=settings.connect_sync_max_items)

        set_sync_state(repo, stage="running_initial_analysis", current=0, total=0)
        total_processed = 0
        while True:
            processed = process_pending_subtasks(repo, limit=25)
            total_processed += processed
            set_sync_state(repo, current=total_processed)
            if processed == 0:
                break

        set_sync_state(repo, status="done", stage="done")
        log_monitor_event("connect_sync_complete", f"sync_id={sync_id}", repo=repo)
    except Exception as exc:
        logger.exception("background sync failed for %s", repo)
        set_sync_state(repo, status="error", error=str(exc))
        log_monitor_event("connect_sync_failed", f"sync_id={sync_id} error={exc}", repo=repo)
    finally:
        with _sync_lock:
            _sync_in_progress = None


def connect_repo(repo: str, token: str | None) -> dict:
    global _sync_in_progress

    repo = (repo or "").strip()
    if not REPO_PATTERN.match(repo):
        raise ConnectError(400, "invalid_repo_format", "Repository must be in 'owner/name' form")

    with _sync_lock:
        if _sync_in_progress is not None:
            raise ConnectError(
                409,
                "sync_in_progress",
                f"A sync is already in progress for '{_sync_in_progress}'. "
                "Wait for it to finish before connecting another repo.",
            )
        _sync_in_progress = repo  # reserve the slot before the network call

    try:
        client = GitHubClient(token or None)
        try:
            meta = client.validate_repo(repo)
        except RepoNotFoundError as exc:
            raise ConnectError(404, "not_found", str(exc)) from exc
        except TokenInvalidError as exc:
            raise ConnectError(401, "token_invalid", str(exc)) from exc
        except RepoPrivateError as exc:
            raise ConnectError(
                403,
                "private_no_token",
                f"'{repo}' is private — add a token to access it." if not token else str(exc),
            ) from exc
        except RateLimitError as exc:
            kind = "authenticated" if exc.authenticated else "unauthenticated"
            raise ConnectError(
                429,
                "rate_limited",
                f"GitHub {kind} rate limit reached — try again in a moment."
                + ("" if exc.authenticated else " (tip: add a token to raise the limit from 60/hr to 5000/hr)"),
            ) from exc

        sync_id = uuid.uuid4().hex
        upsert_repo(repo, token or None)
        set_active_repo(repo)
        set_sync_state(
            repo, sync_id=sync_id, status="running", stage="fetching_issues",
            current=0, total=settings.connect_sync_max_items, clear_error=True,
        )
        log_monitor_event("connect_started", f"sync_id={sync_id} private={meta.get('private')}", repo=repo)

        thread = threading.Thread(target=_run_background_sync, args=(repo, token or None, sync_id), daemon=True)
        thread.start()

        return {
            "repo": repo,
            "sync_id": sync_id,
            "status": "started",
            "private": meta.get("private", False),
            "description": meta.get("description"),
            "open_issues_count": meta.get("open_issues_count"),
        }
    except ConnectError:
        with _sync_lock:
            _sync_in_progress = None
        raise
    except Exception as exc:
        with _sync_lock:
            _sync_in_progress = None
        raise ConnectError(502, "github_unreachable", f"GitHub API request failed: {exc}") from exc


def get_sync_status(repo: str) -> dict:
    row = get_repo_row(repo)
    if not row:
        raise ConnectError(404, "unknown_repo", f"'{repo}' has not been connected yet")
    return {
        "repo": repo,
        "sync_id": row["sync_id"],
        "status": row["sync_status"],
        "stage": row["sync_stage"],
        "progress_current": row["sync_progress_current"],
        "progress_total": row["sync_progress_total"],
        "error": row["sync_error"],
        "last_sync_at": row["last_sync_at"],
    }
