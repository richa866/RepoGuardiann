"""Project-Aware RAG: Top-k similar issues + maintainer resolution notes.
"""
from __future__ import annotations

import logging
import re

from app.db.database import get_conn
from app.rag.embeddings import get_collection

logger = logging.getLogger("repoguardian.rag.retrieval")

# Our schema has no is_maintainer column on comments, so "maintainer comment"
# is approximated the same way app.agent.tools.response_time_check already
# does: any comment NOT from the issue's own author. Good enough signal --
# a real maintainer role would need a separate GitHub API call per commenter
# (collaborator check) that we don't make today.
DECISION_KEYWORDS = [
    r"duplicate of\s*#?\d+",
    r"won'?t\s*fix",
    r"wontfix",
    r"fixed in\s+\S+",
    r"closed as\s+\w+",
    r"not planned",
]
DECISION_REGEX = re.compile("|".join(DECISION_KEYWORDS), re.IGNORECASE)


def find_similar(
    repo: str,
    query_text: str,
    top_k: int = 5,
    exclude_number: int | None = None,
) -> list[dict]:
    coll = get_collection(repo)
    if coll.count() == 0:
        return []

    n_results = min(top_k + (1 if exclude_number is not None else 0), coll.count())
    res = coll.query(query_texts=[query_text], n_results=n_results)

    matches: list[dict] = []
    if not res or not res["ids"] or not res["ids"][0]:
        return matches

    ids = res["ids"][0]
    distances = res["distances"][0] if res.get("distances") else [0.0] * len(ids)
    metadatas = res["metadatas"][0] if res.get("metadatas") else [{}] * len(ids)
    documents = res["documents"][0] if res.get("documents") else [""] * len(ids)

    for doc_id, dist, meta, doc in zip(ids, distances, metadatas, documents):
        num = meta.get("number")
        if exclude_number is not None and num == exclude_number:
            continue
        similarity = max(0.0, min(1.0, 1.0 - float(dist)))
        matches.append({
            "repo": repo,
            "number": num,
            "title": meta.get("title", ""),
            "state": meta.get("state", "open"),
            "similarity": round(similarity, 4),
            "distance": round(float(dist), 4),
            "snippet": doc[:300],
        })
        if len(matches) >= top_k:
            break

    return matches


def get_decision_context(repo: str, similar_issue_numbers: list[int]) -> list[dict]:
    """For each similar issue, surface real maintainer-decision text: any
    comment matching closing-decision language ("duplicate of #X", "wontfix",
    "fixed in vX.Y", "closed as ...", "not planned"), plus always the last 2
    non-author comments regardless, so the agent has real decision text to
    cite even when no keyword hits."""
    conn = get_conn()
    contexts: list[dict] = []

    for number in similar_issue_numbers:
        issue_row = conn.execute(
            "SELECT author, state FROM issues WHERE repo = ? AND number = ?", (repo, number)
        ).fetchone()
        if not issue_row:
            continue
        issue_author = issue_row["author"]

        comments = conn.execute(
            "SELECT author, body, created_at FROM comments "
            "WHERE repo = ? AND issue_number = ? ORDER BY created_at ASC",
            (repo, number),
        ).fetchall()
        maintainer_comments = [c for c in comments if c["author"] != issue_author]

        excerpts = []
        for c in maintainer_comments:
            body = c["body"] or ""
            m = DECISION_REGEX.search(body)
            if m:
                excerpts.append({
                    "author": c["author"],
                    "created_at": c["created_at"],
                    "text": body.strip(),
                    "matched_phrase": m.group(0),
                })

        if not excerpts:
            for c in maintainer_comments[-2:]:
                excerpts.append({
                    "author": c["author"],
                    "created_at": c["created_at"],
                    "text": (c["body"] or "").strip(),
                    "matched_phrase": None,
                })

        contexts.append({
            "number": number,
            "state": issue_row["state"],
            "excerpts": excerpts,
        })

    return contexts
