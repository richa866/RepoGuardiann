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
  PlusCircle,
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
    <header className="fixed top-3 left-3 right-3 z-50 flex items-center justify-between px-4 py-2.5 rounded-2xl glass-panel border border-white/10 shadow-2xl backdrop-blur-2xl">
      {/* Brand & 3D Logo */}
      <div className="flex items-center gap-3">
        <GuardianLogo3D className="w-9 h-9 cursor-pointer" />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-sky-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
              RepoGuardian
            </h1>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-500/30">
              Agentic Triage
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
            <GitBranch className="w-3 h-3 text-sky-400" />
            <span className="text-slate-200 font-medium">{health?.active_repo || 'No repo connected'}</span>
            <span className="text-slate-500">|</span>
            <span>{issuesCount} issues</span>
            {escalatedCount > 0 && (
              <>
                <span className="text-slate-500">•</span>
                <span className="text-red-400 font-semibold flex items-center gap-0.5">
                  <ShieldAlert className="w-3 h-3 text-red-400" />
                  {escalatedCount} escalated
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Center View Switcher */}
      <nav className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-slate-950/70 border border-white/5">
        <button
          onClick={() => onSelectView('topology')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition ${
            activeView === 'topology'
              ? 'bg-purple-600/30 text-purple-200 border border-purple-400/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-purple-400" />
          <span>Git Branches</span>
        </button>

        <button
          onClick={() => onSelectView('3d')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition ${
            activeView === '3d'
              ? 'bg-sky-500/25 text-sky-200 border border-sky-400/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-sky-400" />
          <span>3D Triage Tree</span>
        </button>

        <button
          onClick={() => onSelectView('list')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition ${
            activeView === 'list'
              ? 'bg-sky-500/25 text-sky-200 border border-sky-400/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <List className="w-3.5 h-3.5 text-sky-400" />
          <span>2D Triage Table</span>
        </button>

        <button
          onClick={() => onSelectView('health')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition ${
            activeView === 'health'
              ? 'bg-sky-500/25 text-sky-200 border border-sky-400/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span>Health Trends</span>
        </button>

        <button
          onClick={() => onSelectView('brief')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition ${
            activeView === 'brief'
              ? 'bg-sky-500/25 text-sky-200 border border-sky-400/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-amber-400" />
          <span>Weekly Brief</span>
        </button>
      </nav>

      {/* Right Actions & Status */}
      <div className="flex items-center gap-2">
        {/* AI Engine Status Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-mono bg-slate-950/80 border border-white/5">
          <Cpu className={`w-3.5 h-3.5 ${isGemini ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span className="text-slate-300">
            {isGemini ? 'Gemini 1.5 Flash' : 'Deterministic RAG'}
          </span>
        </div>

        {/* Sync Button */}
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono bg-slate-900/80 hover:bg-slate-800 border border-white/10 text-slate-200 hover:text-sky-300 transition"
          title="Poll GitHub for new issues and comments"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-sky-400' : ''}`} />
          <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
        </button>

        {/* Check Now Trigger */}
        <button
          onClick={onCheckNow}
          disabled={isChecking}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono bg-sky-950/80 hover:bg-sky-900/80 border border-sky-500/40 text-sky-200 hover:text-sky-100 transition shadow-sm shadow-sky-500/20"
          title="Execute agentic investigation loop on all pending subtasks"
        >
          <Zap className={`w-3.5 h-3.5 ${isChecking ? 'animate-bounce text-sky-300' : 'text-sky-400'}`} />
          <span>{isChecking ? 'Running...' : 'Check Now'}</span>
        </button>

        {/* Connect New Repo Button */}
        <button
          onClick={onOpenConnect}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-md shadow-sky-600/30 transition"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Connect Repo</span>
        </button>
      </div>
    </header>
  );
}
