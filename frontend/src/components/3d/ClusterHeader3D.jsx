import React, { useMemo } from 'react';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';

export function ClusterHeader3D({ cluster, position }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 1024, 256);

    // 1. Frosted Dark Pill Background
    ctx.beginPath();
    ctx.roundRect(24, 24, 976, 208, 104);
    ctx.fillStyle = 'rgba(4, 7, 18, 0.94)';
    ctx.fill();

    // 2. High-Contrast Border with Category Glow
    ctx.lineWidth = 6;
    ctx.strokeStyle = cluster.color;
    ctx.shadowColor = cluster.color;
    ctx.shadowBlur = 24;
    ctx.stroke();
    ctx.shadowBlur = 0; // reset

    // 3. Category Indicator Dot
    ctx.beginPath();
    ctx.arc(80, 128, 18, 0, Math.PI * 2);
    ctx.fillStyle = cluster.color;
    ctx.fill();

    // 4. Clean High-Contrast Typography
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px "JetBrains Mono", monospace, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(cluster.name.toUpperCase(), 124, 128);

    // 5. Minimalist Count Badge Pill
    const countText = `${cluster.totalCount || 0}`;
    const countWidth = Math.max(110, ctx.measureText(countText).width + 50);
    const countX = 976 - countWidth + 10;

    ctx.beginPath();
    ctx.roundRect(countX, 56, countWidth, 144, 72);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 46px "JetBrains Mono", monospace, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(countText, countX + countWidth / 2, 128);

    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }, [cluster.name, cluster.color, cluster.totalCount]);

  return (
    <Billboard position={position} follow={true} lockX={false} lockY={false} lockZ={false}>
      {/* Frosted Backing Plane for WebGL Depth Buffer Occlusion */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[5.8, 1.45]} />
        <meshBasicMaterial color="#040712" depthWrite={true} depthTest={true} />
      </mesh>

      {/* Front Textured Badge */}
      <mesh>
        <planeGeometry args={[5.8, 1.45]} />
        <meshBasicMaterial
          map={texture}
          transparent={true}
          depthWrite={true}
          depthTest={true}
          toneMapped={false}
        />
      </mesh>
    </Billboard>
  );
}
