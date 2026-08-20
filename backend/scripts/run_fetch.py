"""Unified CLI entrypoint for RepoGuardian data pipeline.
1. Initializes SQLite schema (init_db)
2. Runs GitHub issue & comment fetch pipeline with raw caching (fetch.py)
3. Runs Chroma vector embeddings backfill (embeddings.py)
4. Displays comprehensive pipeline summary and most-discussed issue.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path

# Reconfigure stdout to utf-8 for Windows cp1252 consoles
sys.stdout.reconfigure(encoding="utf-8")

# Add backend directory to sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv

load_dotenv(BACKEND_DIR / ".env")
load_dotenv(REPO_ROOT / ".env", override=False)

from app.db.database import get_conn, init_db
from app.github.fetch import fetch_repository_data
from app.rag.embeddings import (
    COLLECTION_NAME,
    embed_all_issues,
    get_collection,
)


def main():
    parser = argparse.ArgumentParser(
        description="Unified RepoGuardian CLI: init DB, fetch GitHub issues/comments, and backfill Chroma embeddings."
    )
    parser.add_argument(
        "--repo",
        type=str,
        default=os.getenv("TARGET_REPO", "encode/httpx"),
        help="Target GitHub repository (default: TARGET_REPO from .env)",
    )
    parser.add_argument(
        "--max-items",
        type=int,
        default=int(os.getenv("FULL_SYNC_MAX_ITEMS", "300")),
        help="Maximum issues to fetch and index (default: 300)",
    )
    parser.add_argument(
        "--force-refresh",
        action="store_true",
        help="Bypass local raw JSON cache and re-fetch from GitHub API",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    print("\n" + "=" * 76)
    print(f" REPO GUARDIAN — PIPELINE SYNC & EMBEDDING RUNNER")
    print(f" Target Repository: {args.repo}")
    print(f" Max Items:        {args.max_items}")
    print(f" Force Refresh:    {args.force_refresh}")
    print("=" * 76 + "\n")

    # Step 1: Initialize Database
    print("[1/3] Initializing SQLite database schema...")
    init_db()
    print("      [OK] Database tables and indexes verified.\n")

    # Step 2: Fetch and Cache Issues & Comments
    print(f"[2/3] Fetching and caching up to {args.max_items} issues & discussion comments for '{args.repo}'...")
    token = os.getenv("GITHUB_TOKEN") or None
    fetch_summary = fetch_repository_data(
        repo=args.repo,
        token=token,
        max_items=args.max_items,
        force_refresh=args.force_refresh,
    )
    print(f"      [OK] Fetched & normalized {fetch_summary['fetched_issues']} issues.\n")

    # Step 3: Embed all issues into ChromaDB Vector Store
    print(f"[3/3] Backfilling sentence-transformers vector embeddings into ChromaDB collection '{COLLECTION_NAME}'...")
    total_embedded = embed_all_issues(repo=args.repo)
    print(f"      [OK] Backfilled {total_embedded} vector embeddings.\n")

    # Step 4: Summary & Statistics Query
    conn = get_conn()
    cur = conn.cursor()

    # Query metrics
    cur.execute("SELECT count(*) FROM issues WHERE repo = ?", (args.repo,))
    total_issues = cur.fetchone()[0]

    cur.execute("SELECT count(*) FROM comments WHERE repo = ?", (args.repo,))
    total_comments = cur.fetchone()[0]

    cur.execute("SELECT count(*) FROM comments WHERE repo = ? AND is_maintainer = 1", (args.repo,))
    maintainer_comments = cur.fetchone()[0]

    cur.execute("SELECT count(*) FROM issues WHERE repo = ? AND is_pr = 1", (args.repo,))
    total_prs = cur.fetchone()[0]

    cur.execute("SELECT count(*) FROM issues WHERE repo = ? AND is_pr = 0", (args.repo,))
    total_issues_only = cur.fetchone()[0]

    cur.execute("SELECT count(*) FROM issues WHERE repo = ? AND state = 'open'", (args.repo,))
    open_issues = cur.fetchone()[0]

    cur.execute("SELECT count(*) FROM issues WHERE repo = ? AND state = 'closed'", (args.repo,))
    closed_issues = cur.fetchone()[0]

    cur.execute(
        "SELECT min(created_at), max(created_at), min(updated_at), max(updated_at) FROM issues WHERE repo = ?",
        (args.repo,),
    )
    min_created, max_created, min_updated, max_updated = cur.fetchone()

    chroma_coll = get_collection(COLLECTION_NAME)
    chroma_vector_count = chroma_coll.count()

    print("=" * 76)
    print(" PIPELINE EXECUTION SUMMARY")
    print("=" * 76)
    print(f" • Target Repository:        {args.repo}")
    print(f" • Total Issues Indexed:     {total_issues} ({open_issues} open, {closed_issues} closed)")
    print(f" • Issues vs PRs Breakdown:  {total_issues_only} Issues / {total_prs} Pull Requests")
    print(f" • Total Comments Stored:    {total_comments} ({maintainer_comments} maintainer responses)")
    print(f" • Date Range Covered:       {min_created[:10]} to {max_created[:10]}")
    print(f" • Chroma Vector Count:      {chroma_vector_count} embeddings in '{COLLECTION_NAME}'")
    print("=" * 76 + "\n")

    # Step 5: Most-discussed issue query
    print("=" * 76)
    print(" MOST-DISCUSSED ISSUE IN DATASET")
    print(" Query: SELECT * FROM issues WHERE number = (SELECT number FROM issues WHERE repo = ? ORDER BY comments_count DESC LIMIT 1)")
    print("=" * 76)

    cur.execute(
        """
        SELECT * FROM issues 
        WHERE repo = ? AND number = (
            SELECT number FROM issues WHERE repo = ? ORDER BY comments_count DESC LIMIT 1
        )
        """,
        (args.repo, args.repo),
    )
    row = cur.fetchone()
    if row:
        row_dict = dict(row)
        for key, val in row_dict.items():
            if key == "body" and val and len(val) > 250:
                print(f"  {key:<18}: {val[:250]}... [truncated]")
            else:
                print(f"  {key:<18}: {val}")
    else:
        print("  No issues found.")
    print("=" * 76 + "\n")


if __name__ == "__main__":
    main()
