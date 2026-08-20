import pytest
from app.agent.tools import (
    SECURITY_REGEX,
    CONTENTIOUS_REGEX,
    DUPLICATE_SIMILARITY_THRESHOLD,
    REGRESSION_SIMILARITY_THRESHOLD,
)

def test_security_regex():
    text = "Found a critical RCE vulnerability via arbitrary code execution in the parser (CVE-2024-1234)"
    matches = [m.group(0).lower() for m in SECURITY_REGEX.finditer(text)]
    assert "rce" in matches
    assert "arbitrary code" in matches
    assert "cve-2024-1234" in matches

def test_contentious_regex():
    text = "I strongly disagree with this proposal, please wontfix or revert this breaking change"
    matches = [m.group(0).lower() for m in CONTENTIOUS_REGEX.finditer(text)]
    assert "disagree" in matches
    assert "wontfix" in matches
    assert "breaking change" in matches

def test_thresholds():
    # 0.75 is a calibrated value (see the comment above DUPLICATE_SIMILARITY_THRESHOLD
    # in agent/tools.py), not an arbitrary default -- don't "fix" this back to 0.80
    # without re-reading that rationale first.
    assert DUPLICATE_SIMILARITY_THRESHOLD == 0.75
    assert REGRESSION_SIMILARITY_THRESHOLD == 0.85
