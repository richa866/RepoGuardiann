import React, { useState, useEffect } from 'react';
import { 
  Terminal, 
  RefreshCw, 
  X, 
  Play, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ChevronRight,
  Sparkles,
  Activity,
  Layers,
  Zap,
  Filter
} from 'lucide-react';

export function MonitorPanel({ monitorStatus, onTriggerCheck, isChecking }) {
  const [isOpen, setIsOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' | 'logs'

  const schedulerRunning = monitorStatus?.scheduler_running;
  const recentSubtasks = monitorStatus?.recent_subtasks || [];
  const recentLogs = monitorStatus?.recent_log || [];
  const pendingCount = monitorStatus?.pending_subtasks || 0;
  const doneCount = recentSubtasks.filter(t => t.status === 'done').length;
  const runningCount = recentSubtasks.filter(t => t.status === 'running').length;

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const filteredSubtasks = recentSubtasks.filter((t) => {
    if (statusFilter === 'all') return true;
    return t.status === statusFilter;
  });

  return (
    <>
      {/* 1. Sleek Floating Telemetry Pill (Top-Left) */}
      <div className="fixed top-18 left-4 z-40 flex items-center gap-1.5 p-1 rounded-full bg-slate-950/85 border border-white/10 shadow-2xl backdrop-blur-2xl">
        <button
          onClick={() => setIsOpen(true)}
          className="group flex items-center gap-2 px-3.5 py-1.5 rounded-full hover:bg-white/5 transition text-xs font-mono"
        >
          <span className="relative flex items-center justify-center w-2.5 h-2.5">
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${schedulerRunning ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${schedulerRunning ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </span>

          <span className="text-slate-200 font-semibold group-hover:text-sky-300 transition-colors">
            Agent Loop
          </span>

          <span className="text-slate-600">•</span>

          <span className="text-sky-400 font-bold">
            {pendingCount > 0 ? `${pendingCount} queued` : 'Active'}
          </span>

          <span className="text-[10px] text-slate-500 uppercase px-1.5 py-0.2 rounded bg-white/5 border border-white/5 ml-1">
            Expand Table ↗
          </span>
        </button>

        <button
          onClick={onTriggerCheck}
          disabled={isChecking}
          title="Drain queue & check now"
          className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-sky-300 transition mr-0.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-sky-400' : ''}`} />
        </button>
      </div>

      {/* 2. Full-Featured Centered Telemetry Matrix Table Modal */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-xl animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-5xl max-h-[85vh] rounded-3xl bg-slate-950/95 border border-sky-500/30 shadow-[0_0_80px_rgba(56,189,248,0.2)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-sky-950/80 border border-sky-500/40 text-sky-400">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold font-mono text-slate-100">
                      Autonomous Subtask Execution Matrix
                    </h2>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live Poller Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Continuous subtask scheduler, duplicate clustering & LLM escalation queue
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onTriggerCheck}
                  disabled={isChecking}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold text-sky-300 bg-sky-950/80 hover:bg-sky-900/80 border border-sky-500/40 transition shadow-sm"
                >
                  <Zap className={`w-3.5 h-3.5 ${isChecking ? 'animate-bounce' : 'text-sky-400'}`} />
                  <span>{isChecking ? 'Draining...' : 'Force Drain Queue'}</span>
                </button>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Stat Gauges */}
            <div className="grid grid-cols-4 gap-3 px-6 py-3.5 border-b border-white/5 bg-slate-900/30 text-xs font-mono">
              <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 flex items-center justify-between">
                <span className="text-slate-400">Polling Cadence</span>
                <span className="font-bold text-sky-300">{monitorStatus?.poll_interval_seconds || 300}s</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 flex items-center justify-between">
                <span className="text-slate-400">Queued Tasks</span>
                <span className="font-bold text-amber-300">{pendingCount}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 flex items-center justify-between">
                <span className="text-slate-400">Completed (Session)</span>
                <span className="font-bold text-emerald-300">{doneCount}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 flex items-center justify-between">
                <span className="text-slate-400">Active Workers</span>
                <span className="font-bold text-purple-300">{runningCount > 0 ? `${runningCount} busy` : 'Idle'}</span>
              </div>
            </div>

            {/* Filter Tabs & View Controls */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-slate-950/40">
              {/* Tab Switcher */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('tasks')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition ${
                    activeTab === 'tasks'
                      ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Subtask Queue ({recentSubtasks.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('logs')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition ${
                    activeTab === 'logs'
                      ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Scheduler Events ({recentLogs.length})</span>
                </button>
              </div>

              {/* Status Filter Pills */}
              {activeTab === 'tasks' && (
                <div className="flex items-center gap-1">
                  {['all', 'done', 'running', 'pending'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`text-[11px] font-mono uppercase px-2.5 py-1 rounded-lg transition ${
                        statusFilter === st
                          ? 'bg-white/15 text-white font-bold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Main Table Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'tasks' ? (
                filteredSubtasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-500 font-mono text-xs">
                    <Terminal className="w-8 h-8 text-slate-600 mb-2" />
                    <span>No subtasks match the selected status filter</span>
                  </div>
                ) : (
                  <table className="w-full text-left font-mono text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400 uppercase text-[10px] tracking-wider">
                        <th className="pb-3 pl-2">ID</th>
                        <th className="pb-3">Subtask Type</th>
                        <th className="pb-3">Target Issue</th>
                        <th className="pb-3">Execution Status</th>
                        <th className="pb-3">Latest Output / Telemetry</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredSubtasks.map((task) => (
                        <tr key={task.id} className="hover:bg-white/5 transition group">
                          <td className="py-3 pl-2 text-slate-400">#{task.id}</td>
                          <td className="py-3">
                            <span className="font-semibold text-slate-200">
                              {task.task_type.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-3">
                            {task.issue_number ? (
                              <span className="px-2 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-600/30 font-bold">
                                #{task.issue_number}
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                                task.status === 'done'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                  : task.status === 'running'
                                  ? 'bg-sky-950 text-sky-300 border border-sky-500/40 animate-pulse'
                                  : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                              }`}
                            >
                              {task.status === 'done' && <CheckCircle2 className="w-3 h-3" />}
                              {task.status === 'running' && <RefreshCw className="w-3 h-3 animate-spin" />}
                              {task.status === 'pending' && <Clock className="w-3 h-3" />}
                              {task.status}
                            </span>
                          </td>
                          <td className="py-3 max-w-md">
                            <p className="text-slate-300 text-[11px] truncate bg-slate-900/60 px-2.5 py-1 rounded-lg border border-white/5">
                              {task.log ? task.log.split('\n')[0] : 'Executing payload...'}
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : (
                <div className="space-y-2">
                  {recentLogs.length === 0 ? (
                    <div className="text-center py-16 text-slate-500 font-mono text-xs">
                      No scheduler events recorded yet
                    </div>
                  ) : (
                    recentLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-2xl bg-slate-900/50 border border-white/5 flex items-center justify-between text-xs font-mono"
                      >
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-emerald-400" />
                          <span className="text-slate-200 font-semibold">{log.event}</span>
                        </div>
                        <span className="text-slate-500 text-[11px]">
                          {new Date(log.ts).toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-white/10 bg-slate-900/60 flex items-center justify-between text-xs font-mono text-slate-400">
              <span>Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-200">ESC</kbd> or click outside to close</span>
              <span>RepoGuardian v2.1 • Autonomous Loop</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
