import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  TrendingUp, 
  Users, 
  ShieldCheck, 
  Clock, 
  AlertTriangle, 
  BarChart3 
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
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
      <div className="w-full h-full flex items-center justify-center text-sky-400 font-mono text-sm">
        <Activity className="w-5 h-5 animate-spin mr-2" />
        <span>Computing Repository Health Metrics & Contributor Activity...</span>
      </div>
    );
  }

  const snapshots = data?.snapshots || [];
  const categoryCounts = data?.category_counts || {};
  const pieData = Object.entries(categoryCounts).map(([name, value]) => ({ name, value }));

  const chartData = snapshots.map((s, idx) => ({
    name: new Date(s.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    backlog: s.open_issues,
    responseTime: s.avg_response_hours,
    duplicates: s.duplicate_rate_pct,
    activeContributors: s.active_contributors_30d,
  }));

  return (
    <div className="w-full h-full pt-20 pb-6 px-6 max-w-6xl mx-auto flex flex-col space-y-4 overflow-y-auto">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl glass-panel border border-white/10 space-y-1">
          <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
            Total Escalations
          </span>
          <p className="text-2xl font-bold font-mono text-sky-300">
            {data?.total_escalations || 0}
          </p>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-white/10 space-y-1">
          <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            Avg SLA Response
          </span>
          <p className="text-2xl font-bold font-mono text-amber-300">
            {snapshots[snapshots.length - 1]?.avg_response_hours?.toFixed(1) || '0.0'} hrs
          </p>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-white/10 space-y-1">
          <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            Active Contributors (30d)
          </span>
          <p className="text-2xl font-bold font-mono text-emerald-300">
            {snapshots[snapshots.length - 1]?.active_contributors_30d || 0}
          </p>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-white/10 space-y-1">
          <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-red-400" />
            Duplicate Rate
          </span>
          <p className="text-2xl font-bold font-mono text-red-300">
            {snapshots[snapshots.length - 1]?.duplicate_rate_pct?.toFixed(1) || '0.0'}%
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
        {/* Backlog Growth & Response Trend */}
        <div className="p-4 rounded-2xl glass-panel border border-white/10 flex flex-col">
          <h3 className="text-xs font-semibold text-slate-200 uppercase font-mono mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-sky-400" />
            Backlog Growth & Response Drift
          </h3>
          <div className="flex-1 min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                />
                <Line type="monotone" dataKey="backlog" stroke="#38bdf8" strokeWidth={2} name="Open Issues" />
                <Line type="monotone" dataKey="responseTime" stroke="#f59e0b" strokeWidth={2} name="Avg Response (hrs)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Escalation Category Distribution */}
        <div className="p-4 rounded-2xl glass-panel border border-white/10 flex flex-col">
          <h3 className="text-xs font-semibold text-slate-200 uppercase font-mono mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-400" />
            Escalation Category Breakdown
          </h3>
          <div className="flex-1 min-h-[220px]">
            {pieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono">
                No escalation categories recorded yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
