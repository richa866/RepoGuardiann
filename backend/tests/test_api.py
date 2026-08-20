from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "github_configured" in data

def test_monitor_status():
    resp = client.get("/monitor/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "scheduler_running" in data
