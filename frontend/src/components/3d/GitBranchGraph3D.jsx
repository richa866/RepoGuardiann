import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { NebulaBackground } from './NebulaBackground';
import { 
  GitBranch, 
  GitCommit, 
  ShieldAlert, 
  ArrowRight,
  GitMerge,
  User,
  Clock,
  RotateCcw,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

// Dynamic Hierarchical Git Tree Generator tailored per repository
export function generateRepoBranchGraph(activeRepo = 'demo/repoguardian-seed', issues = []) {
  const repoName = activeRepo.split('/')[1] || activeRepo;
  const repoOwner = activeRepo.split('/')[0] || 'maintainer';

  // Filter relevant issues/PRs for this repo
  const repoIssues = Array.isArray(issues) ? issues.filter((i) => !i.repo || i.repo === activeRepo) : [];

  const securityIssues = repoIssues.filter((i) =>
    /security|cve|vuln|auth|leak|overflow|urgent/i.test(
      `${i.title || ''} ${i.body || ''} ${JSON.stringify(i.labels || [])}`
    )
  );

  const featureIssues = repoIssues.filter(
    (i) =>
      /feat|feature|add|support|implement|new|plugin|option|command/i.test(
        `${i.title || ''} ${i.body || ''} ${JSON.stringify(i.labels || [])}`
      ) && !securityIssues.includes(i)
  );

  const choreIssues = repoIssues.filter(
    (i) =>
      /bump|chore|docs|test|ci|workflow|release|clean|refactor|doc/i.test(
        `${i.title || ''} ${i.body || ''} ${JSON.stringify(i.labels || [])}`
      ) &&
      !securityIssues.includes(i) &&
      !featureIssues.includes(i)
  );

  const fixIssues = repoIssues.filter(
    (i) =>
      !securityIssues.includes(i) &&
      !featureIssues.includes(i) &&
      !choreIssues.includes(i)
  );

  // Hash-based deterministic pseudo-random helper for consistent styling
  let hashVal = 0;
  for (let i = 0; i < activeRepo.length; i++) {
    hashVal = (hashVal << 5) - hashVal + activeRepo.charCodeAt(i);
    hashVal |= 0;
  }
  const absHash = Math.abs(hashVal);

  const topAuthor = repoIssues[0]?.author || (repoOwner === 'demo' ? 'maintainer1' : repoOwner);

  // Build Commits for Main Trunk
  const mainCommits = [
    {
      id: 'm1',
      hash: ((absHash + 101) % 0xffffff).toString(16).padStart(6, '0'),
      msg: `chore: initial repository setup for ${repoName}`,
      author: topAuthor,
      time: '14d ago',
      x: -11.0,
    },
    {
      id: 'm2',
      hash: ((absHash + 202) % 0xffffff).toString(16).padStart(6, '0'),
      msg: `feat(core): setup ${repoName} architecture & pipeline`,
      author: repoIssues[1]?.author || topAuthor,
      time: '10d ago',
      x: -6.5,
    },
    {
      id: 'm3',
      hash: ((absHash + 303) % 0xffffff).toString(16).padStart(6, '0'),
      msg: `feat(engine): core runtime models & dispatcher`,
      author: repoIssues[2]?.author || topAuthor,
      time: '7d ago',
      x: -2.0,
    },
    {
      id: 'm4',
      hash: ((absHash + 404) % 0xffffff).toString(16).padStart(6, '0'),
      msg: `merge: feature/subsystems into main`,
      author: topAuthor,
      time: '4d ago',
      x: 2.5,
      isMerge: true,
    },
    {
      id: 'm5',
      hash: ((absHash + 505) % 0xffffff).toString(16).padStart(6, '0'),
      msg: `chore(release): v1.${(absHash % 9) + 1}.0 tag`,
      author: topAuthor,
      time: '2d ago',
      x: 7.0,
    },
    {
      id: 'm6',
      hash: ((absHash + 606) % 0xffffff).toString(16).padStart(6, '0'),
      msg: `merge: release into main`,
      author: topAuthor,
      time: '6h ago',
      x: 11.0,
      isMerge: true,
    },
  ];

  // Build Commits for Hotfix / Security Branch
  const sec1 = securityIssues[0] || fixIssues[0];
  const sec2 = securityIssues[1] || fixIssues[1];
  const hotfixCommits = [
    {
      id: 'h1',
      hash: sec1 ? (sec1.number ? `fix#${sec1.number}` : 'sec01') : ((absHash + 707) % 0xffffff).toString(16).padStart(6, '0'),
      msg: sec1 ? `sec(#${sec1.number}): ${sec1.title}` : `sec(patch): harden memory & buffer limits in ${repoName}`,
      author: sec1?.author || 'security-audit',
      time: sec1?.created_at ? '3d ago' : '2d ago',
      x: 2.5,
    },
  ];
  if (sec2) {
    hotfixCommits.push({
      id: 'h2',
      hash: `fix#${sec2.number}`,
      msg: `sec(#${sec2.number}): ${sec2.title}`,
      author: sec2.author || 'security-audit',
      time: '1d ago',
      x: 5.5,
    });
  }

  // Build Commits for Release Candidate Branch
  const rel1 = choreIssues[0] || repoIssues[3];
  const rel2 = choreIssues[1] || repoIssues[4];
  const releaseCommits = [
    {
      id: 'r1',
      hash: ((absHash + 808) % 0xffffff).toString(16).padStart(6, '0'),
      msg: `chore(release): prepare v${(absHash % 3) + 1}.${(absHash % 8) + 1}.0-rc1`,
      author: topAuthor,
      time: '5d ago',
      x: -4.0,
    },
    {
      id: 'r2',
      hash: rel1 ? `rel#${rel1.number}` : ((absHash + 909) % 0xffffff).toString(16).padStart(6, '0'),
      msg: rel1 ? `chore(#${rel1.number}): ${rel1.title}` : `chore(deps): synchronize ${repoName} dependencies`,
      author: rel1?.author || 'dependabot[bot]',
      time: '3d ago',
      x: 0.5,
    },
    {
      id: 'r3',
      hash: ((absHash + 111) % 0xffffff).toString(16).padStart(6, '0'),
      msg: `merge: hotfix into release`,
      author: topAuthor,
      time: '1d ago',
      x: 5.0,
      isMerge: true,
    },
    {
      id: 'r4',
      hash: rel2 ? `rel#${rel2.number}` : ((absHash + 222) % 0xffffff).toString(16).padStart(6, '0'),
      msg: rel2 ? `verify(#${rel2.number}): ${rel2.title}` : `chore(release): final verification & test matrix`,
      author: rel2?.author || topAuthor,
      time: '8h ago',
      x: 9.0,
    },
  ];

  // Build Commits for Feature Subsystem Branch
  const feat1 = featureIssues[0] || repoIssues[5];
  const feat2 = featureIssues[1] || repoIssues[6];
  const feat3 = featureIssues[2] || repoIssues[7];
  const featureCommits = [
    {
      id: 'f1',
      hash: feat1 ? `pr#${feat1.number}` : ((absHash + 333) % 0xffffff).toString(16).padStart(6, '0'),
      msg: feat1 ? `feat(#${feat1.number}): ${feat1.title}` : `feat(${repoName}): add modular extension hooks`,
      author: feat1?.author || 'contributor-a',
      time: '6d ago',
      x: -8.0,
    },
    {
      id: 'f2',
      hash: feat2 ? `pr#${feat2.number}` : ((absHash + 444) % 0xffffff).toString(16).padStart(6, '0'),
      msg: feat2 ? `feat(#${feat2.number}): ${feat2.title}` : `test(${repoName}): expand integration test suite`,
      author: feat2?.author || 'contributor-b',
      time: '4d ago',
      x: -4.0,
    },
    {
      id: 'f3',
      hash: feat3 ? `pr#${feat3.number}` : ((absHash + 555) % 0xffffff).toString(16).padStart(6, '0'),
      msg: feat3 ? `fix(#${feat3.number}): ${feat3.title}` : `perf(${repoName}): optimize high-throughput IO path`,
      author: feat3?.author || 'contributor-c',
      time: '2d ago',
      x: 0.0,
    },
  ];

  // Build Commits for Ecosystem / Plugin Branch
  const eco1 = featureIssues[3] || choreIssues[2] || repoIssues[8];
  const eco2 = featureIssues[4] || choreIssues[3] || repoIssues[9];
  const ecoCommits = [
    {
      id: 'rag1',
      hash: eco1 ? `pr#${eco1.number}` : ((absHash + 666) % 0xffffff).toString(16).padStart(6, '0'),
      msg: eco1 ? `feat(#${eco1.number}): ${eco1.title}` : `feat(${repoName}): ecosystem connector & adapter`,
      author: eco1?.author || 'contributor-d',
      time: '3d ago',
      x: 1.5,
    },
    {
      id: 'rag2',
      hash: eco2 ? `pr#${eco2.number}` : ((absHash + 777) % 0xffffff).toString(16).padStart(6, '0'),
      msg: eco2 ? `docs(#${eco2.number}): ${eco2.title}` : `docs(${repoName}): user guide & architecture specs`,
      author: eco2?.author || 'contributor-e',
      time: '1d ago',
      x: 6.0,
    },
  ];

  return {
    branches: [
      {
        id: 'hotfix',
        name: `hotfix/${repoName}-urgent`,
        label: `${repoName} Security Patch`,
        color: '#f43f5e',
        glow: '#e11d48',
        y: 5.4,
        z: -1.5,
        forkFrom: { branch: 'release', commitId: 'r2' },
        mergeInto: { branch: 'release', commitId: 'r3' },
        commits: hotfixCommits,
      },
      {
        id: 'release',
        name: `release/v${(absHash % 3) + 1}.${(absHash % 8) + 1}`,
        label: `${repoName} Release Candidate`,
        color: '#10b981',
        glow: '#059669',
        y: 3.2,
        z: 1.8,
        forkFrom: { branch: 'main', commitId: 'm2' },
        mergeInto: { branch: 'main', commitId: 'm6' },
        commits: releaseCommits,
      },
      {
        id: 'main',
        name: 'main',
        label: `${repoName} Trunk (Production)`,
        color: '#38bdf8',
        glow: '#0284c7',
        y: 0,
        z: 0,
        commits: mainCommits,
      },
      {
        id: 'feature-core',
        name: `feat/${repoName}-core`,
        label: `${repoName} Core Subsystem`,
        color: '#a855f7',
        glow: '#7e22ce',
        y: -3.2,
        z: 1.5,
        forkFrom: { branch: 'main', commitId: 'm1' },
        mergeInto: { branch: 'main', commitId: 'm4' },
        commits: featureCommits,
      },
      {
        id: 'feature-ecosystem',
        name: `feat/${repoName}-ecosystem`,
        label: `${repoName} Ecosystem & Docs`,
        color: '#f59e0b',
        glow: '#d97706',
        y: -5.4,
        z: -1.5,
        forkFrom: { branch: 'main', commitId: 'm3' },
        commits: ecoCommits,
      },
    ],
  };
}

// Dynamic Camera Controller that auto-frames any tree size perfectly in the center
function SmoothBranchCameraController({ selectedCommit, selectedBranch, resetTrigger, autoFrameConfig, isUserInteracting, controlsRef }) {
  const { camera, size } = useThree();
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const targetCamPos = useRef(new THREE.Vector3(0, 0, 24));
  const animating = useRef(false);
  const animationFrames = useRef(0);

  useEffect(() => {
    if (selectedCommit && selectedBranch) {
      targetLookAt.current.set(selectedCommit.x, selectedBranch.y, selectedBranch.z);
      targetCamPos.current.set(
        selectedCommit.x + 1.0,
        selectedBranch.y + 0.8,
        selectedBranch.z + 8.5
      );
      animating.current = true;
      animationFrames.current = 50;
    } else if (autoFrameConfig) {
      const { center, distance } = autoFrameConfig;
      targetLookAt.current.set(center[0], center[1], center[2]);
      targetCamPos.current.set(center[0], center[1] + 0.5, center[2] + distance);
      animating.current = true;
      animationFrames.current = 50;
    }
  }, [selectedCommit, selectedBranch, resetTrigger, autoFrameConfig, size.width, size.height]);

  useFrame(() => {
    if (isUserInteracting.current) {
      animating.current = false;
      return;
    }

    if (animating.current && animationFrames.current > 0) {
      if (controlsRef.current) {
        controlsRef.current.target.lerp(targetLookAt.current, 0.07);
      }
      camera.position.lerp(targetCamPos.current, 0.07);
      animationFrames.current--;
      if (animationFrames.current <= 0) {
        animating.current = false;
      }
    }
  });

  return null;
}

function CrystalCommitNode({ commit, branch, isSelected, selectedCommit, onSelect }) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  const { scene } = useGLTF('/models/git_branch_node.glb');
  const [crystalNormal, crystalRoughness] = useTexture([
    '/textures/crystal_normal.png',
    '/textures/crystal_roughness.png',
  ]);

  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone();
        child.material.color = new THREE.Color(branch.color);
        child.material.normalMap = crystalNormal;
        child.material.normalScale = new THREE.Vector2(1.5, 1.5);
        child.material.roughnessMap = crystalRoughness;
        if (child.material.emissive) {
          child.material.emissive = new THREE.Color(branch.glow);
          child.material.emissiveIntensity = commit.isMerge ? 3.5 : 2.2;
        }
        child.material.roughness = 0.2;
        child.material.metalness = 0.88;
        child.material.clearcoat = 0.6;
        child.material.needsUpdate = true;
      }
    });
    return c;
  }, [scene, branch, commit.isMerge, crystalNormal, crystalRoughness]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    meshRef.current.rotation.y += 0.012;
    meshRef.current.rotation.z = Math.sin(t * 0.8 + commit.x) * 0.08;

    const targetScale = isSelected ? 1.35 : hovered ? 1.2 : 1.0;
    meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
  });

  const isOtherSelected = Boolean(selectedCommit && selectedCommit.id !== commit.id);
  const showLabel = !isOtherSelected || isSelected || hovered;

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

      {commit.isMerge && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.9, 0.04, 16, 32]} />
          <meshBasicMaterial color={branch.color} transparent opacity={0.7} />
        </mesh>
      )}

      {showLabel && (
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
      )}
    </group>
  );
}

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
      if (b.commits.length > 0) {
        const pTag = new THREE.Vector3(-15.5, b.y, b.z);
        const pFirst = new THREE.Vector3(b.commits[0].x, b.y, b.z);
        const guideCurve = new THREE.LineCurve3(pTag, pFirst);
        list.push({ curve: guideCurve, color: b.color, isGuide: true });
      }

      for (let i = 0; i < b.commits.length - 1; i++) {
        const p1 = new THREE.Vector3(b.commits[i].x, b.y, b.z);
        const p2 = new THREE.Vector3(b.commits[i + 1].x, b.y, b.z);
        const curve = new THREE.LineCurve3(p1, p2);
        list.push({ curve, color: b.color, isGuide: false });
      }

      if (b.forkFrom && b.commits.length > 0) {
        const parent = commitMap.get(b.forkFrom.commitId);
        if (parent) {
          const p1 = new THREE.Vector3(parent.x, parent.branchY, parent.branchZ);
          const p2 = new THREE.Vector3(b.commits[0].x, b.y, b.z);
          const mid = new THREE.Vector3(parent.x + 1.2, b.y * 0.6 + parent.branchY * 0.4, b.z * 0.6 + parent.branchZ * 0.4);
          const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
          list.push({ curve, color: b.color, isGuide: false });
        }
      }

      if (b.mergeInto && b.commits.length > 0) {
        const target = commitMap.get(b.mergeInto.commitId);
        const lastCommit = b.commits[b.commits.length - 1];
        if (target && lastCommit) {
          const p1 = new THREE.Vector3(lastCommit.x, b.y, b.z);
          const p2 = new THREE.Vector3(target.x, target.branchY, target.branchZ);
          const mid = new THREE.Vector3(lastCommit.x + 1.5, b.y * 0.4 + target.branchY * 0.6, b.z * 0.4 + target.branchZ * 0.6);
          const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
          list.push({ curve, color: b.color, isGuide: false });
        }
      }
    });

    return list;
  }, [branches, commitMap]);

  return (
    <group>
      {curveData.map((item, idx) => (
        <mesh key={idx} geometry={new THREE.TubeGeometry(item.curve, 24, item.isGuide ? 0.025 : 0.05, 8, false)}>
          <meshBasicMaterial color={item.color} transparent opacity={item.isGuide ? 0.3 : 0.6} />
        </mesh>
      ))}
    </group>
  );
}

export function GitBranchGraph3D({ activeRepo = 'demo/repoguardian-seed', issues = [], onShowIssues }) {
  const [selectedCommit, setSelectedCommit] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const controlsRef = useRef();
  const isUserInteracting = useRef(false);

  const branches = useMemo(() => generateRepoBranchGraph(activeRepo, issues).branches, [activeRepo, issues]);

  // Flatten all commits in chronological / coordinate order for sequential stepping
  const allCommitsWithBranch = useMemo(() => {
    const list = [];
    branches.forEach((b) => {
      b.commits.forEach((c) => {
        list.push({ commit: c, branch: b });
      });
    });
    return list.sort((a, b) => a.commit.x - b.commit.x);
  }, [branches]);

  const currentCommitIndex = useMemo(() => {
    if (!selectedCommit) return -1;
    return allCommitsWithBranch.findIndex((item) => item.commit.id === selectedCommit.id);
  }, [allCommitsWithBranch, selectedCommit]);

  const handleNextCommit = useCallback(() => {
    if (allCommitsWithBranch.length === 0) return;
    const nextIdx = (currentCommitIndex + 1) % allCommitsWithBranch.length;
    const item = allCommitsWithBranch[nextIdx];
    setSelectedCommit(item.commit);
    setSelectedBranch(item.branch);
  }, [allCommitsWithBranch, currentCommitIndex]);

  const handlePrevCommit = useCallback(() => {
    if (allCommitsWithBranch.length === 0) return;
    const prevIdx = (currentCommitIndex - 1 + allCommitsWithBranch.length) % allCommitsWithBranch.length;
    const item = allCommitsWithBranch[prevIdx];
    setSelectedCommit(item.commit);
    setSelectedBranch(item.branch);
  }, [allCommitsWithBranch, currentCommitIndex]);

  const handleResetView = useCallback(() => {
    setSelectedCommit(null);
    setSelectedBranch(null);
    setIsAutoRotating(false);
    setResetTrigger((prev) => prev + 1);
  }, []);

  // Global Keyboard Shortcuts for Git Branches
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.key === 'ArrowRight' || e.key === 'Tab') {
        e.preventDefault();
        handleNextCommit();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevCommit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleResetView();
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsAutoRotating((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextCommit, handlePrevCommit, handleResetView]);

  // Compute dynamic bounding box to auto-frame any repository tree perfectly in the center
  const autoFrameConfig = useMemo(() => {
    const allCommits = branches.flatMap((b) => b.commits);
    if (allCommits.length === 0) {
      return { center: [0, 0, 0], distance: 20 };
    }

    const minX = Math.min(...allCommits.map((c) => c.x), -16.0);
    const maxX = Math.max(...allCommits.map((c) => c.x), 10.0);
    const minY = Math.min(...branches.map((b) => b.y));
    const maxY = Math.max(...branches.map((b) => b.y));
    const minZ = Math.min(...branches.map((b) => b.z));
    const maxZ = Math.max(...branches.map((b) => b.z));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;

    const sizeX = Math.max(1, maxX - minX);
    const sizeY = Math.max(1, maxY - minY);
    const sizeZ = Math.max(1, maxZ - minZ);

    const fovRad = (48 * Math.PI) / 180;
    const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.77;
    const distY = (sizeY / 2) / Math.tan(fovRad / 2);
    const distX = (sizeX / 2) / (Math.tan(fovRad / 2) * aspect);
    const distance = Math.max(distY, distX, 12) * 1.35 + (sizeZ / 2);

    return {
      center: [centerX, centerY, centerZ],
      distance: Math.max(14, Math.min(60, distance)),
    };
  }, [branches]);

  return (
    <div className="relative w-full h-full bg-[#040714] overflow-hidden select-none">
      <Canvas
        camera={{ position: [autoFrameConfig.center[0], autoFrameConfig.center[1] + 0.5, autoFrameConfig.center[2] + autoFrameConfig.distance], fov: 48 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        onPointerMissed={() => {
          setSelectedCommit(null);
          setSelectedBranch(null);
        }}
        onDoubleClick={() => handleResetView()}
      >
        <color attach="background" args={['#040714']} />
        <ambientLight intensity={1.0} />
        <directionalLight position={[12, 18, 12]} intensity={2.2} color="#e0f2fe" />
        <pointLight position={[-12, -12, -12]} intensity={1.6} color="#6366f1" />

        {/* Breathing Space Environment */}
        <NebulaBackground activeTheme="all" />

        {/* Dynamic Centered Camera Controller */}
        <SmoothBranchCameraController
          selectedCommit={selectedCommit}
          selectedBranch={selectedBranch}
          resetTrigger={resetTrigger}
          autoFrameConfig={autoFrameConfig}
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
              selectedCommit={selectedCommit}
              onSelect={(commit, branch) => {
                setSelectedCommit(commit);
                setSelectedBranch(branch);
              }}
            />
          ))
        )}

        {/* Floating 3D Branch Header Badges: Aligned Horizontally on the Left Side */}
        {branches.map((b) => (
          <Html
            key={`header-${b.id}`}
            transform
            sprite
            position={[-15.5, b.y, b.z]}
            distanceFactor={12}
            zIndexRange={[1, 10]}
            className="pointer-events-none select-none"
          >
            <div
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold backdrop-blur-2xl border shadow-2xl uppercase tracking-wider whitespace-nowrap"
              style={{
                backgroundColor: 'rgba(4, 7, 18, 0.92)',
                borderColor: b.color,
                color: b.color,
                boxShadow: `0 0 20px ${b.color}33`,
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
              <GitBranch className="w-3.5 h-3.5" />
              <span>{b.name}</span>
            </div>
          </Html>
        ))}

        {/* Butter-Smooth Orbit Controls with Soft Limits & Auto-Orbit */}
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.5}
          zoomSpeed={0.7}
          panSpeed={0.6}
          screenSpacePanning
          minDistance={4}
          maxDistance={65}
          minPolarAngle={0.15}
          maxPolarAngle={Math.PI - 0.15}
          autoRotate={isAutoRotating}
          autoRotateSpeed={0.5}
          onStart={() => {
            isUserInteracting.current = true;
          }}
          onEnd={() => {
            isUserInteracting.current = false;
          }}
        />
      </Canvas>

      {/* Selected Commit Detail Card */}
      {selectedCommit && selectedBranch && (
        <div className="absolute bottom-24 left-6 z-30 w-80 p-4 rounded-2xl bg-black/90 border border-sky-500/30 shadow-2xl pointer-events-auto space-y-2 animate-in fade-in slide-in-from-bottom duration-200 backdrop-blur-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-xs font-mono font-bold" style={{ color: selectedBranch.color }}>
              commit {selectedCommit.hash}
            </span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/10 text-zinc-300">
              {selectedBranch.name}
            </span>
          </div>
          <p className="text-xs font-semibold text-white">
            {selectedCommit.msg}
          </p>
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-1">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3 text-sky-400" />
              {selectedCommit.author}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-zinc-500" />
              {selectedCommit.time}
            </span>
          </div>
        </div>
      )}

      {/* Floating Sequential Commit Stepper Deck (Above Footer Center) */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex items-center gap-1.5 p-1.5 rounded-full bg-black/60 hover:bg-black/90 border border-white/10 hover:border-white/25 backdrop-blur-3xl shadow-2xl transition-all duration-200">
        <button
          onClick={handlePrevCommit}
          className="p-1.5 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition active:scale-95 cursor-pointer"
          title="Previous Commit (←)"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="px-3 text-xs font-mono">
          {selectedCommit ? (
            <span className="text-white font-bold">
              commit {selectedCommit.hash} ({currentCommitIndex + 1}/{allCommitsWithBranch.length})
            </span>
          ) : (
            <span className="text-zinc-400">
              {allCommitsWithBranch.length} Commits • <kbd className="px-1 py-0.5 rounded bg-white/10 text-[10px] text-zinc-300">←</kbd> <kbd className="px-1 py-0.5 rounded bg-white/10 text-[10px] text-zinc-300">→</kbd>
            </span>
          )}
        </span>

        <button
          onClick={handleNextCommit}
          className="p-1.5 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition active:scale-95 cursor-pointer"
          title="Next Commit (→)"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Clean Unified Bottom Footer: Topology Context, Reset View, Auto-Orbit, CTA & Legend */}
      <footer className="fixed bottom-4 sm:bottom-6 left-4 sm:left-6 right-4 sm:right-6 z-30 flex items-center justify-between gap-3 pointer-events-none flex-wrap sm:flex-nowrap">
        {/* Left Footer Group: Reset View, Auto-Orbit & Topology Info */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={handleResetView}
            className="group flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/60 hover:bg-black/90 border border-white/10 hover:border-white/30 shadow-2xl backdrop-blur-3xl transition-all duration-200 text-xs font-mono text-zinc-300 hover:text-white active:scale-95"
            title="Reset 3D camera to default overview (Esc)"
          >
            <RotateCcw className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white group-hover:-rotate-90 transition-all duration-300" />
            <span className="font-medium">Reset</span>
          </button>

          <button
            onClick={() => setIsAutoRotating((prev) => !prev)}
            className={`p-2 rounded-full border shadow-2xl backdrop-blur-3xl transition-all duration-200 ${
              isAutoRotating
                ? 'bg-sky-500/20 text-sky-300 border-sky-400/50 shadow-sky-500/20'
                : 'bg-black/60 hover:bg-black/90 text-zinc-400 hover:text-white border-white/10 hover:border-white/30'
            }`}
            title={isAutoRotating ? 'Pause Auto-Orbit (Space)' : 'Start Cinematic Auto-Orbit (Space)'}
          >
            {isAutoRotating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          <div className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/60 border border-white/10 backdrop-blur-2xl text-xs font-mono text-zinc-300 shadow-2xl">
            <GitBranch className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-white font-medium truncate max-w-[150px]">
              {activeRepo}
            </span>
            <span className="text-zinc-600">•</span>
            <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Synchronized
            </span>
          </div>
        </div>

        {/* Center: Minimalist "ENGAGE AGENTIC TRIAGE" CTA */}
        <div className="pointer-events-auto mx-auto sm:mx-0">
          <button
            onClick={onShowIssues}
            className="group relative flex items-center gap-2.5 px-6 py-2.5 rounded-full font-mono text-xs sm:text-sm font-bold text-black bg-white hover:bg-zinc-200 border border-white shadow-[0_0_35px_rgba(255,255,255,0.35)] transition-all duration-200 active:scale-95 cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4 text-black" />
            <span className="tracking-wider uppercase">
              Engage Agentic Triage
            </span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-black" />
          </button>
        </div>

        {/* Right Footer Group: Branch Legend */}
        <div className="hidden lg:flex items-center gap-1 p-1 rounded-full bg-black/60 border border-white/10 backdrop-blur-2xl pointer-events-auto shadow-2xl">
          {branches.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono text-zinc-300 hover:text-white transition"
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
              <span className="font-medium">{b.name}</span>
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}

useGLTF.preload('/models/git_branch_node.glb');
useTexture.preload('/textures/crystal_normal.png');
useTexture.preload('/textures/crystal_roughness.png');
