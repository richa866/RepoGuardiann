"""Real GitHub REST API client. Handles pagination and rate limits, and works
with or without a token (unauthenticated public access is the default demo
path -- a token only raises the rate limit or unlocks private repos).
"""
from __future__ import annotations

import time
from typing import Iterator

import requests

API_ROOT = "https://api.github.com"
TIMEOUT = 20


class RepoNotFoundError(Exception):
    """The repo doesn't exist, or exists but is private and no/insufficient token was given."""


class RepoPrivateError(Exception):
    """The repo exists but access was denied -- almost always 'private, need a token'."""


class TokenInvalidError(Exception):
    """A token was supplied but GitHub rejected it (bad/expired/revoked)."""


class RateLimitError(Exception):
    def __init__(self, authenticated: bool, reset_epoch: int | None = None):
        self.authenticated = authenticated
        self.reset_epoch = reset_epoch
        kind = "authenticated" if authenticated else "unauthenticated"
        super().__init__(f"GitHub {kind} rate limit reached")


class GitHubClient:
    def __init__(self, token: str | None, repo: str):
        self.token = token or None
        self.owner, self.name = repo.split("/", 1)
        self.session = requests.Session()
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "RepoGuardian/1.0",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        self.session.headers.update(headers)

    def _get(self, url: str, params: dict | None = None, *, retry_on_rate_limit: bool = True) -> requests.Response:
        for attempt in range(5):
            resp = self.session.get(url, params=params, timeout=TIMEOUT)
            if resp.status_code == 403 and resp.headers.get("X-RateLimit-Remaining") == "0":
                if not retry_on_rate_limit:
                    reset = resp.headers.get("X-RateLimit-Reset")
                    raise RateLimitError(bool(self.token), int(reset) if reset else None)
                reset = int(resp.headers.get("X-RateLimit-Reset", time.time() + 60))
                wait = max(reset - time.time(), 1)
                wait = min(wait, 120)  # cap so a demo never hangs too long
                time.sleep(wait)
                continue
            if resp.status_code >= 500 and attempt < 4:
                time.sleep(2**attempt)
                continue
            return resp
        return resp

    def _paginate(self, url: str, params: dict, max_items: int) -> Iterator[dict]:
        params = {**params, "per_page": 100}
        page_url = url
        count = 0
        while page_url and count < max_items:
            resp = self._get(page_url, params if page_url == url else None)
            resp.raise_for_status()
            items = resp.json()
            for item in items:
                yield item
                count += 1
                if count >= max_items:
                    return
            page_url = resp.links.get("next", {}).get("url")

    def validate_repo(self) -> dict:
        """Lightweight GET /repos/{owner}/{name} used by POST /connect to check
        the repo exists and is reachable before kicking off a full sync.
        Raises a typed exception describing exactly what went wrong."""
        url = f"{API_ROOT}/repos/{self.owner}/{self.name}"
        resp = self._get(url, retry_on_rate_limit=False)

        if resp.status_code == 200:
            return resp.json()
        if resp.status_code == 404:
            raise RepoNotFoundError(f"Repository '{self.owner}/{self.name}' not found")
        if resp.status_code == 401:
            raise TokenInvalidError("Token invalid or expired")
        if resp.status_code == 403:
            if resp.headers.get("X-RateLimit-Remaining") == "0":
                reset = resp.headers.get("X-RateLimit-Reset")
                raise RateLimitError(bool(self.token), int(reset) if reset else None)
            raise RepoPrivateError(
                f"'{self.owner}/{self.name}' appears to be private or access-restricted"
            )
        resp.raise_for_status()
        return resp.json()

    def fetch_issues(self, max_items: int = 300) -> list[dict]:
        """Fetches issues (GitHub's /issues endpoint includes PRs; we tag is_pr).
        Sorted by most-recently-updated so a re-sync picks up changes first."""
        url = f"{API_ROOT}/repos/{self.owner}/{self.name}/issues"
        params = {"state": "all", "sort": "updated", "direction": "desc"}
        return list(self._paginate(url, params, max_items))

    def fetch_comments(self, issue_number: int, max_items: int = 200) -> list[dict]:
        url = f"{API_ROOT}/repos/{self.owner}/{self.name}/issues/{issue_number}/comments"
        return list(self._paginate(url, {}, max_items))

    def rate_limit(self) -> dict:
        resp = self._get(f"{API_ROOT}/rate_limit")
        resp.raise_for_status()
        return resp.json()


def normalize_issue(raw: dict) -> dict:
    labels = [l["name"] if isinstance(l, dict) else l for l in raw.get("labels", [])]
    return {
        "number": raw["number"],
        "title": raw.get("title") or "",
        "body": raw.get("body") or "",
        "state": raw.get("state", "open"),
        "is_pr": 1 if "pull_request" in raw else 0,
        "author": (raw.get("user") or {}).get("login"),
        "labels": labels,
        "comments_count": raw.get("comments", 0),
        "url": raw.get("html_url"),
        "created_at": raw.get("created_at"),
        "updated_at": raw.get("updated_at"),
        "closed_at": raw.get("closed_at"),
    }


def normalize_comment(raw: dict) -> dict:
    return {
        "github_comment_id": raw.get("id"),
        "author": (raw.get("user") or {}).get("login"),
        "body": raw.get("body") or "",
        "created_at": raw.get("created_at"),
    }
