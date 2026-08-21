import React, { useState, useEffect } from 'react';
import { 
  X, 
  GitBranch, 
  Key, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  FolderGit2, 
  Star, 
  Lock, 
  Unlock,
  ExternalLink,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Mail,
  FileCode2
} from 'lucide-react';
import api from '../../api';

const PRESET_REPOS = [
  { repo: 'httpie/cli', label: 'httpie/cli (Rich Security & CLI bugs)' },
  { repo: 'psf/black', label: 'psf/black (Python Formatter & Regressions)' },
  { repo: 'pallets/flask', label: 'pallets/flask (Historical maintainer context)' },
  { repo: 'fastapi/typer', label: 'fastapi/typer (Clean & Fast)' },
];

export function ConnectRepoModal({ isOpen, onClose, onConnected, user, sessionToken }) {
  const [repoInput, setRepoInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [userRepos, setUserRepos] = useState([]);
  const [loadingUserRepos, setLoadingUserRepos] = useState(false);
  const [tab, setTab] = useState(user ? 'my_repos' : 'presets');
  const [showTokenGuide, setShowTokenGuide] = useState(false);

  // Load user repositories if authenticated
  useEffect(() => {
    if (isOpen && sessionToken) {
      setLoadingUserRepos(true);
      api.authListUserRepos(sessionToken, 50).then(({ data }) => {
        setLoadingUserRepos(false);
        if (data?.repos) {
          setUserRepos(data.repos);
        }
      });
    }
  }, [isOpen, sessionToken]);

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
      let userFriendlyMsg = error.message || `Failed to connect (${error.code || 'unknown'})`;
      if (error.code === 'token_invalid' || error.status === 401) {
        userFriendlyMsg = 'Invalid or expired GitHub token. Please verify token permissions (repo, user:email).';
      } else if (error.code === 'private_no_token') {
        userFriendlyMsg = 'This repository is private. Please provide a GitHub Personal Access Token with the "repo" scope.';
      } else if (error.code === 'not_found' || error.status === 404) {
        userFriendlyMsg = `Repository "${repoInput.trim()}" not found. Verify owner/repo spelling or check token scope for private repositories.`;
      } else if (error.code === 'rate_limited') {
        userFriendlyMsg = 'GitHub API rate limit exceeded. Provide a Personal Access Token to raise quota to 5,000 requests/hour.';
      }
      setErrorMessage(userFriendlyMsg);
    }
  }

  function handleSelectRepo(repoName) {
    setRepoInput(repoName);
    setErrorMessage(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl bg-black/90 border border-sky-500/30 p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-slate-200 transition cursor-pointer"
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
              Live ingest → Chroma embeddings → Autonomous triage matrix
            </p>
          </div>
        </div>

        {/* Selection Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10 font-mono text-xs">
          {user && (
            <button
              type="button"
              onClick={() => setTab('my_repos')}
              className={`flex-1 py-1.5 rounded-lg transition ${
                tab === 'my_repos' ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30' : 'text-zinc-400 hover:text-white'
              }`}
            >
              My Repositories ({userRepos.length || '...'})
            </button>
          )}
          <button
            type="button"
            onClick={() => setTab('presets')}
            className={`flex-1 py-1.5 rounded-lg transition ${
              tab === 'presets' ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Recommended Demo Repos
          </button>
        </div>

        {/* My Repositories List */}
        {tab === 'my_repos' && user && (
          <div className="space-y-1.5">
            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
              {loadingUserRepos ? (
                <div className="p-4 text-center text-xs font-mono text-zinc-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Loading your accessible GitHub repositories...
                </div>
              ) : userRepos.length > 0 ? (
                userRepos.map((r) => {
                  const fullName = r.full_name || r.name;
                  const isSelected = repoInput === fullName;
                  return (
                    <button
                      key={r.id || fullName}
                      type="button"
                      onClick={() => handleSelectRepo(fullName)}
                      className={`w-full p-2.5 rounded-xl text-left text-xs font-mono border transition flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-sky-950/80 text-sky-200 border-sky-400 shadow-sm'
                          : 'bg-slate-900/50 text-slate-300 border-white/5 hover:border-sky-500/30 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="truncate min-w-0 pr-2">
                        <div className="font-bold text-sky-300 flex items-center gap-1.5 truncate">
                          {r.private ? <Lock className="w-3 h-3 text-amber-400 shrink-0" /> : <Unlock className="w-3 h-3 text-zinc-400 shrink-0" />}
                          <span className="truncate">{fullName}</span>
                        </div>
                        {r.description && (
                          <div className="text-[10px] text-zinc-400 truncate mt-0.5">{r.description}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500 shrink-0">
                        {r.stargazers_count !== undefined && (
                          <span className="flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5 text-amber-400" />
                            {r.stargazers_count}
                          </span>
                        )}
                        <span>{r.language || 'Code'}</span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs font-mono text-zinc-400">
                  No repositories found. Enter a repository name manually below.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preset Repos */}
        {tab === 'presets' && (
          <div className="space-y-1.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_REPOS.map((item) => (
                <button
                  key={item.repo}
                  type="button"
                  onClick={() => handleSelectRepo(item.repo)}
                  className={`p-2.5 rounded-xl text-left text-xs font-mono border transition cursor-pointer ${
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
        )}

        {/* Form */}
        <form onSubmit={handleConnect} className="space-y-3.5">
          <div className="space-y-1">
            <label className="text-xs font-mono text-slate-300">
              Repository Identifier (owner/repo) *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. httpie/cli or pallets/flask"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400"
            />
          </div>

          {!user && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono text-slate-300">
                  Personal Access Token (Optional)
                </label>
                <button
                  type="button"
                  onClick={() => setShowTokenGuide(!showTokenGuide)}
                  className="text-[11px] font-mono text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>How to generate & required scopes</span>
                  {showTokenGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              <input
                type="password"
                placeholder="ghp_... (raises rate limit to 5000/hr)"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400"
              />

              {/* Scope Checklist Indicator */}
              <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono text-zinc-400">
                <span className="text-zinc-500">Required Scopes:</span>
                <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 font-bold flex items-center gap-1">
                  <FileCode2 className="w-2.5 h-2.5" /> repo
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold flex items-center gap-1">
                  <Mail className="w-2.5 h-2.5" /> user:email
                </span>
                <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-2.5 h-2.5" /> read:user
                </span>
              </div>

              {/* Expandable Step-by-Step PAT Generation Guide */}
              {showTokenGuide && (
                <div className="p-3.5 rounded-2xl bg-sky-950/40 border border-sky-500/30 text-xs font-mono space-y-2.5 text-zinc-300 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-sky-300 font-bold text-[11px] border-b border-sky-500/20 pb-1.5">
                    <span>How to create a GitHub Personal Access Token:</span>
                    <a
                      href="https://github.com/settings/tokens/new?scopes=repo,read:user,user:email&description=RepoGuardian"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sky-400 hover:underline cursor-pointer"
                    >
                      <span>Open GitHub Settings</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-zinc-300">
                    <li>
                      Go to <strong className="text-white">GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens (classic)</strong>.
                    </li>
                    <li>
                      Click <strong className="text-white">Generate new token (classic)</strong> and set Note to <code className="text-sky-300 bg-sky-950/80 px-1 rounded">RepoGuardian</code>.
                    </li>
                    <li>
                      Select expiration (<strong className="text-white">90 days</strong> or <strong className="text-white">No expiration</strong>).
                    </li>
                    <li>
                      <strong className="text-emerald-400">Crucial:</strong> Tick the following scope checkboxes:
                      <ul className="list-disc list-inside pl-3 mt-1 space-y-0.5 text-zinc-400">
                        <li><code className="text-sky-300">repo</code> — Full control of repositories (needed for private repos & triage actions)</li>
                        <li><code className="text-emerald-300">user:email</code> & <code className="text-purple-300">read:user</code> — Maintainer identity & permissions</li>
                      </ul>
                    </li>
                    <li>
                      Click <strong className="text-white">Generate token</strong> at the bottom, copy the <code className="text-amber-300">ghp_...</code> string, and paste it above!
                    </li>
                  </ol>
                </div>
              )}
            </div>
          )}

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
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-sky-500/20 cursor-pointer"
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
