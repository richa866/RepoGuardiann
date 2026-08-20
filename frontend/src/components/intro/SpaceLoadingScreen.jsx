import React, { useState, useEffect } from 'react';
import { BlackHoleMergerScene } from './BlackHoleMergerScene';
import { Sparkles, Terminal, Shield, Cpu, GitBranch, Radio, ArrowRight } from 'lucide-react';

const LOG_STEPS = [
  { pct: 15, msg: 'INITIALIZING BINARY EVENT HORIZON...', icon: Radio },
  { pct: 35, msg: 'ORBITAL DECAY: INGESTING REPOSITORY TOPOLOGY...', icon: GitBranch },
  { pct: 60, msg: 'GRAVITATIONAL WAVEFORM: VECTORIZING CHROMA RAG...', icon: Cpu },
  { pct: 85, msg: 'COALESCENCE: COMPUTING AGENTIC REASONING MATRIX...', icon: Terminal },
  { pct: 100, msg: 'SINGULARITY ACHIEVED: TOPOLOGY SYNCHRONIZED.', icon: Sparkles },
];

export function SpaceLoadingScreen({ activeRepo = 'fastapi/typer', onFinish }) {
  const [progress, setProgress] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            if (onFinish) onFinish();
          }, 600);
          return 100;
        }
        const increment = prev < 40 ? 1.8 : prev < 75 ? 2.6 : 3.8;
        const next = Math.min(100, prev + increment);

        for (let i = LOG_STEPS.length - 1; i >= 0; i--) {
          if (next >= LOG_STEPS[i].pct) {
            setCurrentStepIndex(i);
            break;
          }
        }
        return next;
      });
    }, 60);

    return () => clearInterval(interval);
  }, [onFinish]);

  const CurrentIcon = LOG_STEPS[currentStepIndex].icon;

  const chirpFreq = (45 + (progress / 100) * 850).toFixed(0);
  const orbitalVelocity = (0.12 + (progress / 100) * 0.76).toFixed(2);

  // Dynamic gradient glow based on progress
  const progressColor = progress < 45 ? '#2dd4bf' : progress < 80 ? '#c084fc' : '#fbbf24';

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between p-4 sm:p-6 bg-black text-white overflow-hidden select-none">
      {/* 1. 3D Binary Black Hole Merger WebGL Scene with Dynamic Color Sky */}
      <BlackHoleMergerScene progress={progress} />

      {/* 2. Top HUD Header */}
      <header className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white">
            <Radio className="w-4 h-4 animate-pulse text-white" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-bold tracking-widest font-mono uppercase text-white">
              RepoGuardian // Singularity Engine
            </h1>
            <p className="text-[10px] text-zinc-400 font-mono flex items-center gap-1.5 mt-0.5">
              <span>GRAVITATIONAL EVENT GW-260820</span>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-300">TARGET: {activeRepo}</span>
            </p>
          </div>
        </div>

        {/* Skip Button */}
        <button
          onClick={onFinish}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-mono text-zinc-300 hover:text-white bg-white/10 hover:bg-white/20 border border-white/15 transition backdrop-blur-2xl"
        >
          <span>Skip</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </header>

      {/* 3. Center Minimalist Telemetry Gauges */}
      <div className="relative z-10 grid grid-cols-3 gap-2 sm:gap-3 max-w-xl mx-auto w-full">
        <div className="p-3 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-2xl text-center space-y-0.5">
          <span className="text-[10px] uppercase font-mono text-zinc-400 block">Chirp Frequency</span>
          <span className="text-sm sm:text-base font-bold font-mono text-white">{chirpFreq} Hz</span>
        </div>

        <div className="p-3 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-2xl text-center space-y-0.5">
          <span className="text-[10px] uppercase font-mono text-zinc-400 block">Orbital Velocity</span>
          <span className="text-sm sm:text-base font-bold font-mono text-white">{orbitalVelocity} c</span>
        </div>

        <div className="p-3 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-2xl text-center space-y-0.5">
          <span className="text-[10px] uppercase font-mono text-zinc-400 block">Coalescence</span>
          <span className="text-sm sm:text-base font-bold font-mono text-white">{Math.round(progress)}%</span>
        </div>
      </div>

      {/* 4. Bottom Progress Bar & Step Log */}
      <footer className="relative z-10 max-w-xl mx-auto w-full space-y-3">
        <div className="p-4 sm:p-5 rounded-3xl bg-black/75 border border-white/10 backdrop-blur-3xl space-y-3 shadow-2xl">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="flex items-center gap-2 text-white font-medium truncate">
              <CurrentIcon className="w-3.5 h-3.5 text-zinc-300 animate-spin" />
              <span className="truncate">{LOG_STEPS[currentStepIndex].msg}</span>
            </span>
            <span className="font-bold text-white font-mono ml-2 shrink-0">{Math.round(progress)}%</span>
          </div>

          {/* Progress Bar with Dynamic Color Glow */}
          <div className="w-full bg-white/10 border border-white/10 rounded-full h-1.5 overflow-hidden p-0">
            <div
              className="h-full rounded-full transition-all duration-150"
              style={{
                width: `${progress}%`,
                backgroundColor: progressColor,
                boxShadow: `0 0 16px ${progressColor}`,
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
            <span>CHROMA VECTOR EMBEDDINGS</span>
            <span>AUTONOMOUS SCHEDULER ACTIVE</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
