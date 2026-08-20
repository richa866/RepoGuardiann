import React, { useState, useEffect } from 'react';
import { BlackHoleMergerScene } from './BlackHoleMergerScene';
import { Sparkles, Terminal, Shield, Cpu, GitBranch, Radio, ArrowRight } from 'lucide-react';

const LOG_STEPS = [
  { pct: 15, msg: 'INITIALIZING BINARY EVENT HORIZON...', icon: Radio },
  { pct: 35, msg: 'ORBITAL DECAY: INGESTING GITHUB REPOSITORY TOPOLOGY...', icon: GitBranch },
  { pct: 60, msg: 'CHIRPING GRAVITATIONAL WAVES: VECTORIZING VIA CHROMA RAG...', icon: Cpu },
  { pct: 85, msg: 'COALESCENCE IMMINENT: COMPUTING AGENTIC REASONING MATRIX...', icon: Terminal },
  { pct: 100, msg: 'SINGULARITY ACHIEVED: TOPOLOGY SYNCHRONIZED.', icon: Sparkles },
];

export function SpaceLoadingScreen({ activeRepo = 'demo/repoguardian-seed', onFinish }) {
  const [progress, setProgress] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            if (onFinish) onFinish();
          }, 800);
          return 100;
        }
        // Smooth non-linear progress
        const increment = prev < 50 ? 2.5 : prev < 85 ? 3.5 : 5.0;
        const next = Math.min(100, prev + increment);

        for (let i = LOG_STEPS.length - 1; i >= 0; i--) {
          if (next >= LOG_STEPS[i].pct) {
            setCurrentStepIndex(i);
            break;
          }
        }
        return next;
      });
    }, 90);

    return () => clearInterval(interval);
  }, [onFinish]);

  const CurrentIcon = LOG_STEPS[currentStepIndex].icon;

  // Calculate live relativistic metrics
  const chirpFreq = (45 + (progress / 100) * 850).toFixed(0);
  const strainAmplitude = (1.2 * Math.pow(10, -21) * (1 + (progress / 100) * 8)).toExponential(2);
  const orbitalVelocity = (0.12 + (progress / 100) * 0.76).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between p-6 bg-[#03050c] text-slate-100 overflow-hidden select-none">
      {/* 1. 3D Binary Black Hole Merger WebGL Scene */}
      <BlackHoleMergerScene progress={progress} />

      {/* 2. Top HUD Header */}
      <header className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
            <Radio className="w-4 h-4 animate-spin" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-widest font-mono uppercase bg-gradient-to-r from-cyan-300 via-sky-200 to-indigo-300 bg-clip-text text-transparent">
              RepoGuardian // Singularity Engine
            </h1>
            <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
              <span>GRAVITATIONAL WAVE EVENT GW-260820</span>
              <span className="text-slate-600">•</span>
              <span className="text-cyan-400">STATUS: MERGING TOPOLOGY</span>
            </p>
          </div>
        </div>

        {/* Skip Button */}
        <button
          onClick={onFinish}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono text-slate-400 hover:text-cyan-300 bg-slate-900/60 hover:bg-slate-900/90 border border-white/10 transition backdrop-blur-md"
        >
          <span>Skip Simulation</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </header>

      {/* 3. Center Telemetry Gauges */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto w-full">
        <div className="p-2.5 rounded-xl glass-panel border border-cyan-500/20 backdrop-blur-xl text-center space-y-0.5">
          <span className="text-[9px] uppercase font-mono text-slate-400 block">Chirp Frequency</span>
          <span className="text-sm font-bold font-mono text-cyan-300">{chirpFreq} Hz</span>
        </div>

        <div className="p-2.5 rounded-xl glass-panel border border-cyan-500/20 backdrop-blur-xl text-center space-y-0.5">
          <span className="text-[9px] uppercase font-mono text-slate-400 block">Strain Amplitude (h)</span>
          <span className="text-sm font-bold font-mono text-amber-300">{strainAmplitude}</span>
        </div>

        <div className="p-2.5 rounded-xl glass-panel border border-cyan-500/20 backdrop-blur-xl text-center space-y-0.5">
          <span className="text-[9px] uppercase font-mono text-slate-400 block">Orbital Velocity</span>
          <span className="text-sm font-bold font-mono text-purple-300">{orbitalVelocity} c</span>
        </div>

        <div className="p-2.5 rounded-xl glass-panel border border-cyan-500/20 backdrop-blur-xl text-center space-y-0.5">
          <span className="text-[9px] uppercase font-mono text-slate-400 block">Target Repo</span>
          <span className="text-sm font-bold font-mono text-emerald-300 truncate block px-1">
            {activeRepo}
          </span>
        </div>
      </div>

      {/* 4. Bottom Progress Bar & Step Log */}
      <footer className="relative z-10 max-w-xl mx-auto w-full space-y-3">
        <div className="p-4 rounded-2xl glass-panel-glow border border-cyan-500/30 backdrop-blur-2xl space-y-2.5 shadow-2xl">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="flex items-center gap-2 text-cyan-300 font-semibold truncate">
              <CurrentIcon className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              <span>{LOG_STEPS[currentStepIndex].msg}</span>
            </span>
            <span className="font-bold text-cyan-400 ml-2">{Math.round(progress)}%</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-950/80 border border-white/10 rounded-full h-2 overflow-hidden p-0.5 shadow-inner">
            <div
              className="bg-gradient-to-r from-cyan-500 via-sky-400 to-indigo-500 h-full rounded-full transition-all duration-100 shadow-sm shadow-cyan-400/50"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>CHROMA VECTOR MATRIX: ALL-MINILM-L6-V2</span>
            <span>SUBTASK ENGINE ARMED</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
