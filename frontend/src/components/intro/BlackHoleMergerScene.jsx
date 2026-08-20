import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Float } from '@react-three/drei';
import * as THREE from 'three';

// Single Black Hole with Event Horizon, Accretion Disk, and Relativistic Jets
function BlackHoleBody({ position, color = '#f97316', secondaryColor = '#38bdf8', scale = 1.0, rotationSpeed = 1.0 }) {
  const diskRef = useRef();
  const jetRef = useRef();
  const photonRef = useRef();

  // Create accretion disk particles
  const particleCount = 600;
  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const cols = new Float32Array(particleCount * 3);
    const c1 = new THREE.Color(color);
    const c2 = new THREE.Color(secondaryColor);

    for (let i = 0; i < particleCount; i++) {
      const radius = THREE.MathUtils.lerp(0.8, 3.2, Math.pow(Math.random(), 0.5));
      const angle = Math.random() * Math.PI * 2;
      const height = (Math.random() - 0.5) * 0.25 * (radius * 0.4);

      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = height;
      pos[i * 3 + 2] = Math.sin(angle) * radius;

      const mixedColor = c1.clone().lerp(c2, Math.random() * 0.7);
      cols[i * 3] = mixedColor.r;
      cols[i * 3 + 1] = mixedColor.g;
      cols[i * 3 + 2] = mixedColor.b;
    }
    return [pos, cols];
  }, [color, secondaryColor]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * rotationSpeed;
    if (diskRef.current) {
      diskRef.current.rotation.y = t * 1.8;
      diskRef.current.rotation.z = Math.sin(t * 0.4) * 0.1;
    }
    if (photonRef.current) {
      photonRef.current.rotation.y = -t * 0.5;
    }
    if (jetRef.current) {
      jetRef.current.rotation.y = t * 3.0;
    }
  });

  return (
    <group position={position} scale={scale}>
      {/* 1. Event Horizon (Pitch Black Singularity Core) */}
      <mesh>
        <sphereGeometry args={[0.7, 32, 32]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* 2. Photon Sphere / Gravitational Lensing Glow Ring */}
      <mesh ref={photonRef}>
        <sphereGeometry args={[0.78, 32, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.65}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* 3. Swirling Accretion Disk Particles */}
      <points ref={diskRef}>
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
            array={colors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.08}
          vertexColors
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* 4. Glowing Accretion Inner Gas Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.85, 2.2, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* 5. Relativistic Plasma Jets */}
      <group ref={jetRef}>
        <mesh position={[0, 2.5, 0]}>
          <cylinderGeometry args={[0.02, 0.25, 4.5, 12, 1, true]} />
          <meshBasicMaterial
            color={secondaryColor}
            transparent
            opacity={0.7}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, -2.5, 0]} rotation={[Math.PI, 0, 0]}>
          <cylinderGeometry args={[0.02, 0.25, 4.5, 12, 1, true]} />
          <meshBasicMaterial
            color={secondaryColor}
            transparent
            opacity={0.7}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
}

// Gravitational Wave Expansion Rings
function GravitationalWaves({ progress = 0 }) {
  const ringsRef = useRef();

  useFrame(({ clock }) => {
    if (!ringsRef.current) return;
    const t = clock.getElapsedTime();
    const frequency = 1.0 + (progress / 100) * 8.0;

    ringsRef.current.children.forEach((ring, i) => {
      const offset = (i / 4);
      const wave = ((t * frequency * 0.8 + offset) % 1.0);
      const scale = 1.0 + wave * 25.0;
      ring.scale.set(scale, scale, scale);
      ring.material.opacity = Math.max(0, (1.0 - wave) * 0.45 * (0.3 + (progress / 100) * 0.7));
    });
  });

  return (
    <group ref={ringsRef} rotation={[Math.PI / 2, 0, 0]}>
      {[0, 1, 2, 3].map((idx) => (
        <mesh key={idx}>
          <ringGeometry args={[0.9, 1.05, 48]} />
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

// Binary Black Hole Merger Simulation
function BinaryOrbitSystem({ progress = 0 }) {
  const bh1Ref = useRef();
  const bh2Ref = useRef();
  const mergerFlashRef = useRef();
  const angleRef = useRef(0);

  // Calculate orbital decay based on loading progress
  const separation = Math.max(0.2, 7.5 * Math.pow(1 - progress / 100, 0.75));
  const isMerged = progress >= 98;

  useFrame((_, delta) => {
    // Angular velocity chirps faster as separation decreases (Keplerian / GR chirp)
    const chirpSpeed = 1.5 + (1.0 / (separation + 0.1)) * 3.5;
    angleRef.current += delta * chirpSpeed;

    const angle = angleRef.current;
    const r = separation / 2;

    if (bh1Ref.current && bh2Ref.current) {
      bh1Ref.current.position.set(Math.cos(angle) * r, Math.sin(angle * 0.6) * 0.5, Math.sin(angle) * r);
      bh2Ref.current.position.set(-Math.cos(angle) * r, -Math.sin(angle * 0.6) * 0.5, -Math.sin(angle) * r);
    }

    if (mergerFlashRef.current && isMerged) {
      const flashScale = mergerFlashRef.current.scale.x + delta * 25.0;
      mergerFlashRef.current.scale.set(flashScale, flashScale, flashScale);
      mergerFlashRef.current.material.opacity = Math.max(0, mergerFlashRef.current.material.opacity - delta * 2.0);
    }
  });

  return (
    <group>
      {/* Black Hole 1 (Primary - Cyan/Azure Plasma) */}
      <group ref={bh1Ref}>
        <BlackHoleBody
          color="#06b6d4"
          secondaryColor="#6366f1"
          scale={0.95}
          rotationSpeed={1.4}
        />
      </group>

      {/* Black Hole 2 (Secondary - Fiery Crimson/Gold Plasma) */}
      <group ref={bh2Ref}>
        <BlackHoleBody
          color="#f97316"
          secondaryColor="#ef4444"
          scale={0.8}
          rotationSpeed={-1.6}
        />
      </group>

      {/* Gravitational Wave Metric Ripples */}
      <GravitationalWaves progress={progress} />

      {/* Final Merger Supernova Flash at 100% */}
      {isMerged && (
        <mesh ref={mergerFlashRef}>
          <sphereGeometry args={[1.5, 32, 32]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={1.0}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
    </group>
  );
}

export function BlackHoleMergerScene({ progress = 0 }) {
  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none">
      <Canvas
        camera={{ position: [0, 6, 16], fov: 50 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#03050c']} />
        <ambientLight intensity={0.2} />

        <Stars radius={70} depth={50} count={3500} factor={4} saturation={0.8} fade speed={1.5} />

        <BinaryOrbitSystem progress={progress} />
      </Canvas>
    </div>
  );
}
