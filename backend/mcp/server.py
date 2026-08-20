#!/usr/bin/env python3
"""RepoGuardian Model Context Protocol (MCP) Server.
Exposes GitHub authentication, user session management, and repository triage tools
over standard JSON-RPC 2.0 stdio transport (MCP 1.0 specification).
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

# Ensure backend root is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.config import settings
from app.db.database import (
    create_session,
    delete_session,
    get_active_repo,
    get_conn,
    get_latest_user,
    get_session_user,
    init_db,
    set_active_repo,
    upsert_repo,
    upsert_user,
)
from app.github.client import GitHubClient, RateLimitError, TokenInvalidError


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


TOOLS = [
    {
        "name": "github_login_verify",
        "description": "Authenticate a GitHub user into RepoGuardian using a Personal Access Token (classic or fine-grained) or 'demo' for instantaneous guest maintainer mode. Validates token, retrieves GitHub profile, and stores session.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "token": {
                    "type": "string",
                    "description": "GitHub Personal Access Token (ghp_... / github_pat_...) or 'demo'",
                }
            },
            "required": ["token"],
        },
    },
    {
        "name": "github_get_current_user",
        "description": "Get the currently authenticated GitHub user profile, authorization scopes, and API rate-limit headroom in RepoGuardian.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "session_token": {
                    "type": "string",
                    "description": "Optional session token. If omitted, returns the latest active user.",
                }
            },
        },
    },
    {
        "name": "github_list_user_repos",
        "description": "List GitHub repositories owned by or accessible to the authenticated user for monitoring.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "session_token": {
                    "type": "string",
                    "description": "Optional session token to use user's personal token.",
                },
                "max_items": {
                    "type": "integer",
                    "description": "Maximum number of repositories to return (default: 30).",
                    "default": 30,
                },
            },
        },
    },
    {
        "name": "github_set_active_repo",
        "description": "Connect and switch the active repository monitored by RepoGuardian.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "repo": {
                    "type": "string",
                    "description": "Repository identifier in 'owner/name' format (e.g. 'encode/httpx', 'pallets/click').",
                },
                "token": {
                    "type": "string",
                    "description": "Optional token override for private repository access.",
                },
            },
            "required": ["repo"],
        },
    },
    {
        "name": "github_get_repo_health",
        "description": "Retrieve health snapshot, active issue count, and triage escalation statistics for a connected repository.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "repo": {
                    "type": "string",
                    "description": "Optional repository name. Defaults to currently active repository.",
                }
            },
        },
    },
    {
        "name": "github_logout",
        "description": "Terminate the active GitHub user session in RepoGuardian.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "session_token": {
                    "type": "string",
                    "description": "Session token to invalidate.",
                }
            },
        },
    },
]


def handle_tool_call(name: str, args: dict[str, Any]) -> dict[str, Any]:
    init_db()
    
    if name == "github_login_verify":
        raw_token = str(args.get("token", "")).strip()
        if not raw_token:
            return {"error": "Token cannot be empty"}
        
        if raw_token.lower() in ("demo", "guest", "demo-token", "repoguardian-demo"):
            demo_user = _get_demo_user()
            user = upsert_user(demo_user, token_preview="demo_maintainer")
            session = create_session(user["id"], github_token="demo")
            return {
                "status": "success",
                "mode": "demo_maintainer",
                "user": user,
                "session_token": session["session_token"],
                "message": f"Successfully logged in as @{user['login']} (Demo Maintainer)",
            }
        
        gh = GitHubClient(token=raw_token)
        try:
            gh_user = gh.get_authenticated_user()
            user = upsert_user(gh_user, token_preview=_mask_token(raw_token))
            session = create_session(user["id"], github_token=raw_token)
            rate = gh.get_rate_limit().get("resources", {}).get("core", {})
            return {
                "status": "success",
                "mode": "authenticated_pat",
                "user": user,
                "session_token": session["session_token"],
                "rate_limit_remaining": rate.get("remaining", 5000),
                "message": f"Successfully authenticated as GitHub user @{user['login']}",
            }
        except TokenInvalidError:
            return {"error": "GitHub Personal Access Token is invalid or expired."}
        except RateLimitError as exc:
            return {"error": f"GitHub API rate limit exceeded: {exc}"}
        except Exception as exc:
            return {"error": f"Failed to authenticate with GitHub: {exc}"}

    elif name == "github_get_current_user":
        session_token = args.get("session_token")
        if session_token:
            user, session = get_session_user(session_token)
            if user:
                return {"authenticated": True, "user": user, "session": session}
        
        latest = get_latest_user()
        if latest:
            return {"authenticated": True, "user": latest, "is_latest": True}
        return {"authenticated": False, "message": "No active GitHub user logged in."}

    elif name == "github_list_user_repos":
        session_token = args.get("session_token")
        max_items = int(args.get("max_items", 30))
        gh_token = None
        if session_token:
            _, session = get_session_user(session_token)
            if session:
                gh_token = session.get("github_token")
        if not gh_token:
            gh_token = settings.github_token

        if not gh_token or gh_token == "demo":
            return {
                "repos": [
                    {"name": "demo/repoguardian-seed", "description": "RepoGuardian Seed Demo Repository", "open_issues": 7},
                    {"name": "encode/httpx", "description": "Next-generation HTTP client for Python", "open_issues": 89},
                    {"name": "pallets/click", "description": "Python CLI toolkit", "open_issues": 45},
                ]
            }
        
        gh = GitHubClient(token=gh_token)
        try:
            repos = gh.list_user_repos(max_items=max_items)
            return {"repos": repos, "count": len(repos)}
        except Exception as exc:
            return {"error": f"Failed to fetch repositories: {exc}"}

    elif name == "github_set_active_repo":
        repo = str(args.get("repo", "")).strip()
        token = args.get("token")
        if not repo:
            return {"error": "Repository name cannot be empty"}
        
        upsert_repo(repo, token)
        set_active_repo(repo)
        return {
            "status": "success",
            "active_repo": repo,
            "message": f"Active repository set to '{repo}'",
        }

    elif name == "github_get_repo_health":
        target = args.get("repo") or get_active_repo()
        if not target:
            return {"error": "No active repository configured."}
        
        conn = get_conn()
        open_count = conn.execute("SELECT COUNT(*) FROM issues WHERE repo = ? AND state = 'open'", (target,)).fetchone()[0]
        escalated_count = conn.execute("SELECT COUNT(*) FROM escalations WHERE repo = ? AND escalate = 1", (target,)).fetchone()[0]
        
        return {
            "repo": target,
            "open_issues_count": open_count,
            "escalated_issues_count": escalated_count,
            "status": "healthy",
        }

    elif name == "github_logout":
        session_token = args.get("session_token")
        if session_token:
            delete_session(session_token)
        return {"status": "success", "message": "Logged out successfully"}

    return {"error": f"Unknown tool: {name}"}


def main():
    """Main JSON-RPC stdio loop for MCP server."""
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            continue

        req_id = req.get("id")
        method = req.get("method")
        params = req.get("params", {})

        if method == "initialize":
            resp = {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {},
                    },
                    "serverInfo": {
                        "name": "repoguardian-mcp",
                        "version": "1.0.0",
                    },
                },
            }
        elif method == "notifications/initialized":
            continue
        elif method == "ping":
            resp = {"jsonrpc": "2.0", "id": req_id, "result": {}}
        elif method == "tools/list":
            resp = {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "tools": TOOLS,
                },
            }
        elif method == "tools/call":
            tool_name = params.get("name")
            tool_args = params.get("arguments", {})
            try:
                res = handle_tool_call(tool_name, tool_args)
                is_err = "error" in res
                resp = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [
                            {
                                "type": "text",
                                "text": json.dumps(res, indent=2),
                            }
                        ],
                        "isError": is_err,
                    },
                }
            except Exception as exc:
                resp = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [{"type": "text", "text": f"Tool execution failed: {exc}"}],
                        "isError": True,
                    },
                }
        else:
            resp = {
                "jsonrpc": "2.0",
                "id": req_id,
                "error": {
                    "code": -32601,
                    "message": f"Method '{method}' not found",
                },
            }

        sys.stdout.write(json.dumps(resp) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
