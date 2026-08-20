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
    activeBg: 'from-teal-500/30 to-emerald-500/30 text-teal-200 border-teal-400/50 shadow-teal-500/30',
    dotColor: '#2dd4bf',
  },
  {
    id: 'security_urgent',
    label: 'Security',
    icon: ShieldAlert,
    color: '#ef4444',
    activeBg: 'from-red-600/30 to-rose-600/30 text-red-200 border-red-500/50 shadow-red-500/30',
    dotColor: '#ef4444',
  },
  {
    id: 'regression',
    label: 'Regressions',
    icon: AlertTriangle,
    color: '#d946ef',
    activeBg: 'from-purple-600/30 to-fuchsia-600/30 text-purple-200 border-purple-400/50 shadow-purple-500/30',
    dotColor: '#d946ef',
  },
  {
    id: 'contentious',
    label: 'Contentious',
    icon: Flame,
    color: '#f59e0b',
    activeBg: 'from-amber-600/30 to-yellow-600/30 text-amber-200 border-amber-400/50 shadow-amber-500/30',
    dotColor: '#f59e0b',
  },
  {
    id: 'duplicates',
    label: 'Duplicates',
    icon: Copy,
    color: '#64748b',
    activeBg: 'from-slate-700/40 to-slate-800/40 text-slate-200 border-slate-500/50 shadow-slate-500/20',
    dotColor: '#94a3b8',
  },
  {
    id: 'needs_info',
    label: 'Needs Info',
    icon: HelpCircle,
    color: '#06b6d4',
    activeBg: 'from-cyan-600/30 to-teal-600/30 text-cyan-200 border-cyan-400/50 shadow-cyan-500/30',
    dotColor: '#06b6d4',
  },
];

export function DynamicFilterRibbon({ activeFilter = 'all', onSelectFilter, countMap = {} }) {
  return (
    <div className="fixed top-18 right-4 z-40 flex items-center p-1 rounded-full bg-slate-950/80 border border-white/10 shadow-2xl backdrop-blur-2xl pointer-events-auto">
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
                  ? `bg-gradient-to-r ${opt.activeBg} border shadow-lg scale-105 font-bold`
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Icon
                className={`w-3.5 h-3.5 transition-transform duration-300 ${
                  isActive ? 'scale-110 rotate-3' : 'opacity-70'
                }`}
                style={{ color: opt.color }}
              />

              <span>{opt.label}</span>

              {count !== undefined && count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white'
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
    </div>
  );
}
