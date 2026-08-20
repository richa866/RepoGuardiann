import React from 'react';
import { 
  Sparkles, 
  ShieldAlert, 
  AlertTriangle, 
  Flame, 
  Copy, 
  HelpCircle,
} from 'lucide-react';

export const FILTER_OPTIONS = [
  {
    id: 'all',
    label: 'All Matrix',
    icon: Sparkles,
    color: '#1b999c',
    glow: 'rgba(27, 153, 156, 0.4)',
    activeBorder: 'border-teal-400',
    activeText: 'text-teal-200',
    activeBg: 'bg-teal-950/80',
  },
  {
    id: 'security_urgent',
    label: 'Security & Urgent',
    icon: ShieldAlert,
    color: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.5)',
    activeBorder: 'border-red-500',
    activeText: 'text-red-200',
    activeBg: 'bg-red-950/90',
  },
  {
    id: 'regression',
    label: 'Regressions',
    icon: AlertTriangle,
    color: '#d946ef',
    glow: 'rgba(217, 70, 239, 0.5)',
    activeBorder: 'border-purple-400',
    activeText: 'text-purple-200',
    activeBg: 'bg-purple-950/90',
  },
  {
    id: 'contentious',
    label: 'Contentious',
    icon: Flame,
    color: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.5)',
    activeBorder: 'border-amber-400',
    activeText: 'text-amber-200',
    activeBg: 'bg-amber-950/90',
  },
  {
    id: 'duplicates',
    label: 'Duplicates',
    icon: Copy,
    color: '#94a3b8',
    glow: 'rgba(148, 163, 184, 0.4)',
    activeBorder: 'border-slate-400',
    activeText: 'text-slate-200',
    activeBg: 'bg-slate-800/90',
  },
  {
    id: 'needs_info',
    label: 'Needs Info',
    icon: HelpCircle,
    color: '#06b6d4',
    glow: 'rgba(6, 182, 212, 0.5)',
    activeBorder: 'border-cyan-400',
    activeText: 'text-cyan-200',
    activeBg: 'bg-cyan-950/90',
  },
];

export function DynamicFilterRibbon({ activeFilter = 'all', onSelectFilter, countMap = {} }) {
  const activeOpt = FILTER_OPTIONS.find((o) => o.id === activeFilter) || FILTER_OPTIONS[0];

  return (
    <aside className="fixed top-20 right-6 z-40 flex items-center p-1 rounded-full bg-slate-950/85 border border-white/10 shadow-2xl backdrop-blur-2xl pointer-events-auto">
      <div className="flex items-center gap-1 relative">
        {FILTER_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isActive = activeFilter === opt.id;
          const count = countMap[opt.id];

          return (
            <button
              key={opt.id}
              onClick={() => onSelectFilter(opt.id)}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono transition-all duration-300 ${
                isActive
                  ? `${opt.activeBg} ${opt.activeText} border ${opt.activeBorder} shadow-lg scale-105 font-bold`
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
              style={{
                boxShadow: isActive ? `0 0 20px ${opt.glow}` : undefined,
              }}
            >
              <Icon
                className={`w-3.5 h-3.5 transition-transform duration-300 ${
                  isActive ? 'scale-110 rotate-3' : 'opacity-70'
                }`}
                style={{ color: opt.color }}
              />

              <span className="whitespace-nowrap">{opt.label}</span>

              {count !== undefined && count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full transition-colors font-mono ${
                    isActive
                      ? 'bg-white/20 text-white font-bold'
                      : 'bg-white/5 text-slate-400'
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
