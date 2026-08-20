import React, { useMemo, useRef, useState, useEffect, Suspense, Component } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';
import { GitNode } from './GitNode';
import { 
  ShieldAlert, 
  Flame, 
  Copy, 
  HelpCircle, 
  CheckCircle2, 
  AlertTriangle,
  Filter,
  Layers
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
        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-950 p-6">
          <p className="text-sm font-mono text-amber-400 mb-2">3D Acceleration Unavailable</p>
          <p className="text-xs text-slate-500">Falling back to 2D HUD mode...</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// Spaced-out 3D Spatial Cluster Centers
const CLUSTERS = {
  security_urgent: {
    id: 'security_urgent',
    name: 'Security & Urgent Hub',
    color: '#ef4444',
    icon: ShieldAlert,
    center: [0, 9.5, 0],
  },
  regression: {
    id: 'regression',
    name: 'Historical Regressions',
    color: '#d946ef',
    icon: AlertTriangle,
    center: [-14.5, 4.5, -4.5],
  },
  contentious: {
    id: 'contentious',
    name: 'Contentious Proposals',
    color: '#f59e0b',
    icon: Flame,
    center: [14.5, 3.5, 4.5],
  },
  duplicates: {
    id: 'duplicates',
    name: 'Semantic Duplicates',
    color: '#64748b',
    icon: Copy,
    center: [12.5, -8.5, -4.5],
  },
  needs_info: {
    id: 'needs_info',
    name: 'Missing Information',
    color: '#06b6d4',
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

// Camera Controller that only animates during selection transitions, yielding full control to OrbitControls
function SmoothCameraController({ selectedPosition, isUserInteracting, controlsRef }) {
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
    } else {
      targetLookAt.current.set(0, 0, 0);
      targetCamPos.current.set(0, 4, 34);
      animating.current = true;
      animationFrames.current = 45;
    }
  }, [selectedPosition]);

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
  // Group and intelligently cap issues per cluster for high performance and clean tree visualization
  const { nodeData, clusterList, connections, selectedPos } = useMemo(() => {
    const clusterMap = {
      security_urgent: [],
      regression: [],
      contentious: [],
      duplicates: [],
      needs_info: [],
      normal: [],
    };

    issues.forEach((issue) => {
      const cats = issue.latest_categories || [];
      if (cats.includes('security-sensitive') || cats.includes('urgent')) {
        clusterMap.security_urgent.push(issue);
      } else if (cats.includes('possible-regression')) {
        clusterMap.regression.push(issue);
      } else if (cats.includes('contentious')) {
        clusterMap.contentious.push(issue);
      } else if (cats.includes('likely-duplicate') || cats.includes('stale/needs-triage')) {
        clusterMap.duplicates.push(issue);
      } else if (cats.includes('needs-more-info')) {
        clusterMap.needs_info.push(issue);
      } else {
        clusterMap.normal.push(issue);
      }
    });

    const nodes = [];
    const conns = [];
    const activeClusters = [];
    let selPos = null;

    Object.entries(clusterMap).forEach(([clusterKey, allClusterIssues]) => {
      // Filter out if user selected a specific category filter
      if (activeFilter !== 'all' && activeFilter !== clusterKey) {
        return;
      }

      const clusterCfg = CLUSTERS[clusterKey];
      const totalCount = allClusterIssues.length;

      if (totalCount > 0) {
        // Cap visible nodes per cluster to keep 3D tree responsive and readable (e.g. max 6-8 per cluster)
        const visibleIssues = allClusterIssues.slice(0, 7);

        activeClusters.push({
          ...clusterCfg,
          totalCount,
          visibleCount: visibleIssues.length,
        });

        // Spacious radial distribution around cluster center
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

          // Intra-cluster connection link
          if (idx > 0) {
            conns.push({
              p1: nodes[nodes.length - 2].position,
              p2: pos,
              color: clusterCfg.color,
              isDashed: clusterKey === 'duplicates',
            });
          }
        });

        // Connector from cluster center to global hub
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
      <ambientLight intensity={0.9} />
      <directionalLight position={[15, 22, 15]} intensity={2.2} color="#e0f2fe" />
      <pointLight position={[-15, -15, -15]} intensity={1.5} color="#6366f1" />
      <pointLight position={[0, 12, 10]} intensity={1.8} color="#38bdf8" />

      {/* Starfield & Deep Space Grid */}
      <Stars radius={90} depth={60} count={3500} factor={4} saturation={0.6} fade speed={1} />
      <gridHelper args={[160, 80, '#1e293b', '#0b1329']} position={[0, -12, 0]} />

      {/* Camera Controller */}
      <SmoothCameraController
        selectedPosition={selectedPos}
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
            onSelect={onSelectIssue}
          />
        ))}
      </group>

      {/* Floating 3D Cluster Header Badges (Proportionally Scaled with transform & sprite) */}
      {clusterList.map((c) => {
        const Icon = c.icon;
        return (
          <Html
            key={`cluster-${c.id}`}
            transform
            sprite
            position={[c.center[0], c.center[1] + 2.8, c.center[2]]}
            distanceFactor={14}
            zIndexRange={[1, 10]}
            className="pointer-events-none select-none"
          >
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-mono font-bold backdrop-blur-2xl border shadow-2xl uppercase tracking-wider whitespace-nowrap"
              style={{
                backgroundColor: 'rgba(5, 8, 17, 0.92)',
                borderColor: c.color,
                color: c.color,
                boxShadow: `0 0 25px ${c.color}40`,
              }}
            >
              <Icon className="w-4 h-4" />
              <span>{c.name}</span>
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-slate-200 text-[10px]">
                {c.totalCount} {c.totalCount === 1 ? 'issue' : 'issues'}
              </span>
            </div>
          </Html>
        );
      })}

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

  return (
    <div className="w-full h-full relative select-none">
      {/* Floating Category Filter Pills on Top of 3D Scene */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 p-1 rounded-2xl glass-panel border border-white/10 shadow-2xl backdrop-blur-xl pointer-events-auto">
        <button
          onClick={() => setActiveFilter('all')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono transition ${
            activeFilter === 'all'
              ? 'bg-sky-500/25 text-sky-200 border border-sky-400/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3 h-3 text-sky-400" />
          <span>All ({issues.length})</span>
        </button>

        <button
          onClick={() => setActiveFilter('security_urgent')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono transition ${
            activeFilter === 'security_urgent'
              ? 'bg-red-950/90 text-red-300 border border-red-500/50 shadow-sm'
              : 'text-slate-400 hover:text-red-300'
          }`}
        >
          <ShieldAlert className="w-3 h-3 text-red-400" />
          <span>Security & Urgent</span>
        </button>

        <button
          onClick={() => setActiveFilter('regression')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono transition ${
            activeFilter === 'regression'
              ? 'bg-purple-950/90 text-purple-300 border border-purple-500/50 shadow-sm'
              : 'text-slate-400 hover:text-purple-300'
          }`}
        >
          <AlertTriangle className="w-3 h-3 text-purple-400" />
          <span>Regressions</span>
        </button>

        <button
          onClick={() => setActiveFilter('contentious')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono transition ${
            activeFilter === 'contentious'
              ? 'bg-amber-950/90 text-amber-300 border border-amber-500/50 shadow-sm'
              : 'text-slate-400 hover:text-amber-300'
          }`}
        >
          <Flame className="w-3 h-3 text-amber-400" />
          <span>Contentious</span>
        </button>

        <button
          onClick={() => setActiveFilter('duplicates')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono transition ${
            activeFilter === 'duplicates'
              ? 'bg-slate-800 text-slate-200 border border-slate-600 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Copy className="w-3 h-3 text-slate-400" />
          <span>Duplicates</span>
        </button>

        <button
          onClick={() => setActiveFilter('needs_info')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono transition ${
            activeFilter === 'needs_info'
              ? 'bg-cyan-950/90 text-cyan-300 border border-cyan-500/50 shadow-sm'
              : 'text-slate-400 hover:text-cyan-300'
          }`}
        >
          <HelpCircle className="w-3 h-3 text-cyan-400" />
          <span>Needs Info</span>
        </button>
      </div>

      <ErrorBoundary3D fallback={fallback}>
        <Suspense
          fallback={
            <div className="w-full h-full flex items-center justify-center bg-slate-950/80 backdrop-blur-md text-sky-400 font-mono text-sm">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
                <span>Mapping Spacious Issue Clusters...</span>
              </div>
            </div>
          }
        >
          <Canvas
            camera={{ position: [0, 4, 34], fov: 50 }}
            gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
            onPointerMissed={() => onSelectIssue(null)}
          >
            <color attach="background" args={['#040711']} />
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
