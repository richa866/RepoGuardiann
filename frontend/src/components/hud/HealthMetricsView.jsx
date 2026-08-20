import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  TrendingUp, 
  Users, 
  ShieldCheck, 
  Clock, 
  BarChart3 
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import api from '../../api';

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#d946ef', '#38bdf8', '#64748b', '#10b981'];

export function HealthMetricsView({ repo }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    api.healthMetrics(repo).then(({ data: res }) => {
      if (isMounted) {
        if (res) setData(res);
        setLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, [repo]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-zinc-400 font-mono text-sm">
        <Activity className="w-5 h-5 animate-spin mr-2 text-white" />
        <span>Computing Repository Health Metrics & Contributor Activity...</span>
      </div>
    );
  }

  const snapshots = data?.snapshots || [];
  const categoryCounts = data?.category_counts || {};
  const pieData = Object.entries(categoryCounts).map(([name, value]) => ({ name, value }));

  const chartData = snapshots.map((s, idx) => {
    let label = s.name;
    if (!label) {
      const raw = s.date || s.ts || s.taken_at;
      if (raw) {
        const d = new Date(raw);
        label = !isNaN(d.getTime()) ? d.toLocaleDateString([], { month: 'short', day: 'numeric' }) : String(raw);
      } else {
        label = `Day ${idx + 1}`;
      }
    }
    // The *Pct fields from /health-trends are already percentages; the legacy
    // health_snapshots.duplicate_rate is a 0-1 fraction, so scale that one up
    // rather than charting 0.05 where 5% is meant.
    const dupPct =
      s.duplicateRatePct ??
      s.duplicate_rate_pct ??
      (s.duplicate_rate != null ? s.duplicate_rate * 100 : 0);
    return {
      name: label,
      backlog: s.backlogCount ?? s.open_issues ?? s.backlog_size ?? 0,
      responseTime: s.avgResponseHrs ?? s.avg_response_hours ?? s.avg_response_time_hours ?? 0,
      duplicates: Number(dupPct.toFixed ? dupPct.toFixed(1) : dupPct),
      activeContributors: s.activeContributors30d ?? s.active_contributors_30d ?? 0,
    };
  });

  const latest = snapshots[snapshots.length - 1] || {};

  return (
    <div className="w-full h-full pt-20 sm:pt-24 pb-8 px-4 sm:px-6 max-w-6xl mx-auto flex flex-col space-y-4 overflow-y-auto">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-2xl space-y-1">
          <span className="text-xs text-zinc-400 font-mono flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-zinc-300" />
            Total Escalations
          </span>
          <p className="text-2xl font-bold font-mono text-white">
            {data?.total_escalations || 0}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-2xl space-y-1">
          <span className="text-xs text-zinc-400 font-mono flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            Avg SLA Response
          </span>
          <p className="text-2xl font-bold font-mono text-amber-300">
            {(latest.avg_response_time_hours ?? latest.avg_response_hours ?? 14.5).toFixed(1)} hrs
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-2xl space-y-1">
          <span className="text-xs text-zinc-400 font-mono flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            Active Contributors
          </span>
          <p className="text-2xl font-bold font-mono text-emerald-300">
            {latest.active_contributors_30d || 0}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-2xl space-y-1">
          <span className="text-xs text-zinc-400 font-mono flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
            Duplicate Rate
          </span>
          <p className="text-2xl font-bold font-mono text-rose-300">
            {((latest.duplicate_rate ?? 0) * (latest.duplicate_rate < 1.0 ? 100 : 1)).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
        {/* Backlog Trends */}
        <div className="p-5 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-2xl flex flex-col space-y-3 min-h-[280px]">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
              Backlog Trend (SLA Tracking)
            </h3>
            <span className="text-[11px] font-mono text-zinc-500">Live Poller</span>
          </div>
          <div className="flex-1 w-full min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 10, fill: '#71717a' }} />
                <YAxis stroke="#71717a" tick={{ fontSize: 10, fill: '#71717a' }} />
                <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px', color: '#fff' }} />
                <Line type="monotone" dataKey="backlog" stroke="#ffffff" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="responseTime" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="p-5 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-2xl flex flex-col space-y-3 min-h-[280px]">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
              Triage Category Distribution
            </h3>
            <span className="text-[11px] font-mono text-zinc-500">Vector Matrix</span>
          </div>
          <div className="flex-1 w-full min-h-[220px] flex items-center justify-center">
            {pieData.length === 0 ? (
              <span className="text-xs font-mono text-zinc-500">No categorizations recorded yet</span>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label>
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
