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
      <div className="w-full h-full flex items-center justify-center text-zinc-400 font-mono text-sm">
        <Sparkles className="w-5 h-5 animate-pulse mr-2 text-white" />
        <span>Synthesizing Maintainer Weekly Brief...</span>
      </div>
    );
  }

  const stats = brief?.stats || {};

  return (
    <div className="w-full h-full pt-20 sm:pt-24 pb-8 px-4 sm:px-6 max-w-4xl mx-auto flex flex-col space-y-4 overflow-y-auto">
      {/* Executive Summary Card */}
      <div className="p-4 sm:p-6 rounded-3xl bg-black/60 border border-white/10 backdrop-blur-2xl space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/10 border border-white/15 text-white">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white font-mono">
                Maintainer Executive Brief
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                Repository: {repo} • Generated: {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>

          <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-white/10 text-white border border-white/15">
            {brief?.method || 'AI-Synthesized'}
          </span>
        </div>

        {/* Narrative Paragraph */}
        <div className="text-xs sm:text-sm text-zinc-200 leading-relaxed font-sans bg-white/[0.02] p-4 rounded-2xl border border-white/5">
          {brief?.summary || 'No weekly summary generated yet for this repository.'}
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 pt-2">
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
            <span className="text-[11px] text-zinc-400 font-mono block">New Issues</span>
            <span className="text-lg font-bold font-mono text-white">{stats.new_issues_count || 0}</span>
          </div>

          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
            <span className="text-[11px] text-zinc-400 font-mono block">Security / Urgent</span>
            <span className="text-lg font-bold font-mono text-rose-400">{stats.security_urgent_count || 0}</span>
          </div>

          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
            <span className="text-[11px] text-zinc-400 font-mono block">Duplicates Handled</span>
            <span className="text-lg font-bold font-mono text-zinc-300">{stats.duplicates_count || 0}</span>
          </div>

          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
            <span className="text-[11px] text-zinc-400 font-mono block">Backlog Delta</span>
            <span className={`text-lg font-bold font-mono ${stats.backlog_delta > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {stats.backlog_delta > 0 ? `+${stats.backlog_delta}` : stats.backlog_delta || 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
