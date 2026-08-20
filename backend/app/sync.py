"""Fetch-from-GitHub + embed + enqueue pipeline. Used by POST /sync (manual
resync of the active repo) and by POST /connect's background sync (used by
both the .env auto-bootstrap on startup and the frontend's live "connect a
repo" flow). Any new/changed issue gets duplicate_check and missing_info_check
subtasks queued; health_trend_check is queued once per sync, not per-issue.

`run_sync` takes an explicit (repo, token) pair rather than reading from
global settings -- this is what makes the pipeline multi-repo: the same code
path handles the .env-configured default repo AND any repo a user connects
live from the frontend, they just pass different (repo, token) in.
"""
from __future__ import annotations

import logging
import re

from app.database import (
    enqueue_subtask,
    get_meta,
    log_monitor_event,
    now_iso,
    replace_comments,
    set_meta,
    set_sync_state,
    upsert_issue,
)
from app.github_client import GitHubClient, normalize_comment, normalize_issue
from app.rag import embed_issue

logger = logging.getLogger("repoguardian.sync")

RESOLUTION_PATTERNS = [
    re.compile(r"duplicate of #(\d+)", re.I),
    re.compile(r"closed as duplicate", re.I),
    re.compile(r"fixed in ([\w.\-]+)", re.I),
    re.compile(r"resolved in ([\w.\-]+)", re.I),
]


def _extract_resolution(comments: list[dict]) -> str:
    for c in reversed(comments):  # most recent first
        text = c.get("body") or ""
        for pat in RESOLUTION_PATTERNS:
            m = pat.search(text)
            if m:
                return m.group(0)
    return ""


def run_sync(repo: str, token: str | None, max_items: int = 300, *, track_progress: bool = False) -> dict:
    """Full pipeline: fetch -> store -> embed -> enqueue subtasks for changed
    issues, scoped to `repo`. If track_progress is True, writes stage/progress
    into the `repos` table as it goes so GET /sync/status can report it (used
    by the live-connect flow; the plain POST /sync button doesn't need it)."""
    client = GitHubClient(token, repo)
    log_monitor_event("sync_started", f"max_items={max_items}", repo=repo)

    if track_progress:
        set_sync_state(repo, stage="fetching_issues", current=0, total=max_items)

    raw_issues = client.fetch_issues(max_items=max_items)
    changed_numbers: list[int] = []

    if track_progress:
        set_sync_state(repo, stage="embedding_history", current=0, total=len(raw_issues))

    for i, raw in enumerate(raw_issues):
        issue = normalize_issue(raw)
        changed = upsert_issue(repo, issue)

        comments_raw = client.fetch_comments(issue["number"]) if issue["comments_count"] else []
        comments = [normalize_comment(c) for c in comments_raw]
        replace_comments(repo, issue["number"], comments)

        resolution = _extract_resolution(comments) if issue["state"] == "closed" else ""
        embed_issue(repo, issue["number"], issue["title"], issue["body"], issue["state"], resolution)

        if changed:
            changed_numbers.append(issue["number"])

        if track_progress:
            set_sync_state(repo, current=i + 1)

    if track_progress:
        set_sync_state(repo, stage="running_initial_analysis", current=0, total=len(changed_numbers))

    for number in changed_numbers:
        enqueue_subtask(repo, "duplicate_check", number)
        enqueue_subtask(repo, "missing_info_check", number)

    if changed_numbers:
        enqueue_subtask(repo, "health_trend_check", None)

    set_meta(f"last_sync_at:{repo}", now_iso())
    log_monitor_event(
        "sync_finished",
        f"fetched={len(raw_issues)} changed={len(changed_numbers)}",
        repo=repo,
    )

    return {
        "repo": repo,
        "fetched": len(raw_issues),
        "changed": len(changed_numbers),
        "changed_numbers": changed_numbers,
        "last_sync_at": get_meta(f"last_sync_at:{repo}"),
    }
