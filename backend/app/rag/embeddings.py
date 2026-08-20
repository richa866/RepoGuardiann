"""ChromaDB vector embeddings layer using sentence-transformers (all-MiniLM-L6-v2).
Embeds issues and PRs into the local 'repoguardian_issues' Chroma vector collection.
Matches CONTRACTS.md specification.
"""
from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path
from typing import Any

import chromadb
from chromadb.utils import embedding_functions

# Ensure backend directory is in sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
REPO_ROOT = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv

load_dotenv(BACKEND_DIR / ".env")
load_dotenv(REPO_ROOT / ".env", override=False)

from app.config import settings
from app.db.database import get_conn

logger = logging.getLogger("repoguardian.rag.embeddings")

COLLECTION_NAME = "repoguardian_issues"

_client: chromadb.ClientAPI | None = None
_embed_fn: Any = None


def get_chroma_path() -> str:
    """Resolve ChromaDB persistent directory path from environment or config."""
    chroma_path = os.getenv("CHROMA_PATH") or getattr(settings, "chroma_path", "./data/chromadb")
    p = Path(chroma_path)
    if not p.is_absolute():
        p = (REPO_ROOT / p).resolve()
    p.mkdir(parents=True, exist_ok=True)
    return str(p)


def _get_client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        target_path = get_chroma_path()
        logger.info("[chroma] Initializing PersistentClient at %s", target_path)
        _client = chromadb.PersistentClient(path=target_path)
    return _client


def _get_embed_fn():
    global _embed_fn
    if _embed_fn is None:
        model_name = getattr(settings, "embedding_model", "all-MiniLM-L6-v2")
        logger.info("[chroma] Loading sentence-transformers model: %s", model_name)
        _embed_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=model_name
        )
    return _embed_fn


def get_collection(name: str = COLLECTION_NAME):
    """Returns the persistent ChromaDB collection for issues vector search."""
    client = _get_client()
    return client.get_or_create_collection(
        name=name,
        embedding_function=_get_embed_fn(),
        metadata={"hnsw:space": "cosine"},
    )


def vector_id(repo: str, issue_number: int) -> str:
    """Deterministic document ID for vector database."""
    return f"{repo}#{issue_number}"


def format_issue_document(title: str, body: str | None) -> str:
    """Embed title + "\n\n" + body per CONTRACTS.md."""
    body_text = (body or "").strip()
    return f"{title.strip()}\n\n{body_text}"


issue_document = format_issue_document


def format_labels(labels_val: Any) -> str:
    """Converts labels list or JSON string into comma-joined string for Chroma metadata."""
    if isinstance(labels_val, str):
        try:
            parsed = json.loads(labels_val)
            if isinstance(parsed, list):
                return ",".join(str(l) for l in parsed)
        except Exception:
            return labels_val
        return labels_val
    elif isinstance(labels_val, list):
        return ",".join(str(l) for l in labels_val)
    return ""


def embed_issue(repo: str, issue: dict, comments: list[dict] | None = None) -> None:
    """Embeds a single issue into the Chroma collection."""
    coll = get_collection(COLLECTION_NAME)
    title = issue.get("title", "")
    body = issue.get("body", "")
    doc = format_issue_document(title, body)
    doc_id = vector_id(repo, issue["number"])
    
    labels_str = format_labels(issue.get("labels", []))
    meta = {
        "number": int(issue["number"]),
        "title": str(title)[:200],
        "state": str(issue.get("state", "open")),
        "is_pr": bool(issue.get("is_pr", False)),
        "labels": labels_str,
        "created_at": str(issue.get("created_at") or ""),
        "closed_at": str(issue.get("closed_at") or ""),
        "repo": str(repo),
    }
    coll.upsert(ids=[doc_id], documents=[doc], metadatas=[meta])


def embed_all_issues(repo: str | None = None, batch_size: int = 64) -> int:
    """Reads all issues from SQLite and batch embeds them into ChromaDB."""
    conn = get_conn()
    cur = conn.cursor()
    if repo:
        cur.execute(
            "SELECT repo, number, title, body, state, is_pr, labels, created_at, closed_at FROM issues WHERE repo = ?",
            (repo,),
        )
    else:
        cur.execute(
            "SELECT repo, number, title, body, state, is_pr, labels, created_at, closed_at FROM issues"
        )
    rows = cur.fetchall()
    if not rows:
        logger.warning("[chroma] No issues found in SQLite database to embed.")
        return 0

    coll = get_collection(COLLECTION_NAME)
    total_embedded = 0

    ids: list[str] = []
    docs: list[str] = []
    metadatas: list[dict] = []

    for r in rows:
        row_dict = dict(r)
        r_repo = row_dict["repo"]
        r_num = int(row_dict["number"])
        r_title = row_dict["title"] or ""
        r_body = row_dict["body"] or ""
        
        doc_id = vector_id(r_repo, r_num)
        doc_text = format_issue_document(r_title, r_body)
        labels_str = format_labels(row_dict.get("labels", "[]"))

        meta = {
            "number": r_num,
            "title": str(r_title)[:200],
            "state": str(row_dict.get("state") or "open"),
            "is_pr": bool(row_dict.get("is_pr", False)),
            "labels": labels_str,
            "created_at": str(row_dict.get("created_at") or ""),
            "closed_at": str(row_dict.get("closed_at") or ""),
            "repo": str(r_repo),
        }

        ids.append(doc_id)
        docs.append(doc_text)
        metadatas.append(meta)

        if len(ids) >= batch_size:
            coll.upsert(ids=ids, documents=docs, metadatas=metadatas)
            total_embedded += len(ids)
            ids, docs, metadatas = [], [], []

    if ids:
        coll.upsert(ids=ids, documents=docs, metadatas=metadatas)
        total_embedded += len(ids)

    logger.info("[chroma] Successfully embedded %d issues into '%s'", total_embedded, COLLECTION_NAME)
    return total_embedded


def collection_size(repo: str | None = None) -> int:
    """Returns the total number of embedded documents in the collection."""
    try:
        return get_collection(COLLECTION_NAME).count()
    except Exception:
        return 0


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    print(f"[*] Initializing ChromaDB embeddings in: {get_chroma_path()}")
    target_repo = os.getenv("TARGET_REPO", "encode/httpx")
    
    # 1. Embed all issues from SQLite
    embedded = embed_all_issues(repo=None)
    coll = get_collection(COLLECTION_NAME)
    count = coll.count()
    
    print("\n" + "=" * 70)
    print(f"[✓] collection.count() = {count}")
    print("=" * 70 + "\n")

    # 2. Example Query: query_texts=["memory leak"], n_results=3
    print("--- Example Query: collection.query(query_texts=['memory leak'], n_results=3) ---\n")
    query_results = coll.query(query_texts=["memory leak"], n_results=3)

    ids = query_results["ids"][0]
    distances = query_results["distances"][0]
    metas = query_results["metadatas"][0]
    documents = query_results["documents"][0]

    for idx, (doc_id, dist, meta, doc) in enumerate(zip(ids, distances, metas, documents), start=1):
        similarity = max(0.0, 1.0 - float(dist))
        kind = "PR" if meta.get("is_pr") else "Issue"
        print(f"Match #{idx}:")
        print(f"  ID:          {doc_id}")
        print(f"  Issue:       #{meta.get('number')} ({kind}) [{meta.get('state', '').upper()}]")
        print(f"  Title:       {meta.get('title')}")
        print(f"  Similarity:  {similarity:.4f} (Cosine Distance: {dist:.4f})")
        print(f"  Labels:      {meta.get('labels')}")
        print(f"  Created:     {meta.get('created_at')}")
        print(f"  Closed:      {meta.get('closed_at') or 'N/A'}")
        body_preview = doc.replace('\n', ' ')[:140]
        print(f"  Snippet:     {body_preview}...")
        print("-" * 70)


if __name__ == "__main__":
    main()
