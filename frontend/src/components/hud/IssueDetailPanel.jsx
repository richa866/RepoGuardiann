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
  AlertCircle
} from 'lucide-react';
import api from '../../api';

export function IssueDetailPanel({ issue, onClose, onFeedbackSubmitted, feedbackMap = {} }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [feedbackVote, setFeedbackVote] = useState(feedbackMap[issue?.number] || null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  useEffect(() => {
    if (!issue) return;
    let isMounted = true;
    setLoading(true);
    setFeedbackVote(feedbackMap[issue.number] || null);

    api.getIssue(issue.number, issue.repo).then(({ data }) => {
      if (isMounted) {
        if (data) setDetail(data);
        setLoading(false);
      }
    });

    return () => { isMounted = false; };
  }, [issue, feedbackMap]);

  if (!issue) return null;

  const categories = issue.latest_categories || [];
  const latestEscalation = detail?.escalations?.[0];
  const evidence = latestEscalation?.evidence || {};
  const draftedComment = latestEscalation?.drafted_comment || evidence?.missing_info_check?.drafted_comment;
  const similarIssues = detail?.similar_issues || evidence?.duplicate_check?.matches || [];

  async function handleFeedback(vote) {
    setSubmittingFeedback(true);
    setFeedbackVote(vote);
    // Optimistic UI response for instantaneous 100% consistency across all nodes
    if (onFeedbackSubmitted) {
      onFeedbackSubmitted(issue.number, vote);
    }
    await api.submitFeedback(issue.number, {
      vote,
      escalation_id: latestEscalation?.id,
      repo: issue.repo,
    });
    setSubmittingFeedback(false);
  }

  function handleCopyDraft() {
    if (!draftedComment) return;
    navigator.clipboard.writeText(draftedComment);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 2000);
  }

  return (
    <aside className="fixed top-20 sm:top-24 right-3 sm:right-6 bottom-3 sm:bottom-6 z-50 w-[calc(100vw-1.5rem)] sm:w-[420px] max-w-lg rounded-3xl bg-black/95 border border-white/10 shadow-2xl backdrop-blur-3xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 pointer-events-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-white/[0.08] bg-white/[0.02]">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs font-mono font-bold text-white">#{issue.number}</span>
          <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full ${
            issue.state === 'open' ? 'bg-white/10 text-white border border-white/15' : 'bg-zinc-800 text-zinc-400'
          }`}>
            {issue.state}
          </span>
          <span className="text-xs text-zinc-400 font-mono truncate">by {issue.author}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {issue.url && (
            <a
              href={issue.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition"
              title="View on GitHub"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Highly Descriptive Scrollable Body Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs pr-2.5 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        {/* Title & Description */}
        <div className="space-y-2">
          <h2 className="text-sm sm:text-base font-semibold text-white leading-snug tracking-tight">
            {issue.title}
          </h2>
          {issue.body && (
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">Issue Description</span>
              <div className="text-xs text-zinc-300 font-mono leading-relaxed bg-white/[0.03] p-3 rounded-2xl border border-white/[0.06] max-h-48 overflow-y-auto whitespace-pre-wrap">
                {issue.body}
              </div>
            </div>
          )}
        </div>

        <div className="h-px bg-white/[0.06]" />

        {/* AI Escalation Verdict */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider font-mono text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              Agentic Triage Verdict
            </span>
            <span className="text-[10px] font-mono text-zinc-500">
              {latestEscalation?.synthesis_method || 'deterministic'}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {categories.length === 0 ? (
              <span className="text-xs text-zinc-500 font-mono">No escalation signals detected</span>
            ) : (
              categories.map((cat) => (
                <span
                  key={cat}
                  className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full font-semibold bg-white/10 text-white border border-white/15"
                >
                  {cat}
                </span>
              ))
            )}
          </div>

          <p className="text-zinc-300 leading-relaxed font-sans pt-1 text-xs sm:text-[13px] bg-white/[0.02] p-3 rounded-2xl border border-white/[0.04]">
            {latestEscalation?.explanation || issue.latest_explanation || 'Normal issue backlog activity.'}
          </p>
        </div>

        {/* Project-Aware RAG Matches */}
        {similarIssues.length > 0 && (
          <>
            <div className="h-px bg-white/[0.06]" />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider font-mono text-white flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-purple-400" />
                  RAG Vector Similarities
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">Chroma</span>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto">
                {similarIssues.map((match) => (
                  <div
                    key={match.number}
                    className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-white truncate">
                        #{match.number} {match.title}
                      </span>
                      <span className="text-[10px] font-mono text-purple-400 shrink-0 font-bold">
                        {(match.similarity * 100).toFixed(1)}% match
                      </span>
                    </div>

                    {match.resolution && (
                      <p className="text-[11px] text-zinc-300 font-mono">
                        Resolution: "{match.resolution}"
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
            <div className="h-px bg-white/[0.06]" />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider font-mono text-white flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  Drafted Follow-up Comment
                </span>
                <button
                  onClick={handleCopyDraft}
                  className="flex items-center gap-1 text-[10px] font-mono text-white hover:text-zinc-200 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 transition cursor-pointer"
                >
                  {copiedDraft ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedDraft ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="text-zinc-300 font-mono text-xs bg-white/[0.03] p-3 rounded-2xl border border-white/[0.06] whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                {draftedComment}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Human Feedback Footer: Confirm / Override or Completed Status Tag */}
      <div className="p-3.5 sm:p-4 border-t border-white/[0.08] bg-white/[0.02]">
        {feedbackVote === 'up' ? (
          <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center justify-between gap-2 shadow-lg animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-bold">✓ Confirmed by Maintainer</span>
            </div>
            <span className="text-[10px] text-emerald-400/80 uppercase">AI Verdict Validated</span>
          </div>
        ) : feedbackVote === 'down' ? (
          <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center justify-between gap-2 shadow-lg animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-bold">✗ Overridden by Maintainer</span>
            </div>
            <span className="text-[10px] text-amber-400/80 uppercase">Removed from 3D View</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleFeedback('up')}
              disabled={submittingFeedback}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-xs font-mono font-bold bg-white text-black hover:bg-zinc-200 transition shadow-md cursor-pointer active:scale-95 disabled:opacity-50"
              title="Confirm: Human agrees with AI verdict"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              <span>Confirm</span>
            </button>

            <button
              onClick={() => handleFeedback('down')}
              disabled={submittingFeedback}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-xs font-mono font-medium bg-white/5 hover:bg-amber-950/40 text-zinc-300 border border-white/10 hover:border-amber-500/40 transition cursor-pointer active:scale-95 disabled:opacity-50"
              title="Override: Human disagrees with AI verdict"
            >
              <ThumbsDown className="w-3.5 h-3.5 text-amber-400" />
              <span>Override</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
