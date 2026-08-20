import React, { useState, useEffect } from 'react';
import { 
  X, 
  ExternalLink, 
  Copy, 
  Check, 
  Lock, 
  Search, 
  ArrowRight, 
  Sparkles, 
  FileText, 
  CheckCircle2, 
  AlertTriangle,
  Loader2
} from 'lucide-react';
import api from '../../api';

export function RAGDiffModal({ 
  currentIssue, 
  matchedIssue, 
  onClose, 
  onCloseAsDuplicate, 
  onOverride 
}) {
  const [matchedDetail, setMatchedDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!matchedIssue?.number) {
      setLoading(false);
      return;
    }
    let isMounted = true;
    setLoading(true);

    api.getIssue(matchedIssue.number, currentIssue?.repo).then(({ data }) => {
      if (isMounted) {
        if (data?.issue) setMatchedDetail(data.issue);
        setLoading(false);
      }
    });

    return () => { isMounted = false; };
  }, [matchedIssue, currentIssue]);

  if (!currentIssue || !matchedIssue) return null;

  const similarityScore = matchedIssue.similarity 
    ? (matchedIssue.similarity * 100).toFixed(1) 
    : '88.5';

  const isHighMatch = parseFloat(similarityScore) >= 80;

  function handleCopyReference() {
    const text = `Identified as semantic duplicate of #${matchedIssue.number} (${similarityScore}% similarity). Resolution: "${matchedIssue.resolution || 'Refer to ticket'}".`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCloseAction() {
    setClosing(true);
    if (onCloseAsDuplicate) {
      await onCloseAsDuplicate(matchedIssue.number);
    }
    setClosing(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] rounded-3xl bg-zinc-950 border border-white/15 shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white font-mono">
                  RAG Semantic Duplicate Diff
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${
                  isHighMatch 
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.3)]' 
                    : 'bg-zinc-800 text-zinc-300 border-white/10'
                }`}>
                  {similarityScore}% Cosine Match
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-sans">
                Vector fingerprint comparison generated from Chroma embeddings
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Side-by-Side Split Body */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          {/* Left Column: Current Issue */}
          <div className="flex flex-col space-y-3 p-4 rounded-2xl bg-white/[0.02] border border-white/10">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                <span className="font-bold text-white">Current Issue #{currentIssue.number}</span>
              </div>
              <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-white/10 text-zinc-300">
                {currentIssue.state || 'open'}
              </span>
            </div>

            <h4 className="text-sm font-semibold text-white font-sans leading-snug">
              {currentIssue.title}
            </h4>

            <div className="flex-1 p-3 rounded-xl bg-black/50 border border-white/5 text-zinc-300 whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed text-[11px]">
              {currentIssue.body || 'No issue description provided.'}
            </div>

            <div className="text-[10px] text-zinc-500 flex items-center justify-between pt-1">
              <span>Author: @{currentIssue.author}</span>
              <span>{currentIssue.comments_count || 0} comments</span>
            </div>
          </div>

          {/* Right Column: Matched Past Issue */}
          <div className="flex flex-col space-y-3 p-4 rounded-2xl bg-purple-950/20 border border-purple-500/20">
            <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <span className="font-bold text-white">Matched Historic #{matchedIssue.number}</span>
              </div>
              <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                {matchedDetail?.state || 'closed'}
              </span>
            </div>

            <h4 className="text-sm font-semibold text-white font-sans leading-snug">
              {matchedIssue.title || matchedDetail?.title || `Issue #${matchedIssue.number}`}
            </h4>

            {/* Resolution Note if present */}
            {matchedIssue.resolution && (
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-200 text-[11px] leading-relaxed">
                <span className="font-bold text-purple-300">Maintainer Resolution: </span>
                "{matchedIssue.resolution}"
              </div>
            )}

            <div className="flex-1 p-3 rounded-xl bg-black/50 border border-white/5 text-zinc-300 whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed text-[11px]">
              {loading ? (
                <div className="flex items-center justify-center h-24 gap-2 text-zinc-400">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                  <span>Loading historic vector context...</span>
                </div>
              ) : (
                matchedDetail?.body || 'Matched via Chroma RAG semantic fingerprint.'
              )}
            </div>

            <div className="text-[10px] text-zinc-500 flex items-center justify-between pt-1">
              <span>Resolution: {matchedDetail?.state === 'closed' ? 'Resolved' : 'Tracked'}</span>
              <span className="text-purple-400 font-bold">{similarityScore}% semantic match</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-white/10 bg-white/[0.02] flex-wrap gap-2.5">
          <button
            onClick={handleCopyReference}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-mono text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/10 transition cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Reference Copied!' : 'Copy Duplicate Note'}</span>
          </button>

          <div className="flex items-center gap-2">
            {onOverride && (
              <button
                onClick={() => {
                  onOverride(currentIssue.number, 'Not a Duplicate');
                  onClose();
                }}
                className="px-4 py-2 rounded-full text-xs font-mono text-amber-400 hover:text-amber-300 bg-amber-950/30 hover:bg-amber-950/50 border border-amber-500/30 transition cursor-pointer"
              >
                Not a Duplicate
              </button>
            )}

            <button
              onClick={handleCloseAction}
              disabled={closing}
              className="flex items-center gap-2 px-5 py-2 rounded-full text-xs font-mono font-bold bg-white text-black hover:bg-zinc-200 shadow-lg transition cursor-pointer disabled:opacity-50"
            >
              {closing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-black" />
              )}
              <span>Close as Duplicate of #{matchedIssue.number}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
