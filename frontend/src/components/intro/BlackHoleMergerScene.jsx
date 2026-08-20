import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// 1. Dynamic Color-Shifting Cosmic Background Shader
const NebulaSkyShader = {
  uniforms: {
    uTime: { value: 0 },
    uProgress: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vPosition;
    void main() {
      vUv = uv;
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float uProgress;
    varying vec2 vUv;
    varying vec3 vPosition;

    // Simplex Noise
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    float fbm(vec3 p) {
      float total = 0.0;
      float amplitude = 0.55;
      float freq = 1.0;
      for (int i = 0; i < 4; i++) {
        total += snoise(p * freq) * amplitude;
        freq *= 2.05;
        amplitude *= 0.48;
      }
      return total;
    }

    void main() {
      vec3 dir = normalize(vPosition);
      float t = uTime * 0.06;
      float p = uProgress * 0.01;

      // Multi-octave cosmic gas density
      float n1 = fbm(dir * 2.2 + vec3(t, t * 0.7, 0.0));
      float n2 = fbm(dir * 3.5 - vec3(0.0, t * 0.5, t * 0.8));
      float gas = smoothstep(-0.2, 0.7, n1 * 0.6 + n2 * 0.4);

      // Dynamic Color Shifting based on Progress:
      // Phase 1 (0-40%): Cyan/Teal deep void
      // Phase 2 (40-80%): Royal Purple / Magenta accretion glow
      // Phase 3 (80-100%): Golden Supernova Radiance
      vec3 colDeepVoid = vec3(0.015, 0.025, 0.05);
      vec3 colTeal     = vec3(0.04, 0.45, 0.55);
      vec3 colMagenta  = vec3(0.65, 0.12, 0.58);
      vec3 colGold     = vec3(0.98, 0.65, 0.22);
      vec3 colWhite    = vec3(0.95, 0.98, 1.0);

      vec3 activeGasCol;
      if (p < 0.45) {
        float f = p / 0.45;
        activeGasCol = mix(colTeal, colMagenta, f);
      } else if (p < 0.85) {
        float f = (p - 0.45) / 0.4;
        activeGasCol = mix(colMagenta, colGold, f);
      } else {
        float f = (p - 0.85) / 0.15;
        activeGasCol = mix(colGold, colWhite, f);
      }

      vec3 finalCol = mix(colDeepVoid, activeGasCol, gas * (0.45 + p * 0.45));

      // Vignette to edges
      gl_FragColor = vec4(finalCol, 1.0);
    }
  `,
};

function DynamicNebulaSky({ progress = 0 }) {
  const matRef = useRef();
  const smoothProg = useRef(progress);

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = clock.getElapsedTime();
      smoothProg.current = THREE.MathUtils.lerp(smoothProg.current, progress, 0.06);
      matRef.current.uniforms.uProgress.value = smoothProg.current;
    }
  });

  return (
    <mesh>
      <sphereGeometry args={[50, 32, 32]} />
      <shaderMaterial
        ref={matRef}
        args={[NebulaSkyShader]}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

// Single Black Hole Body with Smooth Particle Ring
function BlackHoleBody({ color = '#38bdf8', secondaryColor = '#818cf8', scale = 1.0 }) {
  const diskRef = useRef();
  const photonRef = useRef();

  const particleCount = 450;
  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const cols = new Float32Array(particleCount * 3);
    const c1 = new THREE.Color(color);
    const c2 = new THREE.Color(secondaryColor);

    for (let i = 0; i < particleCount; i++) {
      const radius = THREE.MathUtils.lerp(0.8, 2.6, Math.pow(Math.random(), 0.5));
      const angle = Math.random() * Math.PI * 2;
      const height = (Math.random() - 0.5) * 0.15 * (radius * 0.3);

      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = height;
      pos[i * 3 + 2] = Math.sin(angle) * radius;

      const mixed = c1.clone().lerp(c2, Math.random() * 0.8);
      cols[i * 3] = mixed.r;
      cols[i * 3 + 1] = mixed.g;
      cols[i * 3 + 2] = mixed.b;
    }
    return [pos, cols];
  }, [color, secondaryColor]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (diskRef.current) {
      diskRef.current.rotation.y = t * 1.5;
    }
    if (photonRef.current) {
      photonRef.current.rotation.y = -t * 0.4;
    }
  });

  return (
    <group scale={scale}>
      {/* 1. Singularity Event Horizon */}
      <mesh>
        <sphereGeometry args={[0.65, 32, 32]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* 2. Lensing Photon Glow */}
      <mesh ref={photonRef}>
        <sphereGeometry args={[0.74, 32, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.7}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* 3. Accretion Disk Particles */}
      <points ref={diskRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={particleCount} array={positions} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={particleCount} array={colors} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          size={0.065}
          vertexColors
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* 4. Glowing Inner Gas Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.75, 1.8, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

// Gravitational Wave Expansion Rings
function GravitationalWaves({ progress = 0 }) {
  const ringsRef = useRef();

  useFrame(({ clock }) => {
    if (!ringsRef.current) return;
    const t = clock.getElapsedTime();
    const freq = 1.0 + (progress / 100) * 4.0;

    ringsRef.current.children.forEach((ring, i) => {
      const offset = i / 3;
      const wave = (t * freq * 0.6 + offset) % 1.0;
      const scale = 1.0 + wave * 22.0;
      ring.scale.set(scale, scale, scale);
      ring.material.opacity = Math.max(0, (1.0 - wave) * 0.35 * (0.3 + (progress / 100) * 0.7));
    });
  });

  return (
    <group ref={ringsRef} rotation={[Math.PI / 2, 0, 0]}>
      {[0, 1, 2].map((idx) => (
        <mesh key={idx}>
          <ringGeometry args={[0.95, 1.05, 48]} />
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

// Ultra-Smooth Jitter-Free Binary Black Hole Merger
function BinaryOrbitSystem({ progress = 0 }) {
  const bh1Ref = useRef();
  const bh2Ref = useRef();
  const singleBhRef = useRef();
  const shockwaveRef = useRef();
  const angleRef = useRef(0);
  const smoothProgress = useRef(progress);
  const currentSep = useRef(6.0);

  useFrame((_, delta) => {
    // 1. Smooth progress interpolation to eliminate discrete step jumps
    smoothProgress.current = THREE.MathUtils.lerp(smoothProgress.current, progress, 0.08);
    const p = smoothProgress.current / 100;

    // 2. Smooth physical separation curve (smoothly decays to 0)
    const targetSep = 6.0 * Math.pow(1.0 - p, 0.8);
    currentSep.current = THREE.MathUtils.lerp(currentSep.current, targetSep, 0.1);

    // 3. Smooth angular velocity integration (clamped so it never jitters)
    const angularSpeed = THREE.MathUtils.clamp(1.2 + (1.0 - p) * 2.0 + (p * 5.0), 1.2, 7.5);
    angleRef.current += delta * angularSpeed;

    const angle = angleRef.current;
    const r = Math.max(0.0, currentSep.current / 2);

    const isMerged = p > 0.94;
    const mergeFactor = isMerged ? (p - 0.94) / 0.06 : 0.0;

    // Smooth orbital positions
    if (bh1Ref.current && bh2Ref.current) {
      const yBob = Math.sin(angle * 0.5) * 0.3 * (1.0 - mergeFactor);
      bh1Ref.current.position.set(Math.cos(angle) * r, yBob, Math.sin(angle) * r);
      bh2Ref.current.position.set(-Math.cos(angle) * r, -yBob, -Math.sin(angle) * r);

      // Fade out individual holes as they merge
      const scale = Math.max(0.01, (1.0 - mergeFactor * 0.85));
      bh1Ref.current.scale.set(scale, scale, scale);
      bh2Ref.current.scale.set(scale, scale, scale);
    }

    // Smoothly scale in merged singularity core at final phase
    if (singleBhRef.current) {
      if (isMerged) {
        const s = THREE.MathUtils.lerp(0.01, 1.4, mergeFactor);
        singleBhRef.current.scale.set(s, s, s);
      } else {
        singleBhRef.current.scale.set(0.001, 0.001, 0.001);
      }
    }

    // Supernova flash expansion at 100%
    if (shockwaveRef.current && p > 0.96) {
      const flashScale = shockwaveRef.current.scale.x + delta * 20.0;
      shockwaveRef.current.scale.set(flashScale, flashScale, flashScale);
      shockwaveRef.current.material.opacity = Math.max(0, shockwaveRef.current.material.opacity - delta * 1.5);
    }
  });

  return (
    <group>
      {/* Primary Black Hole (Cyan / Teal) */}
      <group ref={bh1Ref}>
        <BlackHoleBody color="#2dd4bf" secondaryColor="#38bdf8" scale={0.9} />
      </group>

      {/* Secondary Black Hole (Rose / Lavender) */}
      <group ref={bh2Ref}>
        <BlackHoleBody color="#f43f5e" secondaryColor="#c084fc" scale={0.8} />
      </group>

      {/* Merged Single Singularity (Appears smoothly at 95%+) */}
      <group ref={singleBhRef} scale={[0.001, 0.001, 0.001]}>
        <BlackHoleBody color="#ffffff" secondaryColor="#38bdf8" scale={1.3} />
      </group>

      {/* Gravitational Wave Ripples */}
      <GravitationalWaves progress={progress} />

      {/* Smooth Coalescence Shockwave */}
      <mesh ref={shockwaveRef} scale={[1, 1, 1]}>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={progress > 97 ? 0.9 : 0.0}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

export function BlackHoleMergerScene({ progress = 0 }) {
  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none">
      <Canvas
        camera={{ position: [0, 5, 14], fov: 48 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={0.5} />
        <DynamicNebulaSky progress={progress} />
        <BinaryOrbitSystem progress={progress} />
      </Canvas>
    </div>
  );
}
