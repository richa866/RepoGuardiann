"""Email notifications via Resend (https://resend.com). Currently just one
use case: tell the logged-in maintainer when a new pull request lands on
their connected repo. Silently no-ops without a RESEND_API_KEY -- like
Gemini, this is optional at boot, not required for the app to run.

Free tier restriction: without a verified domain, Resend can only deliver
to the email address on the Resend account itself -- so whoever signs into
this app with GitHub must use the same email as the Resend account.
"""
from __future__ import annotations

import logging

import requests

from app.config import settings

logger = logging.getLogger("repoguardian.notifications")

RESEND_URL = "https://api.resend.com/emails"


def _send_email(to_email: str, subject: str, html: str) -> bool:
    if not settings.resend_configured:
        logger.info("[notify] RESEND_API_KEY not set, skipping email to %s", to_email)
        return False

    try:
        resp = requests.post(
            RESEND_URL,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.notify_from_email,
                "to": [to_email],
                "subject": subject,
                "html": html,
            },
            timeout=10,
        )
        if resp.status_code >= 400:
            logger.warning("[notify] Resend rejected email to %s: %s %s", to_email, resp.status_code, resp.text[:300])
            return False
        return True
    except requests.RequestException as exc:
        logger.warning("[notify] Failed to send email to %s: %s", to_email, exc)
        return False


def send_pr_notification(to_email: str, repo: str, pr: dict) -> bool:
    """pr is a normalized issue row with is_pr=1 (title, number, author, url)."""
    subject = f"[{repo}] New pull request: {pr['title']}"
    html = f"""
    <div style="font-family: -apple-system, sans-serif; max-width: 560px;">
      <h2 style="margin-bottom: 4px;">New pull request on {repo}</h2>
      <p style="color: #555; margin-top: 0;">RepoGuardian spotted a new PR while polling this repo.</p>
      <p style="font-size: 16px;"><strong>#{pr['number']}: {pr['title']}</strong></p>
      <p style="color: #555;">Opened by <strong>{pr.get('author', 'unknown')}</strong></p>
      <p><a href="{pr.get('url', '')}" style="color: #2563eb;">View on GitHub &rarr;</a></p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #999; font-size: 12px;">Sent by RepoGuardian &mdash; you're receiving this because you're signed in as the active maintainer.</p>
    </div>
    """
    return _send_email(to_email, subject, html)
