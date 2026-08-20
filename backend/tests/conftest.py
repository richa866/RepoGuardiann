"""Session-wide test setup.

Without this, any test that hits the FastAPI app via TestClient blows up with
"no such table" on a fresh checkout: TestClient(app) used without `with` never
runs the app's lifespan startup event, so init_db() never fires and none of
the tables (sync_meta, issues, subtasks, ...) exist yet. And even once tables
exist, tests would otherwise read/write the real dev database at
data/repoguardian.db instead of an isolated one.

This fixture initializes an isolated, throwaway SQLite file before any test
runs, so the whole suite is self-contained and order-independent.
"""
import pytest

from app.config import settings
from app.db import database


@pytest.fixture(scope="session", autouse=True)
def _test_database(tmp_path_factory):
    db_path = tmp_path_factory.mktemp("db") / "test_repoguardian.db"
    original_path = settings.database_path
    settings.database_path = str(db_path)
    database._local.conn = None
    database.init_db()
    yield
    conn = getattr(database._local, "conn", None)
    if conn is not None:
        conn.close()
    database._local.conn = None
    settings.database_path = original_path
