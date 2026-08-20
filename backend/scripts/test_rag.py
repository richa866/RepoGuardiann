"""RAG verification script -- proves Project-Aware RAG is real, not a
placeholder. Picks real closed issues from the database, runs find_similar
and get_decision_context on each, and prints the real scores and real
maintainer text so the team can see it with their own eyes.

Run: python scripts/test_rag.py <owner/repo> [issue_number ...]
If no issue numbers are given, picks the 3 closed issues with the most
comments (best chance of having real discussion/decision text to show).
"""
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.database import get_conn
from app.rag.retrieval import find_similar, get_decision_context


def pick_sample_issues(conn, repo: str, n: int = 3) -> list[dict]:
    rows = conn.execute(
        "SELECT number, title, body, state, comments_count FROM issues "
        "WHERE repo = ? AND state = 'closed' ORDER BY comments_count DESC LIMIT ?",
        (repo, n),
    ).fetchall()
    return [dict(r) for r in rows]


def print_issue_report(repo: str, issue: dict) -> None:
    print("=" * 78)
    print(f"#{issue['number']}  {issue['title']}")
    print(f"state={issue['state']}  comments={issue.get('comments_count', '?')}")
    print("-" * 78)

    query_text = f"{issue['title']}\n\n{issue.get('body') or ''}"
    matches = find_similar(repo, query_text, top_k=5, exclude_number=issue["number"])

    if not matches:
        print("find_similar: no matches returned.")
        return

    print(f"find_similar -> {len(matches)} match(es):")
    for m in matches:
        print(f"  #{m['number']:<6} {m['similarity']:.1%}  ({m['state']:<6})  {m['title'][:55]}")

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
    if len(sys.argv) < 2:
        print("Usage: python scripts/test_rag.py <owner/repo> [issue_number ...]")
        sys.exit(1)

    repo = sys.argv[1]
    conn = get_conn()

    if len(sys.argv) > 2:
        numbers = [int(n) for n in sys.argv[2:]]
        issues = []
        for n in numbers:
            row = conn.execute(
                "SELECT number, title, body, state, comments_count FROM issues WHERE repo = ? AND number = ?",
                (repo, n),
            ).fetchone()
            if row:
                issues.append(dict(row))
    else:
        issues = pick_sample_issues(conn, repo)

    if not issues:
        print(f"No issues found for {repo}. Run a sync first.")
        sys.exit(1)

    print(f"Testing RAG against {len(issues)} real issue(s) from {repo}\n")
    for issue in issues:
        print_issue_report(repo, issue)


if __name__ == "__main__":
    main()
