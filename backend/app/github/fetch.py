"""GitHub fetch pipeline with file-based raw response caching.
Fetches issues, PRs, comments, and collaborators for a repository,
caching raw API payloads under data/raw_cache/<owner>_<repo>/<kind>/,
and normalizing records into SQLite tables (issues, comments).
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Callable

# Add backend directory to sys.path if running as script
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
REPO_ROOT = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv

load_dotenv(BACKEND_DIR / ".env")
load_dotenv(REPO_ROOT / ".env", override=False)

from app.db.database import (
    enqueue_subtask,
    get_conn,
    init_db,
    log_monitor_event,
    now_iso,
    prune_stale_issues,
    replace_comments,
    set_active_repo,
    set_meta,
    set_sync_state,
    upsert_issue,
    upsert_repo,
)
from app.github.client import GitHubClient, RateLimitError
from app.rag.embeddings import embed_issue

logger = logging.getLogger("repoguardian.github.fetch")


def get_cache_dir(repo: str) -> Path:
    """Returns directory path for raw caching: data/raw_cache/<owner>_<repo>/"""
    sanitized_repo = repo.replace("/", "_").replace("-", "_").lower()
    
    # Try repo_root/data/raw_cache, fallback to backend/data/raw_cache
    data_dir = REPO_ROOT / "data" / "raw_cache" / sanitized_repo
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


def get_cached_or_fetch(
    cache_path: Path,
    fetch_fn: Callable[[], Any],
    force_refresh: bool = False,
) -> tuple[Any, bool]:
    """Load JSON from cache if available, otherwise call fetch_fn and save to cache.
    Returns (data, is_cache_hit).
    """
    if not force_refresh and cache_path.exists():
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data, True
        except Exception as exc:
            logger.warning("Failed to read cache from %s (%s). Re-fetching.", cache_path, exc)

    data = fetch_fn()
    try:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as exc:
        logger.warning("Failed to write cache to %s: %s", cache_path, exc)

    return data, False


def normalize_issue(raw: dict) -> dict:
    """Normalizes raw GitHub issue/PR dict into database format."""
    labels = [lbl["name"] if isinstance(lbl, dict) else str(lbl) for lbl in raw.get("labels", [])]
    return {
        "number": raw["number"],
        "title": (raw.get("title") or "").strip(),
        "body": raw.get("body") or "",
        "state": raw.get("state", "open"),
        "is_pr": 1 if "pull_request" in raw else 0,
        "author": (raw.get("user") or {}).get("login", "unknown"),
        "labels": labels,
        "comments_count": int(raw.get("comments", 0)),
        "url": raw.get("html_url", ""),
        "created_at": raw.get("created_at"),
        "updated_at": raw.get("updated_at"),
        "closed_at": raw.get("closed_at"),
    }


def normalize_comment(raw: dict, maintainer_logins: set[str]) -> dict:
    """Normalizes raw GitHub comment dict and sets is_maintainer."""
    author = (raw.get("user") or {}).get("login", "unknown")
    author_assoc = raw.get("author_association", "")
    
    # Consider maintainer if in collaborator list OR author_association indicates maintainer/member
    is_maint = (
        author.lower() in maintainer_logins
        or author_assoc in ("OWNER", "MEMBER", "COLLABORATOR")
    )
    return {
        "github_comment_id": raw.get("id"),
        "author": author,
        "body": raw.get("body") or "",
        "created_at": raw.get("created_at"),
        "is_maintainer": 1 if is_maint else 0,
    }


def fetch_repository_data(
    repo: str,
    token: str | None = None,
    since: str | None = None,
    max_items: int = 300,
    force_refresh: bool = False,
    progress_callback: Callable[[str, int, int], None] | None = None,
) -> dict:
    """Main fetching routine:
    1. Fetches and caches repo collaborators.
    2. Fetches and caches up to max_items issues (paginated 100 per page).
    3. Fetches and caches all comments for each issue.
    4. Normalizes and stores everything into SQLite.
    """
    client = GitHubClient(token=token)
    cache_root = get_cache_dir(repo)
    init_db()
    upsert_repo(repo, token)

    set_sync_state(repo, status="running", stage="fetching_issues", current=0, total=max_items, clear_error=True)
    log_monitor_event("fetch_started", f"Fetching up to {max_items} issues for {repo}", repo=repo)

    try:
        # 1. Collaborators / Maintainers
        collab_cache = cache_root / "collaborators" / "collaborators.json"
        raw_collabs, collab_hit = get_cached_or_fetch(
            collab_cache,
            lambda: client.list_repo_collaborators(repo, max_items=100),
            force_refresh=force_refresh,
        )
        maintainer_logins = {
            c["login"].lower() for c in raw_collabs if isinstance(c, dict) and "login" in c
        }
        logger.info(
            "[fetch] Loaded %d collaborators/maintainers (cache=%s)",
            len(maintainer_logins),
            "HIT" if collab_hit else "MISS",
        )

        # 2. Issues & Comments
        fetched_count = 0
        total_comments_count = 0
        open_count = 0
        closed_count = 0
        pr_count = 0
        new_issue_count = 0
        updated_issue_count = 0
        subtasks_created_count = 0
        per_page = 100

        # Two fetch strategies, chosen by whether this is the very first sync
        # for this repo (since=None) or a periodic/incremental poll
        # (since=<timestamp from the last sync>):
        #
        # - Initial/full sync (since=None): fetch state="open" up to
        #   max_items, THEN state="closed" up to max_items -- each phase gets
        #   its OWN budget (the same configured max_items, not a hardcoded
        #   number, not split between them). Most-recent-first is GitHub's
        #   own default sort (updated desc), unchanged. Previously open and
        #   closed shared ONE combined budget (open items first), so closed
        #   items -- and whatever mix of closed issues vs closed PRs happened
        #   to be most recently updated within that shrinking budget -- got
        #   whatever was left over. E.g. httpie/cli has 648 closed PRs on
        #   GitHub; under the shared-budget version we only ever stored 325
        #   of them. Now every phase, for every repo, gets the same full
        #   max_items budget, so none of them compete with each other for it.
        #
        # - Incremental poll (since=<timestamp>): a single state="all" pass
        #   with GitHub's `since` filter, also capped at max_items. Must stay
        #   state="all" rather than split into open/closed -- a
        #   state="open"-only query stops returning an issue the instant it's
        #   closed, so it could never detect a close. Also see
        #   effective_force_refresh below: without it, every poll tick was
        #   replaying the very first cached page-1 response forever and never
        #   actually reflecting anything that changed on GitHub, no matter how
        #   often the scheduler ticked.
        if since:
            phases = [("all", max_items, since)]
        else:
            phases = [("open", max_items, None), ("closed", max_items, None)]

        # Incremental polls exist specifically to reflect live GitHub state, so
        # they must never serve a stale cached page -- force_refresh=True here
        # regardless of the caller's own force_refresh (which only governs the
        # rarer, dev-facing initial/full-sync cache reuse).
        effective_force_refresh = force_refresh or bool(since)

        for state, phase_budget, phase_since in phases:
            phase_fetched = 0
            phase_numbers: set[int] = set()
            page = 1
            while phase_fetched < phase_budget:
                page_cache = cache_root / "issues" / f"page_{state}_{page}_per{per_page}.json"

                raw_issues_page, page_hit = get_cached_or_fetch(
                    page_cache,
                    lambda state=state, phase_since=phase_since, page=page: client.list_issues(
                        repo, state=state, since=phase_since, per_page=per_page, page=page
                    ),
                    force_refresh=effective_force_refresh,
                )

                if not raw_issues_page or not isinstance(raw_issues_page, list):
                    break

                for raw_issue in raw_issues_page:
                    norm_issue = normalize_issue(raw_issue)
                    # upsert_issue only reports changed/unchanged, not new-vs-updated --
                    # check existence first so monitor_runs can report the two separately.
                    is_new = get_conn().execute(
                        "SELECT 1 FROM issues WHERE repo = ? AND number = ?",
                        (repo, norm_issue["number"]),
                    ).fetchone() is None
                    changed = upsert_issue(repo, norm_issue)
                    fetched_count += 1
                    phase_fetched += 1
                    phase_numbers.add(norm_issue["number"])

                    if norm_issue["state"] == "open":
                        open_count += 1
                    else:
                        closed_count += 1
                    if norm_issue["is_pr"]:
                        pr_count += 1

                    # Fetch Comments if issue has comments
                    issue_comments = []
                    if norm_issue["comments_count"] > 0:
                        comments_cache = cache_root / "comments" / f"issue_{norm_issue['number']}_comments.json"
                        raw_comments, _ = get_cached_or_fetch(
                            comments_cache,
                            lambda n=norm_issue["number"]: client.list_comments(repo, n, max_items=100),
                            force_refresh=effective_force_refresh,
                        )
                        if isinstance(raw_comments, list):
                            issue_comments = [
                                normalize_comment(c, maintainer_logins) for c in raw_comments
                            ]
                            replace_comments(repo, norm_issue["number"], issue_comments)
                            total_comments_count += len(issue_comments)

                    # Only embed + queue agent work for issues that actually changed --
                    # re-embedding/re-queueing ~300 unchanged issues on every sync would
                    # waste local embedding compute and spam the subtask queue (though
                    # enqueue_subtask's own dedupe_key would still no-op it, better to
                    # not even try). embed_issue itself doesn't need `changed` for
                    # correctness (Chroma upsert is idempotent) but there's no reason to
                    # redo it either.
                    if changed:
                        if is_new:
                            new_issue_count += 1
                        else:
                            updated_issue_count += 1
                        embed_issue(repo=repo, issue=norm_issue, comments=issue_comments)
                        _, created1 = enqueue_subtask(repo, "duplicate_check", norm_issue["number"], norm_issue["updated_at"])
                        _, created2 = enqueue_subtask(repo, "missing_info_check", norm_issue["number"], norm_issue["updated_at"])
                        subtasks_created_count += int(created1) + int(created2)

                    # Log one-line summary per issue processed
                    kind_str = "PR" if norm_issue["is_pr"] else "Issue"
                    title_snippet = (norm_issue["title"][:45] + "...") if len(norm_issue["title"]) > 45 else norm_issue["title"]
                    logger.info(
                        "[fetch] Issue #%d [%s, %s] '%s' by @%s | %d comments (cache=%s)",
                        norm_issue["number"],
                        norm_issue["state"],
                        kind_str,
                        title_snippet,
                        norm_issue["author"],
                        len(issue_comments),
                        "HIT" if page_hit else "MISS",
                    )

                    if progress_callback:
                        progress_callback("fetching_issues", fetched_count, phase_budget)
                    set_sync_state(repo, current=fetched_count, total=phase_budget)

                    if phase_fetched >= phase_budget:
                        break

                if len(raw_issues_page) < per_page:
                    break
                page += 1

            if phase_fetched >= max_items:
                logger.warning(
                    "[fetch] %s hit the max_items cap (%d) while fetching %s items -- "
                    "some items beyond the latest %d may be missing from this sync",
                    repo, max_items, state, max_items,
                )

            # "Show only the latest max_items" has to mean the DB actually
            # forgets anything older than that window too, not just that this
            # one fetch was capped -- otherwise every full sync only ever
            # grows the stored total (each run adds up to max_items more
            # on top of whatever was already there from a previous run),
            # which is exactly how pallets/flask ended up with 402 stored
            # closed PRs despite every individual sync being capped at
            # max_items: old items from an earlier run just never left.
            # Only prune on a full/initial sync (since=None) -- an
            # incremental poll's `state="all"` phase only ever sees a small
            # recently-changed slice, and phase_numbers there is nowhere near
            # a complete "latest max_items" set, so pruning against it would
            # wipe out everything the last full sync correctly stored.
            if since is None:
                removed = prune_stale_issues(repo, state, keep_numbers=phase_numbers)
                if removed:
                    logger.info(
                        "[fetch] %s pruned %d stale %s item(s) outside the latest %d",
                        repo, removed, state, max_items,
                    )


        _, health_created = enqueue_subtask(repo, "health_trend_check", None)
        subtasks_created_count += int(health_created)
        set_meta(f"last_sync_{repo}", now_iso())
        set_sync_state(repo, status="done", stage="done", current=fetched_count, total=fetched_count)
        log_monitor_event(
            "fetch_completed",
            f"Fetched {fetched_count} issues ({open_count} open, {closed_count} closed, {pr_count} PRs), {total_comments_count} comments",
            repo=repo,
        )

        summary = {
            "repo": repo,
            "fetched_issues": fetched_count,
            "new_issues": new_issue_count,
            "updated_issues": updated_issue_count,
            "subtasks_created": subtasks_created_count,
            "open_issues": open_count,
            "closed_issues": closed_count,
            "pull_requests": pr_count,
            "issues_only": fetched_count - pr_count,
            "total_comments": total_comments_count,
            "maintainers_count": len(maintainer_logins),
        }

        final_summary_line = (
            f"[fetch] Completed sync for {repo}: fetched {fetched_count} issues "
            f"({open_count} open, {closed_count} closed, {pr_count} PRs, {fetched_count - pr_count} Issues), "
            f"{total_comments_count} comments stored, {len(maintainer_logins)} maintainers identified."
        )
        logger.info(final_summary_line)
        return summary

    except RateLimitError as exc:
        error_msg = f"GitHub rate limit hit. Resets at epoch {exc.reset_epoch}"
        logger.error(error_msg)
        set_sync_state(repo, status="error", error=error_msg)
        log_monitor_event("sync_rate_limited", error_msg, repo=repo)
        return {"repo": repo, "status": "error", "error": error_msg}
    except Exception as exc:
        error_msg = f"Sync failed: {exc}"
        logger.exception(error_msg)
        set_sync_state(repo, status="error", error=error_msg)
        log_monitor_event("sync_error", error_msg, repo=repo)
        return {"repo": repo, "status": "error", "error": error_msg}


def run_sync(
    repo: str,
    token: str | None = None,
    since: str | None = None,
    max_items: int = 300,
    progress_callback: Callable[[str, int, int], None] | None = None,
) -> dict:
    """Wrapper function matching run_sync signature for background workers.

    `since` used to be accepted here and silently dropped -- fetch_repository_data
    was never told about it, so every periodic poll re-ran a full state="all"
    fetch from page 1 instead of an incremental since-filtered one. Now threaded
    through properly; see fetch_repository_data's phase-selection comment for
    why `since` also implies force_refresh (a poll must never replay a stale
    cached page)."""
    return fetch_repository_data(
        repo=repo,
        token=token,
        since=since,
        max_items=max_items,
        force_refresh=False,
        progress_callback=progress_callback,
    )


def main():
    parser = argparse.ArgumentParser(description="Fetch and cache GitHub issues and comments.")
    parser.add_argument(
        "--repo",
        type=str,
        default=os.getenv("TARGET_REPO", "encode/httpx"),
        help="Repository in owner/name form (default: from TARGET_REPO in .env)",
    )
    parser.add_argument(
        "--max-items",
        type=int,
        default=int(os.getenv("FULL_SYNC_MAX_ITEMS", "300")),
        help="Maximum issues to fetch (default: 300)",
    )
    parser.add_argument(
        "--force-refresh",
        action="store_true",
        help="Bypass local raw cache and force fresh API fetch",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    print(f"[*] Starting GitHub Fetch for repository: {args.repo}")
    print(f"[*] Max items: {args.max_items} | Force refresh: {args.force_refresh}")
    print(f"[*] Cache location: {get_cache_dir(args.repo)}\n")

    summary = fetch_repository_data(
        repo=args.repo,
        token=os.getenv("GITHUB_TOKEN"),
        max_items=args.max_items,
        force_refresh=args.force_refresh,
    )

    print("\n" + "=" * 70)
    print(
        f"[fetch] Completed sync for {summary['repo']}: fetched {summary['fetched_issues']} issues "
        f"({summary['open_issues']} open, {summary['closed_issues']} closed, {summary['pull_requests']} PRs, {summary['issues_only']} Issues), "
        f"{summary['total_comments']} comments stored, {summary['maintainers_count']} maintainers identified."
    )
    print("=" * 70 + "\n")

    # Show query: SELECT number, title, state, comments_count FROM issues LIMIT 5
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT number, title, state, comments_count AS comment_count FROM issues WHERE repo = ? ORDER BY updated_at DESC LIMIT 5",
        (args.repo,),
    )
    rows = cur.fetchall()
    print("=== SELECT number, title, state, comment_count FROM issues LIMIT 5 ===")
    for r in rows:
        print(f"#{r['number']} | {r['state'].upper():6s} | comments: {r['comment_count']:2d} | {r['title']}")
    print("=" * 70)


if __name__ == "__main__":
    main()
