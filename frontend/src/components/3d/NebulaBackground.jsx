import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';

// Palette extracted from the user's reference image:
// Gold: #f7d08a, Teal: #1b999c, Jade: #38a388, Indigo: #28235c, Violet: #591a4f
const THEME_PALETTES = {
  all: {
    c1: new THREE.Color('#1b999c'), // Deep Teal
    c2: new THREE.Color('#38a388'), // Jade
    c3: new THREE.Color('#f7d08a'), // Golden dust
    c4: new THREE.Color('#591a4f'), // Cosmic Violet
    bg: '#040714',
  },
  security_urgent: {
    c1: new THREE.Color('#ef4444'), // Crimson
    c2: new THREE.Color('#f97316'), // Fire Orange
    c3: new THREE.Color('#fde047'), // Flare
    c4: new THREE.Color('#7f1d1d'), // Deep Blood Red
    bg: '#0c0406',
  },
  regression: {
    c1: new THREE.Color('#d946ef'), // Magenta
    c2: new THREE.Color('#a855f7'), // Purple
    c3: new THREE.Color('#e879f9'), // Pink Flare
    c4: new THREE.Color('#3b0764'), // Deep Violet
    bg: '#0a0312',
  },
  contentious: {
    c1: new THREE.Color('#f59e0b'), // Amber
    c2: new THREE.Color('#eab308'), // Gold
    c3: new THREE.Color('#f97316'), // Orange
    c4: new THREE.Color('#451a03'), // Deep Umber
    bg: '#0c0702',
  },
  duplicates: {
    c1: new THREE.Color('#38bdf8'), // Sky
    c2: new THREE.Color('#64748b'), // Slate
    c3: new THREE.Color('#818cf8'), // Indigo
    c4: new THREE.Color('#0f172a'), // Midnight
    bg: '#030712',
  },
  needs_info: {
    c1: new THREE.Color('#06b6d4'), // Cyan
    c2: new THREE.Color('#2dd4bf'), // Mint
    c3: new THREE.Color('#38a388'), // Jade
    c4: new THREE.Color('#134e4a'), // Deep Teal
    bg: '#020c0e',
  },
};

export function NebulaBackground({ activeTheme = 'all' }) {
  const pointsRef = useRef();
  const cloudsRef = useRef();
  const currentTheme = THEME_PALETTES[activeTheme] || THEME_PALETTES.all;

  // 1. Generate 1,500 Multi-Colored Nebula Dust Particles
  const particleCount = 1400;
  const [positions, baseColors, scales] = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const col = new Float32Array(particleCount * 3);
    const sc = new Float32Array(particleCount);

    const palette = [
      new THREE.Color('#1b999c'),
      new THREE.Color('#38a388'),
      new THREE.Color('#f7d08a'),
      new THREE.Color('#591a4f'),
      new THREE.Color('#28235c'),
    ];

    for (let i = 0; i < particleCount; i++) {
      // Cosmic spiral / cloud distribution
      const r = THREE.MathUtils.lerp(12, 90, Math.pow(Math.random(), 0.6));
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI * 0.7;

      pos[i * 3] = r * Math.cos(phi) * Math.sin(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * 0.6 + (Math.sin(theta * 2) * 6);
      pos[i * 3 + 2] = r * Math.cos(phi) * Math.cos(theta);

      const colorPick = palette[i % palette.length];
      col[i * 3] = colorPick.r;
      col[i * 3 + 1] = colorPick.g;
      col[i * 3 + 2] = colorPick.b;

      sc[i] = Math.random() * 1.5 + 0.5;
    }

    return [pos, col, sc];
  }, []);

  // Dynamic lerping color registers for smooth theme transitions
  const lerpC1 = useRef(new THREE.Color('#1b999c'));
  const lerpC2 = useRef(new THREE.Color('#38a388'));
  const lerpC3 = useRef(new THREE.Color('#f7d08a'));
  const lerpC4 = useRef(new THREE.Color('#591a4f'));

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Smoothly transition colors toward the active theme
    lerpC1.current.lerp(currentTheme.c1, 0.05);
    lerpC2.current.lerp(currentTheme.c2, 0.05);
    lerpC3.current.lerp(currentTheme.c3, 0.05);
    lerpC4.current.lerp(currentTheme.c4, 0.05);

    // Subtle breathing pulse (sinusoidal hue & intensity drift)
    const breath = Math.sin(t * 0.4) * 0.15 + 0.85;

    if (pointsRef.current) {
      pointsRef.current.rotation.y = t * 0.008;
      pointsRef.current.rotation.x = Math.sin(t * 0.005) * 0.05;
    }

    if (cloudsRef.current) {
      cloudsRef.current.children.forEach((cloud, i) => {
        cloud.rotation.z = t * (0.01 + i * 0.005) * (i % 2 === 0 ? 1 : -1);
        cloud.scale.setScalar(breath * (1 + i * 0.1));
      });
    }
  });

  return (
    <group>
      {/* 1. Deep Space Starfield */}
      <Stars radius={110} depth={60} count={3500} factor={4} saturation={0.8} fade speed={1.2} />

      {/* 2. Swirling Colorful Nebula Dust Particles */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particleCount}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={particleCount}
            array={baseColors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.28}
          vertexColors
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* 3. Luminous Volumetric Nebula Cloud Glow Meshes */}
      <group ref={cloudsRef}>
        {/* Jade / Emerald Cloud */}
        <mesh position={[-25, 8, -35]}>
          <sphereGeometry args={[22, 16, 16]} />
          <meshBasicMaterial
            color={currentTheme.c2}
            transparent
            opacity={0.12}
            blending={THREE.AdditiveBlending}
            side={THREE.BackSide}
          />
        </mesh>

        {/* Teal / Cyan Cosmic Gas */}
        <mesh position={[28, -6, -40]}>
          <sphereGeometry args={[26, 16, 16]} />
          <meshBasicMaterial
            color={currentTheme.c1}
            transparent
            opacity={0.14}
            blending={THREE.AdditiveBlending}
            side={THREE.BackSide}
          />
        </mesh>

        {/* Golden Stardust Cloud */}
        <mesh position={[6, 18, -45]}>
          <sphereGeometry args={[18, 16, 16]} />
          <meshBasicMaterial
            color={currentTheme.c3}
            transparent
            opacity={0.1}
            blending={THREE.AdditiveBlending}
            side={THREE.BackSide}
          />
        </mesh>

        {/* Deep Violet / Plum Cosmic Veil */}
        <mesh position={[-10, -20, -38]}>
          <sphereGeometry args={[24, 16, 16]} />
          <meshBasicMaterial
            color={currentTheme.c4}
            transparent
            opacity={0.15}
            blending={THREE.AdditiveBlending}
            side={THREE.BackSide}
          />
        </mesh>
      </group>
    </group>
  );
}
