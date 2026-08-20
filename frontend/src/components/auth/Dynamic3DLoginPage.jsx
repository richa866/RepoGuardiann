import React, { useState, useRef, useMemo, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { 
  Shield, 
  Sparkles, 
  Key, 
  ArrowRight, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Cpu, 
  Zap, 
  GitBranch, 
  Radio, 
  HelpCircle,
  Eye,
  EyeOff,
  Terminal,
  ExternalLink
} from 'lucide-react';
import api from '../../api';

// ─── 3D Cosmic Matrix Background Scene ────────────────────────────────────────

function CosmicNexus({ mousePos }) {
  const pointsRef = useRef();
  const torusRef = useRef();
  const innerRingRef = useRef();

  // Generate 1200 glowing cosmic particles
  const [positions, colors] = useMemo(() => {
    const count = 1200;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    const color1 = new THREE.Color('#38bdf8'); // Sky blue
    const color2 = new THREE.Color('#a855f7'); // Purple
    const color3 = new THREE.Color('#34d399'); // Emerald

    for (let i = 0; i < count; i++) {
      const radius = 10 + Math.random() * 45;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = (Math.random() - 0.5) * 25;
      pos[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

      const mixedColor = Math.random() < 0.4 ? color1 : Math.random() < 0.7 ? color2 : color3;
      col[i * 3] = mixedColor.r;
      col[i * 3 + 1] = mixedColor.g;
      col[i * 3 + 2] = mixedColor.b;
    }
    return [pos, col];
  }, []);

  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.04;
      pointsRef.current.rotation.x = mousePos.current.y * 0.15;
      pointsRef.current.rotation.z = mousePos.current.x * 0.15;
    }
    if (torusRef.current) {
      torusRef.current.rotation.x += delta * 0.15;
      torusRef.current.rotation.y += delta * 0.22;
    }
    if (innerRingRef.current) {
      innerRingRef.current.rotation.z -= delta * 0.3;
      innerRingRef.current.rotation.y += delta * 0.1;
    }
  });

  return (
    <group>
      {/* 1. Orbiting Particle Cloud */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={positions.length / 3}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={colors.length / 3}
            array={colors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.25}
          vertexColors
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* 2. Cybernetic Torus Knot Core */}
      <mesh ref={torusRef} position={[0, 0, -10]}>
        <torusKnotGeometry args={[4.5, 0.8, 120, 16, 2, 3]} />
        <meshStandardMaterial
          color="#6366f1"
          emissive="#38bdf8"
          emissiveIntensity={0.6}
          wireframe
          transparent
          opacity={0.25}
        />
      </mesh>

      {/* 3. Glowing Singularity Ring */}
      <mesh ref={innerRingRef} position={[0, 0, -10]}>
        <ringGeometry args={[6.5, 7.2, 64]} />
        <meshBasicMaterial
          color="#38bdf8"
          wireframe
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 4. Ambient & Directional Lights */}
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1.5} color="#38bdf8" />
      <pointLight position={[-10, -10, -5]} intensity={1.2} color="#a855f7" />
    </group>
  );
}

// ─── Dynamic 3D Login Page Component ──────────────────────────────────────────

export function Dynamic3DLoginPage({ onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('token'); // 'token' | 'demo'
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [oauthConfigured, setOauthConfigured] = useState(false);
  const [oauthUrl, setOauthUrl] = useState(null);

  const mousePos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    function handleMouseMove(e) {
      mousePos.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1,
      };
    }
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Check OAuth availability
  useEffect(() => {
    api.authGetOAuthUrl().then(({ data }) => {
      if (data?.configured && data?.url) {
        setOauthConfigured(true);
        setOauthUrl(data.url);
      }
    });
  }, []);

  // Handle Token Verification Login
  async function handleVerifyToken(e) {
    if (e) e.preventDefault();
    const token = tokenInput.trim();
    if (!token) {
      setErrorMsg('Please enter a valid GitHub Personal Access Token.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const { data, error } = await api.authVerifyToken(token);
    setLoading(false);

    if (error || !data?.success) {
      setErrorMsg(error || data?.message || 'Authentication failed. Please verify token permissions.');
      return;
    }

    // Save session details
    if (data.session_token) {
      localStorage.setItem('repoguardian_token', data.session_token);
    }
    if (data.user) {
      localStorage.setItem('repoguardian_user', JSON.stringify(data.user));
    }

    if (onLoginSuccess) {
      onLoginSuccess(data.user, data.session_token);
    }
  }

  // Handle 1-Click Demo Login
  async function handleDemoLogin() {
    setLoading(true);
    setErrorMsg(null);

    const { data, error } = await api.authVerifyToken('demo');
    setLoading(false);

    if (error || !data?.success) {
      setErrorMsg('Demo mode initialization failed.');
      return;
    }

    if (data.session_token) {
      localStorage.setItem('repoguardian_token', data.session_token);
    }
    if (data.user) {
      localStorage.setItem('repoguardian_user', JSON.stringify(data.user));
    }

    if (onLoginSuccess) {
      onLoginSuccess(data.user, data.session_token);
    }
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black text-white flex items-center justify-center p-4 select-none">
      
      {/* 1. Interactive 3D Cosmic Background */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 15], fov: 60 }}>
          <Suspense fallback={null}>
            <CosmicNexus mousePos={mousePos} />
          </Suspense>
        </Canvas>
      </div>

      {/* 2. Cybernetic Vignette and Grid Overlay */}
      <div className="absolute inset-0 z-1 pointer-events-none bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(0,0,0,0.85)_100%)]" />
      <div className="absolute inset-0 z-1 pointer-events-none bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

      {/* 3. Main Glassmorphic Login Card */}
      <div className="relative z-10 w-full max-w-md mx-auto p-6 sm:p-8 rounded-3xl bg-slate-950/80 border border-white/15 backdrop-blur-3xl shadow-[0_0_60px_rgba(56,189,248,0.15)] flex flex-col space-y-6 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-sky-500/10 border border-sky-400/30 text-sky-400 shadow-inner mb-1">
            <Shield className="w-7 h-7" />
          </div>
          
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-white">
              RepoGuardian
            </h1>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
              MCP 1.0
            </span>
          </div>

          <p className="text-xs text-zinc-400 font-mono max-w-xs mx-auto leading-relaxed">
            Autonomous GitHub issue & PR triage matrix with agentic tool loop and vector RAG.
          </p>
        </div>

        {/* Tab Selection: Personal Access Token vs 1-Click Demo */}
        <div className="flex items-center p-1 rounded-2xl bg-white/[0.04] border border-white/10">
          <button
            type="button"
            onClick={() => { setActiveTab('token'); setErrorMsg(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-mono transition cursor-pointer ${
              activeTab === 'token'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-400/30 font-bold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>GitHub PAT</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('demo'); setErrorMsg(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-mono transition cursor-pointer ${
              activeTab === 'demo'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-400/30 font-bold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>1-Click Demo</span>
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tab Content: Token Login */}
        {activeTab === 'token' && (
          <form onSubmit={handleVerifyToken} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-zinc-300 flex items-center justify-between">
                <span>Personal Access Token</span>
                <span className="text-[10px] text-zinc-500">scope: repo, read:org</span>
              </label>
              
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  required
                  placeholder="ghp_... or github_pat_..."
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-2xl bg-black/60 border border-white/10 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-sky-400 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-1"
                >
                  {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !tokenInput.trim()}
              className="w-full py-3 rounded-2xl text-xs font-mono font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Verifying Token & Rate Limits...</span>
                </>
              ) : (
                <>
                  <span>Sign In & Launch Matrix</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {oauthConfigured && oauthUrl && (
              <a
                href={oauthUrl}
                className="w-full py-2.5 rounded-2xl text-xs font-mono font-semibold bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 flex items-center justify-center gap-2 transition"
              >
                <span>Sign in with GitHub OAuth</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </form>
        )}

        {/* Tab Content: 1-Click Demo Login */}
        {activeTab === 'demo' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-xs font-mono text-purple-200 space-y-1.5 leading-relaxed">
              <div className="flex items-center gap-1.5 font-bold text-purple-300">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Instant Evaluation Mode</span>
              </div>
              <p className="text-[11px] text-zinc-300">
                Instantly enter as Maintainer with pre-indexed repositories (<span className="text-purple-300 font-semibold">httpie/cli</span>, <span className="text-purple-300 font-semibold">psf/black</span>, <span className="text-purple-300 font-semibold">pallets/flask</span>) and live RAG ChromaDB embeddings.
              </p>
            </div>

            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading}
              className="w-full py-3 rounded-2xl text-xs font-mono font-bold bg-purple-500 hover:bg-purple-400 text-white transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Entering Demo Environment...</span>
                </>
              ) : (
                <>
                  <span>Enter as Guest Maintainer</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}

        {/* Matrix Diagnostics & Privacy Footer */}
        <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-[10px] font-mono text-zinc-500">
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-emerald-400" />
            Tokens stored locally in session
          </span>
          <span className="flex items-center gap-1">
            <Radio className="w-3 h-3 text-sky-400" />
            5,000 req/hr SLA
          </span>
        </div>

      </div>

    </div>
  );
}
