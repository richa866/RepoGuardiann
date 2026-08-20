import React, { useState } from 'react';
import { 
  X, 
  Key, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  LogOut, 
  Sparkles, 
  ExternalLink,
  User,
  Activity,
  FolderGit2
} from 'lucide-react';
import api from '../../api';

function GitHubIcon({ className = "w-6 h-6" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export function GitHubAuthModal({ 
  isOpen, 
  onClose, 
  user, 
  sessionToken,
  rateLimit,
  onAuthSuccess, 
  onLogout 
}) {
  const [tokenInput, setTokenInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [activeTab, setActiveTab] = useState('token'); // 'token' | 'demo'

  if (!isOpen) return null;

  async function handleVerifyToken(tokenValue) {
    const raw = (tokenValue || tokenInput).trim();
    if (!raw) {
      setErrorMsg('Please enter a GitHub Personal Access Token or choose Demo mode.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);

    const { data, error } = await api.authVerifyToken(raw);
    setIsVerifying(false);

    if (error) {
      setErrorMsg(typeof error === 'string' ? error : (error.message || 'Authentication failed'));
      return;
    }

    if (data?.authenticated && data?.user) {
      onAuthSuccess({
        user: data.user,
        sessionToken: data.session_token,
        rateLimit: data.rate_limit,
        isDemo: data.is_demo,
      });
      onClose();
    }
  }

  async function handleDemoLogin() {
    await handleVerifyToken('demo');
  }

  async function handleSignOut() {
    if (sessionToken) {
      await api.authLogout(sessionToken);
    }
    onLogout();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl bg-black/90 border border-sky-500/30 p-6 space-y-5 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-slate-200 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-sky-500/20 border border-sky-400/30 text-sky-300">
            <GitHubIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              GitHub Maintainer Authentication
              <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-mono border border-sky-500/30">
                MCP / API
              </span>
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Authenticate for 5,000 req/hr, private repo access & automated triage actions
            </p>
          </div>
        </div>

        {/* Authenticated User Profile View */}
        {user ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
              <div className="flex items-center gap-3.5">
                <img
                  src={user.avatar_url || 'https://avatars.githubusercontent.com/u/9919?v=4'}
                  alt={user.login}
                  className="w-12 h-12 rounded-full border border-sky-400/40 shadow-md object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm truncate">{user.name || user.login}</span>
                    <a
                      href={user.html_url || `https://github.com/${user.login}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-sky-400 hover:underline flex items-center gap-1 font-mono"
                    >
                      @{user.login}
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  {user.bio && (
                    <p className="text-xs text-slate-400 truncate mt-0.5">{user.bio}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] font-mono text-zinc-400">
                    <span>{user.public_repos ?? 0} repos</span>
                    <span>•</span>
                    <span>{user.followers ?? 0} followers</span>
                    {user.token_preview && (
                      <>
                        <span>•</span>
                        <span className="text-zinc-500">Token: {user.token_preview}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Rate Limit Stats */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 font-mono text-xs">
                <div className="p-2 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    Rate Limit:
                  </span>
                  <span className="text-emerald-300 font-bold">
                    {rateLimit?.remaining ?? 5000} / {rateLimit?.limit ?? 5000}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                    Session:
                  </span>
                  <span className="text-sky-300 font-semibold">Active</span>
                </div>
              </div>
            </div>

            {/* Logout / Switch Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setTokenInput('');
                  setActiveTab('token');
                }}
                className="text-xs font-mono text-zinc-400 hover:text-white transition"
              >
                Switch Account / Token
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-mono font-semibold transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect & Sign Out</span>
              </button>
            </div>
          </div>
        ) : (
          /* Login Options */
          <div className="space-y-4">
            {/* Quick Demo Access banner */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-950/70 to-indigo-950/70 border border-sky-500/30 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                  Instant Demo Maintainer Mode
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Test full triage workflows without creating personal tokens
                </div>
              </div>
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={isVerifying}
                className="px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-black text-xs font-mono font-bold transition shrink-0 cursor-pointer shadow-md"
              >
                {isVerifying ? 'Verifying...' : 'Launch Demo'}
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 uppercase tracking-wider before:h-px before:flex-1 before:bg-white/10 after:h-px after:flex-1 after:bg-white/10">
              Or Use Personal Access Token
            </div>

            {/* Token Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleVerifyToken();
              }}
              className="space-y-3"
            >
              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-sky-400" />
                    GitHub Token (Classic or Fine-Grained)
                  </span>
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-sky-400 hover:underline flex items-center gap-0.5"
                  >
                    Generate PAT
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </label>
                <input
                  type="password"
                  placeholder="ghp_... or github_pat_..."
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-400"
                />
              </div>

              <div className="text-[11px] text-zinc-400 font-mono space-y-1 bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
                <div className="font-semibold text-zinc-300">Recommended Scopes:</div>
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono">repo</span>
                  <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono">read:user</span>
                  <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono">user:email</span>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifying || !tokenInput.trim()}
                  className="px-5 py-2 rounded-xl text-xs font-mono font-bold bg-white text-black hover:bg-zinc-200 transition disabled:opacity-50 cursor-pointer shadow-lg"
                >
                  {isVerifying ? 'Authenticating...' : 'Authenticate & Connect'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
