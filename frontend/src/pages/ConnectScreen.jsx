import { useEffect, useRef, useState } from "react";
import api from "../api";

const STAGE_LABELS = {
  fetching_issues: "Fetching issues from GitHub…",
  embedding_history: "Embedding issue history for similarity search…",
  running_initial_analysis: "Running initial analysis (duplicate, security, staleness checks)…",
  done: "Done!",
};

const ERROR_HINTS = {
  not_found: "Double-check the spelling — it must be an exact 'owner/name' match.",
  token_invalid: "Generate a fresh token at github.com/settings/tokens and try again.",
  private_no_token: "Private repos need a token with repo:read scope.",
  rate_limited: "GitHub limits unauthenticated requests to 60/hour. Add a token, or wait a few minutes.",
  sync_in_progress: "Only one sync runs at a time in this demo — wait for it to finish.",
  invalid_repo_format: "Use the exact form 'owner/name', e.g. facebook/react.",
};

export default function ConnectScreen({ onConnected }) {
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState(null);
  const [activeRepo, setActiveRepo] = useState(null);
  const [status, setStatus] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => () => clearInterval(pollRef.current), []);

  async function pollStatus(repoName) {
    const { data } = await api.syncStatus(repoName);
    if (!data) return;
    setStatus(data);
    if (data.status === "done") {
      clearInterval(pollRef.current);
      setTimeout(() => onConnected(repoName), 600);
    } else if (data.status === "error") {
      clearInterval(pollRef.current);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = repo.trim();
    if (!trimmed) return;

    setConnecting(true);
    setConnectError(null);
    setStatus(null);

    const { data, error } = await api.connect(trimmed, token.trim() || null);
    setConnecting(false);

    if (error) {
      setConnectError(error);
      return;
    }

    setActiveRepo(data.repo);
    pollRef.current = setInterval(() => pollStatus(data.repo), 1500);
    pollStatus(data.repo);
  }

  const progressPct = status?.progress_total
    ? Math.min(100, Math.round((status.progress_current / status.progress_total) * 100))
    : status?.stage === "running_initial_analysis" ? 90 : status?.stage === "done" ? 100 : 5;

  return (
    <div className="connect-shell">
      <div className="connect-card">
        <div className="connect-brand">
          <span style={{ fontSize: 28 }}>🛡</span>
          <h1>RepoGuardian</h1>
        </div>
        <p className="connect-sub">
          Connect any public GitHub repository to start monitoring its issues live.
        </p>

        {!activeRepo && (
          <form onSubmit={handleSubmit} className="connect-form">
            <label className="connect-label">Repository</label>
            <input
              type="text"
              className="connect-input"
              placeholder="owner/name — e.g. facebook/react"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              disabled={connecting}
              autoFocus
            />

            <button
              type="button"
              className="connect-token-toggle"
              onClick={() => setShowToken((s) => !s)}
            >
              {showToken ? "− Hide token field" : "+ Add a GitHub token (optional)"}
            </button>
            {showToken && (
              <>
                <input
                  type="password"
                  className="connect-input"
                  placeholder="ghp_… (optional)"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={connecting}
                />
                <p className="connect-hint">
                  Optional — only needed for private repos or to raise the rate limit from
                  60/hour to 5,000/hour. Public repos work fine with no token.
                </p>
              </>
            )}

            {connectError && (
              <div className="connect-error">
                <strong>{connectError.message}</strong>
                {ERROR_HINTS[connectError.code] && <div className="connect-error-hint">{ERROR_HINTS[connectError.code]}</div>}
              </div>
            )}

            <button type="submit" className="btn btn-accent connect-submit" disabled={connecting || !repo.trim()}>
              {connecting ? "Connecting…" : "Connect"}
            </button>
          </form>
        )}

        {activeRepo && status && (
          <div className="connect-progress">
            <div className="connect-progress-repo">{activeRepo}</div>
            <div className="progress-bar-track">
              <div
                className={"progress-bar-fill" + (status.status === "error" ? " error" : "")}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="connect-stage-label">
              {status.status === "error"
                ? `Sync failed: ${status.error}`
                : STAGE_LABELS[status.stage] || "Working…"}
            </div>
            {status.progress_total > 0 && status.status !== "error" && (
              <div className="connect-progress-count">
                {status.progress_current} / {status.progress_total}
              </div>
            )}
            {status.status === "error" && (
              <button
                className="btn btn-sm"
                style={{ marginTop: 12 }}
                onClick={() => { setActiveRepo(null); setStatus(null); }}
              >
                Try a different repo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
