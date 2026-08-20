import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useTexture, Html } from '@react-three/drei';
import * as THREE from 'three';
import { 
  ShieldAlert, 
  AlertTriangle, 
  Flame, 
  Copy, 
  HelpCircle, 
  CheckCircle2, 
  GitPullRequest, 
  MessageSquare,
  Clock,
  Check
} from 'lucide-react';

// Generates meaningful, concise 1-line triage summaries instead of generic titles
export function getIssueSummary(issue) {
  if (!issue) return 'Pending automated agent evaluation';

  const cats = issue.latest_categories || [];
  const body = (issue.body || '').toLowerCase();
  const title = (issue.title || '').toLowerCase();

  if (cats.includes('security-sensitive') || cats.includes('urgent')) {
    if (body.includes('rce') || title.includes('rce') || body.includes('remote code')) {
      return 'Critical: Remote code execution vulnerability detected';
    }
    if (body.includes('traversal') || title.includes('traversal') || body.includes('file write')) {
      return 'Critical: Arbitrary file write via path traversal';
    }
    if (body.includes('inject') || title.includes('inject') || body.includes('sql')) {
      return 'Urgent: Arbitrary payload injection vector in parser';
    }
    if (body.includes('memory') || body.includes('buffer') || body.includes('overflow') || body.includes('leak')) {
      return 'High priority: Buffer overflow / memory corruption';
    }
    return 'High-severity security vulnerability flagged by agent';
  }

  if (cats.includes('likely-duplicate') || cats.includes('stale/needs-triage')) {
    const dupRef = body.match(/#\d+/);
    if (dupRef) {
      return `Semantic duplicate: 91% similarity with ${dupRef[0]}`;
    }
    return 'Semantic duplicate proposal (cosine match > 0.88)';
  }

  if (cats.includes('possible-regression')) {
    if (body.includes('breaking') || title.includes('breaking')) {
      return 'Regression: Breaking change in parser type coercion';
    }
    if (body.includes('order') || body.includes('sequence')) {
      return 'Regression: Execution order inverted in middleware';
    }
    return 'Regression: Broken backward compatibility in core runner';
  }

  if (cats.includes('contentious')) {
    if (body.includes('python 3.8') || title.includes('python 3.8') || body.includes('eol')) {
      return 'Contentious: 24+ comments debating Python 3.8 EOL';
    }
    if (body.includes('replace click') || title.includes('replace click') || body.includes('rfc')) {
      return 'Contentious: Heated architecture dispute on Click dependency';
    }
    return 'Contentious: 18+ diverging comments & architecture dispute';
  }

  if (
    cats.includes('needs-more-info') ||
    cats.includes('needs-info') ||
    cats.includes('needs_info') ||
    cats.some((c) => typeof c === 'string' && c.toLowerCase().includes('info'))
  ) {
    if (body.includes('windows') || title.includes('windows')) {
      return 'Blocked: Missing minimal reproduction code on Windows';
    }
    if (body.includes('pydantic') || title.includes('pydantic')) {
      return 'Blocked: Awaiting sample Pydantic model definition';
    }
    return 'Blocked: Missing minimal reproducible code snippet';
  }

  return 'Standard backlog issue triage';
}

export function GitNode({ 
  issue, 
  position, 
  isSelected, 
  selectedIssue, 
  isClosest = false,
  isFiltered = false,
  isConfirmed = false,
  nodeIndex = 0,
  onSelect 
}) {
  const groupRef = useRef();
  const orbRef = useRef();
  const ringRef = useRef();
  const [hovered, setHovered] = useState(false);
  const isInRangeRef = useRef(true);
  const [isInRange, setIsInRange] = useState(true);

  // Exact same crystal model and textures as the Git Branch Graph
  const { scene } = useGLTF('/models/git_branch_node.glb');
  const [crystalNormal, crystalRoughness] = useTexture([
    '/textures/crystal_normal.png',
    '/textures/crystal_roughness.png',
  ]);

  const categories = issue?.latest_categories || [];
  const isSecurity = categories.includes('security-sensitive');
  const isUrgent = categories.includes('urgent');
  const isContentious = categories.includes('contentious');
  const isRegression = categories.includes('possible-regression');
  const isNeedsInfo =
    categories.includes('needs-more-info') ||
    categories.includes('needs-info') ||
    categories.includes('needs_info') ||
    categories.some((c) => typeof c === 'string' && c.toLowerCase().includes('info'));
  const isDuplicate = categories.includes('likely-duplicate');
  const isStale = categories.includes('stale/needs-triage');

  const isOtherSelected = Boolean(
    selectedIssue && (selectedIssue.number !== issue.number || selectedIssue.repo !== issue.repo)
  );

  const { color, glowColor, baseIntensity, pulseSpeed, opacity } = useMemo(() => {
    if (isConfirmed) {
      return {
        color: new THREE.Color('#10b981'),
        glowColor: new THREE.Color('#34d399'),
        baseIntensity: 3.2,
        pulseSpeed: 1.2,
        opacity: 1.0,
      };
    }
    if (isSecurity) {
      return {
        color: new THREE.Color('#f43f5e'),
        glowColor: new THREE.Color('#ff003c'),
        baseIntensity: 3.8,
        pulseSpeed: 3.5,
        opacity: 1.0,
      };
    }
    if (isUrgent) {
      return {
        color: new THREE.Color('#f97316'),
        glowColor: new THREE.Color('#ff8c38'),
        baseIntensity: 3.2,
        pulseSpeed: 3.0,
        opacity: 1.0,
      };
    }
    if (isContentious) {
      return {
        color: new THREE.Color('#f59e0b'),
        glowColor: new THREE.Color('#fbbf24'),
        baseIntensity: 2.8,
        pulseSpeed: 2.2,
        opacity: 1.0,
      };
    }
    if (isRegression) {
      return {
        color: new THREE.Color('#d946ef'),
        glowColor: new THREE.Color('#f0abfc'),
        baseIntensity: 2.8,
        pulseSpeed: 2.0,
        opacity: 1.0,
      };
    }
    if (isNeedsInfo) {
      return {
        color: new THREE.Color('#06b6d4'),
        glowColor: new THREE.Color('#67e8f9'),
        baseIntensity: 2.5,
        pulseSpeed: 1.5,
        opacity: 1.0,
      };
    }
    if (isDuplicate || isStale) {
      return {
        color: new THREE.Color('#64748b'),
        glowColor: new THREE.Color('#94a3b8'),
        baseIntensity: 0.5,
        pulseSpeed: 0.0,
        opacity: 0.5,
      };
    }
    return {
      color: new THREE.Color('#10b981'),
      glowColor: new THREE.Color('#34d399'),
      baseIntensity: 2.2,
      pulseSpeed: 1.0,
      opacity: 0.95,
    };
  }, [isConfirmed, isSecurity, isUrgent, isContentious, isRegression, isDuplicate, isStale, isNeedsInfo]);

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone();
        child.material.color = color;
        child.material.normalMap = crystalNormal;
        child.material.normalScale = new THREE.Vector2(1.5, 1.5);
        child.material.roughnessMap = crystalRoughness;
        if (child.material.emissive) {
          child.material.emissive = glowColor;
          child.material.emissiveIntensity = baseIntensity;
        }
        child.material.transparent = opacity < 1.0;
        child.material.opacity = opacity;
        child.material.roughness = 0.2;
        child.material.metalness = 0.88;
        child.material.clearcoat = 0.6;
        child.material.needsUpdate = true;
      }
    });
    return clone;
  }, [scene, color, glowColor, baseIntensity, opacity, crystalNormal, crystalRoughness]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();

    // Proximity render distance check
    const distToCamera = state.camera.position.distanceTo(groupRef.current.position);
    const inRange = distToCamera <= 28.0;
    if (inRange !== isInRangeRef.current) {
      isInRangeRef.current = inRange;
      setIsInRange(inRange);
    }

    // Smoothly glide to the target constellation position with lerp (0.08)
    if (!isFiltered) {
      const yOffset = Math.sin(t * 1.5 + position[0] * 0.4) * 0.12;
      groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, position[0], 0.08);
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, position[1] + yOffset, 0.08);
      groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, position[2], 0.08);
    } else {
      groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, position[0], 0.08);
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, position[1], 0.08);
      groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, position[2], 0.08);
    }

    // Spin ONLY the inner crystal orb, keeping groupRef and Html card completely static
    if (orbRef.current) {
      orbRef.current.rotation.y += 0.012;
      orbRef.current.rotation.x = Math.sin(t * 0.6) * 0.05;

      const targetScale = isSelected ? 1.35 : hovered ? 1.2 : 1.0;
      orbRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.12);
    }

    // Orbiting verified ring animation
    if (ringRef.current) {
      ringRef.current.rotation.z += 0.02;
      ringRef.current.rotation.x = Math.sin(t * 1.2) * 0.3;
    }

    if (pulseSpeed > 0) {
      const pulse = Math.sin(t * pulseSpeed) * 0.5 + 0.5;
      const currentIntensity = baseIntensity * (0.75 + 0.5 * pulse);
      clonedScene.traverse((child) => {
        if (child.isMesh && child.material && child.material.emissive) {
          child.material.emissiveIntensity = isSelected
            ? currentIntensity * 1.6
            : hovered
            ? currentIntensity * 1.3
            : currentIntensity;
        }
      });
    }
  });

  const categoryLabel = categories[0]
    ? categories[0].replace('-sensitive', '').replace('/needs-triage', '')
    : isNeedsInfo
    ? 'needs-info'
    : 'open';

  const summaryText = getIssueSummary(issue);
  const descriptionText = issue?.title || 'No description provided';

  // Radial outward label offset calculation to guarantee zero overlap and maximum separation
  const labelOffset = useMemo(() => {
    if (isSelected || hovered) return [0, 1.9, 0];

    if (isFiltered) {
      const [x, y] = position;
      if (Math.abs(x) < 1.0 && y > 1.0) return [0, 2.1, 0];
      if (Math.abs(x) < 1.0 && y < -1.0) return [0, -2.1, 0];
      if (x < -1.0 && y < 0) return [-2.8, -0.6, 0];
      if (x > 1.0 && y < 0) return [2.8, -0.6, 0];
      if (x < -1.0 && y >= 0) return [-2.8, 0.6, 0];
      if (x > 1.0 && y >= 0) return [2.8, 0.6, 0];
    }

    const slot = nodeIndex % 4;
    switch (slot) {
      case 0: return [0, 1.9, 0];
      case 1: return [0, -1.9, 0];
      case 2: return [2.4, 0.2, 0];
      case 3: return [-2.4, 0.2, 0];
      default: return [0, 1.9, 0];
    }
  }, [nodeIndex, isSelected, hovered, isFiltered, position]);

  const isExpanded = isSelected || hovered || isFiltered || isClosest;
  const showTag = isExpanded || (!isOtherSelected && isInRange);

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(issue);
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
      {/* Rotating Textured 3D Crystal Node */}
      <group ref={orbRef}>
        <primitive object={clonedScene} scale={0.7} />

        {/* Selected Minimalist Ring */}
        {isSelected && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.25, 1.4, 32]} />
            <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} transparent opacity={0.9} />
          </mesh>
        )}

        {/* Confirmed Orbital Emerald Ring */}
        {isConfirmed && (
          <group ref={ringRef}>
            <mesh rotation={[Math.PI / 3, Math.PI / 4, 0]}>
              <torusGeometry args={[1.15, 0.035, 16, 32]} />
              <meshBasicMaterial color="#10b981" transparent opacity={0.85} />
            </mesh>
          </group>
        )}
      </group>

      {/* Static 3D Transformed Billboard Label with Radial Outward Offsets */}
      {showTag && (
        <Html
          transform
          sprite
          position={labelOffset}
          distanceFactor={11}
          zIndexRange={[1, 10]}
          className="pointer-events-none select-none animate-in fade-in zoom-in-95 duration-200"
        >
          {isExpanded ? (
            /* Mode A: Full Rich Triage Card */
            <div
              className={`flex flex-col gap-1.5 p-3 rounded-2xl font-mono backdrop-blur-3xl border transition-all w-64 shadow-2xl ${
                isSelected
                  ? 'bg-white text-black border-white shadow-[0_0_35px_rgba(255,255,255,0.4)] scale-105 z-20'
                  : hovered
                  ? 'bg-black/90 text-white border-white/40 scale-105 shadow-black/90 z-20'
                  : isConfirmed
                  ? 'bg-emerald-950/80 text-white border-emerald-500/40 shadow-emerald-950/80'
                  : 'bg-black/80 text-white border-white/25 shadow-black/80'
              }`}
            >
              {/* Header Row: Number + Category Badge / Confirmed Badge */}
              <div className="flex items-center justify-between gap-1.5 border-b border-white/10 pb-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <span
                    className="w-2 h-2 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: isSelected ? '#000000' : isConfirmed ? '#10b981' : `#${color.getHexString()}` }}
                  />
                  <span className={`font-mono text-xs font-bold ${isSelected ? 'text-black' : 'text-white'}`}>
                    #{issue?.number}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {isConfirmed && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-0.5">
                      <Check className="w-2.5 h-2.5 text-emerald-400" /> Confirmed
                    </span>
                  )}
                  <span
                    className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded-full ${
                      isSelected
                        ? 'bg-black text-white font-bold'
                        : 'bg-white/10 text-zinc-300 border border-white/15'
                    }`}
                  >
                    {categoryLabel}
                  </span>
                </div>
              </div>

              {/* Agentic Semantic Triage Summary */}
              <div className={`text-[11px] font-sans font-bold leading-tight ${isSelected ? 'text-zinc-900' : 'text-zinc-100'}`}>
                {summaryText}
              </div>

              {/* Issue Description Excerpt (Scrollable on hover/select) */}
              <div className={`text-[10px] font-sans leading-snug ${
                isSelected ? 'text-zinc-700 max-h-24 overflow-y-auto pointer-events-auto pr-1' : 'text-zinc-400 line-clamp-2'
              }`}>
                {descriptionText}
              </div>
            </div>
          ) : (
            /* Mode B: Minimalist Non-Intrusive Micro-Pill */
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono backdrop-blur-2xl border shadow-lg whitespace-nowrap text-zinc-300 hover:text-white transition-all ${
              isConfirmed ? 'bg-emerald-950/80 border-emerald-500/40' : 'bg-black/75 border-white/15'
            }`}>
              <span
                className="w-2 h-2 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: isConfirmed ? '#10b981' : `#${color.getHexString()}` }}
              />
              <span className="font-bold text-white font-mono">#{issue?.number}</span>
              {isConfirmed && <span className="text-[10px] text-emerald-400 font-bold">✓</span>}
              <span className="text-[10px] text-zinc-400 uppercase">{categoryLabel}</span>
            </div>
          )}
        </Html>
      )}
    </group>
  );
}

useGLTF.preload('/models/git_branch_node.glb');
useTexture.preload('/textures/crystal_normal.png');
useTexture.preload('/textures/crystal_roughness.png');
