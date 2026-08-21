import React from 'react';
import { X, Command, Keyboard, ArrowDown, ArrowUp, CornerDownLeft, Sparkles, Shield } from 'lucide-react';

export function KeyboardShortcutsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const SHORTCUTS = [
    {
      group: 'Navigation & Views',
      items: [
        { key: 'J / ↓', desc: 'Select next issue in constellation/table' },
        { key: 'K / ↑', desc: 'Select previous issue in constellation/table' },
        { key: '1', desc: 'Switch to 3D Git Constellation Tree' },
        { key: '2', desc: 'Switch to 2D Table Matrix view' },
        { key: '3', desc: 'Switch to Repo Health & Trends view' },
        { key: '4', desc: 'Switch to Weekly Briefing summary' },
      ],
    },
    {
      group: 'Triage Actions (Selected Issue)',
      items: [
        { key: 'U', desc: 'Confirm triage verdict (Thumbs Up 👍)' },
        { key: 'O', desc: 'Open Maintainer Override dialog (Thumbs Down 👎)' },
        { key: 'C', desc: 'Focus / Copy drafted response comment' },
        { key: 'Esc', desc: 'Close open modal, drawer, or search' },
      ],
    },
    {
      group: 'HUD & System',
      items: [
        { key: '?', desc: 'Toggle this keyboard shortcuts cheat sheet' },
        { key: 'R', desc: 'Refresh live data from GitHub backend' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-lg rounded-3xl bg-slate-950/95 border border-sky-500/30 p-6 space-y-5 shadow-[0_0_50px_rgba(56,189,248,0.2)] relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-slate-200 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-sky-500/20 border border-sky-400/30 text-sky-300">
            <Keyboard className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>Maintainer Keyboard Shortcuts</span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                PRO HUD
              </span>
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Speed through issue triage and analysis without lifting your hands
            </p>
          </div>
        </div>

        {/* Shortcut Groups */}
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {SHORTCUTS.map((section) => (
            <div key={section.group} className="space-y-2">
              <h3 className="text-xs font-mono font-bold text-sky-400 uppercase tracking-wider">
                {section.group}
              </h3>
              <div className="space-y-1.5">
                {section.items.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs font-mono"
                  >
                    <span className="text-slate-300">{item.desc}</span>
                    <kbd className="px-2.5 py-1 rounded-lg bg-sky-950/80 border border-sky-500/40 text-sky-300 font-bold text-[11px] shadow-sm">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-200">Esc</kbd> to close</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold transition cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
