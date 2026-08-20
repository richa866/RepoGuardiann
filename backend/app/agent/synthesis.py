"""Multi-step agent loop: execute all 6 tools -> synthesize decision via LLM with deterministic rule fallback.
"""
from __future__ import annotations

import json
import logging
import time

from app.agent.tools import TOOL_REGISTRY
from app.db.database import get_conn, now_iso, tx
from app.llm import synthesize_json

logger = logging.getLogger("repoguardian.agent.synthesis")

# A poll cycle enqueues both a duplicate_check and a missing_info_check
# subtask for the same changed issue; without this, the processor triggers
# two full evaluate_issue() runs for one issue -- doubling every tool call
# (including missing_info_check's real Gemini call) and the synthesis call
# itself. TTL is long enough to cover both subtasks landing in the same
# drain batch, short enough that a later genuine re-check isn't served
# minutes-stale evidence.
_RECENT_EVALUATIONS: dict[tuple[str, int], tuple[dict, float]] = {}
_RECENT_EVALUATIONS_TTL_SECONDS = 120


def run_all_tools(repo: str, issue_number: int) -> dict:
    evidence = {}
    for name, fn in TOOL_REGISTRY.items():
        try:
            evidence[name] = fn(repo, issue_number)
        except Exception as exc:
            logger.warning("Tool %s failed on %s#%s: %s", name, repo, issue_number, exc)
            evidence[name] = {"error": str(exc)}
    return evidence


def _rule_based_fallback(issue: dict, evidence: dict) -> dict:
    categories = []
    reasons = []

    sec = evidence.get("security_keyword_check", {})
    if sec.get("is_security_sensitive"):
        categories.append("security-sensitive")
        reasons.append(f"Contains security-sensitive keywords: {', '.join(sec.get('matched_keywords', []))}")

    dup = evidence.get("duplicate_check", {})
    if dup.get("is_likely_duplicate"):
        categories.append("likely-duplicate")
        top_match = next((m for m in dup.get("matches", []) if m.get("is_likely_duplicate")), None)
        if top_match:
            reasons.append(f"Matches open issue #{top_match['number']} ('{top_match['title']}') with {top_match['similarity'] * 100:.1f}% similarity")

    if dup.get("is_possible_regression"):
        categories.append("possible-regression")
        top_match = next((m for m in dup.get("matches", []) if m.get("is_possible_regression")), None)
        if top_match:
            reasons.append(f"Matches closed issue #{top_match['number']} ('{top_match['title']}') with {top_match['similarity'] * 100:.1f}% similarity (possible regression)")

    resp = evidence.get("response_time_check", {})
    if resp.get("is_urgent"):
        categories.append("urgent")
        reasons.append(f"Unresponded for {resp.get('days_open', 0)} days with no maintainer reply")

    stale = evidence.get("staleness_check", {})
    if stale.get("is_stale"):
        categories.append("stale/needs-triage")
        reasons.append(f"Untriaged for {stale.get('days_since_update', 0)} days without labels or comments")

    missing = evidence.get("missing_info_check", {})
    if missing.get("is_missing_info"):
        categories.append("needs-more-info")
        reasons.append("Bug report is missing reproduction steps or environment details")

    cont = evidence.get("contentiousness_check", {})
    if cont.get("is_contentious"):
        categories.append("contentious")
        reasons.append(f"High discussion activity ({cont.get('comment_count', 0)} comments, {cont.get('participant_count', 0)} participants, pushback detected)")

    escalate = 1 if categories else 0
    explanation = " | ".join(reasons) if reasons else "Normal issue activity -- no escalation triggers met."
    drafted = missing.get("drafted_comment")

    return {
        "escalate": bool(escalate),
        "categories": categories,
        "explanation": explanation,
        "drafted_comment": drafted,
        "synthesis_method": "rule-based-fallback",
    }


def evaluate_issue(repo: str, issue_number: int) -> dict:
    cache_key = (repo, issue_number)
    now = time.time()
    cached = _RECENT_EVALUATIONS.get(cache_key)
    if cached and (now - cached[1]) < _RECENT_EVALUATIONS_TTL_SECONDS:
        return cached[0]

    conn = get_conn()
    issue_row = conn.execute("SELECT * FROM issues WHERE repo = ? AND number = ?", (repo, issue_number)).fetchone()
    if not issue_row:
        raise ValueError(f"Issue #{issue_number} not found in {repo}")
    issue = dict(issue_row)
    issue["labels"] = json.loads(issue["labels"] or "[]")

    evidence = run_all_tools(repo, issue_number)

    # Attempt LLM synthesis, fall back to rule-based on any failure
    decision = None
    try:
        prompt = f"""You are RepoGuardian, an agentic maintainer assistant.
Evaluate this GitHub issue based on the evidence gathered by our 6 tools:

Issue #{issue['number']}: {issue['title']}
Labels: {issue['labels']}
Body: {issue.get('body', '')[:800]}

Evidence from Tools:
{json.dumps(evidence, indent=2)}

Respond with a JSON object:
{{
  "escalate": true or false,
  "categories": ["security-sensitive", "urgent", "possible-regression", "likely-duplicate", "contentious", "needs-more-info", "stale/needs-triage"],
  "explanation": "Clear, evidence-backed explanation citing specific metrics (e.g. similarity %, days unresponded, comment count)",
  "drafted_comment": "Polite maintainer follow-up comment if info is missing or null"
}}"""
        llm_resp = synthesize_json(prompt)
        decision = {
            "escalate": bool(llm_resp.get("escalate", False)),
            "categories": llm_resp.get("categories", []),
            "explanation": llm_resp.get("explanation", ""),
            "drafted_comment": llm_resp.get("drafted_comment"),
            "synthesis_method": "gemini-llm",
        }
    except Exception as exc:
        logger.info("LLM synthesis unavailable or failed (%s); using deterministic rule-based fallback", exc)
        decision = _rule_based_fallback(issue, evidence)

    with tx() as c:
        c.execute(
            """
            INSERT INTO escalations
                (repo, issue_number, escalate, categories, explanation, evidence_json, drafted_comment, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                repo,
                issue_number,
                1 if decision["escalate"] else 0,
                json.dumps(decision["categories"]),
                decision["explanation"],
                json.dumps(evidence),
                decision.get("drafted_comment"),
                now_iso(),
            ),
        )

    result = {
        "repo": repo,
        "issue_number": issue_number,
        "evidence": evidence,
        **decision,
    }
    _RECENT_EVALUATIONS[cache_key] = (result, now)
    return result
