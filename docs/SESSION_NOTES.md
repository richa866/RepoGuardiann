# Session Notes — Backend Integration & Sync Fixes

Working notes from a debugging/integration session on `feat/agent-escalation`, covering three
merges into that branch and four real backend bugs found and fixed while getting the frontend
and backend running together end to end. Kept for anyone picking this branch up later.

## Branch state

`feat/agent-escalation` is now fully merged with all three parallel tracks:

- `feat/rag-retrieval` (P3 — RAG/embeddings work)
- `fix/complete-backend-migration` (P1 — structured feedback API, health-trends endpoints)
- `feat/frontend-hud` (P4 — the 3D HUD frontend, fast-forwarded in cleanly, 0 conflicts)

Merge conflicts encountered (all resolved, verified live against real data, not just
auto-resolved and trusted):

- `backend/app/api/feedback.py` — deleted on our side to kill a duplicate-route bug (see below),
  independently rebuilt on `fix/complete-backend-migration`'s side into a much richer
  implementation (auto `escalation_id` lookup, structured override reasons, analytics). Kept
  theirs — it's a strict superset of the fix we'd made.
- `backend/app/api/issues.py` — removed our now-redundant feedback route, trimmed the orphaned
  imports/models that left behind.
- `frontend/src/components/hud/HealthMetricsView.jsx` — took their chart-data mapper (handles
  more field-name variants) but kept our fraction→percent scaling, since the raw
  `health_snapshots.duplicate_rate` column is stored 0–1.
- One piece of *silent* auto-merge damage caught by explicit verification, not by git: after
  taking their `feedback.py` back, our side of `main.py` still had the `feedback_router` import
  and mount removed (from when we'd deleted the file) — so the route existed but was never
  registered. Would have 404'd every feedback POST. Fixed by re-adding the import/mount.

## Bugs found and fixed this session

### 1. Duplicate `POST /issues/{number}/feedback` route (fixed, then re-fixed after merge)

Two files defined the same route; FastAPI silently served whichever router was mounted first,
so the other implementation was dead code that never ran. The dead copy happened to be the one
that validated the vote value and stamped `escalations.human_override` — so both silently
stopped happening. Root-caused by testing every write path live (an invalid vote returned
`200 OK` instead of `400`), not by reading the code.

### 2. `collection_size()` poisoned the Chroma collection on the very first `/health` call

`app/rag/embeddings.py` — `collection_size()` used `get_or_create_collection()` without an
embedding function, "to keep `/health` fast." But `get_or_create` *creates* the collection if
missing, and because no embedding function was passed, Chroma persisted it with its
`DefaultEmbeddingFunction`. The first real sync's `embed_issue()` (which does pass
`sentence_transformer`) then failed outright:

```
Embedding function conflict: new: sentence_transformer vs persisted: default
```

Since the frontend calls `/health` on load — before any sync has run — this reliably poisoned
every fresh setup, and the sync would fail with zero issues stored. Fixed by switching to
`get_collection()` (read-only, returns 0 if not yet created, never defines the collection's
config).

### 3. Sync only ever stored 30–500 items, no matter what the config said

Two independent bugs stacked on top of each other:

- **Cache key had no page size in it.** The raw-response cache was keyed as
  `page_{N}.json` — no page-size component. A page fetched once at `per_page=30` got served
  back verbatim to a later run that asked for `per_page=100`, and pagination's own
  end-of-data check (`len(page) < per_page`) then falsely triggered against that stale 30-item
  page. Raising `CONNECT_SYNC_MAX_ITEMS` in `.env` appeared to do nothing because of this.
  Fixed: constant `per_page=100`, cache key now includes both page number and page size.

- **`state="all"` sorted by `updated desc`, single hard cap.** Even after the above fix, a
  sync capped at (say) 500 items would fetch the 500 *most recently updated* issues+PRs — and
  on an active repo, PRs get updated far more often than old-but-still-open issues, so those
  PRs crowd stale issues out of the window entirely. Verified concretely on `httpie/cli`: GitHub
  reports 187 real open issues right now; a "successful" sync under the old logic stored only
  131 of them.

  Fixed with a two-phase fetch (`fetch_repository_data` in `app/github/fetch.py`):
  - **Initial/full sync** (`since=None`): fetch `state="open"` to full completion first
    (bounded only by a 2000-item safety ceiling, not by `max_items`), *then* `state="closed"`
    up to the remaining `max_items` budget for RAG/duplicate-detection history. This guarantees
    every currently-open item is captured regardless of how long ago it was last touched.
    Verified: httpie/cli now shows `open_issues=187, open_prs=145` in the DB — an exact match
    against GitHub's live count.
  - **Incremental poll** (`since=<timestamp>`): stays a single `state="all"` pass with GitHub's
    `since` filter. Deliberately *not* split into open/closed phases — a state="open"-only
    query stops returning an issue the instant it closes, so it could never detect a close.

### 4. Background polling never actually reflected live GitHub state

Two compounding issues, so subtle that "poll every 90s" had been running the whole session
without ever once producing a different result:

- **`run_sync()` silently dropped the `since` parameter.** It accepted `since` in its
  signature but never passed it to `fetch_repository_data()` — every poll tick re-ran a full
  unfiltered fetch from page 1 instead of an incremental since-filtered one.
- **The raw-response cache has no TTL or freshness check at all.** Once `page_1.json` existed,
  it was served back forever, on every future call, regardless of what changed on GitHub —
  `force_refresh` was never set to `True` from the poller. Combined with bug (3)'s cache-key
  issue, a poll tick could replay the exact same cached JSON from the very first sync
  indefinitely.

  Fixed: `run_sync()` now threads `since` through properly, and `since` being present forces
  `force_refresh=True` for that fetch (a poll's entire purpose is freshness, so it must never
  read a stale cached page). Verified live: after the fix, a manual `POST /monitor/check-now`
  logged `cache=MISS` on every single item — confirming it hit GitHub live for the first time.

  Poll interval also changed from 90s → **120s (2 minutes)**, per explicit request, in both
  `.env` and `backend/.env`.

## An operator mistake worth recording

Mid-session, a cleanup command (`rm -rf data/chroma data/raw_cache data/repoguardian.db`) was
run against paths the **live backend server was actively using**, without checking whether a
process held them open first. The next request against the server created a brand-new empty
database at that path, which reset the SQLite WAL and made the deleted data unrecoverable (not
merely inconvenient — actually gone). All of it was reproducible GitHub sync data plus test
feedback rows, not source code or git history, so nothing structural was lost — but it caused
real downtime and a full re-sync, and it's exactly the class of mistake the project's own
safety guidance calls out: check whether a running process owns a path before deleting it,
every time, not just when it seems risky.

## Config changes

`.env` and `backend/.env` (both gitignored, not committed):

| Key | Before | After |
|---|---|---|
| `GITHUB_TOKEN` | only in root `.env`, empty in `backend/.env` (which loads first and won) | synced into `backend/.env`; rate limit went from 60/hr unauthenticated to 5000/hr |
| `CONNECT_SYNC_MAX_ITEMS` | 30 | 300 (now governs *closed-issue backfill* only, not total items — see bug 3) |
| `FULL_SYNC_MAX_ITEMS` | 300 | 500 (same semantics change) |
| `MONITOR_POLL_INTERVAL_SECONDS` | 90 | 120 |

## Known state / open items

- `encode/httpx` is a poor demo repo for "show me open issues" — essentially all of its open
  activity is PRs; real open issues are close to zero. `httpie/cli` is a good one (187 real open
  issues, active on both fronts).
- Three GitHub *write* endpoints exist (`POST /issues/{number}/comment|labels|close`) added on
  `fix/complete-backend-migration`. They were inert while `GITHUB_TOKEN` was unset; now that the
  token loads, they're live against whichever repo is connected. Worth a deliberate decision
  (confirmation gate, dry-run flag, or removal) before a live demo, given the project's stated
  read-only / human-approval design intent elsewhere (e.g. `missing_info_check`'s drafted
  comment is explicitly never auto-posted).
- Gemini's free tier (20 requests/day) has been repeatedly exhausted during this session's
  testing; synthesis degrades to a rule-based tier that still produces real evidence-cited
  verdicts, just not the live multi-step tool-use agent. Worth budgeting for a demo.
- `backend/tests/conftest.py` isolates `settings.database_path` for tests but not
  `settings.chroma_path` — flagged in an earlier session, still not fixed, still out of scope
  unless someone picks it up.
