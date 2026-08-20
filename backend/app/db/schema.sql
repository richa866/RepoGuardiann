CREATE TABLE IF NOT EXISTS repos (
    repo TEXT PRIMARY KEY,
    token TEXT,
    added_at TEXT NOT NULL,
    last_sync_at TEXT,
    sync_id TEXT,
    sync_status TEXT NOT NULL DEFAULT 'idle',   -- idle | running | done | error
    sync_stage TEXT,                             -- fetching_issues | embedding_history | running_initial_analysis | done
    sync_progress_current INTEGER NOT NULL DEFAULT 0,
    sync_progress_total INTEGER NOT NULL DEFAULT 0,
    sync_error TEXT
);

CREATE TABLE IF NOT EXISTS issues (
    repo TEXT NOT NULL,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    state TEXT NOT NULL,                         -- open | closed
    is_pr INTEGER NOT NULL DEFAULT 0,
    author TEXT,
    labels TEXT NOT NULL DEFAULT '[]',           -- JSON array of strings
    comments_count INTEGER NOT NULL DEFAULT 0,
    url TEXT,
    created_at TEXT,
    updated_at TEXT,
    closed_at TEXT,
    last_synced_at TEXT,
    PRIMARY KEY (repo, number)
);
CREATE INDEX IF NOT EXISTS idx_issues_repo_state ON issues(repo, state);
CREATE INDEX IF NOT EXISTS idx_issues_updated ON issues(updated_at DESC);

CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo TEXT NOT NULL,
    issue_number INTEGER NOT NULL,
    github_comment_id INTEGER,
    author TEXT,
    body TEXT,
    created_at TEXT,
    is_maintainer INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_comments_issue ON comments(repo, issue_number);

CREATE TABLE IF NOT EXISTS subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo TEXT NOT NULL,
    issue_number INTEGER,
    task_type TEXT NOT NULL,                     -- duplicate_check | missing_info_check | health_trend_check | security_keyword_check | staleness_check | contentiousness_check
    dedupe_key TEXT UNIQUE,                      -- UNIQUE deduplication key (e.g., "repo#issue#task_type#updated_at")
    status TEXT NOT NULL DEFAULT 'pending',      -- pending | running | done | error
    result_json TEXT,
    log TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_subtasks_status ON subtasks(status);
CREATE INDEX IF NOT EXISTS idx_subtasks_repo_issue ON subtasks(repo, issue_number);
CREATE INDEX IF NOT EXISTS idx_subtasks_dedupe ON subtasks(dedupe_key);

CREATE TABLE IF NOT EXISTS escalations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo TEXT NOT NULL,
    issue_number INTEGER NOT NULL,
    escalate INTEGER NOT NULL,                   -- 1 = escalated, 0 = normal
    categories TEXT NOT NULL DEFAULT '[]',       -- JSON list, e.g. ["security-sensitive", "urgent", "likely-duplicate"]
    explanation TEXT,
    evidence_json TEXT NOT NULL DEFAULT '{}',
    drafted_comment TEXT,
    human_override TEXT,                         -- NULL | 'confirmed' | 'dismissed'
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_escalations_repo_issue ON escalations(repo, issue_number);

CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo TEXT NOT NULL,
    issue_number INTEGER NOT NULL,
    escalation_id INTEGER,
    vote TEXT NOT NULL,                         -- up | down
    note TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_repo_issue ON feedback(repo, issue_number);

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

CREATE TABLE IF NOT EXISTS monitor_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo TEXT,
    ts TEXT NOT NULL,
    event TEXT NOT NULL,
    detail TEXT
);
CREATE INDEX IF NOT EXISTS idx_monitor_log_repo ON monitor_log(repo);

CREATE TABLE IF NOT EXISTS sync_meta (
    key TEXT PRIMARY KEY,
    value TEXT
);
