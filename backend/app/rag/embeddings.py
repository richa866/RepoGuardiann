"""Chroma vector store embeddings using sentence-transformers (all-MiniLM-L6-v2).
"""
from __future__ import annotations

import logging
from typing import Any

import chromadb
from chromadb.utils import embedding_functions

from app.config import settings

logger = logging.getLogger("repoguardian.rag.embeddings")

_client: chromadb.ClientAPI | None = None
_embed_fn: Any = None


def _get_client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=settings.chroma_path)
    return _client


def _get_embed_fn():
    global _embed_fn
    if _embed_fn is None:
        _embed_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=settings.embedding_model
        )
    return _embed_fn


def _collection_name(repo: str) -> str:
    cleaned = repo.replace("/", "__").replace("-", "_").lower()
    return f"repo_issues__{cleaned}"


def get_collection(repo: str):
    client = _get_client()
    return client.get_or_create_collection(
        name=_collection_name(repo),
        embedding_function=_get_embed_fn(),
        metadata={"hnsw:space": "cosine"},
    )


def vector_id(repo: str, issue_number: int) -> str:
    return f"{repo}#{issue_number}"


def issue_document(issue: dict, comments: list[dict] | None = None) -> str:
    parts = [
        f"Title: {issue.get('title', '')}",
        f"State: {issue.get('state', 'open')}",
        f"Labels: {', '.join(issue.get('labels') or [])}",
        f"Body:\n{issue.get('body') or ''}",
    ]
    if comments:
        comment_texts = [f"Comment by {c.get('author')}: {c.get('body')}" for c in comments[:5]]
        parts.append("Discussion:\n" + "\n---\n".join(comment_texts))
    return "\n\n".join(parts)


def embed_issue(repo: str, issue: dict, comments: list[dict] | None = None) -> None:
    coll = get_collection(repo)
    doc = issue_document(issue, comments)
    doc_id = vector_id(repo, issue["number"])
    meta = {
        "repo": repo,
        "number": int(issue["number"]),
        "state": str(issue.get("state", "open")),
        "is_pr": int(issue.get("is_pr", 0)),
        "author": str(issue.get("author") or "unknown"),
        "title": str(issue.get("title", ""))[:200],
    }
    coll.upsert(ids=[doc_id], documents=[doc], metadatas=[meta])


def collection_size(repo: str) -> int:
    try:
        return get_collection(repo).count()
    except Exception:
        return 0
