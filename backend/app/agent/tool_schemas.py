"""Tool JSON schemas for Anthropic / Gemini function calling.
"""
ANTHROPIC_TOOL_SCHEMAS = [
    {
        "name": "duplicate_check",
        "description": "Run vector similarity search against historical issues to identify duplicates or regressions.",
        "input_schema": {
            "type": "object",
            "properties": {
                "repo": {"type": "string", "description": "Target repository (owner/name)"},
                "issue_number": {"type": "integer", "description": "Issue number to check"},
                "top_k": {"type": "integer", "default": 5, "description": "Number of similar issues to return"}
            },
            "required": ["repo", "issue_number"]
        }
    },
    {
        "name": "response_time_check",
        "description": "Check days since issue creation without maintainer reply.",
        "input_schema": {
            "type": "object",
            "properties": {
                "repo": {"type": "string", "description": "Target repository (owner/name)"},
                "issue_number": {"type": "integer", "description": "Issue number to check"}
            },
            "required": ["repo", "issue_number"]
        }
    },
    {
        "name": "security_keyword_check",
        "description": "Scan issue title, body, and comments for security and vulnerability keywords.",
        "input_schema": {
            "type": "object",
            "properties": {
                "repo": {"type": "string", "description": "Target repository (owner/name)"},
                "issue_number": {"type": "integer", "description": "Issue number to check"}
            },
            "required": ["repo", "issue_number"]
        }
    },
    {
        "name": "staleness_check",
        "description": "Check if an issue is untriaged and open for > 30 days without labels or comments.",
        "input_schema": {
            "type": "object",
            "properties": {
                "repo": {"type": "string", "description": "Target repository (owner/name)"},
                "issue_number": {"type": "integer", "description": "Issue number to check"}
            },
            "required": ["repo", "issue_number"]
        }
    },
    {
        "name": "missing_info_check",
        "description": "Check if a bug report lacks reproduction steps or environment details.",
        "input_schema": {
            "type": "object",
            "properties": {
                "repo": {"type": "string", "description": "Target repository (owner/name)"},
                "issue_number": {"type": "integer", "description": "Issue number to check"}
            },
            "required": ["repo", "issue_number"]
        }
    },
    {
        "name": "contentiousness_check",
        "description": "Detect high disagreement, pushback language, or multi-participant contention.",
        "input_schema": {
            "type": "object",
            "properties": {
                "repo": {"type": "string", "description": "Target repository (owner/name)"},
                "issue_number": {"type": "integer", "description": "Issue number to check"}
            },
            "required": ["repo", "issue_number"]
        }
    }
]
