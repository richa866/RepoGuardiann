"""Backwards compatibility shim for app.github.client.
"""
from app.github.client import (
    GitHubClient,
    RateLimitError,
    RepoNotFoundError,
    RepoPrivateError,
    TokenInvalidError,
    list_comments,
    list_issues,
    list_repo_collaborators,
    validate_repo,
)
from app.github.fetch import normalize_comment, normalize_issue

__all__ = [
    "GitHubClient",
    "RateLimitError",
    "RepoNotFoundError",
    "RepoPrivateError",
    "TokenInvalidError",
    "list_issues",
    "list_comments",
    "list_repo_collaborators",
    "validate_repo",
    "normalize_issue",
    "normalize_comment",
]
