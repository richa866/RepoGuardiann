# RepoGuardian (PS-04) — System Contracts & Schemas

This document defines the frozen data models, SQLite schema, REST API contracts, and Agent Tool schemas for **RepoGuardian**.

---

## 1. Database Schema (`backend/app/db/schema.sql`)

### Tables

1. **`repos`**: Connected GitHub repositories and live sync status.
2. **`issues`**: Synced issues and pull requests scoped by `repo`.
3. **`comments`**: Issue discussion comments and maintainer replies.
4. **`subtasks`**: Autonomous agent subtasks queue (`duplicate_check`, `missing_info_check`, `health_trend_check`).
5. **`escalations`**: Agent escalation verdicts, categories, evidence JSON, and maintainer follow-up drafts.
6. **`feedback`**: Human-in-the-loop maintainer decisions (thumbs up/down, override notes).
7. **`health_snapshots`**: Periodic repository metrics (backlog growth, SLA response drift, duplicate rate, contributor activity).
8. **`monitor_log`**: Audit log of background scheduler events.

---

## 2. REST API Contracts (`backend/app/api/`)

### Core Endpoints

* `GET /health`: System & active repo health check (`status`, `github_configured`, `gemini_configured`, `active_repo`, `embedding_count`).
* `GET /health-metrics`: Historical repository trend snapshots & escalation breakdown.
* `GET /issues`: Filterable list of issues with latest escalation categories and explanation.
  * Query parameters: `repo`, `state`, `category`, `sort`, `limit`, `offset`.
* `GET /issues/{number}`: Full issue detail, comments, escalations, RAG similarity matches, subtask history, and feedback.
* `POST /issues/{number}/feedback`: Submit maintainer feedback (`vote: "up" | "down"`, `escalation_id`, `note`, `repo`).
* `GET /monitor/status`: Background scheduler state, pending subtask count, recent subtasks feed, and event logs.
* `POST /monitor/check-now` (or `POST /monitor/trigger`): Trigger immediate polling and subtask queue processing.
* `POST /connect`: Connect a new GitHub repository (`repo: "owner/name"`, optional `token`).
* `GET /sync/status`: Poll background sync stage and progress (`stage`, `progress_current`, `progress_total`).
* `POST /sync`: Trigger full resync of the active repository.
* `GET /brief`: Generate or retrieve the maintainer weekly executive brief.

---

## 3. Agent Tool Schemas (`backend/app/agent/tool_schemas.py`)

1. **`duplicate_check(repo, issue_number, top_k=5)`**:
   * Uses Chroma vector cosine similarity to retrieve top-k similar historical issues and maintainer resolutions.
   * Thresholds: `is_likely_duplicate >= 0.80`, `is_possible_regression >= 0.85 (closed state)`.
2. **`response_time_check(repo, issue_number)`**:
   * Calculates days since creation/update without maintainer reply vs. duplicate cluster volume.
   * Escalates `urgent` if no response in 5+ days and similar open reports exist.
3. **`security_keyword_check(repo, issue_number)`**:
   * Scans title, body, and comments for critical vulnerabilities (`cve`, `rce`, `injection`, `xss`, `credential`, `arbitrary code`).
4. **`staleness_check(repo, issue_number)`**:
   * Identifies untriaged issues open > 30 days with 0 labels and 0 comments.
5. **`missing_info_check(repo, issue_number)`**:
   * Detects missing reproduction steps or environment details in bug reports; auto-drafts maintainer follow-up comment.
6. **`contentiousness_check(repo, issue_number)`**:
   * Flags high-disagreement threads (5+ comments, 3+ participants, or explicit pushback keywords like `disagree`, `wontfix`, `nack`).

---

## 4. Escalation Categories

* `security-sensitive`: Critical security or vulnerability report.
* `urgent`: Unresponded issue with multiple duplicate reports.
* `possible-regression`: High similarity to a closed/fixed issue.
* `likely-duplicate`: High similarity to an existing open report.
* `contentious`: High community/maintainer pushback or active debate.
* `needs-more-info`: Bug report lacking steps to reproduce or environment details.
* `stale/needs-triage`: Open 30+ days without labels or responses.
