"""Project-aware RAG: Chroma + sentence-transformers, local-only, no API key.
Same code path is used tonight (dummy seed issues) and tomorrow (real fetched
issues) -- embed_issue() and find_similar() don't know or care where the text
came from.

Multi-repo note: one shared Chroma collection holds embeddings for every
connected repo. Each vector's id is "{repo}#{number}" and its metadata
carries `repo`, so find_similar() always filters with `where={"repo": repo}`
-- otherwise a search on repo A could surface a numerically-colliding issue
from repo B.
"""
from __future__ import annotations

import os

# The sentence-transformers model is downloaded once and cached locally; once
# cached, skip the network round-trip HF's client otherwise makes on every
# call to check for updates -- meaningfully faster embedding during a demo.
os.environ.setdefault("HF_HUB_OFFLINE", "1")

import chromadb
from chromadb.utils import embedding_functions

from app.config import settings

_client = None
_collection = None
_embed_fn = None


def _get_collection():
    global _client, _collection, _embed_fn
    if _collection is None:
        _client = chromadb.PersistentClient(path=settings.chroma_path)
        _embed_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )
        _collection = _client.get_or_create_collection(
            name="issues",
            embedding_function=_embed_fn,
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def _vector_id(repo: str, number: int) -> str:
    return f"{repo}#{number}"


def issue_document(title: str, body: str) -> str:
    return f"{title}\n\n{body or ''}".strip()


def embed_issue(repo: str, number: int, title: str, body: str, state: str, resolution: str = "") -> None:
    """Insert or update the embedding for one issue. `resolution` is an
    optional short note like 'closed as duplicate of #42' / 'fixed in v2.1',
    surfaced later as maintainer-decision context for RAG matches."""
    col = _get_collection()
    doc = issue_document(title, body)
    col.upsert(
        ids=[_vector_id(repo, number)],
        documents=[doc],
        metadatas=[{"repo": repo, "number": number, "title": title, "state": state, "resolution": resolution}],
    )


def find_similar(repo: str, number: int, title: str, body: str, top_k: int = 5) -> list[dict]:
    """Returns top-k similar issues from the SAME repo (excluding itself),
    with cosine similarity scores in [0, 1] (1 = identical)."""
    col = _get_collection()
    total = col.count()
    if total == 0:
        return []
    doc = issue_document(title, body)
    results = col.query(
        query_texts=[doc],
        n_results=min(top_k + 1, total),
        where={"repo": repo},
    )
    if not results["metadatas"] or not results["metadatas"][0]:
        return []
    matches = []
    for i, meta in enumerate(results["metadatas"][0]):
        if meta["number"] == number and meta["repo"] == repo:
            continue
        distance = results["distances"][0][i]
        similarity = max(0.0, 1 - distance / 2)  # cosine distance -> similarity
        matches.append(
            {
                "number": meta["number"],
                "title": meta["title"],
                "state": meta["state"],
                "resolution": meta.get("resolution", ""),
                "similarity": round(similarity, 4),
            }
        )
    return matches[:top_k]


def collection_size(repo: str | None = None) -> int:
    col = _get_collection()
    if repo is None:
        return col.count()
    got = col.get(where={"repo": repo})
    return len(got["ids"])
