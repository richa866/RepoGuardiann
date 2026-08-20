import { useEffect, useState, useCallback } from "react";
import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import api from "./api";
import Dashboard from "./pages/Dashboard";
import IssueDetailPage from "./pages/IssueDetailPage";
import Duplicates from "./pages/Duplicates";
import Security from "./pages/Security";
import Brief from "./pages/Brief";
import Monitor from "./pages/Monitor";
import ConnectScreen from "./pages/ConnectScreen";
import "./App.css";

function NavItem({ to, children, end }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
      {children}
    </NavLink>
  );
}

function MainApp({ health, onRepoConnected, geminiOn }) {
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const navigate = useNavigate();

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    const { data, notConfigured, error } = await api.sync();
    setSyncing(false);
    if (notConfigured) setSyncMsg(`Not configured: missing ${notConfigured.missing.join(", ")}`);
    else if (error) setSyncMsg(`Sync failed: ${error}`);
    else setSyncMsg(`Synced ${data.fetched} issues, ${data.changed} changed.`);
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">🛡</span>
          <span>RepoGuardian</span>
        </div>
        <nav className="nav">
          <NavItem to="/" end>All Issues</NavItem>
          <NavItem to="/duplicates">Likely Duplicates</NavItem>
          <NavItem to="/security">Security</NavItem>
          <NavItem to="/brief">Weekly Brief</NavItem>
          <NavItem to="/monitor">Monitor</NavItem>
        </nav>
        <div className="topbar-right">
          <span className="pill pill-repo" title="Currently monitored repository">
            📦 {health?.active_repo}
          </span>
          <span className={"pill " + (geminiOn ? "pill-green" : "pill-amber")}>
            Gemini {geminiOn ? "on" : "rule-based fallback"}
          </span>
          <button className="btn btn-accent" onClick={handleSync} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync now"}
          </button>
          <button className="btn" onClick={() => navigate("/connect")}>
            Connect a different repo
          </button>
        </div>
      </header>
      {syncMsg && <div className="sync-toast">{syncMsg}</div>}
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/issues/:number" element={<IssueDetailPage />} />
          <Route path="/duplicates" element={<Duplicates />} />
          <Route path="/security" element={<Security />} />
          <Route path="/brief" element={<Brief />} />
          <Route path="/monitor" element={<Monitor />} />
          <Route path="/connect" element={<ConnectScreen onConnected={onRepoConnected} />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const [health, setHealth] = useState(null);
  const navigate = useNavigate();

  const loadHealth = useCallback(async () => {
    const { data } = await api.health();
    if (data) setHealth(data);
  }, []);

  useEffect(() => {
    loadHealth();
    const t = setInterval(loadHealth, 15000);
    return () => clearInterval(t);
  }, [loadHealth]);

  function handleRepoConnected() {
    loadHealth();
    navigate("/");
  }

  if (health === null) {
    return <div className="loader">Loading…</div>;
  }

  if (!health.active_repo) {
    return (
      <Routes>
        <Route path="*" element={<ConnectScreen onConnected={handleRepoConnected} />} />
      </Routes>
    );
  }

  return <MainApp health={health} geminiOn={health.gemini_configured} onRepoConnected={handleRepoConnected} />;
}
