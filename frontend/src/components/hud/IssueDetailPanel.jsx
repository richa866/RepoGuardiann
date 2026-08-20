import React, { useState, useEffect } from 'react';
import { 
  X, 
  ExternalLink, 
  Copy, 
  Check, 
  ThumbsUp, 
  ThumbsDown, 
  Sparkles,
  Search,
  MessageSquare,
  CheckCircle2,
  GitPullRequest
} from 'lucide-react';
import api from '../../api';

export function IssueDetailPanel({ issue, onClose, onFeedbackSubmitted }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [feedbackVote, setFeedbackVote] = useState(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  useEffect(() => {
    if (!issue) return;
    let isMounted = true;
    setLoading(true);
    setFeedbackVote(null);
    setFeedbackSuccess(false);

    api.getIssue(issue.number, issue.repo).then(({ data }) => {
      if (isMounted) {
        if (data) setDetail(data);
        setLoading(false);
      }
    });

    return () => { isMounted = false; };
  }, [issue]);

  if (!issue) return null;

  const categories = issue.latest_categories || [];
  const latestEscalation = detail?.escalations?.[0];
  const evidence = latestEscalation?.evidence || {};
  const draftedComment = latestEscalation?.drafted_comment || evidence?.missing_info_check?.drafted_comment;
  const similarIssues = detail?.similar_issues || evidence?.duplicate_check?.matches || [];

  async function handleFeedback(vote) {
    setSubmittingFeedback(true);
    setFeedbackVote(vote);
    const res = await api.submitFeedback(issue.number, {
      vote,
      escalation_id: latestEscalation?.id,
      repo: issue.repo,
    });
    setSubmittingFeedback(false);
    if (!res.error) {
      setFeedbackSuccess(true);
      if (onFeedbackSubmitted) onFeedbackSubmitted(issue.number, vote);
    }
  }

  function handleCopyDraft() {
    if (!draftedComment) return;
    navigator.clipboard.writeText(draftedComment);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 2000);
  }

  return (
    <aside className="fixed top-18 right-4 bottom-4 z-50 w-96 rounded-2xl bg-slate-950/90 border border-white/10 shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-slate-900/40">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono font-bold text-sky-400">#{issue.number}</span>
          <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded ${
            issue.state === 'open' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
          }`}>
            {issue.state}
          </span>
          <span className="text-xs text-slate-400 font-mono truncate">by {issue.author}</span>
        </div>

        <div className="flex items-center gap-1">
          {issue.url && (
            <a
              href={issue.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-sky-300 transition"
              title="View on GitHub"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Title & Description */}
        <div className="space-y-1.5">
          <h2 className="text-sm font-semibold text-slate-100 leading-snug">
            {issue.title}
          </h2>
          {issue.body && (
            <p className="text-xs text-slate-400 line-clamp-3 font-mono leading-relaxed">
              {issue.body}
            </p>
          )}
        </div>

        <div className="h-px bg-white/5" />

        {/* AI Escalation Verdict */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider font-mono text-sky-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              Triage Verdict
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              {latestEscalation?.synthesis_method || 'rule-based'}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {categories.length === 0 ? (
              <span className="text-xs text-slate-400 font-mono">No escalation signals detected</span>
            ) : (
              categories.map((cat) => (
                <span
                  key={cat}
                  className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-md font-semibold border ${
                    cat.includes('security')
                      ? 'bg-red-950 text-red-300 border-red-500/50'
                      : cat.includes('urgent')
                      ? 'bg-orange-950 text-orange-300 border-orange-500/50'
                      : cat.includes('contentious')
                      ? 'bg-amber-950 text-amber-300 border-amber-500/50'
                      : cat.includes('regression')
                      ? 'bg-purple-950 text-purple-300 border-purple-500/50'
                      : cat.includes('duplicate')
                      ? 'bg-slate-800 text-slate-200 border-slate-600'
                      : 'bg-cyan-950 text-cyan-300 border-cyan-500/50'
                  }`}
                >
                  {cat}
                </span>
              ))
            )}
          </div>

          <p className="text-slate-300 leading-relaxed font-sans pt-1">
            {latestEscalation?.explanation || issue.latest_explanation || 'Normal issue activity.'}
          </p>
        </div>

        {/* Project-Aware RAG Matches */}
        {similarIssues.length > 0 && (
          <>
            <div className="h-px bg-white/5" />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider font-mono text-slate-300 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-indigo-400" />
                  RAG Historical Context
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Chroma Vector Search</span>
              </div>

              <div className="space-y-2">
                {similarIssues.map((match) => (
                  <div
                    key={match.number}
                    className="pl-2.5 border-l-2 border-indigo-500/50 space-y-0.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-200 truncate">
                        #{match.number} {match.title}
                      </span>
                      <span className="text-[10px] font-mono text-indigo-300 shrink-0">
                        {(match.similarity * 100).toFixed(1)}%
                      </span>
                    </div>

                    {match.resolution && (
                      <p className="text-[11px] text-emerald-400 font-mono">
                        Maintainer: "{match.resolution}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Drafted Maintainer Follow-up Comment */}
        {draftedComment && (
          <>
            <div className="h-px bg-white/5" />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider font-mono text-cyan-300 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                  Drafted Maintainer Reply
                </span>
                <button
                  onClick={handleCopyDraft}
                  className="flex items-center gap-1 text-[10px] font-mono text-cyan-400 hover:text-cyan-200 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 transition"
                >
                  {copiedDraft ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedDraft ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="text-slate-300 font-mono bg-slate-900/50 p-2.5 rounded-xl border border-white/5 whitespace-pre-wrap leading-relaxed">
                {draftedComment}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Human Feedback Footer */}
      <div className="p-3 border-t border-white/5 bg-slate-900/60">
        {feedbackSuccess ? (
          <div className="p-2 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2 justify-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Feedback recorded!</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleFeedback('up')}
              disabled={submittingFeedback}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-mono font-medium transition ${
                feedbackVote === 'up'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 hover:bg-emerald-950/40 text-slate-300 border border-white/10 hover:border-emerald-500/40'
              }`}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              <span>Confirm Verdict</span>
            </button>

            <button
              onClick={() => handleFeedback('down')}
              disabled={submittingFeedback}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-mono font-medium transition ${
                feedbackVote === 'down'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-900 hover:bg-red-950/40 text-slate-300 border border-white/10 hover:border-red-500/40'
              }`}
            >
              <ThumbsDown className="w-3.5 h-3.5" />
              <span>Override</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
