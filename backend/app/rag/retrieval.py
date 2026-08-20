"""Project-Aware RAG: Top-k similar issues + maintainer resolution notes.
"""
from __future__ import annotations

import logging
from app.rag.embeddings import get_collection

logger = logging.getLogger("repoguardian.rag.retrieval")


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
