import sys
from pathlib import Path
import unittest

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from starlette.testclient import TestClient
from app.main import app

class TestAuthAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_demo_login_and_session(self):
        # 1. Verify demo token
        res = self.client.post("/api/auth/github/verify", json={"token": "demo"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        self.assertTrue(data.get("is_demo"))
        self.assertEqual(data.get("user", {}).get("login"), "repoguardian-maintainer")
        session_token = data.get("session_token")
        self.assertIsNotNone(session_token)

        # 2. Get current user with session token
        res_user = self.client.get("/api/auth/user", headers={"Authorization": f"Bearer {session_token}"})
        self.assertEqual(res_user.status_code, 200)
        user_data = res_user.json()
        self.assertTrue(user_data.get("authenticated"))
        self.assertEqual(user_data.get("user", {}).get("login"), "repoguardian-maintainer")

        # 3. List accessible user repos
        res_repos = self.client.get("/api/auth/github/repos", headers={"Authorization": f"Bearer {session_token}"})
        self.assertEqual(res_repos.status_code, 200)
        repos_data = res_repos.json()
        self.assertIn("repos", repos_data)
        self.assertGreaterEqual(len(repos_data["repos"]), 1)

        # 4. Logout
        res_logout = self.client.post("/api/auth/logout", headers={"Authorization": f"Bearer {session_token}"})
        self.assertEqual(res_logout.status_code, 200)

    def test_empty_token_validation(self):
        res = self.client.post("/api/auth/github/verify", json={"token": "  "})
        self.assertEqual(res.status_code, 400)

    def test_oauth_url_endpoint(self):
        res = self.client.get("/api/auth/github/oauth/url")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("configured", data)

if __name__ == "__main__":
    unittest.main()
