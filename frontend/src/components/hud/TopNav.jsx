import React from 'react';
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
  ShieldAlert,
  Cpu
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
  issuesCount = 0,
  escalatedCount = 0,
}) {
  const isGemini = health?.gemini_configured;

  return (
    <header className="fixed top-3 left-4 right-4 z-50 flex items-center justify-between px-4 py-2 rounded-2xl bg-slate-950/70 border border-white/10 shadow-2xl backdrop-blur-2xl">
      {/* Brand & Active Repository */}
      <div className="flex items-center gap-3">
        <GuardianLogo3D className="w-8 h-8 cursor-pointer" />
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-tight bg-gradient-to-r from-sky-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
            RepoGuardian
          </span>
          <span className="text-slate-600">/</span>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-slate-300">
            <GitBranch className="w-3 h-3 text-sky-400" />
            <span className="font-medium text-slate-200">{health?.active_repo || 'No repo'}</span>
            <span className="text-slate-500">•</span>
            <span>{issuesCount}</span>
            {escalatedCount > 0 && (
              <span className="text-red-400 font-bold ml-0.5 flex items-center gap-0.5">
                ({escalatedCount} 🚨)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Center View Tabs (Borderless, Clean) */}
      <nav className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-slate-900/60 border border-white/5">
        <button
          onClick={() => onSelectView('3d')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition ${
            activeView === '3d'
              ? 'bg-sky-500/20 text-sky-300 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>3D Triage</span>
        </button>

        <button
          onClick={() => onSelectView('topology')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition ${
            activeView === 'topology'
              ? 'bg-purple-500/20 text-purple-300 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Git Branches</span>
        </button>

        <button
          onClick={() => onSelectView('list')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition ${
            activeView === 'list'
              ? 'bg-sky-500/20 text-sky-300 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <List className="w-3.5 h-3.5" />
          <span>2D Table</span>
        </button>

        <button
          onClick={() => onSelectView('health')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition ${
            activeView === 'health'
              ? 'bg-emerald-500/20 text-emerald-300 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Health</span>
        </button>

        <button
          onClick={() => onSelectView('brief')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition ${
            activeView === 'brief'
              ? 'bg-amber-500/20 text-amber-300 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Weekly Brief</span>
        </button>
      </nav>

      {/* Right Actions Cluster */}
      <div className="flex items-center gap-1.5">
        {/* Sync Button */}
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-white/5 transition"
          title="Poll GitHub for updates"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-sky-400' : ''}`} />
          <span className="hidden sm:inline">{isSyncing ? 'Syncing' : 'Sync'}</span>
        </button>

        {/* Check Now Trigger */}
        <button
          onClick={onCheckNow}
          disabled={isChecking}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono text-sky-300 hover:text-sky-100 bg-sky-950/60 hover:bg-sky-900/60 border border-sky-500/30 transition"
          title="Trigger agentic investigation"
        >
          <Zap className={`w-3.5 h-3.5 ${isChecking ? 'animate-bounce text-sky-300' : 'text-sky-400'}`} />
          <span className="hidden sm:inline">{isChecking ? 'Running' : 'Check Now'}</span>
        </button>

        {/* Connect Repo Button */}
        <button
          onClick={onOpenConnect}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-mono font-medium text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 transition shadow-md shadow-sky-600/20"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Connect</span>
        </button>
      </div>
    </header>
  );
}
