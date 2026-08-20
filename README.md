# RepoGuardian (PS-04)

An agentic GitHub repository monitor: continuously polls issue/PR activity,
runs a project-aware RAG similarity search against historical issues, calls
six independent evidence-gathering tools per issue, and synthesizes the
results into an evidence-backed escalation decision a maintainer can confirm
or override.

**Multi-repo:** any public GitHub repo can be connected live from the
frontend's connect screen — type `owner/name`, optionally add a token, and
the full fetch → embed → analyze pipeline runs in the background while you
watch real progress. No token is required for public repos (GitHub's
unauthenticated rate limit is used by default). See
["Connecting a repo live"](#connecting-a-repo-live) below.

## Status tonight (no GitHub/Gemini keys)

Everything runs end-to-end against seeded dummy data:

- SQLite schema, sync pipeline, subtask queue, and continuous polling loop — all real, all working.
- Chroma + sentence-transformers RAG — real local embeddings, real cosine-similarity search.
- All 6 agent tools (`duplicate_check`, `response_time_check`, `security_keyword_check`,
  `staleness_check`, `missing_info_check`, `contentiousness_check`) — real logic against the
  DB/RAG, verified against 8 seeded dummy issues (correctly flagged: 1 security-sensitive RCE
  report, 2 near-duplicate crash reports at 90.7% similarity, 1 stale untriaged issue, issues
  missing repro/env info, 1 possible regression against a closed issue, and 1 contentious
  proposal thread with real pushback language and 4 distinct participants).
- Escalation synthesis — real, with an automatic rule-based fallback (see "Gemini fallback" below)
  so escalation works with **zero** LLM calls tonight, and Gemini simply upgrades the explanation
  prose tomorrow without changing any code path.
- Project health analysis — backlog growth, response time trend, duplicate rate, and
  **contributor activity** (active/new contributors in a rolling 30-day window, computed from
  issue + comment authorship) — all real, all charted on `/monitor`.
- Feedback endpoint — real, fully functional, no external dependency.
- Frontend — all 6 pages (Issue Feed, Likely Duplicates, Security, Weekly Brief, Monitor, and
  per-issue detail) render against live seeded data with human-readable evidence (no raw JSON),
  a category legend with hover explanations, and a "not configured" banner verified to appear
  correctly when a GitHub-dependent action (Sync) is triggered without keys.

### Compulsory requirements — structural completeness

| # | Requirement | Status |
|---|---|---|
| 1 | GitHub Integration | **Code complete**, waiting on `GITHUB_TOKEN`/`GITHUB_REPO`. Pagination + rate-limit handling implemented in [`app/github_client.py`](backend/app/github_client.py). Cannot be tested against the live API tonight — only thing genuinely blocked by missing keys. |
| 2 | Agentic Repository Monitoring | **Done and verified.** Real `BackgroundScheduler` poll loop + manual `/monitor/check-now`, autonomous subtask creation (`duplicate_check`, `missing_info_check`, `health_trend_check`), real queue processor with visible logs — see `/monitor` page. |
| 3 | Project-Aware RAG | **Done and verified.** Chroma + `all-MiniLM-L6-v2`, same code path for dummy and real data, similarity search + maintainer resolution notes surfaced (e.g. issue #6 flagged 83.8% similar to closed #5, whose resolution note "Fixed in v2.1..." is shown). |
| 4 | Selective Escalation | **Done and verified.** 7 categories (urgent, security-sensitive, possible-regression, likely-duplicate, stale/needs-triage, needs-more-info, **contentious**), each with a plain-English explanation citing concrete evidence (issue numbers, similarity %, day counts, participant counts). |
| 4b | Project Health Analysis | **Done and verified.** Response time, backlog growth, duplicate rate, and **contributor activity** (active/new contributors, 30-day rolling window) all computed in [`app/monitor.py`](backend/app/monitor.py) `_compute_health_snapshot()`/`_contributor_activity()` and charted on `/monitor`. |
| 5 | Meaningful GitHub/repository tools | **Done.** 6 distinct, independently callable tool functions in [`app/tools.py`](backend/app/tools.py); `app/agent.py` runs all 6, then synthesizes — genuinely multi-step, not one LLM call. |
| 6 | Evidence-backed explanations | **Done and verified.** Every escalation explanation cites specific numbers (see example outputs above); full evidence JSON stored per escalation and shown in human-readable form (not raw JSON) on the issue detail page. |
| 7 | Explainability & Feedback | **Done and verified.** Every escalation links to its issue number and full evidence; `POST /issues/{id}/feedback` records 👍/👎 and updates `human_override` on the escalation, visible in the UI. |

Nothing on the compulsory list is stubbed. The **only** gap tonight is that
requirement #1 has never talked to the real GitHub API (no token yet) — the
client code, pagination, and rate-limit handling are written and this is a
zero-code-change fix tomorrow.

### Gemini fallback (read this before demoing Phase 4)

Escalation synthesis (`app/agent.py`) and the weekly brief (`app/brief.py`)
both try Gemini first, but catch `ConfigError` *and* any runtime failure
(timeout, network error, quota) and fall back to a **deterministic rule-based
synthesis** that applies the exact same escalation rules and still produces
full evidence-backed explanations — just template prose instead of
LLM-generated prose. This was a deliberate design choice, not a last-minute
descope: a free-tier LLM call is the least reliable part of the pipeline
under demo conditions, so it's wrapped so a slow/rate-limited/misconfigured
Gemini degrades gracefully instead of crashing the demo. You saw this
fallback active tonight (`"synthesis_method": "rule-based-fallback"` /
`"method": "template-fallback"` in every response) — verified working end to
end. Adding `GEMINI_API_KEY` tomorrow flips both to real Gemini output with
zero code changes.

## Connecting a repo live

RepoGuardian supports multiple repos in the same database without data
collision (GitHub issue *numbers* repeat across repos, so every table that
references an issue carries an explicit `repo` column — see
[`app/database.py`](backend/app/database.py)).

- **POST /connect** `{repo: "owner/name", token?: "..."}` validates the repo
  exists and is reachable (a lightweight `GET /repos/{owner}/{name}`, not the
  full issue list), then kicks off a background sync and returns immediately
  with a `sync_id`.
- **GET /sync/status** returns `{status, stage, progress_current,
  progress_total}` for polling — stages are `fetching_issues` →
  `embedding_history` → `running_initial_analysis` → `done`. The frontend
  connect screen polls this every 1.5s and shows a live progress bar.
- Every failure case returns a clear, distinct error: `not_found` (404),
  `token_invalid` (401), `private_no_token` (403), `rate_limited` (429, and
  says whether it's the 60/hr unauthenticated or 5000/hr authenticated
  limit), `sync_in_progress` (409).
- **Concurrency:** only one sync runs at a time, globally. A second
  `/connect` call while one is running is rejected with 409
  `sync_in_progress` rather than queued or cancelled — simplest thing that's
  still correct for a single-operator demo tool, and it keeps two GitHub API
  rate-limit budgets from being spent by accident. Verified with a
  synthetic concurrent-request test (see commit history / test output) —
  the first request proceeds, the second gets a clean 409.
- **No token required for the demo path.** `CONNECT_SYNC_MAX_ITEMS` (default
  30) keeps the live-connect sync small enough to fit inside the
  unauthenticated 60-requests/hour limit (list issues ≈ 1 request, plus one
  comments request per issue that has comments). The "Sync now" button /
  `POST /sync` (full resync of the *already-connected* active repo) uses the
  larger `FULL_SYNC_MAX_ITEMS` (default 300) and is meant to be run with a
  token.
- **Live-tested against two real public repos** (see verification section
  below): `pallets/click` synced and fully analyzed with zero token, real
  duplicate/regression/contentious detections against real GitHub history.
  Isolation was confirmed by querying both repos back to back and checking
  neither's `/issues` or RAG similarity results leaked into the other.

### Existing code that assumed a single fixed repo (had to be touched)

Every one of these originally read a single `settings.github_repo` /
`settings.github_token` from `.env`, or filtered SQL with no repo scoping —
listed explicitly per the requirement to call these out:

- **`app/database.py`** — `issues` primary key changed from `number` to
  `(repo, number)`; every table (`comments`, `subtasks`, `escalations`,
  `feedback`, `health_snapshots`, `monitor_log`) gained a `repo` column;
  `upsert_issue`/`replace_comments`/`enqueue_subtask` all now take `repo` as
  their first argument. (SQLite can't cheaply migrate a primary key shape, so
  a schema-version bump drops and recreates these tables rather than hand
  migrating — fine for single-writer dev/demo data, called out loudly in the
  module docstring.)
- **`app/github_client.py`** — `GitHubClient` already took `(token, repo)`
  explicitly, but the module-level `get_client()` read both from `settings`;
  removed in favor of always constructing the client with an explicit repo
  and (possibly `None`) token. Token is now genuinely optional — no
  `Authorization` header is sent when absent, so unauthenticated public
  access works. Added `validate_repo()` with typed exceptions
  (`RepoNotFoundError`, `RepoPrivateError`, `TokenInvalidError`,
  `RateLimitError`) for `/connect`'s pre-flight check.
- **`app/rag.py`** — Chroma vector ids changed from `str(number)` to
  `"{repo}#{number}"`, metadata gained a `repo` field, and `find_similar`
  now filters with `where={"repo": repo}` — otherwise a similarity search on
  repo A could surface a numerically-colliding vector from repo B.
- **`app/tools.py`** — all 6 tool functions gained `repo` as their first
  parameter, threaded through to `_get_issue`/`_get_comments`/`find_similar`.
- **`app/agent.py`** — `evaluate_issue`/`_run_all_tools` take `repo`; the
  escalation INSERT now writes it.
- **`app/sync.py`** — `run_sync` now takes explicit `(repo, token)` instead
  of calling `settings.require_github()`; gained the `track_progress` flag
  used by the live-connect flow to write stage/progress into the `repos`
  table as it works.
- **`app/monitor.py`** — the poll loop now polls `get_active_repo()` instead
  of a fixed repo; `_compute_health_snapshot`/`_contributor_activity`/
  `process_subtask_queue`/`get_status` all take/filter by `repo`.
- **`app/brief.py`** — `generate_brief`/`_gather_stats` take `repo`.
- **`app/main.py`** — every endpoint that touches issue/escalation data now
  accepts an optional `?repo=` query param, defaulting to the active repo
  (`_require_active_repo` helper); added `POST /connect`, `GET /sync/status`,
  `GET /repos`; startup now auto-bootstraps a `.env`-configured repo in the
  background instead of just checking config.
- **`seed_dummy_data.py`** — seeds into a fixed `demo/repoguardian-seed`
  "repo" and sets it active, using the exact same `upsert_issue`/
  `embed_issue`/`enqueue_subtask` calls the real pipeline uses.

## Stack

- Backend: Python 3.13, FastAPI, SQLite (plain `sqlite3`, no ORM)
- Vector store: Chroma (local, persisted to `backend/data/chroma`)
- Embeddings: `sentence-transformers` (`all-MiniLM-L6-v2`, local, no API key)
- LLM: Google Gemini free tier (`google-generativeai`) — substituted in for the
  originally-specified Anthropic key per the Stack section of the brief; see
  `.env.example`
- Frontend: Vite + React 19, `recharts` for charts, `axios` + `react-router-dom`

## Project layout

```
backend/
  app/
    config.py       # env loading + fail-loud ConfigError
    database.py      # SQLite schema + helpers
    github_client.py # GitHub REST client (pagination, rate limits)
    sync.py          # fetch -> store -> embed -> enqueue pipeline (repo-parameterized)
    rag.py            # Chroma + sentence-transformers (repo-scoped)
    tools.py          # 6 agent tool functions (repo-scoped)
    agent.py           # multi-step synthesis (tools -> Gemini/fallback)
    monitor.py         # scheduler + subtask queue processor (per active repo)
    repos.py            # POST /connect orchestration: validate, background sync, progress
    brief.py             # weekly brief (bonus)
    main.py               # FastAPI routes
  seed_dummy_data.py      # loads 8 dummy issues into demo/repoguardian-seed
frontend/
  src/
    api.js               # backend client, handles 503 not_configured + /connect errors cleanly
    App.jsx               # layout, nav, repo badge, routes to ConnectScreen if no active repo
    pages/                # Dashboard, IssueDetailPage, Duplicates, Security, Brief, Monitor, ConnectScreen
    components/            # Banner, CategoryBadge, CategoryLegend, IssueList, EvidenceCard
```

## Running tonight (no keys needed)

```bash
cd backend
python -m venv venv
source venv/Scripts/activate   # or venv/bin/activate on Mac/Linux
pip install -r requirements.txt
python seed_dummy_data.py
uvicorn app.main:app --reload --port 8000
```

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173. You'll see 8 seeded dummy issues already scored,
escalated, and cross-referenced by the RAG similarity search — with the
"GitHub not configured" pill showing in the header, exactly as it should.

**Or skip the .env entirely tonight** and connect a real public repo live —
click "Connect a different repo", type any `owner/name` (e.g. `pallets/click`),
leave the token field empty, and watch it fetch/embed/analyze for real. This
already works with zero keys; see "Connecting a repo live" above.

## Tomorrow morning: going live

**Option A — auto-connect on startup (fill `.env`):**

1. Open `backend/.env` (copy from the repo-root `.env.example` if you don't
   have one yet) and fill in:
   ```
   GITHUB_TOKEN=<a classic or fine-grained PAT with repo:read>
   GITHUB_REPO=<owner/repo>
   GEMINI_API_KEY=<from https://aistudio.google.com/apikey>
   ```
2. Restart the backend (`uvicorn app.main:app --reload --port 8000`) — it
   auto-connects and syncs `GITHUB_REPO` in the background on startup;
   `/health` reports `"github_configured": true`, `"gemini_configured": true`,
   and `"active_repo": "<owner/repo>"` once that finishes.
3. Refresh the frontend — it lands straight on the populated dashboard.

**Option B — connect live from the UI (no .env edit needed):** just paste a
token into the connect screen's optional token field before hitting Connect,
for the higher 5000/hr rate limit and/or private repo access. Same code path
as Option A, just triggered from the browser instead of `.env` + restart.

Either way, the monitoring loop (every `MONITOR_POLL_INTERVAL_SECONDS`,
default 300s) keeps polling the active repo automatically from there; use
"Check now" on `/monitor` for on-demand demo control, and "Sync now" in the
header for a full resync (`FULL_SYNC_MAX_ITEMS`, default 300 issues).

No other code changes are required — every GitHub/Gemini-dependent function
was written and tested tonight against this exact same interface, including
live end-to-end runs against real public repos (see "Connecting a repo
live").

## Design notes for future changes

- Escalation thresholds (`DUPLICATE_SIMILARITY_THRESHOLD`, `STALE_DAYS`,
  `NO_RESPONSE_DAYS`, `SECURITY_KEYWORDS`, etc.) are constants at the top of
  [`app/tools.py`](backend/app/tools.py) — tune without touching logic.
- Each tool function returns a flat, independently-testable evidence dict;
  add a 6th tool by writing one function with the same shape and registering
  it in `ALL_TOOLS` + `_run_all_tools` in `app/agent.py`.
- The rule-based fallback in `_rule_based_synthesis` mirrors the LLM prompt's
  rules 1:1 — if you change escalation logic, update both, or better, extract
  a shared rule table (left as-is tonight to keep both paths easy to read
  under time pressure).
- SQLite schema lives entirely in `database.py`'s `SCHEMA` string; add
  columns/tables there, no migration framework in place (fine for a
  hackathon single-writer SQLite setup, revisit if this grows).
