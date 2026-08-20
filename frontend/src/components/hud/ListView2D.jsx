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
  ExternalLink
} from 'lucide-react';

export function ListView2D({ issues = [], selectedIssue, onSelectIssue }) {
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
    <div className="w-full h-full pt-20 pb-6 px-6 max-w-6xl mx-auto flex flex-col space-y-4 overflow-hidden">
      {/* Controls: Search & Category Chips */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl glass-panel border border-white/10">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search issues by title, body, or #number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950/70 border border-white/10 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400/50"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {categoriesList.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-2.5 py-1 rounded-xl text-xs font-mono font-medium transition ${
                categoryFilter === cat.id
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-400/50 shadow-sm'
                  : 'bg-slate-950/50 text-slate-400 hover:text-slate-200 border border-white/5'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Issues Table / Cards */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {filteredIssues.length === 0 ? (
          <div className="text-center py-16 text-slate-500 font-mono text-sm">
            No issues match the selected filter.
          </div>
        ) : (
          filteredIssues.map((issue) => {
            const isSelected = selectedIssue?.number === issue.number;
            const cats = issue.latest_categories || [];

            return (
              <div
                key={`${issue.repo}-${issue.number}`}
                onClick={() => onSelectIssue(issue)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                  isSelected
                    ? 'bg-sky-950/60 border-sky-400/60 shadow-lg shadow-sky-500/10'
                    : 'glass-panel border-white/5 hover:border-sky-500/30 hover:bg-slate-900/60'
                }`}
              >
                {/* Left info */}
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-sky-400">
                      #{issue.number}
                    </span>
                    <span className={`text-[10px] uppercase font-mono px-1.5 py-0.2 rounded ${
                      issue.state === 'open' ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {issue.state}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      by {issue.author} • {new Date(issue.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-100 truncate">
                    {issue.title}
                  </h3>

                  {issue.latest_explanation && (
                    <p className="text-xs text-slate-400 font-mono truncate">
                      {issue.latest_explanation}
                    </p>
                  )}
                </div>

                {/* Right Badges */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                    {cats.map((cat) => (
                      <span
                        key={cat}
                        className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-md font-semibold border ${
                          cat.includes('security')
                            ? 'bg-red-950/90 text-red-300 border-red-500/50'
                            : cat.includes('urgent')
                            ? 'bg-orange-950/90 text-orange-300 border-orange-500/50'
                            : cat.includes('contentious')
                            ? 'bg-amber-950/90 text-amber-300 border-amber-500/50'
                            : cat.includes('regression')
                            ? 'bg-purple-950/90 text-purple-300 border-purple-500/50'
                            : cat.includes('duplicate')
                            ? 'bg-blue-950/90 text-blue-300 border-blue-500/50'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {cat.replace('-sensitive', '')}
                      </span>
                    ))}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectIssue(issue);
                    }}
                    className="px-3 py-1 rounded-xl text-xs font-medium bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-400/30 transition"
                  >
                    Inspect
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
