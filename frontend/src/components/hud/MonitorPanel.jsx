import React, { useState } from 'react';
import { 
  Radio, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  Activity, 
  RefreshCw,
  Terminal
} from 'lucide-react';

export function MonitorPanel({ monitorStatus, onTriggerCheck, isChecking }) {
  const [collapsed, setCollapsed] = useState(false);

  const schedulerRunning = monitorStatus?.scheduler_running;
  const recentSubtasks = (monitorStatus?.recent_subtasks || []).slice(0, 5);
  const recentLogs = (monitorStatus?.recent_log || []).slice(0, 3);
  const pendingCount = monitorStatus?.pending_subtasks || 0;

  return (
    <aside className="fixed top-20 left-3 z-20 w-80 rounded-2xl glass-panel border border-white/10 shadow-2xl backdrop-blur-xl transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-3 h-3">
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${schedulerRunning ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${schedulerRunning ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </div>
          <span className="text-xs font-semibold tracking-wide text-slate-200 uppercase font-mono">
            Agentic Monitor
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-500/30">
            Active
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onTriggerCheck}
            disabled={isChecking}
            title="Poll now"
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-sky-300 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-sky-400' : ''}`} />
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-slate-200 transition"
          >
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="p-3 space-y-3 max-h-[calc(100vh-140px)] overflow-y-auto">
          {/* Loop Info */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2 rounded-xl bg-slate-900/60 border border-white/5">
              <span className="text-[10px] text-slate-400 font-mono uppercase block">Poll Interval</span>
              <span className="text-xs font-bold text-sky-300 font-mono">
                {monitorStatus?.poll_interval_seconds || 300}s
              </span>
            </div>
            <div className="p-2 rounded-xl bg-slate-900/60 border border-white/5">
              <span className="text-[10px] text-slate-400 font-mono uppercase block">Queue Backlog</span>
              <span className="text-xs font-bold text-emerald-300 font-mono">
                {pendingCount} pending
              </span>
            </div>
          </div>

          {/* Autonomous Subtask Feed */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Terminal className="w-3 h-3 text-sky-400" />
                Autonomous Subtasks
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Live</span>
            </div>

            <div className="space-y-1.5">
              {recentSubtasks.length === 0 ? (
                <div className="text-center py-3 text-xs text-slate-500 font-mono">
                  No subtasks processed yet
                </div>
              ) : (
                recentSubtasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-2 rounded-xl bg-slate-950/70 border border-white/5 flex items-start justify-between gap-2 text-xs hover:border-sky-500/20 transition"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-slate-200 font-medium">
                          {task.task_type.replace('_', ' ')}
                        </span>
                        {task.issue_number && (
                          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-sky-950/80 text-sky-300 border border-sky-600/30">
                            #{task.issue_number}
                          </span>
                        )}
                      </div>
                      {task.log && (
                        <p className="text-[10px] text-slate-400 truncate font-mono">
                          {task.log.split('\n')[0]}
                        </p>
                      )}
                    </div>

                    <span
                      className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded shrink-0 ${
                        task.status === 'done'
                          ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/30'
                          : task.status === 'running'
                          ? 'bg-sky-950/70 text-sky-300 border border-sky-500/30 animate-pulse'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {task.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* System Events */}
          {recentLogs.length > 0 && (
            <div>
              <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5 mb-1.5">
                <Activity className="w-3 h-3 text-emerald-400" />
                Scheduler Events
              </span>
              <div className="space-y-1">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="text-[10px] font-mono p-1.5 rounded-lg bg-slate-900/40 border border-white/5 flex items-center justify-between text-slate-400"
                  >
                    <span className="text-slate-300">{log.event}</span>
                    <span className="text-slate-500">{new Date(log.ts).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
