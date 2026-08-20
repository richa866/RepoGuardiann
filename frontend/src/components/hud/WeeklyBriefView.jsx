import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  ShieldAlert, 
  Users, 
  Copy, 
  Check, 
  Share2, 
  MessageSquare, 
  Download,
  TrendingDown,
  TrendingUp,
  Cpu
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
      <div className="w-full h-full flex items-center justify-center text-zinc-400 font-mono text-sm">
        <Sparkles className="w-5 h-5 animate-pulse mr-2 text-sky-400" />
        <span>Synthesizing Maintainer Weekly Executive Brief...</span>
      </div>
    );
  }

  const stats = brief?.stats || {};
  const isGemini = brief?.method?.includes('gemini') || false;

  function generateMarkdown() {
    return `# 🛡️ RepoGuardian Weekly Executive Brief: ${repo}
**Date**: ${new Date().toLocaleDateString()}
**Synthesis**: ${brief?.method || 'Gemini 2.5 Multi-Agent'}

## 📊 Summary
${brief?.summary || 'No summary available.'}

## 📈 Key Metrics
- **New Issues Triaged**: ${stats.new_issues_count || 0}
- **Critical / Security CVEs**: ${stats.security_urgent_count || 0}
- **Semantic Duplicates Filtered**: ${stats.duplicates_count || 0}
- **Net Backlog Delta**: ${stats.backlog_delta > 0 ? `+${stats.backlog_delta}` : stats.backlog_delta || 0}

---
*Generated autonomously by RepoGuardian Agentic Triage Matrix*`;
  }

  function generateSlackBlock() {
    return `*🛡️ RepoGuardian Weekly Executive Brief: ${repo}* (${new Date().toLocaleDateString()})
${brief?.summary || 'No summary available.'}

*Key Metrics:*
• *New Issues:* ${stats.new_issues_count || 0}
• *Security CVEs:* ${stats.security_urgent_count || 0}
• *Duplicates Filtered:* ${stats.duplicates_count || 0}
• *Backlog Delta:* ${stats.backlog_delta > 0 ? `+${stats.backlog_delta}` : stats.backlog_delta || 0}`;
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

  return (
    <div className="w-full h-full pt-20 sm:pt-24 pb-8 px-4 sm:px-6 max-w-4xl mx-auto flex flex-col space-y-4 overflow-y-auto">
      {/* Executive Summary Card */}
      <div className="p-4 sm:p-6 rounded-3xl bg-black/75 border border-white/10 backdrop-blur-3xl space-y-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 border border-white/15 text-white shadow-md">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white font-mono">
                  Maintainer Executive Brief
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  isGemini 
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' 
                    : 'bg-white/10 text-zinc-300 border-white/15'
                }`}>
                  {brief?.method || 'AI-Synthesized'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono">
                Repository: {repo} • Generated: {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Export Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyMarkdown}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-mono text-white bg-white/10 hover:bg-white/20 border border-white/15 transition cursor-pointer active:scale-95 shadow-sm"
              title="Copy formatted Markdown for GitHub Discussions or PRs"
            >
              {copiedMd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedMd ? 'Markdown Copied!' : 'Copy Markdown'}</span>
            </button>

            <button
              onClick={handleCopySlack}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-mono text-sky-300 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 transition cursor-pointer active:scale-95 shadow-sm"
              title="Copy formatted summary for Slack or Discord channels"
            >
              {copiedSlack ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <MessageSquare className="w-3.5 h-3.5" />}
              <span>{copiedSlack ? 'Slack Block Copied!' : 'Copy for Slack'}</span>
            </button>
          </div>
        </div>

        {/* Narrative Paragraph */}
        <div className="space-y-2">
          <span className="text-[11px] font-mono uppercase text-zinc-400 tracking-wider">Executive Synthesis</span>
          <div className="text-xs sm:text-sm text-zinc-200 leading-relaxed font-sans bg-white/[0.02] p-4 rounded-2xl border border-white/5 whitespace-pre-wrap">
            {brief?.summary || 'No weekly summary generated yet for this repository.'}
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 pt-1">
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 text-center space-y-1">
            <span className="text-[11px] text-zinc-400 font-mono block">New Issues</span>
            <span className="text-xl font-bold font-mono text-white">{stats.new_issues_count || 0}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 text-center space-y-1">
            <span className="text-[11px] text-zinc-400 font-mono block">Security / Urgent</span>
            <span className="text-xl font-bold font-mono text-rose-400">{stats.security_urgent_count || 0}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 text-center space-y-1">
            <span className="text-[11px] text-zinc-400 font-mono block">Duplicates Handled</span>
            <span className="text-xl font-bold font-mono text-purple-300">{stats.duplicates_count || 0}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 text-center space-y-1">
            <span className="text-[11px] text-zinc-400 font-mono block">Backlog Delta</span>
            <span className={`text-xl font-bold font-mono ${stats.backlog_delta > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {stats.backlog_delta > 0 ? `+${stats.backlog_delta}` : stats.backlog_delta || 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
