import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Float } from '@react-three/drei';
import * as THREE from 'three';

function LogoMesh() {
  const meshRef = useRef();
  const { scene } = useGLTF('/models/repoguardian_logo.glb');

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    meshRef.current.rotation.y = t * 0.75;
    meshRef.current.rotation.x = Math.sin(t * 0.4) * 0.12;
  });

  return (
    <Float speed={2.0} rotationIntensity={0.3} floatIntensity={0.4}>
      <primitive ref={meshRef} object={scene} scale={0.72} />
    </Float>
  );
}

export function GuardianLogo3D({ className = "w-10 h-10" }) {
  return (
    <div className={`${className} relative flex items-center justify-center`}>
      <Canvas
        camera={{ position: [0, 0, 4.0], fov: 42 }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={1.8} />
        <directionalLight position={[5, 8, 5]} intensity={2.5} color="#ffffff" />
        <pointLight position={[-5, -5, -5]} intensity={1.8} color="#38bdf8" />
        <pointLight position={[5, -5, 5]} intensity={1.5} color="#06b6d4" />
        <LogoMesh />
      </Canvas>
    </div>
  );
}

useGLTF.preload('/models/repoguardian_logo.glb');
