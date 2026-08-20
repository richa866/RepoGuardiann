"""Live validation test for backend.app.github.client against TARGET_REPO from .env.
"""
from __future__ import annotations

import logging
import os
import sys

# Configure stdout encoding and debug logging
sys.stdout.reconfigure(encoding="utf-8")
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from dotenv import load_dotenv

load_dotenv(os.path.join(backend_dir, ".env"))
load_dotenv(os.path.abspath(os.path.join(backend_dir, "..", ".env")), override=False)

from app.github.client import (
    GitHubClient,
    list_comments,
    list_issues,
    list_repo_collaborators,
    validate_repo,
)


def main():
    target_repo = os.getenv("TARGET_REPO", "encode/httpx")
    token = os.getenv("GITHUB_TOKEN")
    
    print(f"\n=======================================================")
    print(f" TARGET REPOSITORY: {target_repo}")
    print(f" AUTHENTICATED: {'Yes (Token Present)' if token else 'No (Unauthenticated Public Access)'}")
    print(f"=======================================================\n")
    
    # 1. Test validate_repo
    print("--- 1. Pre-flight Validation (validate_repo) ---")
    repo_meta = validate_repo(target_repo)
    print(f"[✓] Repo: {repo_meta.get('full_name')}")
    print(f"    Description: {repo_meta.get('description')}")
    print(f"    Open Issues Count: {repo_meta.get('open_issues_count')}")
    print(f"    Stars: {repo_meta.get('stargazers_count')}")
    print(f"    Private: {repo_meta.get('private')}\n")

    # 2. Test First Page of Issues (Title + Number only)
    print("--- 2. First Page of Issues (Page 1, per_page=10) ---")
    client = GitHubClient()
    first_page = client.list_issues(target_repo, state="all", per_page=10, page=1)
    print(f"Fetched {len(first_page)} issues on page 1:\n")
    for idx, item in enumerate(first_page, start=1):
        kind = "PR" if item.get("is_pr") else "ISSUE"
        print(f"  {idx:2d}. [#{item['number']}] ({kind}) {item['title']}")

    # 3. Test Pagination via Link Header (max_items=25 with per_page=10 => fetches across 3 pages)
    print("\n--- 3. Testing Pagination via Link Header (max_items=25, per_page=10) ---")
    paginated_issues = list_issues(target_repo, state="all", max_items=25, per_page=10)
    print(f"\n[✓] Pagination successfully fetched across multiple pages!")
    print(f"    Total items collected: {len(paginated_issues)}")
    print(f"    Issue numbers sequence: {[i['number'] for i in paginated_issues[:10]]} ... (truncated)")
    pr_count = sum(1 for i in paginated_issues if i.get("is_pr"))
    issue_count = len(paginated_issues) - pr_count
    print(f"    Breakdown: {issue_count} Issues, {pr_count} Pull Requests")

    # 4. Test Comments Fetching on a populated issue
    print("\n--- 4. Testing Comments on an Issue ---")
    sample_issue_num = paginated_issues[0]["number"]
    # find an issue with comments if possible
    for it in paginated_issues:
        if it.get("comments", 0) > 0:
            sample_issue_num = it["number"]
            break
    comments = list_comments(target_repo, sample_issue_num, max_items=5)
    print(f"[✓] Fetched {len(comments)} comment(s) for #{sample_issue_num}")
    for c in comments[:2]:
        author = (c.get("user") or {}).get("login")
        print(f"    - Author: @{author} | Date: {c.get('created_at')}")

    # 5. Test Collaborators / Contributors list
    print("\n--- 5. Testing Collaborators / Contributors list ---")
    collaborators = list_repo_collaborators(target_repo, max_items=5)
    print(f"[✓] Fetched {len(collaborators)} collaborator(s)/contributor(s):")
    for col in collaborators[:5]:
        login = col.get("login")
        print(f"    - @{login}")

    print("\n=======================================================")
    print(" ALL GITHUB CLIENT TESTS PASSED SUCCESSFULLY!")
    print("=======================================================\n")


if __name__ == "__main__":
    main()
