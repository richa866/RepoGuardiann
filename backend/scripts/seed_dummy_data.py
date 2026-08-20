"""Seeds SQLite + Chroma with dummy issues so DB, RAG, escalation, and the
frontend can all be exercised with zero GitHub/Gemini keys. Uses the
exact same upsert_issue/embed_issue code path as the real GitHub sync.

Run: python backend/scripts/seed_dummy_data.py
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db.database import (
    enqueue_subtask,
    init_db,
    replace_comments,
    set_active_repo,
    upsert_issue,
    upsert_repo,
)
from app.rag.embeddings import embed_issue

init_db()

DEMO_REPO = "demo/repoguardian-seed"


def days_ago(n: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=n)).isoformat()


DUMMY_ISSUES = [
    dict(
        number=1,
        title="App crashes on startup with segfault",
        body="The app crashes immediately. No steps to reproduce yet, just started happening.",
        state="open",
        is_pr=0,
        author="alice",
        labels=[],
        comments_count=0,
        url="https://github.com/example/repo/issues/1",
        created_at=days_ago(9),
        updated_at=days_ago(9),
        closed_at=None,
    ),
    dict(
        number=2,
        title="Crash on launch, segmentation fault",
        body="Same as others -- opening the app crashes it right away.",
        state="open",
        is_pr=0,
        author="bob",
        labels=[],
        comments_count=0,
        url="https://github.com/example/repo/issues/2",
        created_at=days_ago(7),
        updated_at=days_ago(7),
        closed_at=None,
    ),
    dict(
        number=3,
        title="Remote code execution via crafted config file",
        body="A specially crafted config.yaml can trigger arbitrary code execution (RCE) when loaded. "
             "This looks like a serious vulnerability / potential CVE.",
        state="open",
        is_pr=0,
        author="carol",
        labels=["bug"],
        comments_count=1,
        url="https://github.com/example/repo/issues/3",
        created_at=days_ago(1),
        updated_at=days_ago(1),
        closed_at=None,
    ),
    dict(
        number=4,
        title="Dark mode toggle does nothing",
        body="Steps to reproduce: 1) open settings 2) click dark mode 3) nothing changes. "
             "Expected: theme switches. Actual: no change. Environment: macOS 14, app v2.3.1.",
        state="open",
        is_pr=0,
        author="dave",
        labels=["bug", "ui"],
        comments_count=2,
        url="https://github.com/example/repo/issues/4",
        created_at=days_ago(3),
        updated_at=days_ago(1),
        closed_at=None,
    ),
    dict(
        number=5,
        title="Old memory leak in background worker",
        body="Long-running background workers slowly leak memory over several hours.",
        state="closed",
        is_pr=0,
        author="erin",
        labels=["bug", "performance"],
        comments_count=3,
        url="https://github.com/example/repo/issues/5",
        created_at=days_ago(120),
        updated_at=days_ago(90),
        closed_at=days_ago(90),
    ),
    dict(
        number=6,
        title="Background worker leaking memory after v2.0 upgrade",
        body="Steps to reproduce: run worker for 2+ hours, RSS keeps climbing. "
             "Environment: Linux, app v2.0.0. This looks like a recurrence of an old issue.",
        state="open",
        is_pr=0,
        author="frank",
        labels=["bug"],
        comments_count=0,
        url="https://github.com/example/repo/issues/6",
        created_at=days_ago(2),
        updated_at=days_ago(2),
        closed_at=None,
    ),
    dict(
        number=7,
        title="Typo in README",
        body="Small typo: 'recieve' should be 'receive'.",
        state="open",
        is_pr=0,
        author="grace",
        labels=[],
        comments_count=0,
        url="https://github.com/example/repo/issues/7",
        created_at=days_ago(45),
        updated_at=days_ago(45),
        closed_at=None,
    ),
    dict(
        number=8,
        title="Proposal: drop Python 2 support in next major version",
        body="Proposing we drop Python 2 support entirely in v3.0 to simplify the codebase.",
        state="open",
        is_pr=0,
        author="henry",
        labels=["proposal"],
        comments_count=6,
        url="https://github.com/example/repo/issues/8",
        created_at=days_ago(6),
        updated_at=days_ago(1),
        closed_at=None,
    ),
]

DUMMY_COMMENTS = {
    3: [
        dict(github_comment_id=901, author="maintainer1", body="Confirmed, investigating urgently.", created_at=days_ago(1)),
    ],
    4: [
        dict(github_comment_id=902, author="maintainer1", body="Can you share your OS theme setting too?", created_at=days_ago(2)),
        dict(github_comment_id=903, author="dave", body="Sure, it's set to Auto.", created_at=days_ago(1)),
    ],
    5: [
        dict(github_comment_id=904, author="maintainer1", body="Thanks for the report, looking into it.", created_at=days_ago(110)),
        dict(github_comment_id=905, author="maintainer1", body="Root cause found, unbounded queue growth.", created_at=days_ago(95)),
        dict(github_comment_id=906, author="maintainer1", body="Fixed in v2.1, closed as duplicate tracking removed.", created_at=days_ago(90)),
    ],
    8: [
        dict(github_comment_id=910, author="maintainer1", body="I disagree with dropping Python 2 this soon, we still have enterprise users on it.", created_at=days_ago(5)),
        dict(github_comment_id=911, author="henry", body="It's already end-of-life upstream, I think we should push forward.", created_at=days_ago(4)),
        dict(github_comment_id=912, author="irene", body="Strongly oppose -- this will break our deployment pipeline.", created_at=days_ago(3)),
        dict(github_comment_id=913, author="jack", body="+1 to dropping it, maintaining both is a real cost.", created_at=days_ago(2)),
        dict(github_comment_id=914, author="irene", body="Can we at least get a 6 month deprecation window before this?", created_at=days_ago(2)),
        dict(github_comment_id=915, author="maintainer1", body="Let's discuss at the next maintainer sync, marking wontfix for v3.0 for now.", created_at=days_ago(1)),
    ],
}


def main():
    upsert_repo(DEMO_REPO, None)
    set_active_repo(DEMO_REPO)

    for issue in DUMMY_ISSUES:
        upsert_issue(DEMO_REPO, issue)
        comments = DUMMY_COMMENTS.get(issue["number"], [])
        replace_comments(DEMO_REPO, issue["number"], comments)
        embed_issue(DEMO_REPO, issue, comments)

    for issue in DUMMY_ISSUES:
        enqueue_subtask(DEMO_REPO, "duplicate_check", issue["number"])
        enqueue_subtask(DEMO_REPO, "missing_info_check", issue["number"])
    enqueue_subtask(DEMO_REPO, "health_trend_check", None)

    print(f"[OK] Seeded {len(DUMMY_ISSUES)} dummy issues into '{DEMO_REPO}', embedded into Chroma, "
          f"queued {len(DUMMY_ISSUES) * 2 + 1} subtasks. Set as the active repo.")


if __name__ == "__main__":
    main()
