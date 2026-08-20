import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';

function getIssueSummary(issue) {
  if (!issue) return '';
  const exp = issue.latest_explanation;
  if (exp) {
    if (exp.includes('Security keyword')) {
      const match = exp.match(/Security keyword '([^']+)'/i);
      if (match) return `Security signal: ${match[1].toUpperCase()} keyword detected`;
    }
    if (exp.includes('similar to')) {
      const match = exp.match(/(\d+\.?\d*%\s+similar\s+to\s+(?:closed\s+issue\s+|issue\s+)?#\d+)/i);
      if (match) return `Duplicate: ${match[1]}`;
    }
    if (exp.includes('missing reproduction') || exp.includes('missing environment')) {
      return 'Missing reproduction & environment info';
    }
    if (exp.includes('Pushback language') || exp.includes('Active back-and-forth')) {
      return 'High contention & pushback in discussion';
    }
    if (exp.includes('No maintainer response')) {
      const match = exp.match(/No maintainer response in (\d+\s+days)/i);
      if (match) return `Unanswered for ${match[1]}`;
    }
  }

  let title = issue.title || '';
  title = title.replace(/^\[[^\]]+\]\s*/, '').replace(/^(?:fix|feat|chore|bug|sec|doc|refactor)\([^)]+\):\s*/i, '');
  return title.length > 55 ? title.slice(0, 52) + '...' : title;
}

export function GitNode({ issue, position, isSelected, selectedIssue, onSelect }) {
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

  // Check if another node is selected in the scene
  const isOtherSelected = Boolean(selectedIssue && (selectedIssue.number !== issue.number || selectedIssue.repo !== issue.repo));

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

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();

    const yOffset = Math.sin(t * 1.5 + position[0] * 0.4) * 0.15;
    groupRef.current.position.y = position[1] + yOffset;

    groupRef.current.rotation.y += 0.01;
    groupRef.current.rotation.x = Math.sin(t * 0.6) * 0.05;

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

    const targetScale = isSelected ? 1.35 : hovered ? 1.2 : 1.0;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.12);
  });

  const categoryLabel = categories[0]
    ? categories[0].replace('-sensitive', '').replace('/needs-triage', '')
    : isNeedsInfo
    ? 'needs-info'
    : 'open';

  const summaryText = getIssueSummary(issue);

  // When another node is selected, hide this node's text completely to keep the view clean
  const showLabel = (!isOtherSelected || isSelected || hovered);

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

      {/* Selected Minimalist Ring */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.25, 1.4, 32]} />
          <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} transparent opacity={0.9} />
        </mesh>
      )}

      {/* Minimalist 3D Transformed Billboard Label (Hidden when other node is selected) */}
      {showLabel && (
        <Html
          transform
          sprite
          position={[0, 1.65, 0]}
          distanceFactor={11}
          zIndexRange={[1, 10]}
          className="pointer-events-none select-none"
        >
          <div
            className={`flex flex-col gap-1 p-2.5 rounded-2xl font-mono backdrop-blur-3xl border transition-all ${
              isEscalated || hovered || isSelected ? 'w-56' : 'w-24 text-center'
            } ${
              isSelected
                ? 'bg-white text-black border-white shadow-[0_0_30px_rgba(255,255,255,0.4)] scale-105'
                : hovered
                ? 'bg-black/85 text-white border-white/40 scale-105 shadow-2xl'
                : 'bg-black/60 text-zinc-200 border-white/10'
            }`}
          >
            {/* Header Row */}
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 font-bold">
                <span
                  className="w-2 h-2 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: isSelected ? '#000000' : `#${color.getHexString()}` }}
                />
                <span className={`font-mono text-xs font-bold ${isSelected ? 'text-black' : 'text-white'}`}>
                  #{issue?.number}
                </span>
              </div>

              {(isEscalated || hovered || isSelected) && (
                <span
                  className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded-full ${
                    isSelected
                      ? 'bg-black text-white font-bold'
                      : 'bg-white/10 text-zinc-300 border border-white/15'
                  }`}
                >
                  {categoryLabel}
                </span>
              )}
            </div>

            {/* Appropriate Concise Summary */}
            {(isEscalated || hovered || isSelected) && (
              <div className={`text-[11px] font-sans font-medium leading-tight ${isSelected ? 'text-zinc-900' : 'text-zinc-300'}`}>
                {summaryText}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

useGLTF.preload('/models/smooth_issue_orb.glb');
