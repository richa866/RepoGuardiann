import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  ShieldAlert, 
  Flame, 
  AlertTriangle, 
  Copy, 
  Clock, 
  CheckCircle2, 
  GitPullRequest,
  ExternalLink,
  Check,
  X
} from 'lucide-react';

export function ListView2D({ issues = [], selectedIssue, onSelectIssue, feedbackMap = {} }) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const categoriesList = [
    { id: 'all', label: 'All Issues' },
    { id: 'security-sensitive', label: 'Security' },
    { id: 'urgent', label: 'Urgent' },
    { id: 'possible-regression', label: 'Regressions' },
    { id: 'likely-duplicate', label: 'Duplicates' },
    { id: 'contentious', label: 'Contentious' },
    { id: 'needs-more-info', label: 'Needs Info' },
    { id: 'stale/needs-triage', label: 'Stale' },
  ];

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      const cats = issue.latest_categories || [];
      const matchCat = categoryFilter === 'all' || cats.includes(categoryFilter);
      const matchSearch =
        search === '' ||
        issue.title.toLowerCase().includes(search.toLowerCase()) ||
        String(issue.number).includes(search) ||
        (issue.body && issue.body.toLowerCase().includes(search.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [issues, categoryFilter, search]);

  return (
    <div className="w-full h-full pt-20 sm:pt-24 pb-6 px-4 sm:px-6 max-w-6xl mx-auto flex flex-col space-y-4 overflow-hidden">
      {/* Controls: Search & Category Chips */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-2xl">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search issues by title, body, or #number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 font-mono"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto max-w-full pb-0.5">
          {categoriesList.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1 rounded-full text-xs font-mono transition-all ${
                categoryFilter === cat.id
                  ? 'bg-white text-black font-bold shadow-md'
                  : 'bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/10 border border-white/10'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Issues Table / Cards */}
      <div className="flex-1 overflow-y-auto rounded-2xl bg-black/50 border border-white/10 backdrop-blur-2xl p-2 sm:p-4 space-y-2">
        {filteredIssues.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-zinc-500 font-mono text-xs">
            No issues match current filters
          </div>
        ) : (
          filteredIssues.map((issue) => {
            const isSelected = selectedIssue?.number === issue.number && selectedIssue?.repo === issue.repo;
            const cats = issue.latest_categories || [];
            const feedback = feedbackMap[issue.number];
            const isConfirmed = feedback === 'up';
            const isOverridden = feedback === 'down';

            return (
              <div
                key={`${issue.repo}-${issue.number}`}
                onClick={() => onSelectIssue(issue)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-white/15 border-white text-white shadow-lg'
                    : isConfirmed
                    ? 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/50'
                    : isOverridden
                    ? 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/50 opacity-80'
                    : 'bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  <span className={`font-mono text-xs font-bold shrink-0 ${
                    isConfirmed ? 'text-emerald-400' : isOverridden ? 'text-amber-400' : 'text-zinc-400'
                  }`}>
                    #{issue.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-white truncate">
                      {issue.title}
                    </p>
                    <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                      by {issue.author} • {issue.comments_count || 0} comments • {new Date(issue.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  {/* Feedback Status Pill in 2D View */}
                  {isConfirmed && (
                    <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-400" /> Confirmed
                    </span>
                  )}
                  {isOverridden && (
                    <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1">
                      <X className="w-3 h-3 text-amber-400" /> Overridden
                    </span>
                  )}

                  {cats.map((c) => (
                    <span
                      key={c}
                      className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 border border-white/15"
                    >
                      {c.replace('-sensitive', '').replace('/needs-triage', '')}
                    </span>
                  ))}

                  {issue.url && (
                    <a
                      href={issue.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
