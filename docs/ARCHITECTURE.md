# RepoGuardian — Architecture & Technical Design

## 1. System Architecture

```mermaid
flowchart TB
    subgraph GitHub_Layer["GitHub Integration Layer"]
        GH_API["GitHub REST API"]
        GH_CLIENT["app.github.client (Rate-Limit Aware)"]
        GH_FETCH["app.github.fetch (Ingestion Pipeline)"]
    end

    subgraph Data_Layer["Storage & Vector Store"]
        SQLITE[("SQLite DB (repoguardian.db)")]
        CHROMA[("Chroma Vector Store (all-MiniLM-L6-v2)")]
    end

    subgraph Agentic_Layer["Agentic Monitoring & Reasoning"]
        SCHEDULER["BackgroundScheduler (app.monitor.poller)"]
        QUEUE["Subtask Queue (app.monitor.queue)"]
        PROCESSOR["Subtask Processor (app.monitor.processor)"]
        TOOLS["6 Independent Tools (app.agent.tools)"]
        RAG["Project-Aware RAG (app.rag.retrieval)"]
        SYNTHESIS["Synthesis Engine (app.agent.synthesis)"]
    end

    subgraph Presentation_Layer["3D WebGL HUD Dashboard"]
        CANVAS["Three.js / React-Three-Fiber"]
        HUD["Glassmorphism HUD (React 19 + Tailwind)"]
        RECHARTS["Health Trends (Recharts)"]
    end

    GH_API --> GH_CLIENT --> GH_FETCH
    GH_FETCH --> SQLITE
    GH_FETCH --> CHROMA
    SCHEDULER --> QUEUE --> PROCESSOR
    PROCESSOR --> TOOLS
    TOOLS --> RAG --> CHROMA
    TOOLS --> SYNTHESIS
    SYNTHESIS --> SQLITE
    SQLITE --> CANVAS & HUD & RECHARTS
```

## 2. Component Directory Mapping

* **`backend/app/db/`**:
  * `schema.sql`: Source of truth table definitions.
  * `database.py`: Thread-safe sqlite3 connection manager & query helpers.
* **`backend/app/github/`**:
  * `client.py`: GitHub API client with rate-limit and token management.
  * `fetch.py`: Fetch, normalize, store, and cache pipeline.
* **`backend/app/rag/`**:
  * `embeddings.py`: Sentence-transformers vector embedding generation.
  * `retrieval.py`: Cosine similarity search with maintainer resolution notes.
* **`backend/app/agent/`**:
  * `tools.py`: 6 callable Python tool functions.
  * `tool_schemas.py`: Anthropic / Gemini tool schemas.
  * `synthesis.py`: Multi-step reasoning and rule-based fallback.
* **`backend/app/monitor/`**:
  * `poller.py`: Periodic GitHub poller loop.
  * `queue.py`: SQLite subtask CRUD.
  * `processor.py`: Subtask executor.
* **`backend/app/api/`**:
  * `issues.py`, `feedback.py`, `health.py`, `monitor.py`: FastAPI routers.
