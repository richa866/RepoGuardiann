from app.rag.embeddings import vector_id, issue_document

def test_vector_id():
    assert vector_id("owner/repo", 42) == "owner/repo#42"

def test_issue_document():
    # format_issue_document(title, body) per CONTRACTS.md: "title + \n\n + body",
    # nothing else -- state/labels aren't part of the embedded document.
    doc = issue_document("Bug in auth", "Auth fails with 401")
    assert doc == "Bug in auth\n\nAuth fails with 401"


def test_issue_document_handles_missing_body():
    assert issue_document("Just a title", None) == "Just a title\n\n"
