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
  CheckCircle2 
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
    <aside className="fixed top-20 sm:top-24 right-3 sm:right-6 bottom-3 sm:bottom-6 z-50 w-[calc(100vw-1.5rem)] sm:w-96 max-w-md rounded-3xl bg-black/90 border border-white/10 shadow-2xl backdrop-blur-3xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 pointer-events-auto">
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
            className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
        {/* Title & Description */}
        <div className="space-y-1.5">
          <h2 className="text-sm font-semibold text-white leading-snug tracking-tight">
            {issue.title}
          </h2>
          {issue.body && (
            <p className="text-xs text-zinc-400 line-clamp-3 font-mono leading-relaxed bg-white/[0.02] p-2.5 rounded-xl border border-white/[0.06]">
              {issue.body}
            </p>
          )}
        </div>

        <div className="h-px bg-white/[0.06]" />

        {/* AI Escalation Verdict */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider font-mono text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
              Triage Verdict
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

          <p className="text-zinc-300 leading-relaxed font-sans pt-1">
            {latestEscalation?.explanation || issue.latest_explanation || 'Normal issue activity.'}
          </p>
        </div>

        {/* Project-Aware RAG Matches */}
        {similarIssues.length > 0 && (
          <>
            <div className="h-px bg-white/[0.06]" />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider font-mono text-white flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-zinc-400" />
                  RAG Vector Matches
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">Chroma</span>
              </div>

              <div className="space-y-2">
                {similarIssues.map((match) => (
                  <div
                    key={match.number}
                    className="pl-3 border-l border-white/20 space-y-0.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-white truncate">
                        #{match.number} {match.title}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                        {(match.similarity * 100).toFixed(1)}%
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
                  <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
                  Drafted Follow-up
                </span>
                <button
                  onClick={handleCopyDraft}
                  className="flex items-center gap-1 text-[10px] font-mono text-white hover:text-zinc-200 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 transition"
                >
                  {copiedDraft ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedDraft ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="text-zinc-300 font-mono bg-white/[0.03] p-3 rounded-2xl border border-white/[0.06] whitespace-pre-wrap leading-relaxed">
                {draftedComment}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Human Feedback Footer */}
      <div className="p-3.5 sm:p-4 border-t border-white/[0.08] bg-white/[0.02]">
        {feedbackSuccess ? (
          <div className="p-2.5 rounded-2xl bg-white/10 border border-white/20 text-white text-xs font-mono flex items-center gap-2 justify-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Verdict Recorded</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleFeedback('up')}
              disabled={submittingFeedback}
              className={`flex-1 flex items-center justify-center gap-2 py-2 sm:py-2.5 rounded-full text-xs font-mono font-bold transition ${
                feedbackVote === 'up'
                  ? 'bg-white text-black'
                  : 'bg-white text-black hover:bg-zinc-200 shadow-md'
              }`}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              <span>Confirm</span>
            </button>

            <button
              onClick={() => handleFeedback('down')}
              disabled={submittingFeedback}
              className={`flex-1 flex items-center justify-center gap-2 py-2 sm:py-2.5 rounded-full text-xs font-mono font-medium transition ${
                feedbackVote === 'down'
                  ? 'bg-rose-600 text-white'
                  : 'bg-white/5 hover:bg-rose-950/40 text-zinc-300 border border-white/10 hover:border-rose-500/40'
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
