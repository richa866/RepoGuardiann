import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';

// Color themes based on reference image:
// Teal #1b999c, Jade #38a388, Gold #f7d08a, Violet #591a4f, Indigo #1c183e
const THEME_RAMPS = {
  all: {
    c1: [0.106, 0.600, 0.612], // Deep Teal
    c2: [0.220, 0.639, 0.533], // Jade / Emerald
    c3: [0.969, 0.816, 0.541], // Warm Golden Stardust
    c4: [0.349, 0.102, 0.310], // Cosmic Violet / Plum
    c5: [0.110, 0.094, 0.243], // Midnight Indigo
    bg: [0.015, 0.027, 0.078],
  },
  security_urgent: {
    c1: [0.937, 0.267, 0.267], // Crimson
    c2: [0.976, 0.451, 0.086], // Fire Orange
    c3: [0.992, 0.878, 0.278], // Solar Flare Gold
    c4: [0.498, 0.114, 0.114], // Deep Blood Red
    c5: [0.200, 0.020, 0.050], // Obsidian Red
    bg: [0.050, 0.015, 0.025],
  },
  regression: {
    c1: [0.851, 0.275, 0.937], // Magenta
    c2: [0.659, 0.333, 0.969], // Royal Purple
    c3: [0.910, 0.475, 0.976], // Pink Flare
    c4: [0.231, 0.027, 0.392], // Deep Violet
    c5: [0.120, 0.020, 0.200], // Dark Void
    bg: [0.040, 0.010, 0.070],
  },
  contentious: {
    c1: [0.961, 0.620, 0.043], // Amber
    c2: [0.918, 0.702, 0.031], // Gold
    c3: [0.976, 0.451, 0.086], // Solar Orange
    c4: [0.271, 0.102, 0.012], // Deep Umber
    c5: [0.150, 0.050, 0.010], // Dark Amber
    bg: [0.050, 0.025, 0.010],
  },
  duplicates: {
    c1: [0.220, 0.741, 0.973], // Sky Blue
    c2: [0.392, 0.455, 0.545], // Slate
    c3: [0.506, 0.549, 0.973], // Indigo Flare
    c4: [0.059, 0.090, 0.165], // Midnight
    c5: [0.020, 0.040, 0.080], // Deep Oceanic
    bg: [0.010, 0.025, 0.050],
  },
  needs_info: {
    c1: [0.024, 0.714, 0.831], // Cyan
    c2: [0.176, 0.831, 0.749], // Mint / Jade
    c3: [0.220, 0.639, 0.533], // Emerald
    c4: [0.075, 0.306, 0.290], // Deep Teal
    c5: [0.020, 0.100, 0.100], // Deep Sea
    bg: [0.010, 0.045, 0.055],
  },
};

// High-definition Procedural Cosmic Nebula Shader
const NebulaShader = {
  vertexShader: `
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uC1;
    uniform vec3 uC2;
    uniform vec3 uC3;
    uniform vec3 uC4;
    uniform vec3 uC5;
    uniform vec3 uBg;
    varying vec3 vWorldPosition;
    varying vec2 vUv;

    // 3D Simplex noise helper functions
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

    float snoise(vec3 v){
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);

      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);

      vec3 x1 = x0 - i1 + 1.0 * C.xxx;
      vec3 x2 = x0 - i2 + 2.0 * C.xxx;
      vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

      i = mod(i, 289.0);
      vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));

      float n_ = 0.142857142857;
      vec3  ns = n_ * D.wyz - D.xzx;

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
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;

      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    // 5-Octave Fractional Brownian Motion for intricate gas filaments
    float fbm(vec3 p) {
      float v = 0.0;
      float a = 0.52;
      vec3 shift = vec3(100.0);
      for (int i = 0; i < 5; ++i) {
        v += a * snoise(p);
        p = p * 2.05 + shift;
        a *= 0.48;
      }
      return v;
    }

    // 4-Point Diffraction Spike for bright stellar cores
    float diffractionStar(vec2 uv, vec2 center, float size) {
      vec2 d = uv - center;
      float r = length(d);
      float core = smoothstep(size, 0.0, r);
      float spikeX = smoothstep(size * 4.0, 0.0, abs(d.x)) * smoothstep(size * 0.25, 0.0, abs(d.y));
      float spikeY = smoothstep(size * 4.0, 0.0, abs(d.y)) * smoothstep(size * 0.25, 0.0, abs(d.x));
      return core + (spikeX + spikeY) * 0.8;
    }

    void main() {
      vec3 dir = normalize(vWorldPosition);
      float t = uTime * 0.035;

      // Coordinate distortion for organic cosmic swirls
      vec3 p = dir * 2.2;
      p.x += sin(t * 0.4 + p.y) * 0.25;
      p.y += cos(t * 0.3 + p.z) * 0.25;

      float n1 = fbm(p + vec3(0.0, t * 0.2, 0.0));
      float n2 = fbm(p * 1.6 - vec3(t * 0.15, 0.0, t * 0.1));
      float n3 = fbm(p * 3.2 + vec3(0.0, 0.0, t * 0.25));

      // Layered density mask
      float density = smoothstep(-0.25, 0.85, n1 * 0.6 + n2 * 0.4);
      float ridge = smoothstep(0.1, 0.9, n2 + n3 * 0.3);

      // Color Ramp Mixing based on the reference photo
      vec3 col = uBg;
      col = mix(col, uC5, smoothstep(0.0, 0.4, density));
      col = mix(col, uC4, smoothstep(0.2, 0.6, density));
      col = mix(col, uC1, smoothstep(0.4, 0.75, density));
      col = mix(col, uC2, smoothstep(0.55, 0.88, density));
      col = mix(col, uC3, smoothstep(0.72, 1.0, ridge * density));

      // Luminous breathing pulse
      float breath = sin(uTime * 0.4) * 0.08 + 0.92;
      col *= breath;

      // Add prominent stellar nurseries with diffraction spikes
      vec2 uv = vUv;
      float star1 = diffractionStar(uv, vec2(0.35, 0.72), 0.012) * 1.5;
      float star2 = diffractionStar(uv, vec2(0.68, 0.45), 0.009) * 1.2;
      float star3 = diffractionStar(uv, vec2(0.22, 0.38), 0.008) * 1.0;
      float star4 = diffractionStar(uv, vec2(0.78, 0.78), 0.011) * 1.4;

      vec3 starColor = uC3 * 1.2 + vec3(0.3);
      col += (star1 + star2 + star3 + star4) * starColor;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function NebulaBackground({ activeTheme = 'all' }) {
  const meshRef = useRef();
  const theme = THEME_RAMPS[activeTheme] || THEME_RAMPS.all;

  // Uniform values for shader
  const uniforms = useMemo(() => {
    return {
      uTime: { value: 0 },
      uC1: { value: new THREE.Vector3(...theme.c1) },
      uC2: { value: new THREE.Vector3(...theme.c2) },
      uC3: { value: new THREE.Vector3(...theme.c3) },
      uC4: { value: new THREE.Vector3(...theme.c4) },
      uC5: { value: new THREE.Vector3(...theme.c5) },
      uBg: { value: new THREE.Vector3(...theme.bg) },
    };
  }, []);

  // 1,800 High-Density Volumetric Stardust Particles
  const particleCount = 1800;
  const [positions, baseColors] = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const col = new Float32Array(particleCount * 3);

    const palette = [
      new THREE.Color('#f7d08a'),
      new THREE.Color('#38a388'),
      new THREE.Color('#1b999c'),
      new THREE.Color('#e879f9'),
      new THREE.Color('#ffffff'),
    ];

    for (let i = 0; i < particleCount; i++) {
      const r = THREE.MathUtils.lerp(15, 120, Math.pow(Math.random(), 0.5));
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI * 0.85;

      pos[i * 3] = r * Math.cos(phi) * Math.sin(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * 0.7 + (Math.sin(theta * 3) * 8);
      pos[i * 3 + 2] = r * Math.cos(phi) * Math.cos(theta);

      const colorPick = palette[i % palette.length];
      col[i * 3] = colorPick.r;
      col[i * 3 + 1] = colorPick.g;
      col[i * 3 + 2] = colorPick.b;
    }

    return [pos, col];
  }, []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    meshRef.current.material.uniforms.uTime.value = t;

    // Smoothly lerp uniform colors toward active theme
    const u = meshRef.current.material.uniforms;
    const targetC1 = new THREE.Vector3(...theme.c1);
    const targetC2 = new THREE.Vector3(...theme.c2);
    const targetC3 = new THREE.Vector3(...theme.c3);
    const targetC4 = new THREE.Vector3(...theme.c4);
    const targetC5 = new THREE.Vector3(...theme.c5);
    const targetBg = new THREE.Vector3(...theme.bg);

    u.uC1.value.lerp(targetC1, 0.05);
    u.uC2.value.lerp(targetC2, 0.05);
    u.uC3.value.lerp(targetC3, 0.05);
    u.uC4.value.lerp(targetC4, 0.05);
    u.uC5.value.lerp(targetC5, 0.05);
    u.uBg.value.lerp(targetBg, 0.05);
  });

  return (
    <group>
      {/* 1. High-Definition Raymarched Cosmic Nebula Sky Dome */}
      <mesh ref={meshRef} scale={[-1, 1, 1]}>
        <sphereGeometry args={[140, 64, 64]} />
        <shaderMaterial
          vertexShader={NebulaShader.vertexShader}
          fragmentShader={NebulaShader.fragmentShader}
          uniforms={uniforms}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* 2. Twinkling Foreground Starfield */}
      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0.9} fade speed={1.2} />

      {/* 3. Swirling Stardust Ionization Filaments */}
      <points>
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
          size={0.32}
          vertexColors
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
}
