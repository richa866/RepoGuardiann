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
  AlertCircle, 
  Cpu, 
  ChevronDown, 
  ChevronUp, 
  Shield, 
  Activity, 
  Clock, 
  FileQuestion, 
  Users, 
  Flame, 
  Send, 
  Tag, 
  Lock, 
  Loader2,
  GitPullRequest,
  GitMerge,
  Link as LinkIcon,
  User,
  RotateCcw
} from 'lucide-react';
import api from '../../api';
import { RAGDiffModal } from './RAGDiffModal';

export function IssueDetailPanel({ issue, onClose, onFeedbackSubmitted, feedbackMap = {} }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [feedbackVote, setFeedbackVote] = useState(feedbackMap[issue?.number] || null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState('False Positive');
  const [customNote, setCustomNote] = useState('');
  const [selectedRAGMatch, setSelectedRAGMatch] = useState(null);

  // 1-Click Action states
  const [postingComment, setPostingComment] = useState(false);
  const [commentPosted, setCommentPosted] = useState(false);
  const [applyingLabels, setApplyingLabels] = useState(false);
  const [labelsApplied, setLabelsApplied] = useState(false);
  const [closingIssue, setClosingIssue] = useState(false);
  const [issueClosed, setIssueClosed] = useState(false);

  useEffect(() => {
    if (!issue) return;
    let isMounted = true;
    setLoading(true);
    setFeedbackVote(feedbackMap[issue.number] || null);
    setShowOverrideModal(false);
    setCommentPosted(false);
    setLabelsApplied(false);
    setIssueClosed(false);

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
  const synthesisMethod = latestEscalation?.synthesis_method || 'deterministic';
  const isGemini = synthesisMethod.includes('gemini');

  // Diagnostic tool metrics extracted from evidence_json
  const securityCheck = evidence?.security_check || {};
  const duplicateCheck = evidence?.duplicate_check || {};
  const missingInfoCheck = evidence?.missing_info_check || {};
  const contentiousnessCheck = evidence?.contentiousness_check || {};
  const responseTimeCheck = evidence?.response_time_check || {};
  const stalenessCheck = evidence?.staleness_check || {};

  // Extract linked issues
  const linkedIssues = (() => {
    const text = `${issue.title || ''} ${issue.body || ''}`;
    const regex = /(?:fixes|closes|resolves|re|see|ref)?\s*#(\d+)/gi;
    const matches = new Set();
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (String(match[1]) !== String(issue.number)) {
        matches.add(match[1]);
      }
    }
    return Array.from(matches).slice(0, 4);
  })();

  async function handleFeedback(vote, note = null) {
    setSubmittingFeedback(true);
    setFeedbackVote(vote);
    setShowOverrideModal(false);

    if (onFeedbackSubmitted) {
      onFeedbackSubmitted(issue.number, vote);
    }

    const payload = {
      vote,
      escalation_id: latestEscalation?.id,
      note: note || (vote === 'down' ? overrideReason : null),
      repo: issue.repo,
    };

    await api.submitFeedback(issue.number, payload);
    setSubmittingFeedback(false);
  }

  async function handleResetFeedback() {
    setSubmittingFeedback(true);
    setFeedbackVote(null);
    if (onFeedbackSubmitted) {
      onFeedbackSubmitted(issue.number, null);
    }
    await api.resetFeedback(issue.number, issue.repo);
    setSubmittingFeedback(false);
  }

  function handleCopyDraft() {
    if (!draftedComment) return;
    navigator.clipboard.writeText(draftedComment);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 2000);
  }

  async function handlePostComment() {
    if (!draftedComment || postingComment) return;
    setPostingComment(true);
    const { error } = await api.postComment(issue.number, draftedComment, issue.repo);
    setPostingComment(false);
    if (!error) {
      setCommentPosted(true);
      setTimeout(() => setCommentPosted(false), 4000);
    }
  }

  async function handleApplyLabels() {
    if (categories.length === 0 || applyingLabels) return;
    setApplyingLabels(true);
    const { error } = await api.addLabels(issue.number, categories, issue.repo);
    setApplyingLabels(false);
    if (!error) {
      setLabelsApplied(true);
      setTimeout(() => setLabelsApplied(false), 4000);
    }
  }

  async function handleCloseDuplicate(duplicateNum) {
    if (closingIssue) return;
    setClosingIssue(true);
    const closeComment = `Closing as duplicate of #${duplicateNum}. Verified by RepoGuardian maintainer.`;
    const { error } = await api.closeIssue(issue.number, 'not_planned', closeComment, issue.repo);
    setClosingIssue(false);
    if (!error) {
      setIssueClosed(true);
      if (onFeedbackSubmitted) onFeedbackSubmitted(issue.number, 'up');
    }
  }

  return (
    <aside className="fixed top-20 sm:top-24 right-3 sm:right-6 bottom-3 sm:bottom-6 z-50 w-[calc(100vw-1.5rem)] sm:w-[440px] max-w-lg rounded-3xl bg-black/95 border border-white/10 shadow-2xl backdrop-blur-3xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 pointer-events-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-white/[0.08] bg-white/[0.02]">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs font-mono font-bold text-white">#{issue.number}</span>
          <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full ${
            issueClosed || issue.state === 'closed' 
              ? 'bg-purple-950/60 text-purple-300 border border-purple-500/30'
              : issue.state === 'open' 
              ? 'bg-white/10 text-white border border-white/15' 
              : 'bg-zinc-800 text-zinc-400'
          }`}>
            {issueClosed ? 'closed' : issue.state}
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
        
        {/* Contributor / Owner In-Depth Dossier Card */}
        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={`https://github.com/${issue.author}.png`}
              alt={issue.author}
              className="w-10 h-10 rounded-full border border-white/20 bg-zinc-800 shrink-0 object-cover shadow-sm"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <a
                  href={`https://github.com/${issue.author}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-white text-xs hover:text-sky-400 font-mono flex items-center gap-1 transition"
                  title="View GitHub Profile"
                >
                  @{issue.author}
                  <ExternalLink className="w-2.5 h-2.5 text-zinc-500" />
                </a>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-zinc-300">
                  {issue.is_pr ? 'PR Contributor' : 'Issue Reporter'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-mono">
                {issue.created_at ? new Date(issue.created_at).toLocaleDateString() : 'Active Contributor'}
              </p>
            </div>
          </div>

          {issue.is_pr && (
            <div className="shrink-0 text-right">
              <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                issue.state === 'open'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
              }`}>
                {issue.state === 'open' ? <GitPullRequest className="w-3 h-3" /> : <GitMerge className="w-3 h-3" />}
                {issue.state}
              </span>
            </div>
          )}
        </div>

        {/* Linked Issues Bar if detected */}
        {linkedIssues.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap p-2.5 rounded-xl bg-sky-950/20 border border-sky-500/20">
            <span className="text-[11px] font-mono text-sky-400 flex items-center gap-1 font-semibold">
              <LinkIcon className="w-3 h-3" />
              Linked:
            </span>
            {linkedIssues.map((num) => (
              <span
                key={num}
                className="text-[11px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-200 border border-sky-500/30"
              >
                #{num}
              </span>
            ))}
          </div>
        )}

        {/* Title & Description */}
        <div className="space-y-2">
          <h2 className="text-sm sm:text-base font-semibold text-white leading-snug tracking-tight">
            {issue.title}
          </h2>
          {issue.body && (
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">Description</span>
              <div className="text-xs text-zinc-300 font-mono leading-relaxed bg-white/[0.03] p-3 rounded-2xl border border-white/[0.06] max-h-40 overflow-y-auto whitespace-pre-wrap">
                {issue.body}
              </div>
            </div>
          )}
        </div>

        <div className="h-px bg-white/[0.06]" />

        {/* AI Escalation Verdict Header with Synthesis Mode Pill */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider font-mono text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              Agentic Triage Verdict
            </span>
            
            {/* Synthesis Mode Badge */}
            {isGemini ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1 shadow-sm">
                <Sparkles className="w-3 h-3 text-purple-400" />
                Gemini 2.5 Flash
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-white/5 text-zinc-400 border border-white/10 flex items-center gap-1">
                <Cpu className="w-3 h-3 text-zinc-400" />
                Rule Engine
              </span>
            )}
          </div>

          {/* Categories Row with 1-Click Label Dispatch */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
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

            {categories.length > 0 && (
              <button
                onClick={handleApplyLabels}
                disabled={applyingLabels || labelsApplied}
                className="flex items-center gap-1 text-[10px] font-mono px-2.5 py-1 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 transition cursor-pointer disabled:opacity-50"
                title="Apply AI categories as GitHub issue labels"
              >
                {applyingLabels ? (
                  <Loader2 className="w-3 h-3 animate-spin text-sky-400" />
                ) : labelsApplied ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Tag className="w-3 h-3 text-sky-400" />
                )}
                <span>{labelsApplied ? 'Labels Attached!' : 'Apply Labels'}</span>
              </button>
            )}
          </div>

          <p className="text-zinc-300 leading-relaxed font-sans pt-1 text-xs sm:text-[13px] bg-white/[0.02] p-3 rounded-2xl border border-white/[0.04]">
            {latestEscalation?.explanation || issue.latest_explanation || 'Normal issue backlog activity.'}
          </p>
        </div>

        {/* Collapsible 6-Tool Diagnostic Evidence & Signals Inspector */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
          <button
            onClick={() => setShowEvidence((prev) => !prev)}
            className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-white/[0.03] transition cursor-pointer"
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider font-mono text-zinc-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              Tool Diagnostic Signals (6 Scanners)
            </span>
            {showEvidence ? (
              <ChevronUp className="w-4 h-4 text-zinc-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-400" />
            )}
          </button>

          {showEvidence && (
            <div className="p-3 pt-1 border-t border-white/[0.06] space-y-2.5 font-mono text-[11px] bg-black/40">
              {/* 1. Security Scanner */}
              <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-zinc-300">Security Keywords:</span>
                </div>
                <span className="text-zinc-400">
                  {securityCheck.keywords_found?.length ? securityCheck.keywords_found.join(', ') : 'None matched'}
                </span>
              </div>

              {/* 2. RAG Semantic Duplicates */}
              <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-zinc-300">RAG Vector Match:</span>
                </div>
                <span className="text-purple-300 font-bold">
                  {similarIssues.length > 0 ? `${(similarIssues[0].similarity * 100).toFixed(1)}% match` : 'No duplicates'}
                </span>
              </div>

              {/* 3. Missing Reproduction Info */}
              <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileQuestion className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-zinc-300">Reproduction Info:</span>
                </div>
                <span className={missingInfoCheck.missing_repro ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
                  {missingInfoCheck.missing_repro ? 'Missing repro code' : 'Complete'}
                </span>
              </div>

              {/* 4. Contentiousness & Debates */}
              <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-zinc-300">Debate Velocity:</span>
                </div>
                <span className="text-zinc-400">
                  {contentiousnessCheck.participant_count ? `${contentiousnessCheck.participant_count} participants` : `${issue.comments_count || 0} comments`}
                </span>
              </div>

              {/* 5. Response Time Watchdog */}
              <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-zinc-300">Maintainer SLA:</span>
                </div>
                <span className="text-zinc-400">
                  {responseTimeCheck.hours_open ? `${responseTimeCheck.hours_open}h open` : 'Within SLA'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Project-Aware RAG Matches with 1-Click Close Duplicate */}
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

              <div className="space-y-2 max-h-36 overflow-y-auto">
                {similarIssues.map((match) => (
                  <div
                    key={match.number}
                    className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2"
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

                    {/* Actions: Side-by-Side Diff & 1-Click Close */}
                    <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
                      <button
                        onClick={() => setSelectedRAGMatch(match)}
                        className="flex items-center gap-1 text-[10px] font-mono px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 transition cursor-pointer"
                      >
                        <Search className="w-3 h-3 text-purple-400" />
                        <span>Side-by-Side Diff</span>
                      </button>

                      <button
                        onClick={() => handleCloseDuplicate(match.number)}
                        disabled={closingIssue || issueClosed}
                        className="flex items-center gap-1 text-[10px] font-mono px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 transition cursor-pointer disabled:opacity-50"
                      >
                        {closingIssue ? (
                          <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
                        ) : issueClosed ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Lock className="w-3 h-3 text-purple-400" />
                        )}
                        <span>{issueClosed ? 'Closed' : `Close as #${match.number}`}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Drafted Maintainer Follow-up Comment with 1-Click GitHub Dispatch */}
        {draftedComment && (
          <>
            <div className="h-px bg-white/[0.06]" />
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider font-mono text-white flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  Drafted Follow-up Comment
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleCopyDraft}
                    className="flex items-center gap-1 text-[10px] font-mono text-white hover:text-zinc-200 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 transition cursor-pointer"
                  >
                    {copiedDraft ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedDraft ? 'Copied' : 'Copy'}</span>
                  </button>

                  <button
                    onClick={handlePostComment}
                    disabled={postingComment || commentPosted}
                    className="flex items-center gap-1 text-[10px] font-mono px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition cursor-pointer font-bold disabled:opacity-50"
                  >
                    {postingComment ? (
                      <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                    ) : commentPosted ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Send className="w-3 h-3 text-emerald-400" />
                    )}
                    <span>{commentPosted ? 'Posted to GitHub!' : 'Post to GitHub'}</span>
                  </button>
                </div>
              </div>

              <div className="text-zinc-300 font-mono text-xs bg-white/[0.03] p-3 rounded-2xl border border-white/[0.06] whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                {draftedComment}
              </div>
            </div>
          </>
        )}

        {/* Reviewer & Contributor Discussion Activity */}
        {detail?.comments && detail.comments.length > 0 && (
          <>
            <div className="h-px bg-white/[0.06]" />
            <div className="space-y-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider font-mono text-white flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                Discussion & Review Activity ({detail.comments.length})
              </span>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {detail.comments.map((c, idx) => (
                  <div key={c.id || idx} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <img
                          src={`https://github.com/${c.author}.png`}
                          alt={c.author}
                          className="w-4 h-4 rounded-full bg-zinc-800 shrink-0 object-cover"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <span className="font-mono text-xs font-semibold text-zinc-200 truncate">
                          @{c.author}
                        </span>
                        {c.is_maintainer ? (
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold">
                            MAINTAINER
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                        {c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap">
                      {c.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Human Feedback Footer: Confirm / Override or Override Reason Modal */}
      <div className="p-3.5 sm:p-4 border-t border-white/[0.08] bg-white/[0.02]">
        {showOverrideModal ? (
          <div className="space-y-2.5 p-3 rounded-2xl bg-amber-950/30 border border-amber-500/30 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-amber-300">Select Override Reason:</span>
              <button
                onClick={() => setShowOverrideModal(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {['False Positive', 'Wrong Category', 'Not a Duplicate', 'Low Priority'].map((r) => (
                <button
                  key={r}
                  onClick={() => setOverrideReason(r)}
                  className={`p-1.5 rounded-xl text-[10px] font-mono border transition ${
                    overrideReason === r
                      ? 'bg-amber-500/20 text-amber-200 border-amber-500/50 font-bold'
                      : 'bg-white/[0.03] text-zinc-400 border-white/[0.06] hover:bg-white/10'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Optional maintainer note..."
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
            />

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => handleFeedback('down', customNote || overrideReason)}
                className="flex-1 py-2 rounded-full text-xs font-mono font-bold bg-amber-500 text-black hover:bg-amber-400 transition"
              >
                Submit Override
              </button>
              <button
                onClick={() => setShowOverrideModal(false)}
                className="px-4 py-2 rounded-full text-xs font-mono text-zinc-400 hover:text-white bg-white/5 border border-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : feedbackVote === 'up' ? (
          <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center justify-between gap-2 shadow-lg animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-bold">✓ Confirmed by Maintainer</span>
            </div>
            <button
              onClick={handleResetFeedback}
              disabled={submittingFeedback}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono text-zinc-300 hover:text-white bg-white/10 hover:bg-white/20 border border-white/15 transition cursor-pointer"
              title="Reset maintainer confirmation and restore original AI state"
            >
              <RotateCcw className="w-3 h-3 text-zinc-400" />
              <span>Undo</span>
            </button>
          </div>
        ) : feedbackVote === 'down' ? (
          <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center justify-between gap-2 shadow-lg animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-bold">✗ Overridden by Maintainer</span>
            </div>
            <button
              onClick={handleResetFeedback}
              disabled={submittingFeedback}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono text-zinc-300 hover:text-white bg-white/10 hover:bg-white/20 border border-white/15 transition cursor-pointer"
              title="Reset maintainer override and restore original AI state"
            >
              <RotateCcw className="w-3 h-3 text-zinc-400" />
              <span>Undo</span>
            </button>
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
              onClick={() => setShowOverrideModal(true)}
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

      {/* RAG Semantic Duplicate Diff Modal */}
      {selectedRAGMatch && (
        <RAGDiffModal
          currentIssue={issue}
          matchedIssue={selectedRAGMatch}
          onClose={() => setSelectedRAGMatch(null)}
          onCloseAsDuplicate={handleCloseDuplicate}
          onOverride={(num, reason) => handleFeedback('down', reason)}
        />
      )}
    </aside>
  );
}
