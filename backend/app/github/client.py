"""Thin GitHub REST wrapper for issues, PRs, comments, and rate-limit tracking.
"""
from __future__ import annotations

import logging
import time
from typing import Any

import requests

from app.config import settings

logger = logging.getLogger("repoguardian.github")

API_BASE = "https://api.github.com"


class RateLimitError(Exception):
    def __init__(self, reset_epoch: int, message: str = "GitHub API rate limit exceeded", authenticated: bool = False):
        super().__init__(message)
        self.reset_epoch = reset_epoch
        self.authenticated = authenticated


class RepoNotFoundError(Exception):
    """The repo doesn't exist, or exists but is private and no/insufficient token was given."""


class RepoPrivateError(Exception):
    """The repo exists but access was denied -- almost always 'private, need a token'."""


class TokenInvalidError(Exception):
    """A token was supplied but GitHub rejected it (bad/expired/revoked)."""


class GitHubClient:
    def __init__(self, token: str | None = None, session: requests.Session | None = None):
        self.token = token or settings.github_token
        self.session = session or requests.Session()
        self.session.headers.update({
            "Accept": "application/vnd.github+json",
            "User-Agent": "RepoGuardian-Agent/1.0",
            "X-GitHub-Api-Version": "2022-11-28",
        })
        if self.token:
            self.session.headers["Authorization"] = f"Bearer {self.token}"

        self.last_rate_limit_remaining: int | None = None
        self.last_rate_limit_reset: int | None = None

    def _update_rate_limits(self, resp: requests.Response) -> None:
        rem = resp.headers.get("X-RateLimit-Remaining")
        rst = resp.headers.get("X-RateLimit-Reset")
        if rem is not None:
            self.last_rate_limit_remaining = int(rem)
        if rst is not None:
            self.last_rate_limit_reset = int(rst)

    def get(self, path: str, params: dict | None = None, timeout: int = 20) -> Any:
        url = f"{API_BASE}{path}" if path.startswith("/") else path
        resp = self.session.get(url, params=params, timeout=timeout)
        self._update_rate_limits(resp)

        if resp.status_code == 403 and self.last_rate_limit_remaining == 0:
            reset_ts = self.last_rate_limit_reset or int(time.time() + 60)
            logger.warning("GitHub rate limit hit; resets at epoch %s", reset_ts)
            raise RateLimitError(reset_ts, authenticated=bool(self.token))

        resp.raise_for_status()
        return resp.json(), resp.headers

    def get_repo(self, repo: str) -> dict:
        data, _ = self.get(f"/repos/{repo}")
        return data

    def validate_repo(self, repo: str) -> dict:
        """Lightweight pre-flight check used by POST /connect: does the repo
        exist and is it reachable with the given token? Raises a typed
        exception describing exactly what went wrong, before a full sync
        is kicked off."""
        url = f"{API_BASE}/repos/{repo}"
        resp = self.session.get(url, timeout=20)
        self._update_rate_limits(resp)

        if resp.status_code == 200:
            return resp.json()
        if resp.status_code == 404:
            raise RepoNotFoundError(f"Repository '{repo}' not found")
        if resp.status_code == 401:
            raise TokenInvalidError("Token invalid or expired")
        if resp.status_code == 403:
            if self.last_rate_limit_remaining == 0:
                reset_ts = self.last_rate_limit_reset or int(time.time() + 60)
                raise RateLimitError(reset_ts, authenticated=bool(self.token))
            raise RepoPrivateError(f"'{repo}' appears to be private or access-restricted")
        resp.raise_for_status()
        return resp.json()

    def list_issues(
        self,
        repo: str,
        state: str = "all",
        since: str | None = None,
        per_page: int = 100,
        page: int = 1,
    ) -> tuple[list[dict], dict]:
        params: dict = {"state": state, "per_page": per_page, "page": page, "sort": "updated", "direction": "desc"}
        if since:
            params["since"] = since
        data, headers = self.get(f"/repos/{repo}/issues", params=params)
        return data, dict(headers)

    def list_comments(self, repo: str, issue_number: int, per_page: int = 100) -> list[dict]:
        data, _ = self.get(f"/repos/{repo}/issues/{issue_number}/comments", params={"per_page": per_page})
        return data

    def get_rate_limit(self) -> dict:
        data, _ = self.get("/rate_limit")
        return data
