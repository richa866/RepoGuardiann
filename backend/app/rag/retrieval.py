"""Project-Aware RAG: Top-k similar issues + maintainer resolution notes.
"""
from __future__ import annotations

import logging
import re
from typing import Any

from app.db.database import get_conn
from app.rag.embeddings import get_collection

logger = logging.getLogger("repoguardian.rag.retrieval")

# Regex to catch maintainer decision statements in comments
DECISION_REGEX = re.compile(
    r"(fixed in|closing as duplicate|closed via|duplicate of|won'?t fix|by design|"
    r"not a bug|resolved by|superseded by|see #\d+|already fixed|intended behavior|workaround:)",
    re.IGNORECASE,
)


def find_similar(
    repo: str,
    query_text: str,
    top_k: int = 5,
    exclude_number: int | None = None,
) -> list[dict]:
    """Finds top-k semantically similar issues using ChromaDB vector search."""
    coll = get_collection()
    if coll.count() == 0:
        return []

    n_results = min(top_k + (1 if exclude_number is not None else 0), coll.count())
    where_filter = {"repo": repo} if repo else None
    res = coll.query(query_texts=[query_text], n_results=n_results, where=where_filter)

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


def get_decision_context(repo: str, issue_numbers: list[int]) -> list[dict]:
    """Given a list of issue numbers, queries SQLite for maintainer comments
    and extracts decision excerpts matching decision phrases or fallback comments.
    """
    if not issue_numbers:
        return []

    conn = get_conn()
    contexts: list[dict] = []

    for number in issue_numbers:
        issue_row = conn.execute(
            "SELECT state, author FROM issues WHERE repo = ? AND number = ?",
            (repo, number),
        ).fetchone()

        if not issue_row:
            continue

        issue_author = issue_row["author"]
        comments = conn.execute(
            "SELECT author, body, created_at, is_maintainer FROM comments WHERE repo = ? AND issue_number = ? ORDER BY created_at ASC",
            (repo, number),
        ).fetchall()

        # Prioritize comments from maintainers (or anyone other than the author)
        maintainer_comments = [
            c for c in comments if c["is_maintainer"] == 1 or c["author"] != issue_author
        ]
        if not maintainer_comments and comments:
            maintainer_comments = list(comments)

        excerpts: list[dict] = []
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

        # Fallback to the last 2 comments if no explicit decision phrase matched
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
