"""Unit tests for RepoGuardian Model Context Protocol (MCP) server tools."""
import unittest
import sys
from pathlib import Path

# Ensure backend root on sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from mcp.server import handle_tool_call, TOOLS

class TestMCPServer(unittest.TestCase):
    def test_tools_schema_definition(self):
        tool_names = [t["name"] for t in TOOLS]
        self.assertIn("github_login_verify", tool_names)
        self.assertIn("github_get_current_user", tool_names)
        self.assertIn("github_list_user_repos", tool_names)
        self.assertIn("github_set_active_repo", tool_names)
        self.assertIn("github_get_repo_health", tool_names)
        self.assertIn("github_logout", tool_names)

    def test_mcp_login_verify_demo(self):
        res = handle_tool_call("github_login_verify", {"token": "demo"})
        self.assertEqual(res.get("status"), "success")
        self.assertEqual(res.get("mode"), "demo_maintainer")
        self.assertEqual(res.get("user", {}).get("login"), "repoguardian-maintainer")
        session_token = res.get("session_token")
        self.assertIsNotNone(session_token)

        # Query user via MCP
        user_res = handle_tool_call("github_get_current_user", {"session_token": session_token})
        self.assertTrue(user_res.get("authenticated"))
        self.assertEqual(user_res.get("user", {}).get("login"), "repoguardian-maintainer")

        # List repos via MCP
        repos_res = handle_tool_call("github_list_user_repos", {"session_token": session_token})
        self.assertIn("repos", repos_res)
        self.assertGreaterEqual(len(repos_res["repos"]), 1)

        # Logout via MCP
        logout_res = handle_tool_call("github_logout", {"session_token": session_token})
        self.assertEqual(logout_res.get("status"), "success")

    def test_mcp_unknown_tool(self):
        res = handle_tool_call("unknown_fake_tool", {})
        self.assertIn("error", res)

if __name__ == "__main__":
    unittest.main()
