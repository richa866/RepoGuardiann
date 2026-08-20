import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function GitBranchLines({ nodePositions = [] }) {
  const particlesRef = useRef();

  // Generate branch curves between adjacent nodes
  const curves = useMemo(() => {
    if (nodePositions.length < 2) return [];
    const list = [];
    for (let i = 0; i < nodePositions.length - 1; i++) {
      const p1 = new THREE.Vector3(...nodePositions[i]);
      const p2 = new THREE.Vector3(...nodePositions[i + 1]);

      // Create a smooth arching curve
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      // Alternate slight curve in Y and Z for 3D depth
      mid.y += (i % 2 === 0 ? 0.6 : -0.4);
      mid.z += (i % 3 === 0 ? 0.8 : -0.5);

      const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
      list.push(curve);
    }
    return list;
  }, [nodePositions]);

  // Create tube geometries for cyber glowing lines
  const tubeGeometries = useMemo(() => {
    return curves.map((c) => new THREE.TubeGeometry(c, 24, 0.035, 8, false));
  }, [curves]);

  // Data pulse animation along the branches
  const pulseCount = 12;
  const pulsePoints = useMemo(() => {
    return new Float32Array(pulseCount * 3);
  }, [pulseCount]);

  useFrame(({ clock }) => {
    if (!particlesRef.current || curves.length === 0) return;
    const t = clock.getElapsedTime() * 0.4;

    const positions = particlesRef.current.geometry.attributes.position.array;
    for (let i = 0; i < pulseCount; i++) {
      const curveIndex = (i + Math.floor(t)) % curves.length;
      const curve = curves[curveIndex];
      const progress = (t * 0.8 + i / pulseCount) % 1.0;
      const pt = curve.getPoint(progress);

      positions[i * 3] = pt.x;
      positions[i * 3 + 1] = pt.y;
      positions[i * 3 + 2] = pt.z;
    }
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <group>
      {tubeGeometries.map((geo, idx) => (
        <mesh key={idx} geometry={geo}>
          <meshBasicMaterial
            color={idx % 2 === 0 ? '#38bdf8' : '#6366f1'}
            transparent
            opacity={0.35}
          />
        </mesh>
      ))}

      {/* Traveling Data Pulses */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={pulseCount}
            array={pulsePoints}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.18}
          color="#38bdf8"
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
