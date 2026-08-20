# RepoGuardian — System Architecture & Contracts Specification

This document defines the frozen system contracts, target repository configuration, SQLite database schema, ChromaDB vector collection structure, REST API specifications, and environment configurations for **RepoGuardian** (Autonomous GitHub Agentic Maintainer Assistant).

---

## 1. Target Repository Specification

* **Repository**: `encode/httpx`
* **GitHub URL**: `https://github.com/encode/httpx`
* **Language & Ecosystem**: Python / HTTP Client / AsyncIO & Trio
* **Selection Rationale & Qualification**:
  1. **Issue Volume & History**: 2,800+ total issues and PRs (with 300+ open issues), offering a rich historical dataset for duplicate detection, regression clustering, and classification.
  2. **Active Maintenance (Last 6 Months)**: Regularly updated with active commit velocity, PR reviews, and releases by maintainers (Tom Christie, Florimond Houssiau, etc.).
  3. **High Maintainer Responsiveness**: Maintainers actively engage, triage incoming issues, and guide contributors.
  4. **Rich Closed Decision Comments**: Closed issues contain explicit maintainer rationale (e.g., *"Closing as duplicate of #..."*, *"Expected behavior per HTTP/2 specification"*, *"Fixed in release v0.27.0"*, *"Closing due to missing minimal reproducible example"*), providing high-quality ground-truth context for RAG retrieval and regression analysis.
  5. **Real-world Edge Cases**: Exhibits genuine maintainer triage bottlenecks: connection pool timeouts, SSL certificate handling, proxy configuration disputes, HTTP/2 multiplexing regressions, and security-sensitive header handling.

---

## 2. SQLite Database Schema (`backend/app/db/schema.sql`)

The backend uses a local SQLite database with WAL mode enabled. All tables are defined below:

```sql
-- 1. Repositories
CREATE TABLE IF NOT EXISTS repos (
    repo TEXT PRIMARY KEY,                       -- e.g. "encode/httpx"
    token TEXT,                                 -- Optional custom GitHub token
    added_at TEXT NOT NULL,                     -- ISO 8601 timestamp
    last_sync_at TEXT,                          -- ISO 8601 timestamp
    sync_id TEXT,                               -- Current sync job UUID
    sync_status TEXT NOT NULL DEFAULT 'idle',   -- idle | running | done | error
    sync_stage TEXT,                            -- fetching_issues | embedding_history | running_initial_analysis | done
    sync_progress_current INTEGER NOT NULL DEFAULT 0,
    sync_progress_total INTEGER NOT NULL DEFAULT 0,
    sync_error TEXT
);

-- 2. GitHub Issues & Pull Requests
CREATE TABLE IF NOT EXISTS issues (
    repo TEXT NOT NULL,                         -- e.g. "encode/httpx"
    number INTEGER NOT NULL,                    -- GitHub issue number
    title TEXT NOT NULL,
    body TEXT,
    state TEXT NOT NULL,                         -- 'open' | 'closed'
    is_pr INTEGER NOT NULL DEFAULT 0,            -- 0 = Issue, 1 = Pull Request
    author TEXT,
    labels TEXT NOT NULL DEFAULT '[]',           -- JSON array of label names: ["bug", "http2"]
    comments_count INTEGER NOT NULL DEFAULT 0,
    url TEXT,                                   -- GitHub HTML URL
    created_at TEXT,                            -- ISO 8601 timestamp
    updated_at TEXT,                            -- ISO 8601 timestamp
    closed_at TEXT,                             -- ISO 8601 timestamp (or NULL)
    last_synced_at TEXT,                        -- ISO 8601 timestamp
    PRIMARY KEY (repo, number)
);
CREATE INDEX IF NOT EXISTS idx_issues_repo_state ON issues(repo, state);
CREATE INDEX IF NOT EXISTS idx_issues_updated ON issues(updated_at DESC);

-- 3. Issue Discussion Comments
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo TEXT NOT NULL,
    issue_number INTEGER NOT NULL,
    github_comment_id INTEGER,
    author TEXT,
    body TEXT,
    created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_comments_issue ON comments(repo, issue_number);

-- 4. Autonomous Agent Subtasks Queue
CREATE TABLE IF NOT EXISTS subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo TEXT NOT NULL,
    issue_number INTEGER,
    task_type TEXT NOT NULL,                     -- duplicate_check | missing_info_check | health_trend_check | security_keyword_check | staleness_check | contentiousness_check
    dedupe_key TEXT UNIQUE,                      -- "{repo}|{issue_number}|{task_type}|{issue_updated_at}" for per-issue
                                                  -- subtasks, "{repo}|None|{task_type}|{UTC-day}" for repo-wide ones
                                                  -- (e.g. health_trend_check). enqueue_subtask() uses INSERT OR IGNORE,
                                                  -- so this is what actually makes re-polling idempotent.
    status TEXT NOT NULL DEFAULT 'pending',      -- pending | running | done | error
    result_json TEXT,                            -- JSON output from tool analysis
    log TEXT NOT NULL DEFAULT '',                -- Execution / debug log
    created_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_subtasks_status ON subtasks(status);
CREATE INDEX IF NOT EXISTS idx_subtasks_repo_issue ON subtasks(repo, issue_number);
CREATE INDEX IF NOT EXISTS idx_subtasks_dedupe ON subtasks(dedupe_key);

-- 5. Agent Escalations & Maintainer Follow-up Drafts
CREATE TABLE IF NOT EXISTS escalations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo TEXT NOT NULL,
    issue_number INTEGER NOT NULL,
    escalate INTEGER NOT NULL,                   -- 1 = escalated, 0 = regular triage
    categories TEXT NOT NULL DEFAULT '[]',       -- JSON list: ["security-sensitive", "urgent", "likely-duplicate", "possible-regression"]
    explanation TEXT,                            -- Plain English reason for maintainer
    evidence_json TEXT NOT NULL DEFAULT '{}',    -- Structured evidence (similarity scores, matching issue IDs, matched keywords)
    drafted_comment TEXT,                        -- Auto-generated draft response for the maintainer
    human_override TEXT,                         -- NULL | 'confirmed' | 'dismissed'
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_escalations_repo_issue ON escalations(repo, issue_number);

-- 6. Maintainer Feedback (Human-in-the-Loop)
CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo TEXT NOT NULL,
    issue_number INTEGER NOT NULL,
    escalation_id INTEGER,
    vote TEXT NOT NULL,                         -- 'up' | 'down'
    note TEXT,                                  -- Maintainer reason or correction
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_repo_issue ON feedback(repo, issue_number);

-- 7. Background Monitor Runs Audit Log
CREATE TABLE IF NOT EXISTS monitor_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL DEFAULT 'running',      -- running | success | error
    new_issues_count INTEGER NOT NULL DEFAULT 0,
    updated_issues_count INTEGER NOT NULL DEFAULT 0,
    subtasks_created_count INTEGER NOT NULL DEFAULT 0,
    error TEXT
);
CREATE INDEX IF NOT EXISTS idx_monitor_runs_repo ON monitor_runs(repo);

-- 8. Periodic Repository Health Snapshots
CREATE TABLE IF NOT EXISTS health_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo TEXT NOT NULL,
    taken_at TEXT NOT NULL,
    backlog_size INTEGER NOT NULL,
    avg_response_time_hours REAL,
    duplicate_rate REAL,
    open_count INTEGER,
    closed_count INTEGER,
    active_contributors_30d INTEGER,
    new_contributors_30d INTEGER
);
CREATE INDEX IF NOT EXISTS idx_health_repo ON health_snapshots(repo);

-- 9. Background Scheduler Monitor Event Log
CREATE TABLE IF NOT EXISTS monitor_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo TEXT,
    ts TEXT NOT NULL,
    event TEXT NOT NULL,
    detail TEXT
);
CREATE INDEX IF NOT EXISTS idx_monitor_log_repo ON monitor_log(repo);

-- 10. Sync Metadata
CREATE TABLE IF NOT EXISTS sync_meta (
    key TEXT PRIMARY KEY,
    value TEXT
);
```

---

## 3. ChromaDB Vector Collection Schema

ChromaDB provides local semantic embeddings for vector similarity search over historical issues and PRs.

* **Collection Name**: `repoguardian_issues`
* **Embedding Model**: `sentence-transformers/all-MiniLM-L6-v2` (384-dimensional dense vectors)
* **Document ID**: `"{repo}#{issue_number}"` (e.g. `"encode/httpx#1042"`) or stringified integer `"{issue_number}"`
* **Document Content**: `format_issue_document(title, body)` — just `"{title}\n\n{body}"`, nothing else embedded (no labels/state prefix):
  ```text
  HTTP/2 connection leak on keep-alive timeout

  When creating a client with http2=True and sending multiple concurrent requests...
  ```
* **Metadata Schema** (set by `embed_issue()`):
  | Field | Type | Description |
  | :--- | :--- | :--- |
  | `number` | `int` | GitHub issue number |
  | `repo` | `str` | Repository identifier (`"encode/httpx"`) |
  | `title` | `str` | Issue title, truncated to 200 chars |
  | `state` | `str` | `"open"` or `"closed"` |
  | `is_pr` | `bool` | `True` for PR, `False` for Issue |
  | `labels` | `str` | Comma-delimited list of labels (`"bug,http2"`) |
  | `created_at` | `str` | ISO 8601 creation timestamp |
  | `closed_at` | `str` | ISO 8601 close timestamp (or `""` if open) |

---

## 4. REST API Contract (`backend/app/api/`)

All endpoints return JSON responses. Standard HTTP error codes (400, 404, 422, 500) include `{"detail": "Error message"}`.

### 1. `GET /issues`
Returns a paginated, filterable list of issues with escalation verdicts.

* **Query Parameters**:
  * `repo` (string, optional): Filter by repo (defaults to active repo).
  * `state` (string, optional): `"open"` | `"closed"` | `"all"` (default: `"open"`).
  * `category` (string, optional): Filter by escalation category (`"urgent"`, `"security-sensitive"`, `"likely-duplicate"`, `"possible-regression"`, `"needs-more-info"`, `"stale/needs-triage"`, `"contentious"`).
  * `sort` (string, optional): `"updated_desc"` | `"created_desc"` | `"escalated_first"` (default: `"escalated_first"`).
  * `limit` (integer, optional): Default `25`, max `100`.
  * `offset` (integer, optional): Default `0`.

* **Response (200 OK)**:
```json
{
  "total": 312,
  "limit": 25,
  "offset": 0,
  "issues": [
    {
      "repo": "encode/httpx",
      "number": 1042,
      "title": "HTTP/2 connection leak on keep-alive timeout",
      "body": "When creating a client with http2=True...",
      "state": "open",
      "is_pr": false,
      "author": "octocat",
      "labels": ["bug", "http2"],
      "comments_count": 4,
      "url": "https://github.com/encode/httpx/issues/1042",
      "created_at": "2026-08-15T14:20:00Z",
      "updated_at": "2026-08-19T09:12:00Z",
      "closed_at": null,
      "escalation": {
        "id": 45,
        "escalate": 1,
        "categories": ["urgent", "possible-regression"],
        "explanation": "High similarity (0.89) to closed issue #812 which was fixed in v0.26.0. 3 similar reports filed in 48 hours with no maintainer reply.",
        "drafted_comment": "Thanks for reporting! This looks closely related to the HTTP/2 connection pooling fix in #812. Could you share your `httpx` version and whether keep-alive is explicitly disabled?",
        "human_override": null,
        "created_at": "2026-08-19T09:15:00Z"
      }
    }
  ]
}
```

---

### 2. `GET /issues/{number}`
Retrieves full details for a single issue including comments, Chroma semantic similarity matches, subtask execution history, escalation verdicts, and maintainer feedback.

* **Path Parameters**:
  * `number` (integer, required): The issue number.
* **Query Parameters**:
  * `repo` (string, optional): Repository name (defaults to active repo).

* **Response (200 OK)**:
```json
{
  "issue": {
    "repo": "encode/httpx",
    "number": 1042,
    "title": "HTTP/2 connection leak on keep-alive timeout",
    "body": "Detailed description...",
    "state": "open",
    "is_pr": false,
    "author": "octocat",
    "labels": ["bug", "http2"],
    "comments_count": 2,
    "url": "https://github.com/encode/httpx/issues/1042",
    "created_at": "2026-08-15T14:20:00Z",
    "updated_at": "2026-08-19T09:12:00Z",
    "closed_at": null
  },
  "comments": [
    {
      "id": 1,
      "author": "user123",
      "body": "I can also reproduce this on Python 3.12.",
      "created_at": "2026-08-16T10:00:00Z"
    }
  ],
  "escalation": {
    "id": 45,
    "escalate": 1,
    "categories": ["urgent", "possible-regression"],
    "explanation": "High similarity to closed issue #812.",
    "evidence": {
      "duplicate_score": 0.89,
      "matching_issues": [
        {"number": 812, "title": "Connection leak in HTTP/2 pool", "state": "closed", "similarity": 0.89}
      ],
      "days_without_response": 4
    },
    "drafted_comment": "Thanks for reporting!...",
    "human_override": null
  },
  "subtasks": [
    {
      "id": 101,
      "task_type": "duplicate_check",
      "status": "done",
      "result": {"is_duplicate": false, "is_regression": true, "similarity": 0.89, "top_match": 812},
      "finished_at": "2026-08-19T09:14:30Z"
    }
  ],
  "feedback": [
    {
      "id": 12,
      "vote": "up",
      "note": "Accurate regression catch",
      "created_at": "2026-08-19T10:00:00Z"
    }
  ]
}
```

---

### 3. `POST /issues/{number}/feedback`
Records maintainer feedback (human-in-the-loop evaluation) on agent escalation quality.

* **Path Parameters**:
  * `number` (integer, required): The issue number.
* **Request Body**:
```json
{
  "repo": "encode/httpx",
  "escalation_id": 45,
  "vote": "up",
  "note": "Accurate duplicate catch, drafted response saved maintainer time."
}
```
* **Response (200 OK)**:
```json
{
  "status": "ok",
  "feedback_id": 12,
  "message": "Feedback successfully recorded"
}
```

---

### 4. `GET /health`
System liveness and component readiness check.

* **Response (200 OK)**:
```json
{
  "status": "healthy",
  "active_repo": "encode/httpx",
  "github_configured": true,
  "llm_provider": "gemini",
  "llm_configured": true,
  "database_connected": true,
  "chroma_connected": true,
  "embedding_count": 842,
  "open_issues_count": 312,
  "pending_subtasks_count": 0
}
```

---

### 5. `GET /monitor/status`
Returns background monitoring loop state, queue size, and recent scheduler runs.

* **Response (200 OK)**:
```json
{
  "scheduler_active": true,
  "poll_interval_seconds": 300,
  "active_repo": "encode/httpx",
  "last_run": {
    "id": 8,
    "started_at": "2026-08-20T11:45:00Z",
    "finished_at": "2026-08-20T11:45:08Z",
    "status": "success",
    "new_issues_count": 2,
    "updated_issues_count": 5,
    "subtasks_created_count": 6
  },
  "next_run_estimated": "2026-08-20T11:50:00Z",
  "pending_subtasks_count": 0,
  "recent_runs": [
    {
      "id": 8,
      "status": "success",
      "started_at": "2026-08-20T11:45:00Z",
      "new_issues": 2
    }
  ]
}
```

---

### 6. `POST /monitor/trigger`
Forces an immediate polling run and executes pending subtasks without waiting for the scheduler interval.

* **Request Body** (optional):
```json
{
  "repo": "encode/httpx"
}
```
* **Response (200 OK)**:
```json
{
  "status": "triggered",
  "run_id": 9,
  "message": "Monitor poll cycle executed successfully",
  "summary": {
    "new_issues": 1,
    "updated_issues": 3,
    "subtasks_executed": 4
  }
}
```

---

## 5. Environment Variables (`.env`)

The system requires the following environment variables:

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `GITHUB_TOKEN` | No | `""` | GitHub Personal Access Token; raises the unauthenticated 60/hr rate limit to 5,000/hr. Public repos work without it. |
| `TARGET_REPO` / `GITHUB_REPO` | No | — | Repository to auto-connect at startup (`"owner/repo"`). Either name works, `TARGET_REPO` wins if both are set; leave blank to connect live from the UI instead. |
| `GEMINI_API_KEY` | Yes | `""` | **The actual agent-reasoning LLM.** Free-tier key from https://aistudio.google.com/apikey — required for real synthesis; without it the agent falls back to a deterministic rule-based verdict. |
| `GEMINI_MODEL` | No | `gemini-1.5-flash` | Gemini model name — check `genai.list_models()` against your key before relying on this default; Google retires model names frequently. |
| `ANTHROPIC_API_KEY` | No | — | Legacy/unused: a vestigial config field from the original Claude-based plan before the project standardized on Gemini. Not read by any actual LLM call — safe to leave unset. |
| `POLL_INTERVAL_SECONDS` / `MONITOR_POLL_INTERVAL_SECONDS` | No | `300` | Seconds between background poll cycles. Either name works, `POLL_INTERVAL_SECONDS` wins if both are set. |
| `DB_PATH` / `DATABASE_PATH` | No | `./data/repoguardian.db` | Path to the SQLite database file. Either name works, `DB_PATH` wins if both are set. |
| `CHROMA_PATH` | No | `./data/chromadb` | Path to persistent ChromaDB storage directory. |

---

## 6. Escalation Categories & Agent Subtasks

### Escalation Categories
* `security-sensitive`: Potential CVE, RCE, credential leak, authentication bypass, or arbitrary code execution.
* `urgent`: Unanswered issue with multiple duplicate reports or severe operational failure.
* `possible-regression`: High vector similarity ($\ge 0.85$) to a previously closed/fixed issue.
* `likely-duplicate`: High vector similarity ($\ge 0.80$) to an open issue.
* `contentious`: Escalated debate, multiple participant conflicts, or explicit pushback (`wontfix`, `nack`, strong disagreement).
* `needs-more-info`: Missing reproducible code snippet, version details, or OS environment.
* `stale/needs-triage`: Open $> 30$ days without triage label or maintainer response.

### Subtasks Matrix
1. `duplicate_check(repo, issue_number, top_k=5)`: Vector cosine similarity against Chroma collection.
2. `response_time_check(repo, issue_number)`: Unanswered duration analysis.
3. `security_keyword_check(repo, issue_number)`: Regex and rule-based vulnerability heuristics.
4. `staleness_check(repo, issue_number)`: Untriaged dormancy detection.
5. `missing_info_check(repo, issue_number)`: Reproduction steps and environment verification with draft comment generation.
6. `contentiousness_check(repo, issue_number)`: Sentiment, participant volume, and conflict keyword analysis.
