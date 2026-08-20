"""Multi-step escalation agent: runs every tool, then asks Gemini to
synthesize the combined evidence into one evidence-backed decision. If
Gemini is unavailable/misconfigured/errors, falls back to a deterministic
rule-based synthesis (still real logic, still evidence-backed) so the
pipeline never crashes and escalation still works with zero keys tonight.
"""
from __future__ import annotations

import json
import logging

from app.config import ConfigError, settings
from app.database import log_monitor_event, now_iso, tx
from app.tools import (
    contentiousness_check,
    duplicate_check,
    missing_info_check,
    response_time_check,
    security_keyword_check,
    staleness_check,
)

logger = logging.getLogger("repoguardian.agent")


def _run_all_tools(repo: str, issue_number: int) -> dict:
    return {
        "duplicate_check": duplicate_check(repo, issue_number),
        "response_time_check": response_time_check(repo, issue_number),
        "security_keyword_check": security_keyword_check(repo, issue_number),
        "staleness_check": staleness_check(repo, issue_number),
        "missing_info_check": missing_info_check(repo, issue_number),
        "contentiousness_check": contentiousness_check(repo, issue_number),
    }


def _rule_based_synthesis(issue_number: int, evidence: dict) -> dict:
    """Deterministic fallback used when Gemini is not configured or errors.
    Mirrors the same escalation rules, just without free-text LLM prose."""
    categories: list[str] = []
    reasons: list[str] = []

    sec = evidence["security_keyword_check"]
    if sec.get("is_security_sensitive"):
        categories.append("security-sensitive")
        kw = sec["hits"][0]["keyword"] if sec["hits"] else "security term"
        reasons.append(
            f"Security keyword '{kw}' found in {sec['hits'][0]['field']} "
            f"(\"{sec['hits'][0]['snippet']}\")."
        )

    rt = evidence["response_time_check"]
    if rt.get("is_urgent_no_response"):
        categories.append("urgent")
        reasons.append(
            f"No maintainer response in {rt['days_without_response']} days, "
            f"with {len(rt['similar_open_report_numbers'])} similar open report(s): "
            f"#{', #'.join(str(n) for n in rt['similar_open_report_numbers'])}."
        )

    dup = evidence["duplicate_check"]
    if dup.get("is_possible_regression"):
        categories.append("possible-regression")
        bm = dup["best_match"]
        reasons.append(
            f"{bm['similarity']*100:.1f}% similar to closed issue #{bm['number']} "
            f"({'resolution: ' + bm['resolution'] if bm['resolution'] else 'no resolution note on record'})."
        )
    elif dup.get("is_likely_duplicate"):
        categories.append("likely-duplicate")
        bm = dup["best_match"]
        reasons.append(f"{bm['similarity']*100:.1f}% similar to issue #{bm['number']} (state: {bm['state']}).")

    st = evidence["staleness_check"]
    if st.get("is_stale_needs_triage"):
        categories.append("stale/needs-triage")
        reasons.append(
            f"Open {st['age_days']} days with {st['label_count']} labels and "
            f"{st['comment_count']} comments (threshold: {st['threshold_days']} days)."
        )

    mi = evidence["missing_info_check"]
    if mi.get("needs_more_info"):
        categories.append("needs-more-info")
        missing = []
        if not mi["has_repro_steps"]:
            missing.append("reproduction steps")
        if not mi["has_env_info"]:
            missing.append("environment/version info")
        reasons.append(f"Bug report is missing {' and '.join(missing)}.")

    ct = evidence["contentiousness_check"]
    if ct.get("is_contentious"):
        categories.append("contentious")
        if ct["pushback_hits"]:
            h = ct["pushback_hits"][0]
            reasons.append(
                f"Pushback language ('{h['keyword']}') from {h['author']} in the discussion "
                f"({ct['distinct_participants']} distinct participants across {ct['comment_count']} comments)."
            )
        else:
            reasons.append(
                f"Active back-and-forth: {ct['distinct_participants']} distinct participants across "
                f"{ct['comment_count']} comments (thresholds: {ct['threshold_participants']} participants, "
                f"{ct['threshold_comments']} comments)."
            )

    escalate = len(categories) > 0
    explanation = " ".join(reasons) if reasons else "No escalation signals triggered by current rules."

    return {
        "escalate": escalate,
        "categories": categories,
        "explanation": explanation,
        "synthesis_method": "rule-based-fallback",
    }


def _build_prompt(issue_number: int, evidence: dict) -> str:
    return f"""You are RepoGuardian, an assistant that triages GitHub issues for maintainers.
You are given structured evidence from five independent tool checks for issue #{issue_number}.
Do not invent facts not present in the evidence. Cite concrete numbers (issue numbers,
similarity scores, day counts, comment counts) in your explanation.

Evidence (JSON):
{json.dumps(evidence, indent=2, default=str)}

Escalation rules to apply:
- No response in 5+ days AND similar open reports exist -> "urgent"
- High similarity (>=0.85) to a CLOSED issue -> "possible-regression"
- High similarity (>=0.80) to any issue -> "likely-duplicate"
- Any security keyword hit -> "security-sensitive" (always include regardless of other signals)
- Open 30+ days, zero labels, zero comments -> "stale/needs-triage"
- Bug report missing repro steps or env/version info -> "needs-more-info"
- 5+ comments AND 3+ distinct participants, OR explicit pushback language (disagree/wontfix/nack/etc) -> "contentious"

Respond ONLY with a JSON object of this exact shape:
{{
  "escalate": true|false,
  "categories": ["urgent" | "possible-regression" | "likely-duplicate" | "security-sensitive" | "stale/needs-triage" | "needs-more-info" | "contentious", ...],
  "explanation": "plain-English explanation citing specific evidence (issue numbers, scores, day counts)"
}}"""


def _llm_synthesis(issue_number: int, evidence: dict) -> dict:
    from app.llm import synthesize_json

    prompt = _build_prompt(issue_number, evidence)
    result = synthesize_json(prompt)
    result["synthesis_method"] = "gemini"
    return result


def evaluate_issue(repo: str, issue_number: int) -> dict:
    """The full multi-step agent run for one issue: tool calls -> synthesis.
    Always returns a result (degrades to rule-based on any Gemini failure).
    """
    evidence = _run_all_tools(repo, issue_number)

    try:
        settings.require_gemini()
        synthesis = _llm_synthesis(issue_number, evidence)
    except ConfigError:
        synthesis = _rule_based_synthesis(issue_number, evidence)
    except Exception as exc:  # Gemini call failed/timed out -- degrade, don't crash
        logger.warning("Gemini synthesis failed for %s#%s: %s", repo, issue_number, exc)
        log_monitor_event("gemini_synthesis_failed", f"issue #{issue_number}: {exc}", repo=repo)
        synthesis = _rule_based_synthesis(issue_number, evidence)

    drafted_comment = evidence["missing_info_check"].get("drafted_followup_comment")

    with tx() as conn:
        cur = conn.execute(
            """
            INSERT INTO escalations
                (repo, issue_number, escalate, categories, explanation, evidence_json, drafted_comment, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                repo,
                issue_number,
                1 if synthesis.get("escalate") else 0,
                json.dumps(synthesis.get("categories", [])),
                synthesis.get("explanation", ""),
                json.dumps(evidence, default=str),
                drafted_comment,
                now_iso(),
            ),
        )
        escalation_id = cur.lastrowid

    return {"escalation_id": escalation_id, "evidence": evidence, **synthesis}
