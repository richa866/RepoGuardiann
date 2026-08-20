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
  ExternalLink,
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
    <header className="fixed top-3 left-3 right-3 z-30 flex items-center justify-between px-4 py-2.5 rounded-2xl glass-panel border border-white/10 shadow-2xl backdrop-blur-xl">
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
                <span className="text-slate-500">|</span>
                <span className="text-red-400 font-semibold">{escalatedCount} escalated</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* View Switcher Pills */}
      <nav className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-white/5">
        <button
          onClick={() => onSelectView('topology')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeView === 'topology'
              ? 'bg-purple-500/25 text-purple-300 border border-purple-400/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
          title="View clean Git Branch Topology"
        >
          <GitBranch className="w-3.5 h-3.5" />
          <span>Git Branches</span>
        </button>

        <button
          onClick={() => onSelectView('3d')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeView === '3d'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>3D Triage Tree</span>
        </button>

        <button
          onClick={() => onSelectView('list')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeView === 'list'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <List className="w-3.5 h-3.5" />
          <span>2D Triage</span>
        </button>

        <button
          onClick={() => onSelectView('health')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeView === 'health'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Health Trends</span>
        </button>

        <button
          onClick={() => onSelectView('brief')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeView === 'brief'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Weekly Brief</span>
        </button>
      </nav>

      {/* Right Controls & Actions */}
      <div className="flex items-center gap-2.5">
        {/* AI Engine Badge */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border ${
            isGemini
              ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
              : 'bg-amber-950/70 text-amber-300 border-amber-500/40'
          }`}
          title={isGemini ? 'Gemini LLM Active' : 'Deterministic Rule-Based Synthesis Active'}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>{isGemini ? 'Gemini 1.5' : 'Rule-Engine'}</span>
        </div>

        {/* Check Now Button */}
        <button
          onClick={onCheckNow}
          disabled={isChecking}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/30 transition shadow-sm active:scale-95 disabled:opacity-50"
          title="Trigger agent polling & subtask queue processing immediately"
        >
          <Zap className={`w-3.5 h-3.5 ${isChecking ? 'animate-pulse text-amber-400' : 'text-indigo-400'}`} />
          <span>{isChecking ? 'Checking...' : 'Check Now'}</span>
        </button>

        {/* Sync Button */}
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 border border-sky-500/30 transition shadow-sm active:scale-95 disabled:opacity-50"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-sky-400' : 'text-sky-400'}`} />
          <span>{isSyncing ? 'Syncing...' : 'Sync Repo'}</span>
        </button>

        {/* Connect Repo Modal Trigger */}
        <button
          onClick={onOpenConnect}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition active:scale-95"
        >
          <PlusCircle className="w-3.5 h-3.5 text-slate-400" />
          <span>Switch Repo</span>
        </button>
      </div>
    </header>
  );
}
