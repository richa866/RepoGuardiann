import React from 'react';
import { 
  Sparkles, 
  ShieldAlert, 
  AlertTriangle, 
  Flame, 
  Copy, 
  HelpCircle,
  Layers
} from 'lucide-react';

export const FILTER_OPTIONS = [
  {
    id: 'all',
    label: 'All Matrix',
    icon: Sparkles,
    color: '#1b999c',
    glow: 'rgba(27, 153, 156, 0.45)',
    activeBorder: 'border-teal-400',
    activeText: 'text-teal-200',
    activeBg: 'bg-teal-950/90',
  },
  {
    id: 'security_urgent',
    label: 'Security',
    icon: ShieldAlert,
    color: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.55)',
    activeBorder: 'border-red-500',
    activeText: 'text-red-200',
    activeBg: 'bg-red-950/90',
  },
  {
    id: 'regression',
    label: 'Regressions',
    icon: AlertTriangle,
    color: '#d946ef',
    glow: 'rgba(217, 70, 239, 0.55)',
    activeBorder: 'border-purple-400',
    activeText: 'text-purple-200',
    activeBg: 'bg-purple-950/90',
  },
  {
    id: 'contentious',
    label: 'Contentious',
    icon: Flame,
    color: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.55)',
    activeBorder: 'border-amber-400',
    activeText: 'text-amber-200',
    activeBg: 'bg-amber-950/90',
  },
  {
    id: 'duplicates',
    label: 'Duplicates',
    icon: Copy,
    color: '#94a3b8',
    glow: 'rgba(148, 163, 184, 0.45)',
    activeBorder: 'border-slate-400',
    activeText: 'text-slate-200',
    activeBg: 'bg-slate-800/90',
  },
  {
    id: 'needs_info',
    label: 'Needs Info',
    icon: HelpCircle,
    color: '#06b6d4',
    glow: 'rgba(6, 182, 212, 0.55)',
    activeBorder: 'border-cyan-400',
    activeText: 'text-cyan-200',
    activeBg: 'bg-cyan-950/90',
  },
];

export function DynamicFilterRibbon({ activeFilter = 'all', onSelectFilter, countMap = {} }) {
  return (
    <aside className="fixed top-24 right-6 z-40 flex flex-col p-1.5 rounded-3xl bg-slate-950/85 border border-white/10 shadow-2xl backdrop-blur-2xl pointer-events-auto">
      {/* Header Label */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 mb-1 border-b border-white/5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
        <Layers className="w-3 h-3 text-sky-400" />
        <span>Triage Matrix</span>
      </div>

      {/* Vertical Slider Stack */}
      <div className="flex flex-col gap-1">
        {FILTER_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isActive = activeFilter === opt.id;
          const count = countMap[opt.id];

          return (
            <button
              key={opt.id}
              onClick={() => onSelectFilter(opt.id)}
              className={`group relative flex items-center justify-between gap-3 px-3 py-2 rounded-2xl text-xs font-mono transition-all duration-300 ${
                isActive
                  ? `${opt.activeBg} ${opt.activeText} border ${opt.activeBorder} shadow-lg scale-102 font-bold`
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
              style={{
                boxShadow: isActive ? `0 0 25px ${opt.glow}` : undefined,
              }}
            >
              <div className="flex items-center gap-2">
                <Icon
                  className={`w-4 h-4 transition-transform duration-300 ${
                    isActive ? 'scale-110 rotate-3' : 'opacity-70 group-hover:opacity-100'
                  }`}
                  style={{ color: opt.color }}
                />
                <span className="whitespace-nowrap font-medium">{opt.label}</span>
              </div>

              {count !== undefined && count > 0 && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full transition-colors font-mono font-bold ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-white/5 text-slate-400 group-hover:text-slate-200'
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
