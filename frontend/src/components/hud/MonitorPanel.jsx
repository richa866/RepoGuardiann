import React, { useState, useEffect } from 'react';
import { 
  Terminal, 
  RefreshCw, 
  X, 
  CheckCircle2, 
  Clock, 
  Zap, 
  Layers, 
  Activity 
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
      {/* 1. Minimalist Floating Telemetry Pill (Top-Left) */}
      <aside className="fixed top-20 sm:top-24 left-3 sm:left-6 z-40 flex items-center gap-1.5 p-1 sm:p-1.5 rounded-full bg-black/50 border border-white/10 shadow-2xl backdrop-blur-3xl pointer-events-auto">
        <button
          onClick={() => setIsOpen(true)}
          className="group flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full hover:bg-white/[0.06] transition text-xs font-mono"
        >
          <span className="relative flex items-center justify-center w-2 h-2">
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${schedulerRunning ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${schedulerRunning ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </span>

          <span className="text-zinc-200 font-semibold group-hover:text-white transition-colors">
            Agent Loop
          </span>

          <span className="text-zinc-600 hidden xs:inline">•</span>

          <span className="text-white font-mono hidden xs:inline">
            {pendingCount > 0 ? `${pendingCount} queued` : 'Active'}
          </span>

          <span className="text-[10px] text-zinc-400 uppercase px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 ml-0.5 hidden sm:inline">
            Table ↗
          </span>
        </button>

        <button
          onClick={onTriggerCheck}
          disabled={isChecking}
          title="Drain queue & check now"
          className="p-1 sm:p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition mr-0.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-white' : ''}`} />
        </button>
      </aside>

      {/* 2. Full-Featured Centered Telemetry Matrix Table Modal */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-2xl animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-5xl max-h-[88vh] rounded-3xl bg-black/90 border border-white/15 shadow-[0_0_90px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/[0.08] bg-white/[0.02]">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-white/[0.06] border border-white/10 text-white shrink-0">
                  <Terminal className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xs sm:text-sm font-bold font-mono tracking-tight text-white uppercase truncate">
                      Subtask Execution Matrix
                    </h2>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/10 text-zinc-200 border border-white/15 flex items-center gap-1.5 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Active
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-zinc-400 font-mono mt-0.5 truncate hidden xs:block">
                    Continuous autonomous poller, duplicate detection & LLM escalation queue
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={onTriggerCheck}
                  disabled={isChecking}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-full text-xs font-mono font-semibold text-black bg-white hover:bg-zinc-200 transition shadow-sm"
                >
                  <Zap className={`w-3.5 h-3.5 ${isChecking ? 'animate-bounce' : 'text-black'}`} />
                  <span className="hidden sm:inline">{isChecking ? 'Draining...' : 'Force Drain'}</span>
                </button>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Stat Gauges (Responsive 2x2 on Mobile, 4-col on Desktop) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-3.5 border-b border-white/[0.06] bg-white/[0.01] text-xs font-mono">
              <div className="p-2.5 sm:p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
                <span className="text-zinc-400 text-[11px]">Polling Cadence</span>
                <span className="font-bold text-white">{monitorStatus?.poll_interval_seconds || 300}s</span>
              </div>
              <div className="p-2.5 sm:p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
                <span className="text-zinc-400 text-[11px]">Queued Tasks</span>
                <span className="font-bold text-white">{pendingCount}</span>
              </div>
              <div className="p-2.5 sm:p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
                <span className="text-zinc-400 text-[11px]">Completed</span>
                <span className="font-bold text-white">{doneCount}</span>
              </div>
              <div className="p-2.5 sm:p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
                <span className="text-zinc-400 text-[11px]">Workers</span>
                <span className="font-bold text-white">{runningCount > 0 ? `${runningCount} active` : 'Idle'}</span>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3 border-b border-white/[0.06] bg-white/[0.01] flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('tasks')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono transition ${
                    activeTab === 'tasks'
                      ? 'bg-white text-black font-bold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>Tasks ({recentSubtasks.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('logs')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono transition ${
                    activeTab === 'logs'
                      ? 'bg-white text-black font-bold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Activity className="w-3 h-3" />
                  <span>Events ({recentLogs.length})</span>
                </button>
              </div>

              {activeTab === 'tasks' && (
                <div className="flex items-center gap-1 overflow-x-auto">
                  {['all', 'done', 'running', 'pending'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`text-[10px] sm:text-[11px] font-mono uppercase px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full transition ${
                        statusFilter === st
                          ? 'bg-white/15 text-white font-bold border border-white/20'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Main Table */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {activeTab === 'tasks' ? (
                filteredSubtasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-zinc-500 font-mono text-xs">
                    <Terminal className="w-6 h-6 text-zinc-600 mb-2" />
                    <span>No subtasks found in this filter</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs border-collapse min-w-[540px]">
                      <thead>
                        <tr className="border-b border-white/10 text-zinc-400 uppercase text-[10px] tracking-wider">
                          <th className="pb-3 pl-2">ID</th>
                          <th className="pb-3">Task Type</th>
                          <th className="pb-3">Target</th>
                          <th className="pb-3">Status</th>
                          <th className="pb-3">Telemetry / Output</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {filteredSubtasks.map((task) => (
                          <tr key={task.id} className="hover:bg-white/[0.02] transition group">
                            <td className="py-3 pl-2 text-zinc-500">#{task.id}</td>
                            <td className="py-3">
                              <span className="font-medium text-white">
                                {task.task_type.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="py-3">
                              {task.issue_number ? (
                                <span className="px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/15 font-mono text-[11px]">
                                  #{task.issue_number}
                                </span>
                              ) : (
                                <span className="text-zinc-600">—</span>
                              )}
                            </td>
                            <td className="py-3">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] uppercase font-mono font-bold ${
                                  task.status === 'done'
                                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                                    : task.status === 'running'
                                    ? 'bg-sky-950/60 text-sky-300 border border-sky-500/30 animate-pulse'
                                    : 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    task.status === 'done'
                                      ? 'bg-emerald-400'
                                      : task.status === 'running'
                                      ? 'bg-sky-400'
                                      : 'bg-amber-400'
                                  }`}
                                />
                                {task.status}
                              </span>
                            </td>
                            <td className="py-3 max-w-xs sm:max-w-md">
                              <p className="text-zinc-300 text-[11px] truncate bg-white/[0.03] px-2.5 py-1 rounded-lg border border-white/[0.06]">
                                {task.log ? task.log.split('\n')[0] : 'Executing payload...'}
                              </p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                <div className="space-y-1.5">
                  {recentLogs.length === 0 ? (
                    <div className="text-center py-16 text-zinc-500 font-mono text-xs">
                      No scheduler events recorded
                    </div>
                  ) : (
                    recentLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-xs font-mono"
                      >
                        <div className="flex items-center gap-2">
                          <Activity className="w-3.5 h-3.5 text-zinc-400" />
                          <span className="text-white font-medium">{log.event}</span>
                        </div>
                        <span className="text-zinc-500 text-[11px]">
                          {new Date(log.ts).toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 sm:px-6 py-3 sm:py-3.5 border-t border-white/[0.08] bg-white/[0.02] flex items-center justify-between text-xs font-mono text-zinc-400">
              <span>Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white">ESC</kbd> to close</span>
              <span>RepoGuardian v2.1</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
