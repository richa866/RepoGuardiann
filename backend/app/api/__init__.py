from app.api.issues import router as issues_router
from app.api.feedback import router as feedback_router
from app.api.health import router as health_router
from app.api.monitor import router as monitor_router

__all__ = [
    "issues_router",
    "feedback_router",
    "health_router",
    "monitor_router",
]
