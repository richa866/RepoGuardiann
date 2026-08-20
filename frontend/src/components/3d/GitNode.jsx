import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';

export function GitNode({ issue, position, isSelected, onSelect }) {
  const groupRef = useRef();
  const [hovered, setHovered] = useState(false);

  // Load the smooth high-definition issue orb model
  const { scene } = useGLTF('/models/smooth_issue_orb.glb');

  // Clone scene so each node has independent material instances
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone();
      }
    });
    return clone;
  }, [scene]);

  // Determine category color & glow parameters
  const categories = issue?.latest_categories || [];
  const isSecurity = categories.includes('security-sensitive');
  const isUrgent = categories.includes('urgent');
  const isContentious = categories.includes('contentious');
  const isRegression = categories.includes('possible-regression');
  const isDuplicate = categories.includes('likely-duplicate');
  const isStale = categories.includes('stale/needs-triage');
  const isNeedsInfo = 
    categories.includes('needs-more-info') || 
    categories.includes('needs-info') || 
    categories.includes('needs_info') ||
    categories.some(c => typeof c === 'string' && c.toLowerCase().includes('info'));
  const isEscalated = Boolean(issue?.latest_escalate || isSecurity || isUrgent || isRegression || isContentious || isNeedsInfo);

  const { color, glowColor, baseIntensity, pulseSpeed, opacity } = useMemo(() => {
    if (isSecurity) {
      return {
        color: new THREE.Color('#ef4444'),
        glowColor: new THREE.Color('#ff2a2a'),
        baseIntensity: 3.8,
        pulseSpeed: 4.0,
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
    // Normal open issue
    return {
      color: new THREE.Color('#10b981'),
      glowColor: new THREE.Color('#34d399'),
      baseIntensity: 2.2,
      pulseSpeed: 1.0,
      opacity: 0.95,
    };
  }, [isSecurity, isUrgent, isContentious, isRegression, isDuplicate, isStale, isNeedsInfo]);

  // Apply smooth material styles
  useMemo(() => {
    clonedScene.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.color = color;
        if (child.material.emissive) {
          child.material.emissive = glowColor;
          child.material.emissiveIntensity = baseIntensity;
        }
        child.material.transparent = opacity < 1.0;
        child.material.opacity = opacity;
        child.material.roughness = 0.1;
        child.material.metalness = 0.85;
      }
    });
  }, [clonedScene, color, glowColor, baseIntensity, opacity]);

  // Animation loop: smooth bobbing, orbital rotation & dynamic glow pulse
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();

    // Smooth floating bob
    const yOffset = Math.sin(t * 1.5 + position[0] * 0.4) * 0.15;
    groupRef.current.position.y = position[1] + yOffset;

    // Smooth continuous rotation
    groupRef.current.rotation.y += 0.01;
    groupRef.current.rotation.x = Math.sin(t * 0.6) * 0.05;

    // Pulse emission intensity
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

    // Smooth scaling on hover/select
    const targetScale = isSelected ? 1.35 : hovered ? 1.2 : 1.0;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.12);
  });

  const categoryLabel = categories[0]
    ? categories[0].replace('-sensitive', '').replace('/needs-triage', '')
    : isNeedsInfo
    ? 'needs-info'
    : 'open';

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
      <primitive object={clonedScene} scale={0.75} />

      {/* Selected Halo Ring */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.25, 1.45, 32]} />
          <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} transparent opacity={0.9} />
        </mesh>
      )}

      {/* Proportional 3D Transformed Billboard Label with zIndexRange to stay behind HUD */}
      <Html
        transform
        sprite
        position={[0, 1.65, 0]}
        distanceFactor={11}
        zIndexRange={[1, 10]}
        className="pointer-events-none select-none"
      >
        <div
          className={`flex flex-col gap-1 p-2 rounded-2xl font-mono backdrop-blur-2xl border shadow-2xl transition-all ${
            isEscalated || hovered || isSelected ? 'w-52' : 'w-24 text-center'
          } ${
            isSelected
              ? 'bg-slate-950/95 text-white border-sky-400 scale-105 shadow-[0_0_25px_rgba(56,189,248,0.5)]'
              : hovered
              ? 'bg-slate-900/95 text-white border-slate-400 scale-105 shadow-2xl'
              : 'bg-slate-950/85 text-slate-200 border-white/15'
          }`}
        >
          {/* Header Row */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 font-bold">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: `#${color.getHexString()}` }}
              />
              <span className="text-white font-mono text-xs font-bold">#{issue?.number}</span>
            </div>

            {(isEscalated || hovered || isSelected) && (
              <span
                className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md ${
                  isSecurity
                    ? 'bg-red-950 text-red-200 border border-red-500/60'
                    : isContentious
                    ? 'bg-amber-950 text-amber-200 border border-amber-500/60'
                    : isRegression
                    ? 'bg-purple-950 text-purple-200 border border-purple-500/60'
                    : isUrgent
                    ? 'bg-orange-950 text-orange-200 border border-orange-500/60'
                    : isNeedsInfo
                    ? 'bg-cyan-950 text-cyan-200 border border-cyan-500/60'
                    : isDuplicate
                    ? 'bg-slate-800 text-slate-300 border border-slate-600'
                    : 'bg-emerald-950 text-emerald-200 border border-emerald-500/60'
                }`}
              >
                {categoryLabel}
              </span>
            )}
          </div>

          {/* Issue Title Preview (shown for escalated, hovered, or selected nodes) */}
          {(isEscalated || hovered || isSelected) && (
            <div className="text-[11px] text-slate-300 font-sans font-medium truncate leading-tight">
              {issue?.title}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}

useGLTF.preload('/models/smooth_issue_orb.glb');
