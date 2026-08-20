import React, { useMemo, useRef, useState, useEffect, Suspense, Component } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { GitNode } from './GitNode';
import { NebulaBackground } from './NebulaBackground';
import { ClusterHeader3D } from './ClusterHeader3D';
import { DynamicFilterRibbon } from '../hud/DynamicFilterRibbon';
import { 
  ShieldAlert, 
  Flame, 
  Copy, 
  HelpCircle, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';

class ErrorBoundary3D extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.warn("3D Scene Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 bg-black p-6">
          <p className="text-sm font-mono text-amber-400 mb-2">3D Acceleration Unavailable</p>
          <p className="text-xs text-zinc-500">Falling back to 2D HUD mode...</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// Spaced-out 3D Spatial Cluster Centers
export const CLUSTERS = {
  security_urgent: {
    id: 'security_urgent',
    name: 'Security & Urgent Hub',
    color: '#f43f5e',
    icon: ShieldAlert,
    center: [0, 8.5, 0],
  },
  regression: {
    id: 'regression',
    name: 'Historical Regressions',
    color: '#c084fc',
    icon: AlertTriangle,
    center: [-14.5, 4.5, -4.5],
  },
  contentious: {
    id: 'contentious',
    name: 'Contentious Proposals',
    color: '#fbbf24',
    icon: Flame,
    center: [14.5, 3.5, 4.5],
  },
  duplicates: {
    id: 'duplicates',
    name: 'Semantic Duplicates',
    color: '#94a3b8',
    icon: Copy,
    center: [12.5, -8.5, -4.5],
  },
  needs_info: {
    id: 'needs_info',
    name: 'Missing Information',
    color: '#2dd4bf',
    icon: HelpCircle,
    center: [-12.5, -8.5, 4.5],
  },
  normal: {
    id: 'normal',
    name: 'Standard Backlog',
    color: '#10b981',
    icon: CheckCircle2,
    center: [0, -3.0, 0],
  },
};

export function matchesCategory(cats = [], clusterKey) {
  if (!Array.isArray(cats)) return false;
  if (clusterKey === 'security_urgent') {
    return cats.includes('security-sensitive') || cats.includes('urgent');
  }
  if (clusterKey === 'regression') {
    return cats.includes('possible-regression');
  }
  if (clusterKey === 'contentious') {
    return cats.includes('contentious');
  }
  if (clusterKey === 'duplicates') {
    return cats.includes('likely-duplicate') || cats.includes('stale/needs-triage');
  }
  if (clusterKey === 'needs_info') {
    return (
      cats.includes('needs-more-info') ||
      cats.includes('needs-info') ||
      cats.includes('needs_info') ||
      cats.some((c) => typeof c === 'string' && c.toLowerCase().includes('info'))
    );
  }
  return false;
}

const THEME_BACKGROUNDS = {
  all: '#040714',
  security_urgent: '#0d0406',
  regression: '#0a0312',
  contentious: '#0c0702',
  duplicates: '#030712',
  needs_info: '#020c0e',
};

// Camera Controller that smoothly pans to center the active cluster or selected node
function SmoothCameraController({ selectedPosition, activeFilter, isUserInteracting, controlsRef }) {
  const { camera } = useThree();
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const targetCamPos = useRef(new THREE.Vector3(0, 4, 34));
  const animating = useRef(false);
  const animationFrames = useRef(0);

  useEffect(() => {
    if (selectedPosition) {
      targetLookAt.current.set(selectedPosition[0], selectedPosition[1], selectedPosition[2]);
      targetCamPos.current.set(
        selectedPosition[0],
        selectedPosition[1] + 1.0,
        selectedPosition[2] + 9.0
      );
      animating.current = true;
      animationFrames.current = 45;
    } else if (activeFilter !== 'all' && CLUSTERS[activeFilter]) {
      const c = CLUSTERS[activeFilter].center;
      targetLookAt.current.set(c[0], c[1], c[2]);
      targetCamPos.current.set(c[0], c[1] + 0.8, c[2] + 18.0);
      animating.current = true;
      animationFrames.current = 45;
    } else {
      targetLookAt.current.set(0, 0, 0);
      targetCamPos.current.set(0, 4, 34);
      animating.current = true;
      animationFrames.current = 45;
    }
  }, [selectedPosition, activeFilter]);

  useFrame(() => {
    if (isUserInteracting.current) {
      animating.current = false;
      return;
    }

    if (animating.current && animationFrames.current > 0) {
      if (controlsRef.current) {
        controlsRef.current.target.lerp(targetLookAt.current, 0.08);
      }
      camera.position.lerp(targetCamPos.current, 0.08);
      animationFrames.current--;
      if (animationFrames.current <= 0) {
        animating.current = false;
      }
    }
  });

  return null;
}

function ClusterConnectors({ connections = [] }) {
  const tubeGeos = useMemo(() => {
    return connections.map(({ p1, p2, color, isDashed }) => {
      const v1 = new THREE.Vector3(...p1);
      const v2 = new THREE.Vector3(...p2);
      const mid = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);
      mid.y += 0.6;
      const curve = new THREE.QuadraticBezierCurve3(v1, mid, v2);
      return {
        geo: new THREE.TubeGeometry(curve, 24, isDashed ? 0.03 : 0.045, 8, false),
        color,
        opacity: isDashed ? 0.3 : 0.45,
      };
    });
  }, [connections]);

  return (
    <group>
      {tubeGeos.map((item, idx) => (
        <mesh key={idx} geometry={item.geo}>
          <meshBasicMaterial color={item.color} transparent opacity={item.opacity} />
        </mesh>
      ))}
    </group>
  );
}

function SceneContent({ 
  issues = [], 
  selectedIssue, 
  onSelectIssue, 
  controlsRef, 
  isUserInteracting,
  activeFilter = 'all' 
}) {
  const { nodeData, clusterList, connections, selectedPos } = useMemo(() => {
    const clusterMap = {
      security_urgent: [],
      regression: [],
      contentious: [],
      duplicates: [],
      needs_info: [],
      normal: [],
    };

    if (activeFilter !== 'all') {
      issues.forEach((issue) => {
        const cats = issue.latest_categories || [];
        if (matchesCategory(cats, activeFilter)) {
          clusterMap[activeFilter].push(issue);
        }
      });
    } else {
      issues.forEach((issue) => {
        const cats = issue.latest_categories || [];
        if (matchesCategory(cats, 'security_urgent')) {
          clusterMap.security_urgent.push(issue);
        } else if (matchesCategory(cats, 'regression')) {
          clusterMap.regression.push(issue);
        } else if (matchesCategory(cats, 'contentious')) {
          clusterMap.contentious.push(issue);
        } else if (matchesCategory(cats, 'duplicates')) {
          clusterMap.duplicates.push(issue);
        } else if (matchesCategory(cats, 'needs_info')) {
          clusterMap.needs_info.push(issue);
        } else {
          clusterMap.normal.push(issue);
        }
      });
    }

    const nodes = [];
    const conns = [];
    const activeClusters = [];
    let selPos = null;

    Object.entries(clusterMap).forEach(([clusterKey, allClusterIssues]) => {
      if (activeFilter !== 'all' && activeFilter !== clusterKey) {
        return;
      }

      const clusterCfg = CLUSTERS[clusterKey];
      const totalCount = allClusterIssues.length;

      if (totalCount > 0) {
        const visibleIssues = allClusterIssues.slice(0, 10);

        activeClusters.push({
          ...clusterCfg,
          totalCount,
          visibleCount: visibleIssues.length,
        });

        const cCenter = clusterCfg.center;
        visibleIssues.forEach((issue, idx) => {
          const count = visibleIssues.length;
          const radius = count > 1 ? 3.2 + (idx * 1.1) : 0.0;
          const angle = (idx / Math.max(1, count)) * Math.PI * 2 + 0.35;

          const pos = [
            cCenter[0] + Math.cos(angle) * radius,
            cCenter[1] + (Math.sin(idx * 2.5) * 0.8),
            cCenter[2] + Math.sin(angle) * radius,
          ];

          if (selectedIssue && selectedIssue.number === issue.number && selectedIssue.repo === issue.repo) {
            selPos = pos;
          }

          nodes.push({ issue, position: pos, clusterKey });

          if (idx > 0) {
            conns.push({
              p1: nodes[nodes.length - 2].position,
              p2: pos,
              color: clusterCfg.color,
              isDashed: clusterKey === 'duplicates',
            });
          }
        });

        conns.push({
          p1: [0, 0, 0],
          p2: cCenter,
          color: clusterCfg.color,
          isDashed: true,
        });
      }
    });

    return { nodeData: nodes, clusterList: activeClusters, connections: conns, selectedPos: selPos };
  }, [issues, selectedIssue, activeFilter]);

  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[15, 22, 15]} intensity={2.4} color="#e0f2fe" />
      <pointLight position={[-15, -15, -15]} intensity={1.8} color="#6366f1" />
      <pointLight position={[0, 12, 10]} intensity={2.0} color="#38bdf8" />

      {/* Colorful Breathing Nebula Space Environment */}
      <NebulaBackground activeTheme={activeFilter} />

      {/* Smooth Camera Controller */}
      <SmoothCameraController
        selectedPosition={selectedPos}
        activeFilter={activeFilter}
        isUserInteracting={isUserInteracting}
        controlsRef={controlsRef}
      />

      {/* Cluster Connecting Tubes */}
      <ClusterConnectors connections={connections} />

      {/* 3D Smooth Issue Nodes */}
      <group>
        {nodeData.map(({ issue, position }) => (
          <GitNode
            key={`${issue.repo}-${issue.number}`}
            issue={issue}
            position={position}
            isSelected={selectedIssue?.number === issue.number && selectedIssue?.repo === issue.repo}
            selectedIssue={selectedIssue}
            onSelect={onSelectIssue}
          />
        ))}
      </group>

      {/* Genuine WebGL 3D Billboard Cluster Header Badges with Depth Occlusion (Hidden during node inspection to keep view clean) */}
      {!selectedIssue && clusterList.map((c) => (
        <ClusterHeader3D
          key={`cluster-${c.id}`}
          cluster={c}
          position={[c.center[0], c.center[1] + 2.8, c.center[2]]}
        />
      ))}

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.6}
        zoomSpeed={0.9}
        panSpeed={0.7}
        minDistance={4}
        maxDistance={80}
        onStart={() => {
          isUserInteracting.current = true;
        }}
        onEnd={() => {
          isUserInteracting.current = false;
        }}
      />
    </>
  );
}

export function GitTreeScene({ issues = [], selectedIssue, onSelectIssue, fallback }) {
  const controlsRef = useRef();
  const isUserInteracting = useRef(false);
  const [activeFilter, setActiveFilter] = useState('all');

  const countMap = useMemo(() => {
    const map = {
      all: issues.length,
      security_urgent: 0,
      regression: 0,
      contentious: 0,
      duplicates: 0,
      needs_info: 0,
    };
    issues.forEach((i) => {
      const cats = i.latest_categories || [];
      if (matchesCategory(cats, 'security_urgent')) map.security_urgent++;
      if (matchesCategory(cats, 'regression')) map.regression++;
      if (matchesCategory(cats, 'contentious')) map.contentious++;
      if (matchesCategory(cats, 'duplicates')) map.duplicates++;
      if (matchesCategory(cats, 'needs_info')) map.needs_info++;
    });
    return map;
  }, [issues]);

  const bgColor = THEME_BACKGROUNDS[activeFilter] || THEME_BACKGROUNDS.all;

  return (
    <div className="w-full h-full relative select-none">
      {/* Dynamic Vertical Pill-Shaped Filter Slider on Right Flank */}
      <DynamicFilterRibbon
        activeFilter={activeFilter}
        onSelectFilter={setActiveFilter}
        countMap={countMap}
      />

      <ErrorBoundary3D fallback={fallback}>
        <Suspense
          fallback={
            <div className="w-full h-full flex items-center justify-center bg-black/80 backdrop-blur-md text-zinc-400 font-mono text-sm">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Mapping 3D Cluster Matrix...</span>
              </div>
            </div>
          }
        >
          <Canvas
            camera={{ position: [0, 4, 34], fov: 50 }}
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
            onPointerMissed={() => onSelectIssue(null)}
          >
            <color attach="background" args={[bgColor]} />
            <SceneContent
              issues={issues}
              selectedIssue={selectedIssue}
              onSelectIssue={onSelectIssue}
              controlsRef={controlsRef}
              isUserInteracting={isUserInteracting}
              activeFilter={activeFilter}
            />
          </Canvas>
        </Suspense>
      </ErrorBoundary3D>
    </div>
  );
}
