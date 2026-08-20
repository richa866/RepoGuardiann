"""One-shot Phase 1 CLI runner for fetching GitHub repository issues.
"""
import sys
import os
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.github.fetch import run_sync
from app.config import settings

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch issues from GitHub")
    parser.add_argument("--repo", default=settings.github_repo or "httpie/cli", help="Repository (owner/name)")
    parser.add_argument("--token", default=settings.github_token, help="GitHub Personal Access Token")
    parser.add_argument("--max", type=int, default=100, help="Max issues to fetch")
    args = parser.parse_args()

    print(f"Fetching issues for {args.repo}...")
    res = run_sync(args.repo, token=args.token, max_items=args.max)
    print("Result:", res)
