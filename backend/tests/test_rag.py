from app.rag.embeddings import vector_id, issue_document

def test_vector_id():
    assert vector_id("owner/repo", 42) == "owner/repo#42"

def test_issue_document():
    issue = {
        "title": "Bug in auth",
        "state": "open",
        "labels": ["bug", "security"],
        "body": "Auth fails with 401",
    }
    doc = issue_document(issue)
    assert "Title: Bug in auth" in doc
    assert "Labels: bug, security" in doc
