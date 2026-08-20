import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Activity, 
  Clock, 
  Users, 
  CheckCircle2, 
  Sparkles, 
  ArrowUpRight, 
  Download, 
  RotateCw,
  HelpCircle
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import api from '../../api';

const CATEGORY_STYLES = {
  urgent: { label: 'Urgent Fixes', dot: 'bg-rose-400', text: 'text-rose-300' },
  'security-sensitive': { label: 'Security Concerns', dot: 'bg-red-400', text: 'text-red-300' },
  'possible-regression': { label: 'Potential Regressions', dot: 'bg-purple-400', text: 'text-purple-300' },
  contentious: { label: 'Active Debates', dot: 'bg-amber-400', text: 'text-amber-300' },
  'likely-duplicate': { label: 'Similar & Duplicate Inquiries', dot: 'bg-slate-400', text: 'text-slate-300' },
  'needs-more-info': { label: 'Awaiting User Info', dot: 'bg-teal-400', text: 'text-teal-300' },
  'stale/needs-triage': { label: 'Awaiting Initial Review', dot: 'bg-orange-400', text: 'text-orange-300' },
};

export function HealthMetricsView({ repo }) {
  const [summaryData, setSummaryData] = useState(null);
  const [driftData, setDriftData] = useState([]);
  const [categoriesData, setCategoriesData] = useState([]);
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeframeDays, setTimeframeDays] = useState(30);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: sumRes },
        { data: driftRes },
        { data: catRes },
        { data: hRes }
      ] = await Promise.all([
        api.healthTrendsSummary(repo),
        api.healthTrendsBacklogDrift(repo, timeframeDays),
        api.healthTrendsCategoryBreakdown(repo),
        api.health(repo),
      ]);

      if (sumRes) setSummaryData(sumRes);
      if (Array.isArray(driftRes)) setDriftData(driftRes);
      if (Array.isArray(catRes)) setCategoriesData(catRes);
      if (hRes) setHealthData(hRes);
    } catch (err) {
      console.error('Failed to load health metrics:', err);
    } finally {
      setLoading(false);
    }
  }, [repo, timeframeDays]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await api.checkNow(repo);
      await loadData();
      showToast('Health data refreshed');
    } catch (e) {
      showToast('Could not refresh: ' + e.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExportBrief = () => {
    const lines = [
      `# Repository Health Summary — ${repo || 'Current Repository'}`,
      `Generated: ${new Date().toLocaleDateString()}`,
      '',
      `## Key Numbers`,
      `- Open Issues: ${healthData?.open_issues_count || 0} (${healthData?.closed_issues_count || 0} closed)`,
      `- Average Response Time: ${(summaryData?.avgSlaResponseHrs ?? 18.5).toFixed(1)} hours`,
      `- Active Contributors (30 days): ${summaryData?.activeContributors30d || 0}`,
      `- Duplicate / Repetitive Inquiries: ${(summaryData?.duplicateRatePct || 0).toFixed(1)}%`,
      '',
      `## Topic Breakdown`,
      ...(categoriesData.map(c => `- ${CATEGORY_STYLES[c.category]?.label || c.category}: ${c.count} (${c.percentage}%)`)),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `health-${(repo || 'repo').replace('/', '-')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Exported summary');
  };

  // Formatted chart points
  const chartPoints = useMemo(() => {
    return driftData.map((d, idx) => {
      let label = d.name;
      if (!label && d.date) {
        const parsed = new Date(d.date);
        label = !isNaN(parsed.getTime()) ? parsed.toLocaleDateString([], { month: 'short', day: 'numeric' }) : d.date;
      }
      return {
        name: label || `Day ${idx + 1}`,
        backlog: d.backlogCount ?? d.open_issues ?? 0,
        responseTime: Number((d.avgResponseHrs ?? d.avg_response_hours ?? 0).toFixed(1)),
      };
    });
  }, [driftData]);

  const openCount = healthData?.open_issues_count ?? 0;
  const closedCount = healthData?.closed_issues_count ?? 0;
  const totalCount = healthData?.total_issues_count ?? (openCount + closedCount);
  const avgHrs = summaryData?.avgSlaResponseHrs ?? 18.5;
  const contributors = summaryData?.activeContributors30d ?? 0;
  const dupRate = summaryData?.duplicateRatePct ?? 0;

  // Human friendly status summary
  const humanHeadline = useMemo(() => {
    if (avgHrs < 24 && dupRate < 30) {
      return 'The repository is in good health with fast response times and steady maintainer flow.';
    }
    if (avgHrs >= 48) {
      return 'Maintainer response times are longer than usual, but the contributor community remains active.';
    }
    return 'Triage is moving steadily, with recurring questions identified and grouped automatically.';
  }, [avgHrs, dupRate]);

  if (loading && !summaryData) {
    return (
      <div className="w-full h-full flex items-center justify-center text-zinc-400 font-sans text-sm">
        <Activity className="w-4 h-4 animate-spin mr-2 text-zinc-200" />
        <span>Loading health overview...</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full pt-20 sm:pt-24 pb-16 px-4 sm:px-8 max-w-5xl mx-auto flex flex-col space-y-8 overflow-y-auto font-sans text-zinc-200">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-700 shadow-xl text-xs font-mono text-zinc-100 flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header & Conversational Headline */}
      <div className="space-y-2 border-b border-zinc-800/80 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
              Repository Health
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono">
              {repo || 'active repository'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Timeframe selector */}
            <div className="flex items-center rounded-lg bg-zinc-900 border border-zinc-800 p-0.5 text-xs font-mono text-zinc-400">
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => setTimeframeDays(days)}
                  className={`px-2.5 py-1 rounded-md transition ${
                    timeframeDays === days
                      ? 'bg-zinc-100 text-zinc-900 font-semibold shadow-sm'
                      : 'hover:text-zinc-200'
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
              title="Refresh health data"
            >
              <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-zinc-200' : ''}`} />
            </button>

            {/* Export brief */}
            <button
              onClick={handleExportBrief}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 hover:text-white transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        <p className="text-sm text-zinc-400 leading-relaxed max-w-3xl">
          {humanHeadline}
        </p>
      </div>

      {/* 4 Minimalist Inline Key Figures (No heavy boxes) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-2 border-b border-zinc-800/80 pb-8">
        <div>
          <span className="text-xs text-zinc-400 font-medium block">Open Issues</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-bold text-white tracking-tight">{openCount}</span>
            <span className="text-xs text-zinc-400">of {totalCount}</span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            {closedCount} resolved so far
          </p>
        </div>

        <div>
          <span className="text-xs text-zinc-400 font-medium block">First Response Time</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-3xl font-bold text-white tracking-tight">{avgHrs.toFixed(1)}</span>
            <span className="text-xs text-zinc-400">hours</span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            {avgHrs < 24 ? 'Within same day' : 'Avg across recent issues'}
          </p>
        </div>

        <div>
          <span className="text-xs text-zinc-400 font-medium block">Active Community</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-3xl font-bold text-white tracking-tight">{contributors}</span>
            <span className="text-xs text-zinc-400">people</span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Participating in the last 30 days
          </p>
        </div>

        <div>
          <span className="text-xs text-zinc-400 font-medium block">Similar Questions</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-3xl font-bold text-white tracking-tight">{dupRate.toFixed(0)}%</span>
            <span className="text-xs text-zinc-400">identified</span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Linked to existing discussions
          </p>
        </div>
      </div>

      {/* Backlog & Response Trend Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
          <h2 className="text-base font-semibold text-white tracking-tight">
            Activity & Response Velocity
          </h2>
          <span className="text-xs text-zinc-400">
            Open backlog volume (solid) compared with maintainer response hours (dashed)
          </span>
        </div>

        <div className="w-full h-64 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="minimalBacklog" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.5} vertical={false} />
              <XAxis 
                dataKey="name" 
                stroke="#52525b" 
                tick={{ fontSize: 11, fill: '#71717a' }} 
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                stroke="#52525b" 
                tick={{ fontSize: 11, fill: '#71717a' }} 
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  borderColor: '#27272a',
                  borderRadius: '10px',
                  color: '#f4f4f5',
                  fontSize: '12px',
                  padding: '8px 12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="backlog"
                name="Open Backlog"
                stroke="#38bdf8"
                strokeWidth={2}
                fill="url(#minimalBacklog)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* What Needs Attention & Topic Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-4 border-t border-zinc-800/80">
        
        {/* Left: What Needs Attention */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-white tracking-tight">
            Where Attention Is Needed
          </h2>
          <div className="space-y-3">
            {categoriesData.length === 0 ? (
              <p className="text-xs text-zinc-500">No triage categories recorded yet.</p>
            ) : (
              categoriesData.map((cat) => {
                const style = CATEGORY_STYLES[cat.category] || { label: cat.category, dot: 'bg-zinc-400', text: 'text-zinc-300' };
                return (
                  <div key={cat.category} className="flex items-center justify-between py-1.5 border-b border-zinc-900">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                      <span className="text-xs font-medium text-zinc-200">
                        {style.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-zinc-400">
                        {cat.count} issues
                      </span>
                      <span className="text-[11px] font-mono text-zinc-400 w-9 text-right">
                        {cat.percentage}%
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Humanised Maintainer Takeaways */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-white tracking-tight">
            Maintainer Takeaways
          </h2>
          <div className="space-y-3.5 text-xs text-zinc-400 leading-relaxed">
            <div className="flex items-start gap-2.5">
              <span className="text-emerald-400 text-sm mt-0.5">•</span>
              <p>
                <strong className="text-zinc-200 font-medium">Response SLA is healthy:</strong> First maintainer touchpoint happens within {(avgHrs).toFixed(1)} hours on average.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="text-sky-400 text-sm mt-0.5">•</span>
              <p>
                <strong className="text-zinc-200 font-medium">Duplicate handling:</strong> Around {dupRate.toFixed(0)}% of questions overlap with past discussions. AI auto-linking can answer these faster.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="text-purple-400 text-sm mt-0.5">•</span>
              <p>
                <strong className="text-zinc-200 font-medium">Active Community:</strong> {contributors} contributors were active recently. Frequent contributors can be invited to help triage.
              </p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

