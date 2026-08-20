import React, { useState } from 'react';
import { GuardianLogo3D } from '../3d/GuardianLogo3D';
import { 
  GitBranch, 
  RotateCw, 
  Zap, 
  Layers, 
  List, 
  Activity, 
  FileText, 
  Plus,
  ChevronDown,
  UserCheck
} from 'lucide-react';

function GitHubIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export function TopNav({
  health,
  activeView,
  onSelectView,
  onSync,
  isSyncing,
  onCheckNow,
  isChecking,
  onOpenConnect,
  onSwitchRepo,
  repos = [],
  issuesCount = 0,
  escalatedCount = 0,
  user = null,
  rateLimit = null,
  onOpenAuth,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);

  const views = [
    { id: '3d', label: '3D Triage', icon: Layers },
    { id: 'topology', label: 'Git Branches', icon: Zap },
    { id: 'list', label: '2D Table', icon: List },
    { id: 'health', label: 'Health', icon: Activity },
    { id: 'brief', label: 'Weekly Brief', icon: FileText },
  ];

  const currentView = views.find(v => v.id === activeView) || views[0];
  const CurrentIcon = currentView.icon;

  return (
    <header className="fixed top-3 sm:top-4 left-3 sm:left-6 right-3 sm:right-6 z-50 flex items-center justify-between px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full bg-black/50 border border-white/10 shadow-2xl backdrop-blur-3xl transition-all">
      {/* Brand & Repository Context */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
        <GuardianLogo3D className="w-6 h-6 sm:w-7 sm:h-7 shrink-0 cursor-pointer" />
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <span className="text-xs sm:text-sm font-semibold tracking-tight text-white font-sans shrink-0">
            RepoGuardian
          </span>
          <span className="text-zinc-600 font-mono text-xs hidden xs:inline">/</span>
          <div className="relative">
            <button
              onClick={() => setRepoDropdownOpen(!repoDropdownOpen)}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-0.5 sm:py-1 rounded-full bg-white/[0.04] hover:bg-white/10 border border-white/10 hover:border-white/25 text-[11px] sm:text-xs font-mono text-zinc-300 min-w-0 transition cursor-pointer"
              title="Click to switch active repository"
            >
              <GitBranch className="w-3 h-3 text-sky-400 shrink-0" />
              <span className="font-medium text-white truncate max-w-[90px] sm:max-w-[180px]">
                {health?.active_repo || 'No repo'}
              </span>
              <span className="text-zinc-600 hidden sm:inline">•</span>
              <span className="text-zinc-400 hidden sm:inline">{issuesCount}</span>
              {escalatedCount > 0 && (
                <span className="text-white font-medium flex items-center gap-1 shrink-0 ml-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-zinc-300 hidden md:inline">{escalatedCount}</span>
                </span>
              )}
              <ChevronDown className="w-3 h-3 text-zinc-400 ml-0.5" />
            </button>

            {/* Repositories Dropdown */}
            {repoDropdownOpen && (
              <div className="absolute top-8 left-0 w-64 rounded-2xl bg-black/95 border border-white/15 shadow-2xl backdrop-blur-2xl p-2 flex flex-col gap-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2.5 py-1 text-[10px] font-mono uppercase text-zinc-500 tracking-wider">
                  Connected Repositories
                </div>
                {repos.map((r) => {
                  const rName = typeof r === 'string' ? r : r.repo;
                  const isActive = rName === health?.active_repo;
                  return (
                    <button
                      key={rName}
                      onClick={() => {
                        if (onSwitchRepo) onSwitchRepo(rName);
                        setRepoDropdownOpen(false);
                      }}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-mono text-left transition cursor-pointer ${
                        isActive
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold'
                          : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <GitBranch className="w-3 h-3 shrink-0" />
                        <span className="truncate">{rName}</span>
                      </div>
                      {isActive && <span className="text-[10px] text-sky-400 font-bold ml-1">ACTIVE</span>}
                    </button>
                  );
                })}
                <div className="border-t border-white/10 pt-1 mt-1">
                  <button
                    onClick={() => {
                      setRepoDropdownOpen(false);
                      if (onOpenConnect) onOpenConnect();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-mono text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Connect New Repository...</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Center View Switcher (Desktop Full Segments) */}
      <nav className="hidden lg:flex items-center gap-1 p-1 rounded-full bg-white/[0.03] border border-white/10">
        {views.map((v) => {
          const Icon = v.icon;
          const isActive = activeView === v.id;
          return (
            <button
              key={v.id}
              onClick={() => onSelectView(v.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono transition-all duration-200 ${
                isActive
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{v.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Center View Switcher (Tablet / Mobile Dropdown) */}
      <div className="lg:hidden relative">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-mono text-white"
        >
          <CurrentIcon className="w-3 h-3 text-sky-400" />
          <span className="font-semibold">{currentView.label}</span>
          <ChevronDown className="w-3 h-3 text-zinc-400" />
        </button>

        {mobileMenuOpen && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-44 rounded-2xl bg-black/90 border border-white/15 shadow-2xl backdrop-blur-2xl p-1.5 flex flex-col gap-1 z-50 animate-in fade-in zoom-in-95 duration-150">
            {views.map((v) => {
              const Icon = v.icon;
              const isActive = activeView === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => {
                    onSelectView(v.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono text-left transition ${
                    isActive
                      ? 'bg-white text-black font-bold'
                      : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{v.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Actions Cluster */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Sync Action */}
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-full text-xs font-mono text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/10 border border-white/10 transition cursor-pointer"
          title="Poll GitHub for updates"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-white' : 'text-zinc-400'}`} />
          <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync'}</span>
        </button>

        {/* Check Now Trigger */}
        <button
          onClick={onCheckNow}
          disabled={isChecking}
          className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-full text-xs font-mono text-white bg-white/10 hover:bg-white/20 border border-white/20 transition shadow-sm cursor-pointer"
          title="Trigger agentic investigation"
        >
          <Zap className={`w-3.5 h-3.5 ${isChecking ? 'animate-bounce text-white' : 'text-zinc-300'}`} />
          <span className="hidden sm:inline">{isChecking ? 'Running...' : 'Check Now'}</span>
        </button>

        {/* Connect Repo Action */}
        <button
          onClick={onOpenConnect}
          className="flex items-center gap-1 px-3 sm:px-4 py-1.5 rounded-full text-xs font-mono font-bold text-black bg-white hover:bg-zinc-200 transition shadow-md cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">Connect</span>
        </button>

        {/* GitHub User Auth Avatar / Login Button */}
        {user ? (
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-sky-950/60 hover:bg-sky-900/80 border border-sky-500/40 text-xs font-mono text-white transition cursor-pointer shadow-sm group"
            title={`Logged in as @${user.login} (${rateLimit?.remaining ?? 5000} req remaining)`}
          >
            <img
              src={user.avatar_url || 'https://avatars.githubusercontent.com/u/9919?v=4'}
              alt={user.login}
              className="w-5 h-5 rounded-full border border-sky-400/50 object-cover"
            />
            <span className="font-semibold text-sky-200 hidden md:inline truncate max-w-[100px]">
              @{user.login}
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </button>
        ) : (
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-medium text-sky-300 bg-sky-950/40 hover:bg-sky-900/60 border border-sky-500/30 transition cursor-pointer"
            title="Sign in with GitHub or Demo Maintainer"
          >
            <GitHubIcon className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
}
