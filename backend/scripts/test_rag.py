"""RAG verification script -- proves Project-Aware RAG is real, not a
placeholder. Runs find_similar and get_decision_context against real issues
and prints the real scores and real maintainer text so the team can see it
with their own eyes.

Run: python backend/scripts/test_rag.py [owner/repo] [issue_number ...]
"""
from __future__ import annotations

import os
import sys

# Windows UTF-8 reconfigure
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.agent.tools import DUPLICATE_SIMILARITY_THRESHOLD, duplicate_check
from app.db.database import get_active_repo, get_conn
from app.rag.retrieval import find_similar, get_decision_context


def print_issue_report(repo: str, issue: dict, note: str = "") -> None:
    print("=" * 78)
    print(f"#{issue['number']}  {issue['title']}" + (f"   [{note}]" if note else ""))
    print(f"state={issue['state']}  comments={issue.get('comments_count', '?')}")
    print("-" * 78)

    query_text = f"{issue['title']}\n\n{issue.get('body') or ''}"
    matches = find_similar(repo, query_text, top_k=5, exclude_number=issue["number"])

    if not matches:
        print("find_similar: no matches returned.")
        print()
        return

    print(f"find_similar -> {len(matches)} match(es):")
    for m in matches:
        flag = "DUPLICATE" if m["similarity"] >= DUPLICATE_SIMILARITY_THRESHOLD and m["state"] == "open" else ""
        print(f"  #{m['number']:<6} {m['similarity']:.1%}  ({m['state']:<6}) {flag:<10} {m['title'][:50]}")

    similar_numbers = [m["number"] for m in matches]
    contexts = get_decision_context(repo, similar_numbers)
    ctx_by_number = {c["number"]: c for c in contexts}

    print("\nget_decision_context:")
    for m in matches:
        ctx = ctx_by_number.get(m["number"])
        if not ctx or not ctx["excerpts"]:
            print(f"  #{m['number']}: no comments on record")
            continue
        for ex in ctx["excerpts"]:
            tag = f"[matched: {ex['matched_phrase']}]" if ex["matched_phrase"] else "[fallback: recent comment]"
            snippet = ex["text"][:120].replace("\n", " ")
            print(f"  #{m['number']} {tag} {ex['author']}: {snippet}")
    print()


def main():
    repo = sys.argv[1] if len(sys.argv) > 1 else (get_active_repo() or "encode/httpx")
    conn = get_conn()

    if len(sys.argv) > 2:
        numbers = [int(n) for n in sys.argv[2:]]
        sample = [(n, "") for n in numbers]
    else:
        # Pick 5 real sample issues from SQLite database
        rows = conn.execute(
            "SELECT number FROM issues WHERE repo = ? ORDER BY comments_count DESC LIMIT 5",
            (repo,),
        ).fetchall()
        sample = [(r["number"], "most discussed") for r in rows]

    issues = []
    for number, note in sample:
        row = conn.execute(
            "SELECT number, title, body, state, comments_count FROM issues WHERE repo = ? AND number = ?",
            (repo, number),
        ).fetchone()
        if row:
            issues.append((dict(row), note))

    if not issues:
        print(f"No issues found for {repo}. Run a sync first.")
        sys.exit(1)

    print(f"Testing RAG against {len(issues)} real issue(s) from {repo}\n")
    for issue, note in issues:
        print_issue_report(repo, issue, note)


if __name__ == "__main__":
    main()
