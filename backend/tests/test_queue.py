"""Regression test for enqueue_subtask()'s dedupe_key idempotency (see CONTRACTS.md,
subtasks). Runs against an isolated throwaway SQLite file so it never reads or pollutes
the real dev database and doesn't depend on test execution order.
"""
import pytest

from app.config import settings
from app.db import database


@pytest.fixture
def isolated_db(tmp_path, monkeypatch):
    db_path = tmp_path / "test_repoguardian.db"
    monkeypatch.setattr(settings, "database_path", str(db_path))
    # get_conn() caches one connection per thread; drop it so init_db() below
    # actually opens the temp file instead of reusing a connection an earlier
    # test module (e.g. test_api.py importing app.main) may have cached.
    database._local.conn = None
    database.init_db()
    yield
    conn = getattr(database._local, "conn", None)
    if conn is not None:
        conn.close()
    database._local.conn = None


def _count(repo: str, issue_number: int | None, task_type: str) -> int:
    conn = database.get_conn()
    if issue_number is None:
        # "= NULL" is never true in SQL (three-valued logic) -- needs IS NULL
        return conn.execute(
            "SELECT COUNT(*) c FROM subtasks WHERE repo = ? AND issue_number IS NULL AND task_type = ?",
            (repo, task_type),
        ).fetchone()["c"]
    return conn.execute(
        "SELECT COUNT(*) c FROM subtasks WHERE repo = ? AND issue_number = ? AND task_type = ?",
        (repo, issue_number, task_type),
    ).fetchone()["c"]


def test_enqueue_subtask_is_idempotent_for_unchanged_issue(isolated_db):
    id1 = database.enqueue_subtask("acme/repo", "duplicate_check", 42, "2026-01-01T00:00:00Z")
    id2 = database.enqueue_subtask("acme/repo", "duplicate_check", 42, "2026-01-01T00:00:00Z")

    assert id1 == id2, "re-enqueuing the same (repo, issue, type, updated_at) must be a no-op"
    assert _count("acme/repo", 42, "duplicate_check") == 1


def test_enqueue_subtask_requeues_when_issue_actually_changed(isolated_db):
    id1 = database.enqueue_subtask("acme/repo", "duplicate_check", 42, "2026-01-01T00:00:00Z")
    id2 = database.enqueue_subtask("acme/repo", "duplicate_check", 42, "2026-01-02T00:00:00Z")

    assert id1 != id2, "a genuinely updated issue must get a fresh subtask, not be swallowed as a dup"
    assert _count("acme/repo", 42, "duplicate_check") == 2


def test_enqueue_subtask_dedupes_repo_wide_checks_within_the_same_day(isolated_db):
    id1 = database.enqueue_subtask("acme/repo", "health_trend_check", None)
    id2 = database.enqueue_subtask("acme/repo", "health_trend_check", None)

    assert id1 == id2, "repeated triggers within the same day shouldn't spam health_trend_check rows"
    assert _count("acme/repo", None, "health_trend_check") == 1


def test_enqueue_subtask_keys_are_scoped_per_repo(isolated_db):
    """Same issue number in two different connected repos must not collide."""
    id1 = database.enqueue_subtask("acme/repo-one", "duplicate_check", 42, "2026-01-01T00:00:00Z")
    id2 = database.enqueue_subtask("acme/repo-two", "duplicate_check", 42, "2026-01-01T00:00:00Z")

    assert id1 != id2
    assert _count("acme/repo-one", 42, "duplicate_check") == 1
    assert _count("acme/repo-two", 42, "duplicate_check") == 1
