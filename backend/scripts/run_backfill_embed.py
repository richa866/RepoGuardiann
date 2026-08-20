"""One-shot script to backfill Chroma vector embeddings from SQLite.
"""
import sys
import os
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.database import get_conn, get_active_repo
from app.rag.embeddings import embed_issue

if __name__ == "__main__":
    repo = sys.argv[1] if len(sys.argv) > 1 else get_active_repo()
    if not repo:
        print("Usage: python run_backfill_embed.py <owner/repo>")
        sys.exit(1)

    conn = get_conn()
    rows = conn.execute("SELECT * FROM issues WHERE repo = ?", (repo,)).fetchall()
    print(f"Backfilling {len(rows)} issues for {repo}...")

    for r in rows:
        issue = dict(r)
        issue["labels"] = json.loads(issue["labels"] or "[]")
        comments = [dict(c) for c in conn.execute(
            "SELECT * FROM comments WHERE repo = ? AND issue_number = ? ORDER BY created_at ASC",
            (repo, issue["number"])
        ).fetchall()]
        embed_issue(repo, issue, comments)

    print("SUCCESS: Backfilled embeddings.")
