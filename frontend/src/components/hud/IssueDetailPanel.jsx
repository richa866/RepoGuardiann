import React, { useState, useEffect } from 'react';
import { 
  X, 
  ExternalLink, 
  ShieldAlert, 
  Flame, 
  AlertTriangle, 
  Copy, 
  Check, 
  ThumbsUp, 
  ThumbsDown, 
  Clock, 
  GitPullRequest, 
  MessageSquare, 
  Search, 
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import api from '../../api';

export function IssueDetailPanel({ issue, onClose, onFeedbackSubmitted }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [feedbackVote, setFeedbackVote] = useState(null);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  useEffect(() => {
    if (!issue) return;
    let isMounted = true;
    setLoading(true);
    setFeedbackVote(null);
    setFeedbackSuccess(false);

    api.getIssue(issue.number, issue.repo).then(({ data, error }) => {
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
  const draftedComment = latestEscalation?.drafted_comment || evidence?.missing_info_check?.drafted_followup_comment;
  const similarIssues = detail?.similar_issues || evidence?.duplicate_check?.matches || [];
  const subtasks = detail?.subtasks || [];
  const existingFeedback = detail?.feedback || [];

  async function handleFeedback(vote) {
    setSubmittingFeedback(true);
    setFeedbackVote(vote);
    const escalationId = latestEscalation?.id;
    const res = await api.submitFeedback(issue.number, {
      vote,
      escalation_id: escalationId,
      note: feedbackNote || undefined,
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
    <aside className="fixed top-20 right-3 bottom-3 z-50 w-96 rounded-2xl glass-panel-glow border border-sky-500/20 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-950/80">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono font-bold text-sky-400">#{issue.number}</span>
          <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded ${
            issue.state === 'open' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
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
              title="Open on GitHub"
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

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Title & Body */}
        <div>
          <h2 className="text-sm font-semibold text-slate-100 leading-snug">
            {issue.title}
          </h2>
          {issue.body && (
            <p className="text-xs text-slate-400 mt-1.5 line-clamp-4 font-mono bg-slate-950/50 p-2.5 rounded-xl border border-white/5 whitespace-pre-wrap">
              {issue.body}
            </p>
          )}
        </div>

        {/* AI Escalation Decision & Categories */}
        <div className="p-3 rounded-xl bg-gradient-to-br from-slate-900/90 to-slate-950/90 border border-sky-500/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider font-mono text-sky-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              AI Escalation Analysis
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {latestEscalation?.synthesis_method || 'rule-based'}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {categories.length === 0 ? (
              <span className="text-xs text-slate-400 font-mono">No escalation signals</span>
            ) : (
              categories.map((cat) => (
                <span
                  key={cat}
                  className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-md font-semibold border ${
                    cat.includes('security')
                      ? 'bg-red-950/90 text-red-300 border-red-500/50 shadow-sm shadow-red-500/20'
                      : cat.includes('urgent')
                      ? 'bg-orange-950/90 text-orange-300 border-orange-500/50'
                      : cat.includes('contentious')
                      ? 'bg-amber-950/90 text-amber-300 border-amber-500/50'
                      : cat.includes('regression')
                      ? 'bg-purple-950/90 text-purple-300 border-purple-500/50'
                      : cat.includes('duplicate')
                      ? 'bg-blue-950/90 text-blue-300 border-blue-500/50'
                      : cat.includes('stale')
                      ? 'bg-slate-800 text-slate-300 border-slate-600'
                      : 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50'
                  }`}
                >
                  {cat}
                </span>
              ))
            )}
          </div>

          {/* Evidence-Backed Explanation */}
          <div className="text-xs text-slate-300 font-sans leading-relaxed bg-slate-950/60 p-2.5 rounded-lg border border-white/5">
            {latestEscalation?.explanation || issue.latest_explanation || 'No explanation generated yet.'}
          </div>
        </div>

        {/* Project-Aware RAG Similar Issues */}
        {similarIssues.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider font-mono text-slate-300 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-indigo-400" />
                Project-Aware RAG Matches
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Chroma Vector Search</span>
            </div>

            <div className="space-y-1.5">
              {similarIssues.map((match) => (
                <div
                  key={match.number}
                  className="p-2.5 rounded-xl bg-slate-950/70 border border-white/5 hover:border-indigo-500/30 transition space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-200 truncate">
                      #{match.number} {match.title}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-500/40 shrink-0">
                      {(match.similarity * 100).toFixed(1)}% match
                    </span>
                  </div>

                  {match.resolution && (
                    <div className="text-[11px] text-emerald-400 font-mono bg-emerald-950/40 px-2 py-1 rounded border border-emerald-500/20">
                      Maintainer: "{match.resolution}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Drafted Maintainer Follow-up Comment */}
        {draftedComment && (
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
            <div className="text-xs text-slate-300 font-mono bg-slate-950/70 p-2.5 rounded-xl border border-cyan-500/20 whitespace-pre-wrap leading-relaxed">
              {draftedComment}
            </div>
          </div>
        )}

        {/* Subtask Queue Audit Trail */}
        {subtasks.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider font-mono text-slate-400 block">
              Subtask Execution History
            </span>
            <div className="space-y-1">
              {subtasks.map((task) => (
                <div
                  key={task.id}
                  className="text-[10px] font-mono p-1.5 rounded-lg bg-slate-950/50 border border-white/5 flex items-center justify-between text-slate-400"
                >
                  <span className="text-slate-300">{task.task_type}</span>
                  <span className="text-emerald-400">{task.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Human-in-the-Loop Feedback Footer */}
      <div className="p-3 border-t border-white/10 bg-slate-950/90 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider font-mono">
            Maintainer Feedback & Override
          </span>
          {latestEscalation?.human_override && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-500/30">
              {latestEscalation.human_override}
            </span>
          )}
        </div>

        {feedbackSuccess ? (
          <div className="p-2 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2 justify-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Feedback recorded! AI calibration updated.</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleFeedback('up')}
              disabled={submittingFeedback}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border transition ${
                feedbackVote === 'up'
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-slate-900 hover:bg-emerald-950/50 text-slate-300 border-white/10 hover:border-emerald-500/40'
              }`}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              <span>Confirm</span>
            </button>

            <button
              onClick={() => handleFeedback('down')}
              disabled={submittingFeedback}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border transition ${
                feedbackVote === 'down'
                  ? 'bg-red-600 text-white border-red-500'
                  : 'bg-slate-900 hover:bg-red-950/50 text-slate-300 border-white/10 hover:border-red-500/40'
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
