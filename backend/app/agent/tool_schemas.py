"""Gemini function-calling tool declarations for the 6 functions in agent/tools.py.

Was originally written for Anthropic's tool-use format ("input_schema", lowercase
JSON-Schema type strings like "object"/"integer") -- but this project uses Gemini,
and google-generativeai's protos.Tool wants "parameters" (not "input_schema") and
UPPERCASE type enums ("OBJECT"/"INTEGER"/"STRING"), confirmed empirically: passing
lowercase types raises "KeyError: 'object'" during protobuf marshaling, before any
network call is even made.

Not currently wired into synthesis.py -- run_all_tools() calls all 6 tools directly
in Python with known arguments, it's a fixed pipeline rather than a live
model-driven tool-use loop (see docs/ARCHITECTURE.md's fallback note), so nothing
actually hands these to Gemini as callable tools yet. Kept accurate and validated
regardless, so they're ready if/when that changes.
"""
GEMINI_TOOL_SCHEMAS = [
    {
        "name": "duplicate_check",
        "description": "Run vector similarity search against historical issues to identify duplicates or regressions.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "repo": {"type": "STRING", "description": "Target repository (owner/name)"},
                "issue_number": {"type": "INTEGER", "description": "Issue number to check"},
                "top_k": {"type": "INTEGER", "description": "Number of similar issues to return (default 5)"},
            },
            "required": ["repo", "issue_number"],
        },
    },
    {
        "name": "response_time_check",
        "description": "Check how long an issue has gone without a maintainer reply, both in absolute terms and relative to this repo's own average first-response time.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "repo": {"type": "STRING", "description": "Target repository (owner/name)"},
                "issue_number": {"type": "INTEGER", "description": "Issue number to check"},
            },
            "required": ["repo", "issue_number"],
        },
    },
    {
        "name": "security_keyword_check",
        "description": "Scan issue title, body, and comments for security and vulnerability keywords.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "repo": {"type": "STRING", "description": "Target repository (owner/name)"},
                "issue_number": {"type": "INTEGER", "description": "Issue number to check"},
            },
            "required": ["repo", "issue_number"],
        },
    },
    {
        "name": "staleness_check",
        "description": "Check if an issue is untriaged and open for > 30 days without labels or comments.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "repo": {"type": "STRING", "description": "Target repository (owner/name)"},
                "issue_number": {"type": "INTEGER", "description": "Issue number to check"},
            },
            "required": ["repo", "issue_number"],
        },
    },
    {
        "name": "missing_info_check",
        "description": "Judge whether a bug report lacks reproduction steps or environment details, and draft a follow-up comment if so.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "repo": {"type": "STRING", "description": "Target repository (owner/name)"},
                "issue_number": {"type": "INTEGER", "description": "Issue number to check"},
            },
            "required": ["repo", "issue_number"],
        },
    },
    {
        "name": "contentiousness_check",
        "description": "Detect high disagreement, pushback language, or multi-participant contention in an issue's comments.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "repo": {"type": "STRING", "description": "Target repository (owner/name)"},
                "issue_number": {"type": "INTEGER", "description": "Issue number to check"},
            },
            "required": ["repo", "issue_number"],
        },
    },
]
