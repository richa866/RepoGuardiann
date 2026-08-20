import React, { useState, useEffect, useRef } from 'react';
import { GuardianLogo3D } from '../3d/GuardianLogo3D';
import { 
  GitBranch, 
  GitPullRequest,
  RotateCw, 
  Zap, 
  Layers, 
  List, 
  Activity, 
  FileText, 
  Plus,
  ChevronDown,
  User,
  LogOut,
  ExternalLink
} from 'lucide-react';

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
  openIssuesCount = 0,
  openPrsCount = 0,
  escalatedCount = 0,
  currentUser = null,
  onLogout = null,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const mobileRef = useRef(null);
  const userRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setRepoDropdownOpen(false);
      }
      if (mobileRef.current && !mobileRef.current.contains(event.target)) {
        setMobileMenuOpen(false);
      }
      if (userRef.current && !userRef.current.contains(event.target)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const views = [
    { id: '3d', label: '3D Triage', short: '3D', icon: Layers },
    { id: 'prs', label: 'Pull Requests', short: 'PRs', icon: GitPullRequest },
    { id: 'topology', label: 'Git Branches', short: 'Branches', icon: Zap },
    { id: 'list', label: '2D Table', short: 'Table', icon: List },
    { id: 'health', label: 'Health', short: 'Health', icon: Activity },
    { id: 'brief', label: 'Weekly Brief', short: 'Brief', icon: FileText },
  ];

  const currentView = views.find(v => v.id === activeView) || views[0];
  const CurrentIcon = currentView.icon;

  const displayOpenIssues = openIssuesCount || issuesCount;

  return (
    <header className="fixed top-2.5 sm:top-3.5 left-2 sm:left-4 md:left-6 right-2 sm:right-4 md:right-6 z-50 flex items-center justify-between gap-1.5 sm:gap-3 md:gap-4 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-black/80 border border-white/10 shadow-2xl backdrop-blur-3xl transition-all max-w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-2rem)] md:max-w-[calc(100vw-3rem)] mx-auto box-border">
      
      {/* Brand & Repository Context (Left Cluster) */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 min-w-0">
        <GuardianLogo3D className="w-6 h-6 sm:w-7 sm:h-7 shrink-0 cursor-pointer" />
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="text-xs sm:text-sm font-semibold tracking-tight text-white font-sans shrink-0 hidden sm:inline">
            RepoGuardian
          </span>
          <span className="text-zinc-600 font-mono text-xs hidden md:inline shrink-0">/</span>
          
          {/* Active Repo Capsule */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setRepoDropdownOpen(!repoDropdownOpen)}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-white/10 border border-white/10 hover:border-white/25 text-xs font-mono text-zinc-300 transition cursor-pointer shrink-0"
              title={`Active: ${health?.active_repo || 'No repo'} (${displayOpenIssues} open issues, ${openPrsCount} open PRs)`}
            >
              <GitBranch className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="font-medium text-white truncate max-w-[70px] xs:max-w-[95px] sm:max-w-[125px] md:max-w-[155px]">
                {health?.active_repo || 'No repo'}
              </span>
              <span className="text-zinc-600 hidden lg:inline">•</span>
              <span className="text-zinc-400 hidden lg:inline">{displayOpenIssues} open</span>
              {escalatedCount > 0 && (
                <span className="text-white font-medium flex items-center gap-1 shrink-0 ml-0.5 hidden sm:inline-flex">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-zinc-300 hidden xl:inline">{escalatedCount}</span>
                </span>
              )}
              <ChevronDown className="w-3 h-3 text-zinc-400 ml-0.5 shrink-0" />
            </button>

            {/* Repositories Dropdown */}
            {repoDropdownOpen && (
              <div className="absolute top-full mt-2 left-0 w-64 rounded-2xl bg-zinc-950/95 border border-zinc-700 shadow-2xl backdrop-blur-2xl p-2 flex flex-col gap-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2.5 py-1 text-[10px] font-mono uppercase text-zinc-400 tracking-wider">
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
                        <GitBranch className="w-3.5 h-3.5 shrink-0" />
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
                    <Plus className="w-3.5 h-3.5" />
                    <span>Connect New Repository...</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Center View Switcher (Full Text on 2xl screens) */}
      <nav className="hidden 2xl:flex items-center gap-1 p-1 rounded-full bg-white/[0.03] border border-white/10 shrink-0">
        {views.map((v) => {
          const Icon = v.icon;
          const isActive = activeView === v.id;
          return (
            <button
              key={v.id}
              onClick={() => onSelectView(v.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono transition-all duration-200 ${
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

      {/* Center View Switcher (Compact Labels on lg to 2xl screens) */}
      <nav className="hidden lg:flex 2xl:hidden items-center gap-1 p-1 rounded-full bg-white/[0.03] border border-white/10 shrink-0">
        {views.map((v) => {
          const Icon = v.icon;
          const isActive = activeView === v.id;
          return (
            <button
              key={v.id}
              onClick={() => onSelectView(v.id)}
              title={v.label}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono transition-all duration-200 ${
                isActive
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{v.short}</span>
            </button>
          );
        })}
      </nav>

      {/* Center View Switcher (Mobile / Tablet Compact Dropdown on < lg screens) */}
      <div className="lg:hidden relative" ref={mobileRef}>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-mono text-white shrink-0"
        >
          <CurrentIcon className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="font-semibold">{currentView.short || currentView.label}</span>
          <ChevronDown className="w-3 h-3 text-zinc-400 shrink-0" />
        </button>

        {mobileMenuOpen && (
          <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-44 rounded-2xl bg-zinc-950/95 border border-zinc-700 shadow-2xl backdrop-blur-2xl p-1.5 flex flex-col gap-1 z-50 animate-in fade-in zoom-in-95 duration-150">
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

      {/* Right Actions Cluster (Guaranteed to fit on screen) */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Sync Action */}
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full text-xs font-mono text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/10 border border-white/10 transition shrink-0"
          title="Poll GitHub for updates"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-white' : 'text-zinc-400'}`} />
          <span className="hidden md:inline">{isSyncing ? 'Syncing...' : 'Sync'}</span>
        </button>

        {/* Check Now Trigger */}
        <button
          onClick={onCheckNow}
          disabled={isChecking}
          className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full text-xs font-mono text-white bg-white/10 hover:bg-white/20 border border-white/20 transition shadow-sm shrink-0"
          title="Trigger agentic investigation"
        >
          <Zap className={`w-3.5 h-3.5 ${isChecking ? 'animate-bounce text-white' : 'text-zinc-300'}`} />
          <span className="hidden md:inline">{isChecking ? 'Checking...' : 'Check'}</span>
        </button>

        {/* Connect Repo Action (Always cleanly visible inside header) */}
        <button
          onClick={onOpenConnect}
          className="flex items-center gap-1 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-xs font-mono font-bold text-black bg-white hover:bg-zinc-200 transition shrink-0 shadow-md cursor-pointer"
          title="Connect GitHub repository"
        >
          <Plus className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Connect</span>
        </button>

        {/* User Profile Avatar & Dropdown */}
        {currentUser && (
          <div className="relative shrink-0" ref={userRef}>
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-1 p-0.5 sm:p-1 rounded-full bg-white/[0.04] hover:bg-white/10 border border-white/10 transition cursor-pointer"
              title={`Signed in as @${currentUser.login || 'user'}`}
            >
              {currentUser.avatar_url ? (
                <img
                  src={currentUser.avatar_url}
                  alt={currentUser.login}
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-zinc-800 object-cover"
                />
              ) : (
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-sky-500/20 text-sky-300 flex items-center justify-center font-mono text-xs font-bold">
                  {currentUser.login?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </button>

            {userDropdownOpen && (
              <div className="absolute top-full mt-2 right-0 w-64 rounded-2xl bg-zinc-950/95 border border-zinc-700 shadow-2xl backdrop-blur-2xl p-3 flex flex-col gap-2 z-50 animate-in fade-in zoom-in-95 duration-150 font-sans">
                {/* User Info */}
                <div className="flex items-center gap-2.5 pb-2 border-b border-white/10">
                  {currentUser.avatar_url && (
                    <img
                      src={currentUser.avatar_url}
                      alt={currentUser.login}
                      className="w-9 h-9 rounded-full bg-zinc-800 object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-xs text-white truncate">
                      {currentUser.name || currentUser.login}
                    </div>
                    <div className="text-[11px] font-mono text-zinc-400 truncate">
                      @{currentUser.login}
                    </div>
                  </div>
                </div>

                {/* Profile Link */}
                {currentUser.html_url && (
                  <a
                    href={currentUser.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-mono text-zinc-300 hover:text-white hover:bg-white/5 transition"
                  >
                    <span className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-zinc-400" />
                      <span>GitHub Profile</span>
                    </span>
                    <ExternalLink className="w-3 h-3 text-zinc-500" />
                  </a>
                )}

                {/* Sign Out Action */}
                {onLogout && (
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      onLogout();
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-mono text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
