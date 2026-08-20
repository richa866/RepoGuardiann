import { useEffect, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import api from "../api";

function fmtTime(t) {
  try { return new Date(t).toLocaleTimeString(); } catch { return t; }
}

export default function Monitor() {
  const [status, setStatus] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [checking, setChecking] = useState(false);

  async function load() {
    const [s, m] = await Promise.all([api.monitorStatus(), api.healthMetrics()]);
    if (s.data) setStatus(s.data);
    if (m.data) setMetrics(m.data);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  async function handleCheckNow() {
    setChecking(true);
    await api.checkNow();
    setChecking(false);
    load();
  }

  const chartData = (metrics?.snapshots || []).map((s) => ({
    time: fmtTime(s.taken_at),
    backlog: s.backlog_size,
    responseHours: s.avg_response_time_hours,
    duplicateRate: (s.duplicate_rate || 0) * 100,
    activeContributors: s.active_contributors_30d,
    newContributors: s.new_contributors_30d,
  }));
  const latestSnapshot = metrics?.snapshots?.[metrics.snapshots.length - 1];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Monitor</div>
          <div className="page-sub">
            Proof of continuous monitoring — polling loop, subtask queue, and health trend.
          </div>
        </div>
        <button className="btn btn-accent" onClick={handleCheckNow} disabled={checking}>
          {checking ? "Checking…" : "Check now"}
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{status?.scheduler_running ? "Running" : "Stopped"}</div>
          <div className="stat-label">Poll loop status (every {status?.poll_interval_seconds}s)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{status?.subtask_counts?.pending ?? 0}</div>
          <div className="stat-label">Pending subtasks</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{status?.subtask_counts?.done ?? 0}</div>
          <div className="stat-label">Done subtasks</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{metrics?.total_escalations ?? 0}</div>
          <div className="stat-label">Total escalations</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{latestSnapshot?.active_contributors_30d ?? "—"}</div>
          <div className="stat-label">Active contributors (30d)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{latestSnapshot?.new_contributors_30d ?? "—"}</div>
          <div className="stat-label">New contributors (30d)</div>
        </div>
      </div>

      <div className="chart-card">
        <div className="section-title">Backlog Growth</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="time" stroke="var(--text-faint)" fontSize={11} />
            <YAxis stroke="var(--text-faint)" fontSize={11} />
            <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }} />
            <Line type="monotone" dataKey="backlog" stroke="var(--accent)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <div className="section-title">Avg Response Time (hours)</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="time" stroke="var(--text-faint)" fontSize={11} />
            <YAxis stroke="var(--text-faint)" fontSize={11} />
            <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }} />
            <Line type="monotone" dataKey="responseHours" stroke="var(--green)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <div className="section-title">Contributor Activity (30-day window)</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="time" stroke="var(--text-faint)" fontSize={11} />
            <YAxis stroke="var(--text-faint)" fontSize={11} />
            <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }} />
            <Line type="monotone" dataKey="activeContributors" name="Active" stroke="var(--purple)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="newContributors" name="New" stroke="var(--pink)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="section-title">Recent Subtasks (queue processor log)</div>
          {(status?.recent_subtasks || []).map((s) => (
            <div key={s.id} className={"subtask-log-item " + s.status}>
              <strong>#{s.id} {s.task_type}</strong>
              {s.issue_number && <> — issue #{s.issue_number}</>} — {s.status}
              <div style={{ color: "var(--text-faint)", fontSize: 11 }}>
                {s.created_at && fmtTime(s.created_at)}
                {s.log && <div style={{ whiteSpace: "pre-wrap", marginTop: 2 }}>{s.log}</div>}
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="section-title">Monitor Event Log</div>
          {(status?.recent_log || []).map((l) => (
            <div key={l.id} className="subtask-log-item done">
              <strong>{l.event}</strong>
              <div style={{ color: "var(--text-faint)", fontSize: 11 }}>
                {fmtTime(l.ts)} {l.detail && `— ${l.detail}`}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
