"""The real multi-step agent: Gemini decides which of the 6 tools in
agent/tools.py to call and in what order, via genuine function-calling --
not a fixed pipeline that calls everything upfront and asks an LLM to
summarize the results afterward. Falls back to that fixed-pipeline approach
(run_all_tools + a deterministic rule-based verdict) only if the real loop
fails outright (timeout, quota, malformed response), so a demo never shows
a bare error.
"""
from __future__ import annotations

import json
import logging
import re
import time

import google.generativeai as genai

from app.agent.tool_schemas import GEMINI_TOOL_SCHEMAS
from app.agent.tools import TOOL_REGISTRY
from app.config import settings
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

VALID_CATEGORIES = [
    "security-sensitive",
    "urgent",
    "possible-regression",
    "likely-duplicate",
    "contentious",
    "needs-more-info",
    "stale/needs-triage",
]

SYSTEM_PROMPT = """You are RepoGuardian, an autonomous GitHub maintainer triage assistant.

You have 6 tools available, each gathering one kind of real evidence about a
GitHub issue: duplicate_check (vector similarity to other issues + real
maintainer closing comments), response_time_check (unresponded duration vs.
this repo's own average), security_keyword_check, staleness_check,
missing_info_check, contentiousness_check.

Decide for yourself which tools are actually relevant to the issue you're
given -- do not call all six reflexively. A one-line typo fix PR rarely
needs duplicate_check or security_keyword_check; a bug report with no
maintainer reply for days is exactly when response_time_check matters. Call
as many or as few as the issue genuinely warrants, in whatever order makes
sense, and you may call a tool more than once if an earlier result changes
what you want to check next.

Once you have enough evidence, stop calling tools and respond with a JSON
object (no markdown fences, just the JSON):
{
  "escalate": true or false,
  "categories": [zero or more of: "security-sensitive", "urgent", "possible-regression", "likely-duplicate", "contentious", "needs-more-info", "stale/needs-triage"],
  "explanation": "evidence-backed explanation citing specific numbers from the tools you actually called -- issue numbers, similarity percentages, days unresponded, comment counts. Never vague language like 'this seems similar to another issue.'",
  "drafted_comment": "a maintainer follow-up comment if missing_info_check found something missing, otherwise null"
}

If security_keyword_check finds a real match, "security-sensitive" must be
in categories and escalate must be true, regardless of what else fired."""


def run_all_tools(repo: str, issue_number: int) -> dict:
    """Fallback-only now: calls every tool unconditionally. Used when the
    real tool-use loop below fails outright, so a demo still gets a full,
    evidence-backed verdict instead of a bare error."""
    evidence = {}
    for name, fn in TOOL_REGISTRY.items():
        try:
            evidence[name] = fn(repo, issue_number)
        except Exception as exc:
            logger.warning("Tool %s failed on %s#%s: %s", name, repo, issue_number, exc)
            evidence[name] = {"error": str(exc)}
    return evidence


def _synthesize_from_evidence(issue: dict, evidence: dict) -> dict:
    """Second-tier fallback: one Gemini call summarizing evidence that's
    already been gathered by run_all_tools(). Used when the real tool-use
    loop fails for a loop-specific reason (malformed function-calling
    response, hit max_turns) but Gemini itself is still reachable -- still
    better than the deterministic rules below when that's the case."""
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
    return {
        "escalate": bool(llm_resp.get("escalate", False)),
        "categories": [c for c in llm_resp.get("categories", []) if c in VALID_CATEGORIES],
        "explanation": llm_resp.get("explanation", ""),
        "drafted_comment": llm_resp.get("drafted_comment"),
        "tool_calls": [{"tool": name, "input": {"repo": issue.get("repo"), "issue_number": issue["number"]}, "output": out} for name, out in evidence.items()],
        "synthesis_method": "gemini-single-call-fallback",
    }


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
        "tool_calls": [{"tool": name, "input": {"repo": issue.get("repo"), "issue_number": issue["number"]}, "output": out} for name, out in evidence.items()],
        "synthesis_method": "rule-based-fallback",
    }


def _extract_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise


def _run_tool_use_loop(repo: str, issue_number: int, issue: dict, max_turns: int = 8) -> dict:
    """The real agent loop. Gemini chooses which tools to call and in what
    order; we execute the actual Python functions and feed results back as
    function_response turns, repeating until it gives a final JSON answer
    instead of another tool call. Raises on any failure -- caller falls
    back to run_all_tools + _rule_based_fallback."""
    genai.configure(api_key=settings.require_gemini())
    tool = genai.protos.Tool(function_declarations=GEMINI_TOOL_SCHEMAS)
    model = genai.GenerativeModel(
        settings.gemini_model,
        tools=[tool],
        system_instruction=SYSTEM_PROMPT,
    )
    chat = model.start_chat()

    user_prompt = f"""Issue #{issue_number} in {repo}
State: {issue.get('state')}
Labels: {issue.get('labels')}
Body:
{(issue.get('body') or '')[:1500]}

Investigate this issue using whichever tools are actually relevant, then give your final JSON verdict."""

    response = chat.send_message(user_prompt, request_options={"timeout": 25})
    tool_calls: list[dict] = []

    for _ in range(max_turns):
        parts = response.candidates[0].content.parts
        function_calls = [p.function_call for p in parts if p.function_call]

        if not function_calls:
            break

        function_response_parts = []
        for fc in function_calls:
            tool_name = fc.name
            raw_args = dict(fc.args)
            call_kwargs = {k: v for k, v in raw_args.items() if k not in ("repo", "issue_number")}
            if "top_k" in call_kwargs:
                call_kwargs["top_k"] = int(call_kwargs["top_k"])

            fn = TOOL_REGISTRY.get(tool_name)
            if fn is None:
                result = {"error": f"model requested unknown tool '{tool_name}'"}
            else:
                try:
                    # repo/issue_number always come from the real subtask being
                    # evaluated, never from the model's arguments -- there's no
                    # legitimate reason for the model to investigate a
                    # different issue than the one it was asked about.
                    result = fn(repo, issue_number, **call_kwargs)
                except Exception as exc:
                    logger.warning("Tool %s failed during real loop on %s#%s: %s", tool_name, repo, issue_number, exc)
                    result = {"error": str(exc)}

            tool_calls.append({"tool": tool_name, "input": {"repo": repo, "issue_number": issue_number, **call_kwargs}, "output": result})
            function_response_parts.append(
                genai.protos.Part(function_response=genai.protos.FunctionResponse(
                    name=tool_name, response={"result": result},
                ))
            )

        response = chat.send_message(
            genai.protos.Content(parts=function_response_parts),
            request_options={"timeout": 25},
        )
    else:
        raise TimeoutError(f"Gemini tool-use loop exceeded {max_turns} turns without a final answer")

    parsed = _extract_json(response.text)
    categories = list(parsed.get("categories", []))
    categories = [c for c in categories if c in VALID_CATEGORIES]

    # Deterministic safety net: don't just trust the model followed the
    # "security always wins" instruction in the prompt -- enforce it against
    # what the tool actually reported.
    for tc in tool_calls:
        if tc["tool"] == "security_keyword_check" and tc["output"].get("is_security_sensitive"):
            if "security-sensitive" not in categories:
                categories.insert(0, "security-sensitive")
            break

    escalate = bool(parsed.get("escalate", False)) or "security-sensitive" in categories

    return {
        "escalate": escalate,
        "categories": categories,
        "explanation": parsed.get("explanation", ""),
        "drafted_comment": parsed.get("drafted_comment"),
        "tool_calls": tool_calls,
        "synthesis_method": "gemini-tool-use",
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
    issue["repo"] = repo

    try:
        decision = _run_tool_use_loop(repo, issue_number, issue)
        evidence = {tc["tool"]: tc["output"] for tc in decision["tool_calls"]}
    except Exception as exc:
        logger.info(
            "Real tool-use loop unavailable or failed for %s#%s (%s); falling back",
            repo, issue_number, exc,
        )
        evidence = run_all_tools(repo, issue_number)
        try:
            decision = _synthesize_from_evidence(issue, evidence)
        except Exception as exc2:
            logger.info(
                "LLM synthesis on gathered evidence also failed (%s); using deterministic rule-based fallback",
                exc2,
            )
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
