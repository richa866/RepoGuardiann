# 🛠️ RepoGuardian — Comprehensive Developer & Engineering Log

> **Project:** RepoGuardian (Hackathon Problem Statement PS-04)  
> **Repository:** [https://github.com/richa866/RepoGuardiann](https://github.com/richa866/RepoGuardiann)  
> **Status:** Full Working System (Backend, RAG, Agent Tools, 3D WebGL Frontend, Multi-Branch Git)  
> **Last Updated:** August 20, 2026

---

## 📖 Table of Contents
1. [Executive Summary & Problem Statement](#1-executive-summary--problem-statement)
2. [End-to-End Development Timeline & Completed Milestones](#2-end-to-end-development-timeline--completed-milestones)
3. [Architecture & Subsystem Breakdown](#3-architecture--subsystem-breakdown)
4. [3D Asset Pipeline & Blender Models](#4-3d-asset-pipeline--blender-models)
5. [Agentic Monitoring & Multi-Step Tools](#5-agentic-monitoring--multi-step-tools)
6. [Project-Aware RAG & Chroma Vector Store](#6-project-aware-rag--chroma-vector-store)
7. [Frontend 3D Visualizations & HUD Overlays](#7-frontend-3d-visualizations--hud-overlays)
8. [Git Branch Topology & Multi-Developer Workflow](#8-git-branch-topology--multi-developer-workflow)
9. [Running, Testing & Verification Commands](#9-running-testing--verification-commands)

---

## 1. Executive Summary & Problem Statement

RepoGuardian is an autonomous, agentic open-source maintainer assistant designed to eliminate triage fatigue for active GitHub repositories. Instead of relying on passive keyword matching or single generic LLM prompts, RepoGuardian:
1. **Continuously Monitors** repositories via a background polling scheduler and real SQLite subtask queue.
2. **Performs Project-Aware RAG** using local vector embeddings (`all-MiniLM-L6-v2`) to cross-reference incoming issues against historical issues and maintainer resolutions (*"Fixed in v2.1..."*).
3. **Executes 6 Independent Tool Checks** per issue before synthesizing evidence into concrete escalation decisions.
4. **Provides Full Explainability & Human-in-the-Loop Feedback** with drafted follow-up comments and 👍 / 👎 maintainer override buttons.
5. **Renders an Immersive 3D Git-Themed Dashboard** with a Binary Black Hole Singularity loading sequence, hierarchical 3D Git branch tree, and category-clustered issue graphs.

---

## 2. End-to-End Development Timeline & Completed Milestones

### 📍 Milestone 1: Core Backend & SQLite Schema
* Created SQLite database layer in `backend/app/db/database.py` with `backend/app/db/schema.sql`.
* Implemented multi-repo support with compound primary keys `(repo, number)` across all tables:
  * `repos`, `issues`, `comments`, `subtasks`, `escalations`, `feedback`, `health_snapshots`, `monitor_log`.
* Built thread-safe connection pooling and transactional context managers (`with tx():`).

### 📍 Milestone 2: Rate-Limit Aware GitHub Ingestion
* Built `backend/app/github/client.py` wrapping GitHub REST API v3 with automatic rate-limit detection (`X-RateLimit-Remaining`).
* Built `backend/app/github/fetch.py` for fetching, normalizing, storing issues and comments, and triggering embedding + subtask queuing.
* Added support for unauthenticated public repo fetching (60 req/hr) and authenticated tokens (5,000 req/hr).

### 📍 Milestone 3: Local Chroma Vector RAG Engine
* Implemented persistent Chroma DB storage in `backend/app/rag/embeddings.py` and `backend/app/rag/retrieval.py`.
* Configured local `SentenceTransformerEmbeddingFunction` with `all-MiniLM-L6-v2` (zero cloud dependencies, fast local inference).
* Embeds title, body, state, labels, and top maintainer discussion comments.
* Implemented cosine similarity search with automatic regression detection (similarity $\ge 0.85$ against closed issues) and duplicate detection (similarity $\ge 0.80$ against open issues).

### 📍 Milestone 4: 6 Independent Agent Tools & Dual-Mode Synthesis
* Built 6 independently callable Python tool functions in `backend/app/agent/tools.py`:
  1. `duplicate_check`: Cosine similarity vs. historical issues.
  2. `response_time_check`: Days unresponded vs. maintainer presence.
  3. `security_keyword_check`: Regex detection of CVE, RCE, injection, credential leaks.
  4. `staleness_check`: Untriaged issues open > 30 days without labels/comments.
  5. `missing_info_check`: Bug reports lacking repro steps or environment details + auto-drafted follow-up comments.
  6. `contentiousness_check`: Multi-participant debate and pushback keywords (`disagree`, `wontfix`, `nack`).
* Built `backend/app/agent/synthesis.py`: Calls Google Gemini (`gemini-1.5-flash`) for prose synthesis, with automatic fallback to **deterministic rule-based synthesis** if API keys are absent or rate-limited.

### 📍 Milestone 5: Continuous Agentic Polling & Subtask Queue
* Built `backend/app/monitor/poller.py` with `BackgroundScheduler` running periodic sync cycles.
* Built `backend/app/monitor/queue.py` and `backend/app/monitor/processor.py` to manage autonomous subtasks:
  * State transitions: `pending` $\rightarrow$ `running` $\rightarrow$ `done` / `error`.
  * Computes rolling 30-day health snapshots (backlog growth, response SLA, duplicate rate, active/new contributors).

### 📍 Milestone 6: 3D Blender Asset Pipeline (Blender CLI)
* Generated custom 3D `.glb` assets in `frontend/public/models/`:
  1. `repoguardian_logo.glb`: 3D GitHub Octocat medallion with obsidian coin base, glowing cyan rim, and raised luminous white Octocat relief.
  2. `git_branch_node.glb`: Faceted hexagonal crystal commit node with metallic clamp brackets.
  3. `smooth_issue_orb.glb`: 48×48 high-subdivision smooth issue orb with dual gimbal rings and high emission shaders.
  4. `commit_node.glb`: Low-poly faceted commit sphere.
* Created reproducible Blender generation scripts in `scripts/`:
  * `generate_octocat_logo.py`, `generate_branch_node.py`, `generate_smooth_issue_orb.py`, `generate_3d_assets.py`.

### 📍 Milestone 7: 3-Stage 3D WebGL User Flow (Three.js & React-Three-Fiber)
* **Stage 1 — Binary Black Hole Singularity Loader** (`BlackHoleMergerScene.jsx`):
  * Two binary black holes (cyan and orange plasma) with event horizons, 600+ swirling accretion particles, relativistic jets, and chirping gravitational wave ripples ($45\text{ Hz} \rightarrow 850\text{ Hz}$).
* **Stage 2 — Hierarchical 3D Git Branch Tree** (`GitBranchGraph3D.jsx`):
  * Clean Git tree visualization: `main` trunk spine with `release/v2.1`, `feature/auth-sessions`, `hotfix/terminal-escape`, and `feature/rag-pipeline` branching and merging with connecting tubes.
  * Prominent pulsating red button: **`[ 🚨 ENGAGE AGENTIC TRIAGE: SHOW ISSUES ]`**.
* **Stage 3 — Clustered 3D Triage Scene** (`GitTreeScene.jsx`):
  * Category-based spatial clusters with $>2\times$ spacious orbital spread:
    * 🔴 `Critical Security & Urgent Hub`
    * 🟣 `Historical Regressions`
    * 🟡 `Contentious Proposals & Pushback`
    * 🔗 `Semantic Duplicates & Stale Backlog`
    * ❓ `Missing Information & Repro Steps`
    * 🌿 `Standard Triaged Backlog`
  * High-contrast, ultra-readable 3D labels with issue number, category chip, and title preview.

### 📍 Milestone 8: Glassmorphism HUD Overlays & Feedback
* `TopNav.jsx`: Active repo pill, 3D Octocat logo, AI status badge, view switcher, and "Check Now" triggers.
* `MonitorPanel.jsx`: Live agentic polling radar, real-time subtask queue feed, and scheduler event stream.
* `IssueDetailPanel.jsx`: Glassmorphism drawer with escalation verdict, evidence breakdown, Chroma RAG matches, drafted comments, and 👍 / 👎 human override buttons.
* `HealthMetricsView.jsx`: Recharts analytics for backlog growth, response SLA, and contributor activity.
* `WeeklyBriefView.jsx`: Executive weekly brief summary.
* `ConnectRepoModal.jsx`: Modal to connect any GitHub repository live with stage progress bar.

### 📍 Milestone 9: Canonical Package Refactoring & Team Setup Guide
* Reorganized backend into modular packages:
  * `app/db/`, `app/github/`, `app/rag/`, `app/agent/`, `app/monitor/`, `app/api/`.
* Created `CONTRACTS.md`, `docker-compose.yml`, `docs/ARCHITECTURE.md`, `docs/DEMO_SCRIPT.md`.
* Created 4-page `RepoGuardian_Team_Setup_Guide.pdf` for team onboarding.
* Pushed to `https://github.com/richa866/RepoGuardiann.git` across all 5 branches (`main`, `feat/backend-pipeline`, `feat/rag-retrieval`, `feat/agent-escalation`, `feat/frontend-hud`).
* Added unit test suite in `backend/tests/` with 7 passing pytest tests.

---

## 3. Architecture & Subsystem Breakdown

```
repoguardian/
├── CONTRACTS.md                 # Frozen schema & API contracts
├── README.md                    # Primary repository overview
├── DEVELOPERS.md                # This comprehensive engineering log
├── docker-compose.yml           # Containerized orchestration
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app & lifespan scheduler
│   │   ├── config.py            # Settings (env vars)
│   │   ├── db/                  # SQLite access layer & schema.sql
│   │   ├── github/              # REST client & fetch pipeline
│   │   ├── rag/                 # Chroma embeddings & retrieval
│   │   ├── agent/               # 6 tools, tool schemas, synthesis
│   │   ├── monitor/             # Background poller, queue, processor
│   │   └── api/                 # REST routers (issues, feedback, health, monitor)
│   ├── scripts/                 # CLI tools (init_db, run_fetch, seed_dummy_data)
│   └── tests/                   # Pytest unit test suite
├── frontend/
│   ├── public/models/           # Blender .glb models
│   └── src/
│       ├── components/3d/       # 3D Git tree, clustered triage, Octocat logo
│       ├── components/hud/      # Glassmorphism HUD overlays
│       └── components/intro/    # Black hole merger scene & space loader
└── docs/
    ├── ARCHITECTURE.md          # System architecture & data flow
    └── DEMO_SCRIPT.md           # 3-minute hackathon judge script
```

---

## 4. 3D Asset Pipeline & Blender Models

All 3D assets were modeled in Blender 5.2 LTS and exported as compressed `.glb` files into `frontend/public/models/`:

| Model File | Size | Visual Design & Materials | Generation Script |
| :--- | :--- | :--- | :--- |
| **`repoguardian_logo.glb`** | 9.7 KB | Obsidian coin body (`#0b1120`), glowing cyan rim (`#38bdf8`), raised luminous white Octocat relief (`#ffffff`). | [`scripts/generate_octocat_logo.py`](scripts/generate_octocat_logo.py) |
| **`git_branch_node.glb`** | 11 KB | Faceted hexagonal crystal commit core, dual metallic clamp brackets, branch connection pins. | [`scripts/generate_branch_node.py`](scripts/generate_branch_node.py) |
| **`smooth_issue_orb.glb`** | 16 KB | 48×48 high-subdivision UV sphere with smooth shading, dual gimbal rings, high emission core. | [`scripts/generate_smooth_issue_orb.py`](scripts/generate_smooth_issue_orb.py) |
| **`commit_node.glb`** | 64 KB | Low-poly faceted commit sphere with emission material. | [`scripts/generate_3d_assets.py`](scripts/generate_3d_assets.py) |

---

## 5. Agentic Monitoring & Multi-Step Tools

### 6 Independent Tool Functions (`app/agent/tools.py`)

1. **`duplicate_check(repo, issue_number, top_k=5)`**:
   * Vector cosine similarity search vs. historical issues in Chroma DB.
   * `is_likely_duplicate`: Similarity $\ge 0.80$ against open issues.
   * `is_possible_regression`: Similarity $\ge 0.85$ against closed issues.
2. **`response_time_check(repo, issue_number)`**:
   * Evaluates days since creation without maintainer reply.
   * Flags `urgent` if unresponded for $\ge 5$ days.
3. **`security_keyword_check(repo, issue_number)`**:
   * Scans text for CVE identifiers, RCE, arbitrary code execution, SQLi, XSS, credential leaks, and Zip Slip.
4. **`staleness_check(repo, issue_number)`**:
   * Identifies untriaged issues open $\ge 30$ days with 0 labels and 0 comments.
5. **`missing_info_check(repo, issue_number)`**:
   * Analyzes bug reports for missing reproduction steps or environment details; auto-drafts a polite maintainer response.
6. **`contentiousness_check(repo, issue_number)`**:
   * Detects multi-participant debate ($\ge 5$ comments, $\ge 3$ participants) or explicit pushback keywords (`disagree`, `wontfix`, `nack`, `breaking change`).

---

## 6. Project-Aware RAG & Chroma Vector Store

* **Local Vector Store:** Chroma DB (`backend/data/chroma`).
* **Embedding Model:** `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions).
* **Document Ingestion:** Embeds title, state, labels, body text, and top maintainer discussion comments.
* **Resolution Context:** When a regression or duplicate is retrieved, the maintainer's original resolution note (*"Fixed in v2.1 via PR #104"*) is displayed directly in the issue detail card.

---

## 7. Frontend 3D Visualizations & HUD Overlays

* **Tech Stack:** React 19, `@react-three/fiber`, `@react-three/drei`, Three.js, Tailwind CSS v4, Lucide Icons, Recharts.
* **Key Components:**
  * `BlackHoleMergerScene.jsx`: Binary black hole merger simulation.
  * `SpaceLoadingScreen.jsx`: Telemetry HUD with chirp frequency, strain amplitude, and progress bar.
  * `GitBranchGraph3D.jsx`: 3D Git tree with crystal commit nodes and connecting curves.
  * `GitTreeScene.jsx`: 3D clustered triage scene with category hubs and relationship links.
  * `GitNode.jsx`: High-contrast 3D HTML labels and glowing emission orbs.
  * `TopNav.jsx`, `MonitorPanel.jsx`, `IssueDetailPanel.jsx`, `HealthMetricsView.jsx`, `WeeklyBriefView.jsx`, `ConnectRepoModal.jsx`.

---

## 8. Git Branch Topology & Multi-Developer Workflow

All 5 branches are synchronized on **[https://github.com/richa866/RepoGuardiann](https://github.com/richa866/RepoGuardiann)**:

* **`main`**: Production / Demo-ready branch.
* **`feat/backend-pipeline`**: Backend Dev (GitHub client, polling loop, SQLite queues).
* **`feat/rag-retrieval`**: AIML #1 (Chroma embeddings, maintainer resolution context).
* **`feat/agent-escalation`**: AIML #2 (Agent reasoning, 6 tools, prompt synthesis).
* **`feat/frontend-hud`**: AIML #3 / Frontend (3D scenes, HUD overlays, charts).

---

## 9. Running, Testing & Verification Commands

### Start Backend
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
python scripts/seed_dummy_data.py
uvicorn app.main:app --reload --port 8000
```

### Start Frontend
```bash
cd frontend
npm install
npm run dev
```

### Run Unit Tests
```bash
cd backend
source venv/bin/activate
pytest
```

### Re-generate 3D Blender Assets
```bash
blender --background --python scripts/generate_octocat_logo.py
blender --background --python scripts/generate_branch_node.py
blender --background --python scripts/generate_smooth_issue_orb.py
```

### 📍 Milestone 10: Proportional 3D Scaling & Smooth Camera Navigation
* **Proportional 3D Text & Label Scaling**:
  * Switched all 3D HTML labels in `GitNode.jsx`, `GitTreeScene.jsx`, and `GitBranchGraph3D.jsx` to `<Html transform sprite distanceFactor={...}>`.
  * Text and glassmorphism cards now scale **1:1 in true 3D perspective** alongside the 3D meshes when zooming in/out, eliminating oversized label bloat.
* **Smooth Camera Controllers**:
  * Added `SmoothCameraController` in `GitTreeScene.jsx` and `SmoothBranchCameraController` in `GitBranchGraph3D.jsx`.
  * Selecting a node or commit smoothly lerps camera position and OrbitControls target (`controls.target.lerp()`) to focus on the selected element.
  * Deselecting returns camera to the overview vantage point.
* **Health Metrics Data Mapping**:
  * Refined `HealthMetricsView.jsx` to map SQLite `health_snapshots` timestamps, SLA response drift, duplicate rate %, and 30-day contributor activity.
