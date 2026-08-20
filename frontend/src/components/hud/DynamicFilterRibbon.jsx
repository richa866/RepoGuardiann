import React, { useState } from 'react';
import { 
  Sparkles, 
  ShieldAlert, 
  AlertTriangle, 
  Flame, 
  Copy, 
  HelpCircle,
  Layers,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';

export const FILTER_OPTIONS = [
  {
    id: 'all',
    label: 'All Matrix',
    icon: Sparkles,
    color: '#38bdf8',
    dotColor: 'bg-sky-400',
  },
  {
    id: 'security_urgent',
    label: 'Security',
    icon: ShieldAlert,
    color: '#f43f5e',
    dotColor: 'bg-rose-500',
  },
  {
    id: 'regression',
    label: 'Regressions',
    icon: AlertTriangle,
    color: '#c084fc',
    dotColor: 'bg-purple-400',
  },
  {
    id: 'contentious',
    label: 'Contentious',
    icon: Flame,
    color: '#fbbf24',
    dotColor: 'bg-amber-400',
  },
  {
    id: 'duplicates',
    label: 'Duplicates',
    icon: Copy,
    color: '#94a3b8',
    dotColor: 'bg-slate-400',
  },
  {
    id: 'needs_info',
    label: 'Needs Info',
    icon: HelpCircle,
    color: '#2dd4bf',
    dotColor: 'bg-teal-400',
  },
];

export function DynamicFilterRibbon({ activeFilter = 'all', onSelectFilter, countMap = {} }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className="fixed top-20 sm:top-24 right-3 sm:right-6 z-40 flex flex-col p-1.5 sm:p-2 rounded-3xl bg-black/50 border border-white/10 shadow-2xl backdrop-blur-3xl pointer-events-auto transition-all max-h-[calc(100vh-140px)]">
      {/* Header Label / Collapse Toggle */}
      <div className="flex items-center justify-between px-2 sm:px-3 py-1 mb-1 border-b border-white/[0.08] text-[10px] font-mono uppercase tracking-widest text-zinc-400">
        {!collapsed && (
          <span className="flex items-center gap-1.5 font-bold">
            <Layers className="w-3 h-3 text-zinc-300" />
            <span className="hidden sm:inline">Filter Matrix</span>
            <span className="sm:hidden">Filters</span>
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition ml-auto"
          title={collapsed ? "Expand Filters" : "Collapse Filters"}
        >
          {collapsed ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Vertical Slider Stack */}
      <div className="flex flex-col gap-1 overflow-y-auto max-h-[60vh] pr-0.5">
        {FILTER_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isActive = activeFilter === opt.id;
          const count = countMap[opt.id];

          return (
            <button
              key={opt.id}
              onClick={() => onSelectFilter(opt.id)}
              title={opt.label}
              className={`group relative flex items-center justify-between gap-2.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-2xl text-xs font-mono transition-all duration-200 ${
                isActive
                  ? 'bg-white text-black font-bold shadow-lg scale-[1.02]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.06] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 transition-all ${
                    isActive ? 'bg-black scale-125' : opt.dotColor
                  }`}
                />
                {!collapsed && (
                  <span className="whitespace-nowrap tracking-tight">{opt.label}</span>
                )}
              </div>

              {!collapsed && count !== undefined && count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono transition-colors ml-1 ${
                    isActive
                      ? 'bg-black/15 text-black font-bold'
                      : 'bg-white/[0.06] text-zinc-400 group-hover:text-zinc-200'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
