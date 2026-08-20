"""CLI Database Initializer.
Initializes SQLite database using schema.sql and prints tables and schema.
"""
from __future__ import annotations

import os
import sys

# Ensure backend directory is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db.database import get_conn, get_db_path, init_db


def main():
    db_path = get_db_path()
    print(f"[*] Initializing database at: {db_path}")
    conn = init_db()
    
    # 1. Fetch table list (.tables equivalent)
    cur = conn.cursor()
    cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
    )
    tables = [row["name"] for row in cur.fetchall()]
    
    print("\n=== .tables ===")
    print("  ".join(tables))
    
    # 2. Fetch schema for table 'issues' (.schema issues equivalent)
    print("\n=== .schema issues ===")
    cur.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='issues';"
    )
    issue_schema = cur.fetchone()
    if issue_schema:
        print(issue_schema["sql"])
        
    # Also fetch and show indexes for issues
    cur.execute(
        "SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='issues' AND sql IS NOT NULL;"
    )
    for idx in cur.fetchall():
        print(idx["sql"])

    # 3. Fetch schema for subtasks (.schema subtasks equivalent)
    print("\n=== .schema subtasks ===")
    cur.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='subtasks';"
    )
    subtasks_schema = cur.fetchone()
    if subtasks_schema:
        print(subtasks_schema["sql"])

    # Also fetch and show indexes for subtasks
    cur.execute(
        "SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='subtasks' AND sql IS NOT NULL;"
    )
    for idx in cur.fetchall():
        print(idx["sql"])

    print("\n[OK] Database successfully initialized.")


if __name__ == "__main__":
    main()
