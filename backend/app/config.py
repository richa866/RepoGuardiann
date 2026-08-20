"""
Central config loader. Reads .env once at import time. Does NOT raise on
missing GitHub/Gemini keys at startup -- those are optional at boot so the
app (DB, embeddings, feedback) is fully usable with zero keys tonight.

Instead, any code path that actually needs GitHub or Gemini access calls
require_github() / require_gemini(), which raises ConfigError listing
exactly what's missing. Routes catch ConfigError and turn it into a clean
503 "not_configured" JSON response (see app/main.py).
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent

# Load backend/.env first, fall back to repo-root .env so a single .env at
# the project root also works.
load_dotenv(BACKEND_DIR / ".env")
load_dotenv(REPO_ROOT / ".env", override=False)


class ConfigError(RuntimeError):
    """Raised when required config for a specific feature is missing."""

    def __init__(self, missing: list[str], feature: str):
        self.missing = missing
        self.feature = feature
        joined = ", ".join(missing)
        super().__init__(
            f"Missing {joined} -- add to .env to enable {feature}."
        )


def _env(name: str, default: str | None = None) -> str | None:
    val = os.getenv(name, default)
    return val.strip() if isinstance(val, str) else val


@dataclass
class Settings:
    github_token: str | None = field(default_factory=lambda: _env("GITHUB_TOKEN") or None)
    github_repo: str | None = field(default_factory=lambda: _env("GITHUB_REPO") or None)
    gemini_api_key: str | None = field(default_factory=lambda: _env("GEMINI_API_KEY") or None)
    gemini_model: str = field(default_factory=lambda: _env("GEMINI_MODEL", "gemini-1.5-flash"))
    monitor_poll_interval_seconds: int = field(
        default_factory=lambda: int(_env("MONITOR_POLL_INTERVAL_SECONDS", "300"))
    )
    connect_sync_max_items: int = field(
        default_factory=lambda: int(_env("CONNECT_SYNC_MAX_ITEMS", "30"))
    )
    full_sync_max_items: int = field(
        default_factory=lambda: int(_env("FULL_SYNC_MAX_ITEMS", "300"))
    )
    database_path: str = field(default_factory=lambda: _env("DATABASE_PATH", "./data/repoguardian.db"))
    chroma_path: str = field(default_factory=lambda: _env("CHROMA_PATH", "./data/chroma"))
    log_level: str = field(default_factory=lambda: _env("LOG_LEVEL", "INFO"))

    @property
    def github_configured(self) -> bool:
        return bool(self.github_token and self.github_repo)

    @property
    def gemini_configured(self) -> bool:
        return bool(self.gemini_api_key)

    def require_github(self) -> tuple[str, str]:
        missing = []
        if not self.github_token:
            missing.append("GITHUB_TOKEN")
        if not self.github_repo:
            missing.append("GITHUB_REPO")
        if missing:
            raise ConfigError(missing, "GitHub integration")
        return self.github_token, self.github_repo  # type: ignore[return-value]

    def require_gemini(self) -> str:
        if not self.gemini_api_key:
            raise ConfigError(["GEMINI_API_KEY"], "Gemini-powered agent synthesis")
        return self.gemini_api_key


settings = Settings()

# Resolve data paths relative to backend dir so it works regardless of cwd.
_db_path = Path(settings.database_path)
if not _db_path.is_absolute():
    settings.database_path = str((BACKEND_DIR / _db_path).resolve())

_chroma_path = Path(settings.chroma_path)
if not _chroma_path.is_absolute():
    settings.chroma_path = str((BACKEND_DIR / _chroma_path).resolve())

Path(settings.database_path).parent.mkdir(parents=True, exist_ok=True)
Path(settings.chroma_path).mkdir(parents=True, exist_ok=True)
