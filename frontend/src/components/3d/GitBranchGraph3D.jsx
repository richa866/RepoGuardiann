import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { 
  GitBranch, 
  GitCommit, 
  ShieldAlert, 
  ArrowRight,
  GitMerge,
  User,
  Clock,
} from 'lucide-react';

// Structured Hierarchical Git Tree Definition
const TREE_DATA = {
  branches: [
    {
      id: 'main',
      name: 'main',
      label: 'Trunk (Production)',
      color: '#38bdf8',
      glow: '#0284c7',
      y: 0,
      z: 0,
      commits: [
        { id: 'm1', hash: '8f2a1b', msg: 'chore: initial repository setup', author: 'maintainer1', time: '5d ago', x: -10 },
        { id: 'm2', hash: '3e9c4d', msg: 'feat(core): setup SQLite & models', author: 'maintainer1', time: '4d ago', x: -6 },
        { id: 'm3', hash: '5b1a8f', msg: 'feat(rag): Chroma embeddings vector index', author: 'maintainer1', time: '3d ago', x: -2 },
        { id: 'm4', hash: '7c2e9a', msg: 'merge: feature/auth-sessions into main', author: 'maintainer1', time: '2d ago', x: 2, isMerge: true },
        { id: 'm5', hash: '9d4f1b', msg: 'feat(agent): multi-step evaluation tools', author: 'maintainer1', time: '1d ago', x: 6 },
        { id: 'm6', hash: '1a8b3c', msg: 'merge: release/v2.1 into main', author: 'maintainer1', time: '4h ago', x: 10, isMerge: true },
      ],
    },
    {
      id: 'release',
      name: 'release/v2.1',
      label: 'Release Candidate',
      color: '#10b981',
      glow: '#059669',
      y: 3.2,
      z: 1.8,
      forkFrom: { branch: 'main', commitId: 'm2' },
      mergeInto: { branch: 'main', commitId: 'm6' },
      commits: [
        { id: 'r1', hash: 'a1b2c3', msg: 'chore(release): bump version v2.1.0-rc1', author: 'maintainer1', time: '3d ago', x: -3.5 },
        { id: 'r2', hash: 'd4e5f6', msg: 'fix(engine): optimize token budget', author: 'alice', time: '2d ago', x: 0.5 },
        { id: 'r3', hash: '7g8h9i', msg: 'merge: hotfix/terminal-escape into release', author: 'maintainer1', time: '1d ago', x: 4.5, isMerge: true },
        { id: 'r4', hash: '0j1k2l', msg: 'chore(release): v2.1.0 final verification', author: 'maintainer1', time: '6h ago', x: 8 },
      ],
    },
    {
      id: 'feature-auth',
      name: 'feature/auth-sessions',
      label: 'Security & Auth Subsystem',
      color: '#a855f7',
      glow: '#7e22ce',
      y: -3.2,
      z: 1.5,
      forkFrom: { branch: 'main', commitId: 'm1' },
      mergeInto: { branch: 'main', commitId: 'm4' },
      commits: [
        { id: 'f1', hash: '99a8b7', msg: 'feat(auth): token validation middleware', author: 'bob', time: '4d ago', x: -7.5 },
        { id: 'f2', hash: '66c5d4', msg: 'test(auth): add bearer token unit tests', author: 'bob', time: '3d ago', x: -4.0 },
        { id: 'f3', hash: '33e2f1', msg: 'fix(session): sanitize plaintext credentials', author: 'carol', time: '2d ago', x: -0.5 },
      ],
    },
    {
      id: 'hotfix',
      name: 'hotfix/terminal-escape',
      label: 'Security Patch Branch',
      color: '#f43f5e',
      glow: '#e11d48',
      y: 5.4,
      z: -1.5,
      forkFrom: { branch: 'release', commitId: 'r2' },
      mergeInto: { branch: 'release', commitId: 'r3' },
      commits: [
        { id: 'h1', hash: 'ee11aa', msg: 'sec(parser): strip ANSI escape sequences', author: 'security-lead', time: '2d ago', x: 2.0 },
      ],
    },
    {
      id: 'feature-rag',
      name: 'feature/rag-pipeline',
      label: 'Knowledge Engine',
      color: '#f59e0b',
      glow: '#d97706',
      y: -5.2,
      z: -2.0,
      forkFrom: { branch: 'main', commitId: 'm3' },
      commits: [
        { id: 'rag1', hash: '44dd22', msg: 'feat(rag): chunking and cosine distance', author: 'dave', time: '2d ago', x: 1.0 },
        { id: 'rag2', hash: '77bb55', msg: 'feat(rag): maintainer resolution context', author: 'dave', time: '1d ago', x: 5.0 },
      ],
    },
  ],
};

// Smooth Camera Controller for Git Tree
function SmoothBranchCameraController({ selectedCommit, selectedBranch, isUserInteracting, controlsRef }) {
  const { camera } = useThree();
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const targetCamPos = useRef(new THREE.Vector3(0, 2, 22));
  const animating = useRef(false);
  const animationFrames = useRef(0);

  useEffect(() => {
    if (selectedCommit && selectedBranch) {
      targetLookAt.current.set(selectedCommit.x, selectedBranch.y, selectedBranch.z);
      targetCamPos.current.set(
        selectedCommit.x,
        selectedBranch.y + 0.8,
        selectedBranch.z + 8.5
      );
      animating.current = true;
      animationFrames.current = 45;
    } else {
      targetLookAt.current.set(0, 0, 0);
      targetCamPos.current.set(0, 2, 22);
      animating.current = true;
      animationFrames.current = 45;
    }
  }, [selectedCommit, selectedBranch]);

  useFrame(() => {
    if (isUserInteracting.current) {
      animating.current = false;
      return;
    }

    if (animating.current && animationFrames.current > 0) {
      if (controlsRef.current) {
        controlsRef.current.target.lerp(targetLookAt.current, 0.08);
      }
      camera.position.lerp(targetCamPos.current, 0.08);
      animationFrames.current--;
      if (animationFrames.current <= 0) {
        animating.current = false;
      }
    }
  });

  return null;
}

function CrystalCommitNode({ commit, branch, isSelected, onSelect }) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  const { scene } = useGLTF('/models/git_branch_node.glb');

  // Clone geometry and set crisp neon materials
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone();
        child.material.color = new THREE.Color(branch.color);
        if (child.material.emissive) {
          child.material.emissive = new THREE.Color(branch.glow);
          child.material.emissiveIntensity = commit.isMerge ? 3.5 : 2.2;
        }
        child.material.roughness = 0.15;
        child.material.metalness = 0.9;
      }
    });
    return c;
  }, [scene, branch, commit.isMerge]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    meshRef.current.rotation.y += 0.012;
    meshRef.current.rotation.z = Math.sin(t * 0.8 + commit.x) * 0.08;

    const targetScale = isSelected ? 1.35 : hovered ? 1.2 : 1.0;
    meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
  });

  return (
    <group
      ref={meshRef}
      position={[commit.x, branch.y, branch.z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(commit, branch);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      <primitive object={cloned} scale={0.7} />

      {/* Merge Halo Ring */}
      {commit.isMerge && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.9, 0.04, 16, 32]} />
          <meshBasicMaterial color={branch.color} transparent opacity={0.7} />
        </mesh>
      )}

      {/* Proportional 3D Transformed Billboard Commit Tag */}
      <Html
        transform
        sprite
        position={[0, 1.4, 0]}
        distanceFactor={10}
        zIndexRange={[1, 10]}
        className="pointer-events-none select-none"
      >
        <div
          className={`flex flex-col gap-0.5 px-2.5 py-1 rounded-xl text-xs font-mono backdrop-blur-xl border shadow-xl transition-all max-w-[160px] ${
            isSelected
              ? 'bg-sky-950/95 text-white border-sky-400 scale-105 shadow-sky-500/40'
              : hovered
              ? 'bg-slate-900/95 text-white border-slate-400 scale-105 shadow-black/80'
              : 'bg-slate-950/75 text-slate-300 border-white/10 opacity-85'
          }`}
        >
          <div className="flex items-center gap-1.5 font-bold">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: branch.color }} />
            <span style={{ color: branch.color }}>{commit.hash}</span>
            {commit.isMerge && (
              <span className="text-[9px] uppercase px-1 rounded bg-white/10 text-white flex items-center gap-0.5">
                <GitMerge className="w-2.5 h-2.5" /> merge
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-300 truncate">
            {commit.msg}
          </span>
        </div>
      </Html>
    </group>
  );
}

// Branch Tree Connecting Tubes & Merges
function TreeBranchConnections({ branches = [] }) {
  const commitMap = useMemo(() => {
    const map = new Map();
    branches.forEach((b) => {
      b.commits.forEach((c) => {
        map.set(c.id, { ...c, branchY: b.y, branchZ: b.z, branchColor: b.color });
      });
    });
    return map;
  }, [branches]);

  const curveData = useMemo(() => {
    const list = [];

    branches.forEach((b) => {
      // 1. Sequential commits along the same branch
      for (let i = 0; i < b.commits.length - 1; i++) {
        const p1 = new THREE.Vector3(b.commits[i].x, b.y, b.z);
        const p2 = new THREE.Vector3(b.commits[i + 1].x, b.y, b.z);
        const curve = new THREE.LineCurve3(p1, p2);
        list.push({ curve, color: b.color });
      }

      // 2. Fork Curve from parent branch
      if (b.forkFrom && b.commits.length > 0) {
        const parent = commitMap.get(b.forkFrom.commitId);
        if (parent) {
          const p1 = new THREE.Vector3(parent.x, parent.branchY, parent.branchZ);
          const p2 = new THREE.Vector3(b.commits[0].x, b.y, b.z);
          const mid = new THREE.Vector3(parent.x + 1.2, b.y * 0.6 + parent.branchY * 0.4, b.z * 0.6 + parent.branchZ * 0.4);
          const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
          list.push({ curve, color: b.color });
        }
      }

      // 3. Merge Curve back into target branch
      if (b.mergeInto && b.commits.length > 0) {
        const target = commitMap.get(b.mergeInto.commitId);
        const lastCommit = b.commits[b.commits.length - 1];
        if (target && lastCommit) {
          const p1 = new THREE.Vector3(lastCommit.x, b.y, b.z);
          const p2 = new THREE.Vector3(target.x, target.branchY, target.branchZ);
          const mid = new THREE.Vector3(lastCommit.x + 1.5, b.y * 0.4 + target.branchY * 0.6, b.z * 0.4 + target.branchZ * 0.6);
          const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
          list.push({ curve, color: b.color });
        }
      }
    });

    return list;
  }, [branches, commitMap]);

  return (
    <group>
      {curveData.map((item, idx) => (
        <mesh key={idx} geometry={new THREE.TubeGeometry(item.curve, 24, 0.05, 8, false)}>
          <meshBasicMaterial color={item.color} transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

export function GitBranchGraph3D({ activeRepo = 'demo/repoguardian-seed', onShowIssues }) {
  const [selectedCommit, setSelectedCommit] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const controlsRef = useRef();
  const isUserInteracting = useRef(false);

  const branches = TREE_DATA.branches;

  return (
    <div className="relative w-full h-full bg-[#050811] overflow-hidden select-none">
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 2, 22], fov: 48 }}
        gl={{ antialias: true, alpha: false }}
        onPointerMissed={() => {
          setSelectedCommit(null);
          setSelectedBranch(null);
        }}
      >
        <color attach="background" args={['#040711']} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[12, 18, 12]} intensity={2.0} color="#e0f2fe" />
        <pointLight position={[-12, -12, -12]} intensity={1.5} color="#6366f1" />

        <Stars radius={70} depth={50} count={3000} factor={4} saturation={0.6} fade speed={1} />
        <gridHelper args={[120, 60, '#1e293b', '#0b1329']} position={[0, -8, 0]} />

        {/* Smooth Camera Controller */}
        <SmoothBranchCameraController
          selectedCommit={selectedCommit}
          selectedBranch={selectedBranch}
          isUserInteracting={isUserInteracting}
          controlsRef={controlsRef}
        />

        {/* Hierarchical Connecting Tubes */}
        <TreeBranchConnections branches={branches} />

        {/* 3D Commit Crystal Nodes */}
        {branches.map((b) =>
          b.commits.map((c) => (
            <CrystalCommitNode
              key={c.id}
              commit={c}
              branch={b}
              isSelected={selectedCommit?.id === c.id}
              onSelect={(commit, branch) => {
                setSelectedCommit(commit);
                setSelectedBranch(branch);
              }}
            />
          ))
        )}

        {/* Floating 3D Branch Header Badges (Proportionally Scaled) */}
        {branches.map((b) => (
          <Html
            key={`header-${b.id}`}
            transform
            sprite
            position={[b.commits[0].x - 2.8, b.y, b.z]}
            distanceFactor={12}
            zIndexRange={[1, 10]}
            className="pointer-events-none select-none"
          >
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold backdrop-blur-xl border shadow-2xl uppercase tracking-wider whitespace-nowrap"
              style={{
                backgroundColor: 'rgba(5, 8, 17, 0.88)',
                borderColor: b.color,
                color: b.color,
              }}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>{b.name}</span>
            </div>
          </Html>
        ))}

        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.6}
          zoomSpeed={0.9}
          panSpeed={0.7}
          minDistance={4}
          maxDistance={50}
          onStart={() => {
            isUserInteracting.current = true;
          }}
          onEnd={() => {
            isUserInteracting.current = false;
          }}
        />
      </Canvas>

      {/* Top HUD: Repository Topology Header */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        <div className="p-3.5 rounded-2xl glass-panel border border-white/10 backdrop-blur-xl pointer-events-auto space-y-1 shadow-2xl">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-bold text-slate-100 font-mono">
              Git Branch Topology: <span className="text-sky-300">{activeRepo}</span>
            </h2>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
              Synchronized
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono">
            Main Backbone with 4 Feature & Release Sub-Branches • Crystal Node Models
          </p>
        </div>

        {/* Branch Legend */}
        <div className="hidden lg:flex items-center gap-1.5 p-2 rounded-2xl glass-panel border border-white/10 pointer-events-auto">
          {branches.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-mono bg-slate-950/70 border border-white/5"
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
              <span className="text-slate-300 font-medium">{b.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Commit Detail Card (Bottom-Left) */}
      {selectedCommit && selectedBranch && (
        <div className="absolute bottom-28 left-6 z-30 w-80 p-4 rounded-2xl glass-panel-glow border border-sky-500/30 shadow-2xl pointer-events-auto space-y-2 animate-in fade-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-xs font-mono font-bold" style={{ color: selectedBranch.color }}>
              commit {selectedCommit.hash}
            </span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
              {selectedBranch.name}
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-100">
            {selectedCommit.msg}
          </p>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3 text-sky-400" />
              {selectedCommit.author}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" />
              {selectedCommit.time}
            </span>
          </div>
        </div>
      )}

      {/* Bottom Center: The Glowing Red Cyber "SHOW ISSUES" CTA */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-auto">
        <button
          onClick={onShowIssues}
          className="group relative flex items-center gap-3 px-8 py-4 rounded-2xl font-mono text-sm font-bold text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:via-rose-500 hover:to-red-600 border border-red-400/80 shadow-[0_0_40px_rgba(239,68,68,0.6)] hover:shadow-[0_0_60px_rgba(239,68,68,0.9)] transition-all duration-300 active:scale-95 animate-bounce cursor-pointer"
        >
          <div className="absolute -inset-1 rounded-2xl bg-red-500/40 blur-lg group-hover:bg-red-500/70 transition opacity-75" />

          <ShieldAlert className="w-5 h-5 text-white animate-pulse" />
          <span className="tracking-wider uppercase">
            ENGAGE AGENTIC TRIAGE: SHOW ISSUES
          </span>
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
        </button>

        <p className="text-[11px] font-mono text-slate-400 tracking-wider">
          Click to analyze security vulnerabilities, duplicates, and regressions
        </p>
      </div>
    </div>
  );
}

useGLTF.preload('/models/git_branch_node.glb');
