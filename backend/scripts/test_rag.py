"""RAG verification script -- proves Project-Aware RAG is real, not a
placeholder. Runs find_similar and get_decision_context against real issues
and prints the real scores and real maintainer text so the team can see it
with their own eyes.

Run: python scripts/test_rag.py [owner/repo] [issue_number ...]
If no owner/repo is given, uses the active connected repo. If no issue
numbers are given, runs the adversarial regression sample below (15 real
issues: normal duplicate clusters, near-identical titles that are NOT
duplicates, closed issues with zero comments, and near-empty bodies).

The ADVERSARIAL_ASSERTIONS block encodes ground truth found by hand during
threshold calibration (see the DUPLICATE_SIMILARITY_THRESHOLD comment in
app/agent/tools.py) -- this is what makes it a *regression* script: if a
future threshold or embedding change flips one of these, this script fails
loudly instead of silently.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Real GitHub comment text often contains unicode (em-dashes, curly quotes,
# non-ASCII usernames) that Windows' default cp1252 console can't encode.
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from app.agent.tools import DUPLICATE_SIMILARITY_THRESHOLD, duplicate_check
from app.db.database import get_active_repo, get_conn
from app.rag.retrieval import find_similar, get_decision_context

# Curated adversarial sample for httpie/cli, found during Step 5/7 calibration.
# (number, why it's here)
ADVERSARIAL_SAMPLE = [
    (1640, "normal case: real duplicate PR cluster (JSON content-type bug)"),
    (1936, "normal case: real duplicate, different wording (#1623 credential decoding)"),
    (1849, "adversarial: near-identical vocabulary to #1852, NOT actually a duplicate"),
    (1852, "adversarial: near-identical vocabulary to #1849, NOT actually a duplicate"),
    (1865, "adversarial: empty body (spam/test issue)"),
    (1867, "adversarial: 5-char body (spam/test issue)"),
    (1878, "adversarial: 4-char body, literally 'test'"),
    (1813, "adversarial: closed, zero comments -- decision_context must degrade gracefully"),
    (1837, "adversarial: closed, zero comments -- decision_context must degrade gracefully"),
    (1864, "adversarial: closed, zero comments, but part of a real duplicate cluster (#912)"),
    (83, "adversarial: 472-comment pinned test/discussion issue, not a real bug report"),
    (1857, "normal case: closed issue with real comments, part of a real duplicate cluster"),
    (1928, "normal case: real regression candidate (closed, 92% similar to open #1929)"),
    (912, "normal case: original feature request with a real duplicate cluster"),
    (1892, "normal case: real duplicate, docs PR cluster (pipx install instructions)"),
]

# Ground truth assertions: (issue, expected_match, should_be_flagged_duplicate)
ADVERSARIAL_ASSERTIONS = [
    (1936, 1931, True),   # same bug #1623, different wording -- must be flagged post Step-5 fix
    (1849, 1852, False),  # shared vocabulary, different bugs -- must NOT be flagged
    (1852, 1849, False),
]


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


def run_assertions(repo: str) -> bool:
    """Calls the real production duplicate_check() -- not a reimplementation
    of its threshold/state logic -- so this test can't silently drift from
    what actually runs in the pipeline."""
    print("=" * 78)
    print("GROUND TRUTH ASSERTIONS")
    print("-" * 78)
    all_passed = True
    for number, expected_match, should_flag in ADVERSARIAL_ASSERTIONS:
        result = duplicate_check(repo, number, top_k=10)
        if result.get("error"):
            print(f"  SKIP #{number}: {result['error']}")
            continue
        match = next((m for m in result["matches"] if m["number"] == expected_match), None)
        sim = match["similarity"] if match else 0.0
        is_flagged = bool(match and match["is_likely_duplicate"])
        ok = is_flagged == should_flag
        all_passed = all_passed and ok
        status = "PASS" if ok else "FAIL"
        expect_str = "should flag" if should_flag else "should NOT flag"
        print(f"  [{status}] #{number} vs #{expected_match}: {sim:.1%} ({expect_str}, threshold={DUPLICATE_SIMILARITY_THRESHOLD:.0%})")
    print()
    return all_passed


def main():
    repo = sys.argv[1] if len(sys.argv) > 1 else (get_active_repo() or "encode/httpx")
    conn = get_conn()

    if len(sys.argv) > 2:
        numbers = [int(n) for n in sys.argv[2:]]
        sample = [(n, "") for n in numbers]
    else:
        sample = ADVERSARIAL_SAMPLE

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

    if len(sys.argv) <= 2:
        passed = run_assertions(repo)
        sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
