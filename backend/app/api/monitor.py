"""Monitor API router: GET /monitor/status, POST /monitor/check-now, POST /monitor/trigger
"""
from __future__ import annotations

from fastapi import APIRouter
from app.monitor.poller import get_monitor_status, trigger_check_now

router = APIRouter(tags=["monitor"])


@router.get("/monitor/status")
def monitor_status(repo: str | None = None):
    return get_monitor_status(repo)


@router.post("/monitor/check-now")
def monitor_check_now(repo: str | None = None):
    return trigger_check_now(repo)


@router.post("/monitor/trigger")
def monitor_trigger(repo: str | None = None):
    return trigger_check_now(repo)
