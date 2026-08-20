import React, { useState, useMemo } from 'react';
import { 
  GitPullRequest, 
  Search, 
  Filter, 
  User, 
  MessageSquare, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  GitMerge, 
  GitCommit, 
  ShieldAlert, 
  Flame, 
  Link as LinkIcon,
  ChevronRight
} from 'lucide-react';

export function PullRequestsView({ 
  issues = [], 
  selectedIssue, 
  onSelectIssue, 
  feedbackMap = {} 
}) {
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('open'); // 'all' | 'open' | 'closed'
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Filter only Pull Requests
  const prList = useMemo(() => {
    return issues.filter((i) => Boolean(i.is_pr));
  }, [issues]);

  // Extract PR metrics
  const stats = useMemo(() => {
    const total = prList.length;
    const open = prList.filter((p) => p.state === 'open').length;
    const closed = total - open;
    const authors = new Set(prList.map((p) => p.author).filter(Boolean)).size;
    return { total, open, closed, authors };
  }, [prList]);

  // Categories list for PRs
  const categoriesList = [
    { id: 'all', label: 'All Categories' },
    { id: 'urgent', label: 'Urgent' },
    { id: 'security-sensitive', label: 'Security' },
    { id: 'possible-regression', label: 'Regressions' },
    { id: 'needs-more-info', label: 'Needs Info' },
  ];

  // Filtered PRs
  const filteredPRs = useMemo(() => {
    return prList.filter((pr) => {
      // State match
      if (stateFilter === 'open' && pr.state !== 'open') return false;
      if (stateFilter === 'closed' && pr.state !== 'closed') return false;

      // Category match
      if (categoryFilter !== 'all') {
        const cats = pr.latest_categories || [];
        if (!cats.includes(categoryFilter)) return false;
      }

      // Search match
      if (search.trim() !== '') {
        const query = search.toLowerCase();
        const matchTitle = (pr.title || '').toLowerCase().includes(query);
        const matchBody = (pr.body || '').toLowerCase().includes(query);
        const matchAuthor = (pr.author || '').toLowerCase().includes(query);
        const matchNumber = String(pr.number).includes(query);
        if (!matchTitle && !matchBody && !matchAuthor && !matchNumber) return false;
      }

      return true;
    });
  }, [prList, stateFilter, categoryFilter, search]);

  // Helper to extract linked issues from PR title/body (e.g. Fixes #1621)
  function extractLinkedIssues(title = '', body = '') {
    const text = `${title} ${body}`;
    const regex = /(?:fixes|closes|resolves|re|see|ref)?\s*#(\d+)/gi;
    const matches = new Set();
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.add(match[1]);
    }
    return Array.from(matches).slice(0, 3);
  }

  return (
    <div className="w-full h-full pt-20 sm:pt-24 pb-8 px-4 sm:px-6 max-w-6xl mx-auto flex flex-col space-y-5 overflow-hidden">
      
      {/* Header & Quick Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300">
              <GitPullRequest className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Pull Requests Pipeline
              </h1>
              <p className="text-xs text-zinc-400">
                Track code contributions, maintainer reviews, and contributor profiles
              </p>
            </div>
          </div>
        </div>

        {/* Inline Stats Counter */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-center">
            <span className="text-[10px] uppercase font-mono text-zinc-500 block">Open PRs</span>
            <span className="text-sm font-bold text-emerald-400 font-mono">{stats.open}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-center">
            <span className="text-[10px] uppercase font-mono text-zinc-500 block">Merged/Closed</span>
            <span className="text-sm font-bold text-purple-400 font-mono">{stats.closed}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-center">
            <span className="text-[10px] uppercase font-mono text-zinc-500 block">Contributors</span>
            <span className="text-sm font-bold text-sky-400 font-mono">{stats.authors}</span>
          </div>
        </div>
      </div>

      {/* Filter Ribbon & Search Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-2xl">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search PRs by title, description, #number, or @author..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 font-mono"
          />
        </div>

        {/* State Filter Pills */}
        <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setStateFilter('open')}
            className={`px-3 py-1 rounded-lg text-xs font-mono transition cursor-pointer ${
              stateFilter === 'open'
                ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Open ({stats.open})
          </button>
          <button
            onClick={() => setStateFilter('closed')}
            className={`px-3 py-1 rounded-lg text-xs font-mono transition cursor-pointer ${
              stateFilter === 'closed'
                ? 'bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Closed/Merged ({stats.closed})
          </button>
          <button
            onClick={() => setStateFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-mono transition cursor-pointer ${
              stateFilter === 'all'
                ? 'bg-white text-black font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            All ({stats.total})
          </button>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {categoriesList.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-mono transition cursor-pointer ${
                categoryFilter === cat.id
                  ? 'bg-white text-black font-bold shadow-md'
                  : 'bg-white/[0.04] text-zinc-400 hover:text-white border border-white/10'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pull Requests List */}
      <div className="flex-1 overflow-y-auto rounded-2xl bg-black/50 border border-white/10 backdrop-blur-2xl p-2 sm:p-4 space-y-2.5 scrollbar-thin scrollbar-thumb-white/20">
        {filteredPRs.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center text-zinc-500 font-mono text-xs space-y-2">
            <GitPullRequest className="w-8 h-8 text-zinc-600" />
            <span>No pull requests match the current filters</span>
          </div>
        ) : (
          filteredPRs.map((pr) => {
            const isSelected = selectedIssue?.number === pr.number && selectedIssue?.repo === pr.repo;
            const linked = extractLinkedIssues(pr.title, pr.body);
            const isOpen = pr.state === 'open';

            return (
              <div
                key={`${pr.repo}-${pr.number}`}
                onClick={() => onSelectIssue(pr)}
                className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 ${
                  isSelected
                    ? 'bg-white/15 border-white text-white shadow-xl'
                    : 'bg-white/[0.02] hover:bg-white/[0.06] border-white/[0.08] hover:border-white/20'
                }`}
              >
                {/* Left: PR Status + Title + Author Dossier */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {/* Contributor Avatar */}
                  <div className="relative shrink-0 mt-0.5">
                    <img
                      src={`https://github.com/${pr.author}.png`}
                      alt={pr.author}
                      className="w-9 h-9 rounded-full border border-white/20 bg-zinc-800 object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    {/* PR Header Meta */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-white">
                        #{pr.number}
                      </span>

                      {/* State Pill */}
                      <span
                        className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                          isOpen
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        }`}
                      >
                        {isOpen ? (
                          <GitPullRequest className="w-2.5 h-2.5" />
                        ) : (
                          <GitMerge className="w-2.5 h-2.5" />
                        )}
                        {pr.state}
                      </span>

                      {/* Author Handle */}
                      <span className="text-xs font-mono text-sky-400 hover:underline">
                        @{pr.author}
                      </span>

                      {/* Linked Issues Pill */}
                      {linked.length > 0 && (
                        <div className="flex items-center gap-1">
                          {linked.map((num) => (
                            <span
                              key={num}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950/60 text-sky-300 border border-sky-500/30 flex items-center gap-0.5"
                            >
                              <LinkIcon className="w-2.5 h-2.5" />
                              #{num}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="text-xs sm:text-sm font-semibold text-white leading-snug line-clamp-2">
                      {pr.title}
                    </h3>

                    {/* Description snippet */}
                    {pr.body && (
                      <p className="text-xs text-zinc-400 line-clamp-1 font-mono">
                        {pr.body}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Comments, Date, Inspect Action */}
                <div className="flex items-center sm:flex-col sm:items-end justify-between gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-white/[0.06]">
                  <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
                      {pr.comments_count || 0}
                    </span>
                    {pr.created_at && (
                      <span className="text-[11px] text-zinc-500">
                        {new Date(pr.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {pr.url && (
                      <a
                        href={pr.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition"
                        title="Open on GitHub"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-0.5 hover:text-white">
                      Inspect <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
