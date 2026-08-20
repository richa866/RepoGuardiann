"""Thin GitHub REST API v3 wrapper using `requests` and GITHUB_TOKEN bearer authentication.
Handles rate limits, pagination via Link header, and pre-flight validation.
"""
from __future__ import annotations

import logging
import os
import time
from pathlib import Path
from typing import Any, Iterator

import requests
from dotenv import load_dotenv

# Ensure .env is loaded from backend/ or project root
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
REPO_ROOT = BACKEND_DIR.parent
load_dotenv(BACKEND_DIR / ".env")
load_dotenv(REPO_ROOT / ".env", override=False)

logger = logging.getLogger("repoguardian.github")

API_BASE = "https://api.github.com"
DEFAULT_TIMEOUT = 25


class RepoNotFoundError(Exception):
    """The repository does not exist, or is private and inaccessible with the current credentials."""


class RepoPrivateError(Exception):
    """The repository exists but access was denied (private repository requiring a token)."""


class TokenInvalidError(Exception):
    """GitHub token was rejected (expired, revoked, or malformed)."""


class RateLimitError(Exception):
    """GitHub API rate limit exceeded."""

    def __init__(
        self,
        reset_epoch: int | None = None,
        authenticated: bool = False,
        message: str = "GitHub API rate limit exceeded",
    ):
        super().__init__(message)
        self.reset_epoch = reset_epoch
        self.authenticated = authenticated


class GitHubClient:
    """Thin, robust GitHub REST API v3 client."""

    def __init__(self, token: str | None = None, session: requests.Session | None = None):
        self.token = token if token is not None else (os.getenv("GITHUB_TOKEN") or None)
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
            try:
                self.last_rate_limit_remaining = int(rem)
            except ValueError:
                pass
        if rst is not None:
            try:
                self.last_rate_limit_reset = int(rst)
            except ValueError:
                pass

    def _handle_rate_limit(self, reset_epoch: int | None = None) -> None:
        target_epoch = reset_epoch or self.last_rate_limit_reset or int(time.time() + 60)
        sleep_seconds = max(1, int(target_epoch - time.time()) + 1)
        logger.warning("[github] rate limited, sleeping %ss", sleep_seconds)
        time.sleep(sleep_seconds)

    def request(
        self,
        method: str,
        path: str,
        params: dict | None = None,
        timeout: int = DEFAULT_TIMEOUT,
        auto_retry_rate_limit: bool = True,
        **kwargs,
    ) -> requests.Response:
        url = f"{API_BASE}{path}" if path.startswith("/") else path
        logger.debug("[github] %s %s (params: %s)", method.upper(), path, params)

        for attempt in range(5):
            # Proactive rate-limit check if last response reported 0 remaining
            if self.last_rate_limit_remaining == 0 and auto_retry_rate_limit:
                self._handle_rate_limit()

            resp = self.session.request(method, url, params=params, timeout=timeout, **kwargs)
            self._update_rate_limits(resp)

            # Reactive rate-limit check on 403 / 429
            if resp.status_code in (403, 429) and (
                self.last_rate_limit_remaining == 0
                or "rate limit" in resp.text.lower()
                or "secondary rate limit" in resp.text.lower()
            ):
                if not auto_retry_rate_limit:
                    raise RateLimitError(
                        reset_epoch=self.last_rate_limit_reset,
                        authenticated=bool(self.token),
                    )
                self._handle_rate_limit(self.last_rate_limit_reset)
                continue

            # Transient 5xx retry
            if resp.status_code >= 500 and attempt < 4:
                time.sleep(2**attempt)
                continue

            return resp

        return resp

    def get(self, path: str, params: dict | None = None, **kwargs) -> tuple[Any, dict]:
        resp = self.request("GET", path, params=params, **kwargs)
        resp.raise_for_status()
        return resp.json(), dict(resp.headers)

    def _paginate(
        self,
        path: str,
        params: dict | None = None,
        max_items: int | None = None,
        per_page: int = 100,
    ) -> Iterator[dict]:
        """Paginates through GitHub API endpoints following the RFC 5988 Link header."""
        current_params = dict(params or {})
        current_params["per_page"] = per_page
        current_url = path
        yielded = 0

        while current_url:
            resp = self.request(
                "GET",
                current_url,
                params=current_params if current_url == path else None,
            )
            resp.raise_for_status()
            items = resp.json()
            if not isinstance(items, list):
                break

            for item in items:
                yield item
                yielded += 1
                if max_items is not None and yielded >= max_items:
                    return

            # Follow 'next' link from Link header
            next_url = resp.links.get("next", {}).get("url")
            if not next_url or (max_items is not None and yielded >= max_items):
                break
            current_url = next_url
            current_params = {}

    def list_issues(
        self,
        repo: str,
        state: str = "all",
        since: str | None = None,
        max_items: int | None = None,
        per_page: int = 100,
        page: int | None = None,
    ) -> list[dict]:
        """List issues and PRs for a repository. Flags PRs via 'pull_request' key."""
        path = f"/repos/{repo}/issues"
        params: dict = {"state": state, "sort": "updated", "direction": "desc"}
        if since:
            params["since"] = since

        if page is not None:
            params["page"] = page
            params["per_page"] = per_page
            data, _ = self.get(path, params=params)
            issues = data if isinstance(data, list) else []
            for item in issues:
                item["is_pr"] = 1 if "pull_request" in item else 0
            return issues

        issues = []
        for raw in self._paginate(path, params=params, max_items=max_items, per_page=per_page):
            raw["is_pr"] = 1 if "pull_request" in raw else 0
            issues.append(raw)
        return issues

    def list_comments(
        self,
        repo: str,
        issue_number: int,
        max_items: int | None = None,
        per_page: int = 100,
    ) -> list[dict]:
        """List discussion comments on an issue or PR, fully paginated."""
        path = f"/repos/{repo}/issues/{issue_number}/comments"
        return list(self._paginate(path, max_items=max_items, per_page=per_page))

    def list_repo_collaborators(
        self,
        repo: str,
        max_items: int | None = None,
        per_page: int = 100,
    ) -> list[dict]:
        """List repository collaborators / maintainers.
        Falls back gracefully to contributors list if collaborators endpoint requires push access.
        """
        path = f"/repos/{repo}/collaborators"
        try:
            return list(self._paginate(path, max_items=max_items, per_page=per_page))
        except requests.HTTPError as err:
            if err.response is not None and err.response.status_code in (401, 403, 404):
                logger.debug(
                    "Collaborators endpoint not accessible for %s (%s). Falling back to contributors.",
                    repo,
                    err.response.status_code,
                )
                contrib_path = f"/repos/{repo}/contributors"
                return list(self._paginate(contrib_path, max_items=max_items, per_page=per_page))
            raise

    def validate_repo(self, repo: str) -> dict:
        """Lightweight pre-flight check for the /connect endpoint:
        Does the repo exist and is it reachable with the given token?
        Raises typed exceptions on error.
        """
        path = f"/repos/{repo}"
        resp = self.request("GET", path, auto_retry_rate_limit=False)

        if resp.status_code == 200:
            return resp.json()
        if resp.status_code == 404:
            raise RepoNotFoundError(f"Repository '{repo}' not found on GitHub")
        if resp.status_code == 401:
            raise TokenInvalidError("GitHub token is invalid or expired")
        if resp.status_code in (403, 429):
            if resp.headers.get("X-RateLimit-Remaining") == "0":
                raise RateLimitError(
                    reset_epoch=self.last_rate_limit_reset,
                    authenticated=bool(self.token),
                    message=f"GitHub API rate limit reached for repository '{repo}'",
                )
            raise RepoPrivateError(
                f"Repository '{repo}' is private or access is forbidden with current token"
            )

        resp.raise_for_status()
        return resp.json()


# Module-level convenience functions using default environment configuration
_default_client = GitHubClient()


def list_issues(repo: str, state: str = "all", since: str | None = None, max_items: int | None = None, per_page: int = 100) -> list[dict]:
    return _default_client.list_issues(repo=repo, state=state, since=since, max_items=max_items, per_page=per_page)


def list_comments(repo: str, issue_number: int, max_items: int | None = None, per_page: int = 100) -> list[dict]:
    return _default_client.list_comments(repo=repo, issue_number=issue_number, max_items=max_items, per_page=per_page)


def list_repo_collaborators(repo: str, max_items: int | None = None, per_page: int = 100) -> list[dict]:
    return _default_client.list_repo_collaborators(repo=repo, max_items=max_items, per_page=per_page)


def validate_repo(repo: str) -> dict:
    return _default_client.validate_repo(repo=repo)
