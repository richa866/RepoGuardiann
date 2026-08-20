import React from 'react';
import { Compass } from 'lucide-react';

const RADAR_CLUSTERS = [
  { id: 'security_urgent', name: 'Security', color: '#f43f5e', x: 0, y: -0.6 },
  { id: 'regression', name: 'Regression', color: '#c084fc', x: -0.65, y: -0.25 },
  { id: 'contentious', name: 'Contentious', color: '#fbbf24', x: 0.65, y: -0.2 },
  { id: 'duplicates', name: 'Duplicates', color: '#94a3b8', x: 0.55, y: 0.55 },
  { id: 'needs_info', name: 'Needs Info', color: '#2dd4bf', x: -0.55, y: 0.55 },
  { id: 'normal', name: 'Backlog', color: '#10b981', x: 0, y: 0.2 },
];

export function MinimapRadar({ activeFilter = 'all', onSelectFilter, className = '' }) {
  return (
    <div className={`pointer-events-auto select-none ${className}`}>
      <div className="group relative w-24 h-24 rounded-full bg-black/60 hover:bg-black/85 border border-white/10 hover:border-white/25 backdrop-blur-2xl shadow-2xl p-2 flex items-center justify-center transition-all duration-200">
        {/* Radar Rings */}
        <div className="absolute inset-2 rounded-full border border-white/5 pointer-events-none" />
        <div className="absolute inset-5 rounded-full border border-white/10 pointer-events-none" />
        <div className="absolute inset-0 rounded-full border border-sky-400/10 animate-ping opacity-20 pointer-events-none" />

        {/* Crosshairs */}
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/5 pointer-events-none" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/5 pointer-events-none" />

        {/* Center Origin Dot */}
        <div className="absolute w-1.5 h-1.5 rounded-full bg-white/30 pointer-events-none" />

        {/* Cluster Blips on Radar */}
        {RADAR_CLUSTERS.map((c) => {
          const isActive = activeFilter === c.id || activeFilter === 'all';
          const isSelected = activeFilter === c.id;

          // Convert normalized coords (-1..1) to percentage (0..100)
          const leftPercent = (c.x + 1) * 50;
          const topPercent = (c.y + 1) * 50;

          return (
            <button
              key={c.id}
              onClick={() => onSelectFilter(c.id === activeFilter ? 'all' : c.id)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'w-3 h-3 ring-2 ring-white scale-125 z-10'
                  : isActive
                  ? 'w-2 h-2 hover:scale-150'
                  : 'w-1.5 h-1.5 opacity-25 hover:opacity-80'
              }`}
              style={{
                left: `${leftPercent}%`,
                top: `${topPercent}%`,
                backgroundColor: c.color,
                boxShadow: isSelected ? `0 0 10px ${c.color}` : 'none',
              }}
              title={`${c.name} Hub`}
            />
          );
        })}

        {/* Top-Right Mini Compass Icon */}
        <div className="absolute top-1 right-1 pointer-events-none text-zinc-600 group-hover:text-zinc-400 transition">
          <Compass className="w-3 h-3" />
        </div>
      </div>
    </div>
  );
}
