import React, { useState, useEffect } from 'react';
import { FileText, Sparkles, AlertCircle, CheckCircle2, ShieldAlert, Users } from 'lucide-react';
import api from '../../api';

export function WeeklyBriefView({ repo }) {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);

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
      <div className="w-full h-full flex items-center justify-center text-sky-400 font-mono text-sm">
        <Sparkles className="w-5 h-5 animate-pulse mr-2" />
        <span>Synthesizing Maintainer Weekly Brief...</span>
      </div>
    );
  }

  const stats = brief?.stats || {};

  return (
    <div className="w-full h-full pt-20 pb-6 px-6 max-w-4xl mx-auto flex flex-col space-y-4 overflow-y-auto">
      {/* Executive Summary Card */}
      <div className="p-6 rounded-3xl glass-panel-glow border border-sky-500/30 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/20 border border-sky-400/40 text-sky-300">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Maintainer Weekly Executive Brief
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Repository: {repo} • Generated: {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>

          <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
            {brief?.method || 'AI-Synthesized'}
          </span>
        </div>

        {/* Narrative Paragraph */}
        <div className="text-sm text-slate-200 leading-relaxed font-sans bg-slate-950/60 p-4 rounded-2xl border border-white/5">
          {brief?.summary || 'No weekly summary generated yet for this repository.'}
        </div>

        {/* Highlight Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 text-center">
            <span className="text-[10px] text-slate-400 font-mono uppercase block">Active Backlog</span>
            <span className="text-lg font-bold font-mono text-sky-300">{stats.open_issues || 0}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 text-center">
            <span className="text-[10px] text-slate-400 font-mono uppercase block">Total Escalated</span>
            <span className="text-lg font-bold font-mono text-amber-300">{stats.escalated_issues || 0}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 text-center">
            <span className="text-[10px] text-slate-400 font-mono uppercase block">Security Flagged</span>
            <span className="text-lg font-bold font-mono text-red-300">{stats.security_sensitive || 0}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 text-center">
            <span className="text-[10px] text-slate-400 font-mono uppercase block">Likely Duplicates</span>
            <span className="text-lg font-bold font-mono text-purple-300">{stats.likely_duplicates || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
