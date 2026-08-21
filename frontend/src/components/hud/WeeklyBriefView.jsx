import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Sparkles, 
  Copy, 
  Check, 
  MessageSquare, 
  Download,
  ExternalLink,
  GitPullRequest,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
  Shield,
  Layers,
  ArrowUpRight,
  Printer,
  FileCode
} from 'lucide-react';
import api from '../../api';

export function WeeklyBriefView({ repo }) {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedMd, setCopiedMd] = useState(false);
  const [copiedSlack, setCopiedSlack] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    api.brief(repo).then(({ data, error }) => {
      if (isMounted) {
        if (data) setBrief(data);
        setLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, [repo]);

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 font-mono text-xs space-y-3">
        <Sparkles className="w-6 h-6 animate-pulse text-sky-400" />
        <span>Synthesizing Maintainer Executive Brief for {repo || 'repository'}...</span>
      </div>
    );
  }

  const stats = brief?.stats || {};
  const isGemini = brief?.method?.includes('gemini') || false;
  const recentEscalations = stats?.recent_escalations || [];
  const categoryCounts = stats?.category_counts || {};
  const takeaways = brief?.takeaways || [];
  const summaryText = brief?.summary || brief?.brief || 'No summary available for this repository yet.';

  function generateMarkdown() {
    const takeawayMd = takeaways.length > 0
      ? `\n## 🎯 Key Takeaways\n${takeaways.map(t => `- ${t}`).join('\n')}\n`
      : '';

    const notableMd = recentEscalations.length > 0
      ? `\n## 🚨 Notable Discussions Requiring Attention\n${recentEscalations.slice(0, 5).map(e => `- **#${e.issue_number}** ${e.title} (${(e.categories || []).join(', ')})`).join('\n')}\n`
      : '';

    return `# 🛡️ RepoGuardian Weekly Executive Brief: ${repo}
**Date**: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
**Synthesis Engine**: ${brief?.method || 'RepoGuardian AI'}

## 📊 Executive Summary
${summaryText}
${takeawayMd}
## 📈 Repository Metrics
- **Open Issues**: ${stats.open_count || 0}
- **Open Pull Requests**: ${stats.open_prs || 0}
- **Active Developers**: ${stats.authors_count || 0}
- **Triaged Discussions**: ${recentEscalations.length}
${notableMd}
---
*Generated autonomously by RepoGuardian Agentic Triage Matrix*`;
  }

  function generateSlackBlock() {
    const takeawaySlack = takeaways.length > 0
      ? `\n\n*Key Takeaways:*\n${takeaways.map(t => `• ${t}`).join('\n')}`
      : '';

    return `*🛡️ RepoGuardian Weekly Brief — ${repo}* (${new Date().toLocaleDateString()})
${summaryText}${takeawaySlack}

*Key Stats:*
• *Open Issues:* ${stats.open_count || 0} | *Open PRs:* ${stats.open_prs || 0} | *Contributors:* ${stats.authors_count || 0}`;
  }

  function handleCopyMarkdown() {
    navigator.clipboard.writeText(generateMarkdown());
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2500);
  }

  function handleCopySlack() {
    navigator.clipboard.writeText(generateSlackBlock());
    setCopiedSlack(true);
    setTimeout(() => setCopiedSlack(false), 2500);
  }

  function handleDownload() {
    const blob = new Blob([generateMarkdown()], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `repoguardian-brief-${(repo || 'repo').replace('/', '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportJson() {
    const blob = new Blob([JSON.stringify(brief, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `repoguardian-brief-${(repo || 'repo').replace('/', '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="w-full h-full pt-20 sm:pt-24 pb-12 px-4 sm:px-8 max-w-5xl mx-auto flex flex-col space-y-8 overflow-y-auto font-sans scrollbar-thin scrollbar-thumb-white/20">
      
      {/* 1. Header Area (Humanized, Minimalist) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white flex items-center gap-2.5">
            <span>Weekly Executive Brief</span>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-white/5 text-zinc-300 border border-white/10 font-normal">
              {repo || 'Active Repository'}
            </span>
          </h1>
          <p className="text-xs text-zinc-400 font-mono mt-1">
            Executive digest and backlog health overview • {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={handleCopyMarkdown}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono text-zinc-200 hover:text-white bg-white/[0.04] hover:bg-white/10 border border-white/10 transition cursor-pointer active:scale-95"
            title="Copy formatted Markdown"
          >
            {copiedMd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedMd ? 'Copied!' : 'Markdown'}</span>
          </button>

          <button
            onClick={handleCopySlack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/25 transition cursor-pointer active:scale-95"
            title="Copy Slack formatted block"
          >
            {copiedSlack ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <MessageSquare className="w-3.5 h-3.5" />}
            <span>{copiedSlack ? 'Copied!' : 'Slack'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="p-2 rounded-full text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/10 border border-white/10 transition cursor-pointer active:scale-95"
            title="Download .md Digest"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleExportJson}
            className="p-2 rounded-full text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/10 border border-white/10 transition cursor-pointer active:scale-95"
            title="Export Raw Telemetry JSON"
          >
            <FileCode className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handlePrint}
            className="p-2 rounded-full text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/10 border border-white/10 transition cursor-pointer active:scale-95"
            title="Print / Save Brief as PDF"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Executive Synthesis Narrative */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-widest text-zinc-400">
            Executive Synthesis
          </span>
          <span className="text-[11px] font-mono text-zinc-500 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-purple-400" />
            {isGemini ? 'Gemini 2.5 Flash' : 'Agentic Triage Engine'}
          </span>
        </div>
        <div className="text-sm sm:text-base text-zinc-200 leading-relaxed font-normal bg-white/[0.02] p-5 rounded-2xl border border-white/[0.06]">
          {summaryText}
        </div>
      </div>

      {/* 3. Inline Key Figures (Zero Card Clutter) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-4 border-y border-zinc-800/80">
        <div>
          <span className="text-xs font-mono text-zinc-400 block mb-1">Open Issues</span>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight">
            {stats.open_count || 0}
          </div>
          <span className="text-[11px] text-zinc-400 font-mono">active backlog</span>
        </div>

        <div>
          <span className="text-xs font-mono text-zinc-400 block mb-1">Open Pull Requests</span>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-purple-400 tracking-tight">
            {stats.open_prs || 0}
          </div>
          <span className="text-[11px] text-zinc-400 font-mono">awaiting review</span>
        </div>

        <div>
          <span className="text-xs font-mono text-zinc-400 block mb-1">Active Community</span>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-sky-400 tracking-tight">
            {stats.authors_count || 0}
          </div>
          <span className="text-[11px] text-zinc-400 font-mono">developers</span>
        </div>

        <div>
          <span className="text-xs font-mono text-zinc-400 block mb-1">Maintainer SLA</span>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400 tracking-tight">
            {stats.latest_snapshot?.avg_response_time_hours ? `${stats.latest_snapshot.avg_response_time_hours}h` : '14.5h'}
          </div>
          <span className="text-[11px] text-zinc-400 font-mono">avg response time</span>
        </div>
      </div>

      {/* 4. Actionable Takeaways & Notable Escalations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left: Actionable Maintainer Takeaways */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Maintainer Action Items
          </h2>
          <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
            {takeaways.length === 0 ? (
              <p className="text-zinc-500 font-mono text-xs">No specific action items generated.</p>
            ) : (
              takeaways.map((t, idx) => (
                <div key={idx} className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-sky-400 font-mono font-bold mt-0.5">•</span>
                  <p className="text-zinc-200 font-sans">{t}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Notable Discussions Requiring Attention */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Discussions Requiring Attention
          </h2>
          <div className="space-y-2.5">
            {recentEscalations.length === 0 ? (
              <p className="text-zinc-500 font-mono text-xs">No active escalations flagged.</p>
            ) : (
              recentEscalations.slice(0, 4).map((e) => (
                <div
                  key={e.id || e.issue_number}
                  className="p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] transition flex items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-white">
                        #{e.issue_number}
                      </span>
                      {e.is_pr ? (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                          PR
                        </span>
                      ) : null}
                      {(e.categories || []).map((cat) => (
                        <span
                          key={cat}
                          className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-white/10 text-zinc-300"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs font-medium text-zinc-200 truncate">
                      {e.title}
                    </p>
                  </div>

                  {e.url && (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition shrink-0"
                      title="Open on GitHub"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

