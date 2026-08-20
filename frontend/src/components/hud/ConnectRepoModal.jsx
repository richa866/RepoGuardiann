import React, { useState, useEffect } from 'react';
import { X, GitBranch, Key, ArrowRight, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../../api';

const PRESET_REPOS = [
  { repo: 'httpie/cli', label: 'httpie/cli (Rich Security & CLI bugs)' },
  { repo: 'psf/black', label: 'psf/black (Python Formatter & Regressions)' },
  { repo: 'pallets/flask', label: 'pallets/flask (Historical maintainer context)' },
  { repo: 'fastapi/typer', label: 'fastapi/typer (Clean & Fast)' },
];

export function ConnectRepoModal({ isOpen, onClose, onConnected }) {
  const [repoInput, setRepoInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    let timer;
    if (connecting && repoInput) {
      timer = setInterval(async () => {
        const { data } = await api.syncStatus(repoInput.trim());
        if (data) {
          setSyncStatus(data);
          if (data.status === 'done' || data.status === 'idle') {
            setConnecting(false);
            clearInterval(timer);
            if (onConnected) onConnected(repoInput.trim());
            onClose();
          } else if (data.status === 'error') {
            setConnecting(false);
            setErrorMessage(data.error || 'Sync pipeline failed');
            clearInterval(timer);
          }
        }
      }, 1500);
    }
    return () => clearInterval(timer);
  }, [connecting, repoInput, onConnected, onClose]);

  if (!isOpen) return null;

  async function handleConnect(e) {
    e.preventDefault();
    if (!repoInput.trim()) return;
    setConnecting(true);
    setErrorMessage(null);
    setSyncStatus({ stage: 'validating_repo', progress_current: 0, progress_total: 100 });

    const { data, error } = await api.connect(repoInput.trim(), tokenInput.trim() || null);
    if (error) {
      setConnecting(false);
      setErrorMessage(error.message || `Failed to connect: ${error.code}`);
    }
  }

  function handleSelectPreset(repo) {
    setRepoInput(repo);
    setErrorMessage(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl glass-panel-glow border border-sky-500/30 p-6 space-y-5 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-slate-200 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-sky-500/20 border border-sky-400/30 text-sky-300">
            <GitBranch className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              Connect Live GitHub Repository
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Live ingest → Chroma embeddings → Autonomous subtasks
            </p>
          </div>
        </div>

        {/* Preset Repos */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Recommended Hackathon Repos
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRESET_REPOS.map((item) => (
              <button
                key={item.repo}
                type="button"
                onClick={() => handleSelectPreset(item.repo)}
                className={`p-2.5 rounded-xl text-left text-xs font-mono border transition ${
                  repoInput === item.repo
                    ? 'bg-sky-950/80 text-sky-200 border-sky-400 shadow-sm'
                    : 'bg-slate-900/50 text-slate-300 border-white/5 hover:border-sky-500/30 hover:bg-slate-800/60'
                }`}
              >
                <div className="font-bold text-sky-400">{item.repo}</div>
                <div className="text-[10px] text-slate-400 truncate">{item.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleConnect} className="space-y-3.5">
          <div className="space-y-1">
            <label className="text-xs font-mono text-slate-300">
              Repository (owner/repo) *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. httpie/cli or psf/black"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-mono text-slate-300 flex items-center justify-between">
              <span>Personal Access Token (Optional)</span>
              <span className="text-[10px] text-slate-500">Public repos work with 0 tokens</span>
            </label>
            <input
              type="password"
              placeholder="ghp_... (raises rate limit to 5000/hr)"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400"
            />
          </div>

          {/* Progress / Status */}
          {connecting && syncStatus && (
            <div className="p-3 rounded-2xl bg-sky-950/60 border border-sky-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-sky-300">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Stage: {syncStatus.stage || 'Ingesting issues...'}
                </span>
                <span>
                  {syncStatus.progress_current || 0} / {syncStatus.progress_total || 30}
                </span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-sky-400 h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      ((syncStatus.progress_current || 1) / (syncStatus.progress_total || 30)) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/70 border border-red-500/40 text-red-300 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={connecting || !repoInput.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-sky-500/20"
            >
              <span>{connecting ? 'Connecting & Ingesting...' : 'Connect & Monitor'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
