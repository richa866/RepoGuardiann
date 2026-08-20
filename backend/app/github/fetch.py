"""Phase 1: Fetch, normalize, store, and cache GitHub issue data.
"""
from __future__ import annotations

import logging
from typing import Callable

from app.db.database import (
    enqueue_subtask,
    get_meta,
    log_monitor_event,
    now_iso,
    replace_comments,
    set_meta,
    set_sync_state,
    upsert_issue,
)
from app.github.client import GitHubClient, RateLimitError
from app.rag.embeddings import embed_issue

logger = logging.getLogger("repoguardian.github.fetch")


def normalize_issue(raw: dict) -> dict:
    return {
        "number": raw["number"],
        "title": raw.get("title", ""),
        "body": raw.get("body") or "",
        "state": raw.get("state", "open"),
        "is_pr": 1 if "pull_request" in raw else 0,
        "author": (raw.get("user") or {}).get("login", "unknown"),
        "labels": [lbl["name"] if isinstance(lbl, dict) else str(lbl) for lbl in raw.get("labels", [])],
        "comments_count": raw.get("comments", 0),
        "url": raw.get("html_url", ""),
        "created_at": raw.get("created_at"),
        "updated_at": raw.get("updated_at"),
        "closed_at": raw.get("closed_at"),
    }


def normalize_comment(raw: dict) -> dict:
    return {
        "github_comment_id": raw.get("id"),
        "author": (raw.get("user") or {}).get("login", "unknown"),
        "body": raw.get("body") or "",
        "created_at": raw.get("created_at"),
    }


def sync_issue_comments(client: GitHubClient, repo: str, issue_number: int) -> list[dict]:
    raw_comments = client.list_comments(repo, issue_number)
    normalized = [normalize_comment(c) for c in raw_comments]
    replace_comments(repo, issue_number, normalized)
    return normalized


def run_sync(
    repo: str,
    token: str | None = None,
    since: str | None = None,
    max_items: int = 200,
    progress_callback: Callable[[str, int, int], None] | None = None,
) -> dict:
    client = GitHubClient(token=token)
    set_sync_state(repo, status="running", stage="fetching_issues", current=0, total=0, clear_error=True)
    log_monitor_event("sync_started", f"Starting sync for {repo}", repo=repo)

    page = 1
    fetched = 0
    changed_issues: list[dict] = []
    error_msg: str | None = None

    try:
        while fetched < max_items:
            per_page = min(100, max_items - fetched)
            raw_issues = client.list_issues(repo=repo, state="all", since=since, per_page=per_page, page=page)
            if not raw_issues:
                break

            for raw in raw_issues:
                norm = normalize_issue(raw)
                changed = upsert_issue(repo, norm)
                if changed:
                    changed_issues.append(norm)
                fetched += 1
                if progress_callback:
                    progress_callback("fetching_issues", fetched, max_items)
                set_sync_state(repo, current=fetched, total=max_items)

            if len(raw_issues) < per_page:
                break
            page += 1

        set_sync_state(repo, stage="embedding_history", current=0, total=len(changed_issues))
        for idx, issue in enumerate(changed_issues, start=1):
            try:
                comments = sync_issue_comments(client, repo, issue["number"])
            except Exception as exc:
                logger.warning("Could not fetch comments for %s#%s: %s", repo, issue["number"], exc)
                comments = []

            embed_issue(repo=repo, issue=issue, comments=comments)
            enqueue_subtask(repo, "duplicate_check", issue["number"])
            enqueue_subtask(repo, "missing_info_check", issue["number"])
            if progress_callback:
                progress_callback("embedding_history", idx, len(changed_issues))
            set_sync_state(repo, current=idx, total=len(changed_issues))

        enqueue_subtask(repo, "health_trend_check", None)
        set_meta(f"last_sync_{repo}", now_iso())
        set_sync_state(repo, status="done", stage="done", current=fetched, total=fetched)
        log_monitor_event("sync_completed", f"Synced {fetched} issues, {len(changed_issues)} changed", repo=repo)

    except RateLimitError as exc:
        error_msg = f"GitHub rate limit hit. Resets at epoch {exc.reset_epoch}"
        logger.error(error_msg)
        set_sync_state(repo, status="error", error=error_msg)
        log_monitor_event("sync_rate_limited", error_msg, repo=repo)
    except Exception as exc:
        error_msg = f"Sync failed: {exc}"
        logger.exception(error_msg)
        set_sync_state(repo, status="error", error=error_msg)
        log_monitor_event("sync_error", error_msg, repo=repo)

    return {
        "repo": repo,
        "fetched": fetched,
        "changed": len(changed_issues),
        "status": "error" if error_msg else "done",
        "error": error_msg,
    }
