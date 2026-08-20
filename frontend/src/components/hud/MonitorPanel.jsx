import React, { useState } from 'react';
import { 
  Radio, 
  ChevronRight, 
  ChevronDown, 
  Activity, 
  RefreshCw,
  Terminal,
  X
} from 'lucide-react';

export function MonitorPanel({ monitorStatus, onTriggerCheck, isChecking }) {
  const [isOpen, setIsOpen] = useState(false);

  const schedulerRunning = monitorStatus?.scheduler_running;
  const recentSubtasks = monitorStatus?.recent_subtasks || [];
  const recentLogs = monitorStatus?.recent_log || [];
  const pendingCount = monitorStatus?.pending_subtasks || 0;

  return (
    <>
      {/* 1. Sleek Floating Telemetry Pill (Top-Left, Ultra-Compact) */}
      <div className="fixed top-18 left-4 z-40 flex items-center gap-1.5 p-1 rounded-full bg-slate-950/80 border border-white/10 shadow-xl backdrop-blur-xl">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1 rounded-full hover:bg-white/5 transition text-xs font-mono"
        >
          <span className="relative flex items-center justify-center w-2.5 h-2.5">
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${schedulerRunning ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${schedulerRunning ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </span>

          <span className="text-slate-300 font-medium">
            Agent Loop
          </span>

          <span className="text-slate-500">•</span>

          <span className="text-sky-300 font-semibold">
            {pendingCount > 0 ? `${pendingCount} queued` : 'Idle'}
          </span>

          <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-90 text-sky-400' : ''}`} />
        </button>

        <button
          onClick={onTriggerCheck}
          disabled={isChecking}
          title="Poll queue now"
          className="p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-sky-300 transition mr-0.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-sky-400' : ''}`} />
        </button>
      </div>

      {/* 2. Slide-Over Telemetry Sheet (Opens Only When Clicked) */}
      {isOpen && (
        <aside className="fixed top-28 left-4 z-40 w-84 rounded-2xl bg-slate-950/90 border border-sky-500/20 shadow-2xl backdrop-blur-2xl p-3.5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-xs font-semibold text-slate-200 font-mono uppercase tracking-wider">
                Autonomous Subtask Feed
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
            <div className="p-2 rounded-xl bg-slate-900/60 border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase block">Polling Cadence</span>
              <span className="font-bold text-sky-300">{monitorStatus?.poll_interval_seconds || 300}s</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-900/60 border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase block">Pending Tasks</span>
              <span className="font-bold text-emerald-300">{pendingCount}</span>
            </div>
          </div>

          {/* Live Subtask Stream */}
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {recentSubtasks.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-500 font-mono">
                No recent subtasks in queue
              </div>
            ) : (
              recentSubtasks.slice(0, 6).map((task) => (
                <div
                  key={task.id}
                  className="p-2 rounded-xl bg-slate-900/40 border border-white/5 flex items-start justify-between gap-2 text-xs"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-slate-200 font-medium truncate">
                        {task.task_type.replace(/_/g, ' ')}
                      </span>
                      {task.issue_number && (
                        <span className="text-[10px] font-mono px-1 rounded bg-sky-950 text-sky-300 border border-sky-600/30">
                          #{task.issue_number}
                        </span>
                      )}
                    </div>
                    {task.log && (
                      <p className="text-[10px] text-slate-400 font-mono truncate">
                        {task.log.split('\n')[0]}
                      </p>
                    )}
                  </div>

                  <span
                    className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded shrink-0 ${
                      task.status === 'done'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                        : task.status === 'running'
                        ? 'bg-sky-950 text-sky-300 border border-sky-500/30 animate-pulse'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {task.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </aside>
      )}
    </>
  );
}
