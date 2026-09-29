"""Authentication and User Session API router for RepoGuardian.
Handles GitHub Personal Access Token verification, OAuth flow, and session persistence.
"""
from __future__ import annotations

import logging
from typing import Any

import requests
from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel

from app.config import settings
from app.db.database import (
    create_session,
    delete_session,
    get_latest_user,
    get_session_user,
    upsert_user,
)
from app.github.client import GitHubClient, TokenInvalidError, RateLimitError

logger = logging.getLogger("repoguardian.auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])


class TokenVerifyIn(BaseModel):
    token: str


class OAuthCallbackIn(BaseModel):
    code: str
    state: str | None = None


def _mask_token(token: str) -> str:
    if not token or len(token) < 8:
        return "****"
    return f"{token[:4]}...{token[-4:]}"


def _get_demo_user() -> dict:
    return {
        "id": 99999999,
        "login": "repoguardian-maintainer",
        "name": "RepoGuardian Demo Maintainer",
        "avatar_url": "https://avatars.githubusercontent.com/u/9919?s=200&v=4",
        "email": "maintainer@repoguardian.ai",
        "html_url": "https://github.com/repoguardian",
        "bio": "Autonomous AI triage agent & open-source maintainer assistant.",
        "company": "RepoGuardian AI Lab",
        "location": "Global / Autonomous",
        "public_repos": 42,
        "followers": 1337,
        "oauth_scopes": ["repo", "read:user", "user:email"],
    }


def _extract_token(authorization: str | None, session_token_param: str | None) -> str | None:
    if authorization and authorization.startswith("Bearer "):
        return authorization.split(" ", 1)[1].strip()
    return session_token_param


@router.post("/github/verify")
def verify_github_token(body: TokenVerifyIn):
    """Verify GitHub Personal Access Token or activate Demo Maintainer mode.
    Fetches user profile, stores in SQLite, and creates an authenticated session.
    """
    raw_token = body.token.strip()
    if not raw_token:
        raise HTTPException(400, "Token cannot be empty")

    # 1. Demo Maintainer Mode
    if raw_token.lower() in ("demo", "guest", "demo-token", "repoguardian-demo"):
        demo_data = _get_demo_user()
        user = upsert_user(demo_data, token_preview="demo_maintainer")
        session = create_session(user["id"], github_token="demo")
        return {
            "success": True,
            "authenticated": True,
            "is_demo": True,
            "user": user,
            "session_token": session["session_token"],
            "rate_limit": {
                "limit": 5000,
                "remaining": 4995,
                "reset": 0,
            },
            "scopes": demo_data["oauth_scopes"],
        }

    # 2. Real GitHub Token Verification
    gh_client = GitHubClient(token=raw_token)
    try:
        gh_user = gh_client.get_authenticated_user()
    except TokenInvalidError as exc:
        raise HTTPException(401, {"error": "token_invalid", "message": "GitHub Personal Access Token is invalid or expired."}) from exc
    except RateLimitError as exc:
        raise HTTPException(429, {"error": "rate_limited", "message": "GitHub rate limit exceeded for this token."}) from exc
    except Exception as exc:
        logger.error("Token verification failed: %s", exc)
        raise HTTPException(400, {"error": "verification_failed", "message": f"Failed to verify GitHub token: {exc}"}) from exc

    token_preview = _mask_token(raw_token)
    user = upsert_user(gh_user, token_preview=token_preview)
    session = create_session(user["id"], github_token=raw_token)

    # Fetch rate limits
    rate_info = {}
    try:
        rl_data = gh_client.get_rate_limit()
        core = rl_data.get("resources", {}).get("core", {})
        rate_info = {
            "limit": core.get("limit", 5000),
            "remaining": core.get("remaining", 5000),
            "reset": core.get("reset", 0),
        }
    except Exception:
        rate_info = {"limit": 5000, "remaining": 5000, "reset": 0}

    return {
        "success": True,
        "authenticated": True,
        "is_demo": False,
        "user": user,
        "session_token": session["session_token"],
        "rate_limit": rate_info,
        "scopes": gh_user.get("oauth_scopes", []),
    }


@router.get("/user")
def get_current_user(
    authorization: str | None = Header(default=None),
    session_token: str | None = Query(default=None),
):
    """Retrieve current authenticated user and session details."""
    token = _extract_token(authorization, session_token)
    if not token:
        # Check if there is a latest registered user
        latest = get_latest_user()
        if latest:
            return {"authenticated": True, "user": latest, "is_active_session": False}
        return {"authenticated": False, "user": None}

    user, session = get_session_user(token)
    if not user:
        return {"authenticated": False, "user": None}

    is_demo = session.get("github_token") == "demo"
    rate_info = {"limit": 5000, "remaining": 4995, "reset": 0}
    if not is_demo and session.get("github_token"):
        try:
            gh_client = GitHubClient(token=session["github_token"])
            rl = gh_client.get_rate_limit()
            core = rl.get("resources", {}).get("core", {})
            rate_info = {
                "limit": core.get("limit", 5000),
                "remaining": core.get("remaining", 5000),
                "reset": core.get("reset", 0),
            }
        except Exception:
            pass

    return {
        "authenticated": True,
        "is_active_session": True,
        "is_demo": is_demo,
        "user": user,
        "rate_limit": rate_info,
        "session_token": token,
    }


@router.get("/github/repos")
def list_authenticated_user_repos(
    authorization: str | None = Header(default=None),
    session_token: str | None = Query(default=None),
    max_items: int = Query(default=50, ge=1, le=100),
):
    """List GitHub repositories accessible to the authenticated user."""
    token = _extract_token(authorization, session_token)
    gh_token = None
    if token:
        _, session = get_session_user(token)
        if session:
            gh_token = session.get("github_token")
    if not gh_token:
        gh_token = settings.github_token

    if not gh_token or gh_token == "demo":
        # Return popular featured demo repos
        return {
            "repos": [
                {
                    "id": 1,
                    "name": "repoguardian-seed",
                    "full_name": "demo/repoguardian-seed",
                    "private": False,
                    "description": "RepoGuardian Seed Demo Repository (8 Pre-analyzed Issues & 3D Matrix)",
                    "stargazers_count": 842,
                    "open_issues_count": 7,
                    "language": "Python",
                    "html_url": "https://github.com/demo/repoguardian-seed",
                },
                {
                    "id": 2,
                    "name": "httpx",
                    "full_name": "encode/httpx",
                    "private": False,
                    "description": "A next-generation HTTP client for Python.",
                    "stargazers_count": 13800,
                    "open_issues_count": 89,
                    "language": "Python",
                    "html_url": "https://github.com/encode/httpx",
                },
                {
                    "id": 3,
                    "name": "click",
                    "full_name": "pallets/click",
                    "private": False,
                    "description": "Python composable command line interface toolkit.",
                    "stargazers_count": 16200,
                    "open_issues_count": 45,
                    "language": "Python",
                    "html_url": "https://github.com/pallets/click",
                },
                {
                    "id": 4,
                    "name": "fastapi",
                    "full_name": "fastapi/fastapi",
                    "private": False,
                    "description": "FastAPI framework, high performance, easy to learn, fast to code, ready for production",
                    "stargazers_count": 78000,
                    "open_issues_count": 210,
                    "language": "Python",
                    "html_url": "https://github.com/fastapi/fastapi",
                },
            ]
        }

    gh_client = GitHubClient(token=gh_token)
    try:
        repos = gh_client.list_user_repos(max_items=max_items)
        return {"repos": repos}
    except Exception as exc:
        logger.error("Failed to list user repos: %s", exc)
        raise HTTPException(500, f"Failed to list user repositories from GitHub: {exc}")


@router.get("/github/oauth/url")
def get_oauth_url():
    """Return GitHub OAuth authorization URL if OAuth App is configured."""
    client_id = settings.github_client_id
    if not client_id:
        return {
            "configured": False,
            "url": None,
            "message": "GITHUB_CLIENT_ID not set in .env. Use Personal Access Token (PAT) or Demo login.",
        }

    scope = "repo,read:user,user:email"
    url = f"https://github.com/login/oauth/authorize?client_id={client_id}&scope={scope}"
    return {
        "configured": True,
        "url": url,
    }


@router.post("/github/oauth/callback")
def handle_oauth_callback(body: OAuthCallbackIn):
    """Exchange OAuth code for access token and authenticate user."""
    client_id = settings.github_client_id
    client_secret = settings.github_client_secret
    if not client_id or not client_secret:
        raise HTTPException(503, "GitHub OAuth not configured on server (missing GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET)")

    try:
        resp = requests.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": body.code,
            },
            timeout=15,
        )
        resp.raise_for_status()
        token_data = resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            error_msg = token_data.get("error_description") or token_data.get("error") or "Failed to exchange OAuth code"
            raise HTTPException(400, error_msg)

        gh_client = GitHubClient(token=access_token)
        gh_user = gh_client.get_authenticated_user()
        token_preview = _mask_token(access_token)
        user = upsert_user(gh_user, token_preview=token_preview)
        session = create_session(user["id"], github_token=access_token)

        return {
            "success": True,
            "authenticated": True,
            "user": user,
            "session_token": session["session_token"],
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("OAuth exchange failed: %s", exc)
        raise HTTPException(500, f"OAuth token exchange failed: {exc}")


@router.post("/logout")
def logout(
    authorization: str | None = Header(default=None),
    session_token: str | None = Query(default=None),
):
    """Terminate current user session."""
    token = _extract_token(authorization, session_token)
    if token:
        delete_session(token)
    return {"success": True, "message": "Logged out successfully"}
