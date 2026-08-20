import React, { useMemo, Suspense, Component } from 'react';
import { Canvas } from '@react-three/fiber';
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
    name: 'Critical Security & Urgent Hub',
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
    name: 'Contentious Proposals & Pushback',
    color: '#f59e0b',
    icon: Flame,
    center: [14.5, 3.5, 4.5],
  },
  duplicates: {
    id: 'duplicates',
    name: 'Semantic Duplicates & Stale Backlog',
    color: '#64748b',
    icon: Copy,
    center: [12.5, -8.5, -4.5],
  },
  needs_info: {
    id: 'needs_info',
    name: 'Missing Reproduction & Environment Info',
    color: '#06b6d4',
    icon: HelpCircle,
    center: [-12.5, -8.5, 4.5],
  },
  normal: {
    id: 'normal',
    name: 'Standard Triaged Backlog',
    color: '#10b981',
    icon: CheckCircle2,
    center: [0, -3.0, 0],
  },
};

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

function SceneContent({ issues = [], selectedIssue, onSelectIssue }) {
  // Group issues into spacious category-based clusters
  const { nodeData, clusterList, connections } = useMemo(() => {
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

    Object.entries(clusterMap).forEach(([clusterKey, clusterIssues]) => {
      const clusterCfg = CLUSTERS[clusterKey];
      if (clusterIssues.length > 0) {
        activeClusters.push({
          ...clusterCfg,
          count: clusterIssues.length,
        });

        // Spacious radial distribution around cluster center
        const cCenter = clusterCfg.center;
        clusterIssues.forEach((issue, idx) => {
          const count = clusterIssues.length;
          // Increased orbital radius for spacious separation
          const radius = count > 1 ? 3.2 + (idx * 1.2) : 0.0;
          const angle = (idx / Math.max(1, count)) * Math.PI * 2 + 0.35;

          const pos = [
            cCenter[0] + Math.cos(angle) * radius,
            cCenter[1] + (Math.sin(idx * 2.5) * 0.8),
            cCenter[2] + Math.sin(angle) * radius,
          ];

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

    return { nodeData: nodes, clusterList: activeClusters, connections: conns };
  }, [issues]);

  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[15, 22, 15]} intensity={2.2} color="#e0f2fe" />
      <pointLight position={[-15, -15, -15]} intensity={1.5} color="#6366f1" />
      <pointLight position={[0, 12, 10]} intensity={1.8} color="#38bdf8" />

      {/* Starfield & Deep Space Grid */}
      <Stars radius={90} depth={60} count={3500} factor={4} saturation={0.6} fade speed={1} />
      <gridHelper args={[160, 80, '#1e293b', '#0b1329']} position={[0, -12, 0]} />

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

      {/* Floating 3D Cluster Header Badges */}
      {clusterList.map((c) => {
        const Icon = c.icon;
        return (
          <Html
            key={`cluster-${c.id}`}
            position={[c.center[0], c.center[1] + 2.8, c.center[2]]}
            center
            distanceFactor={32}
            className="pointer-events-none"
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
                {c.count} {c.count === 1 ? 'issue' : 'issues'}
              </span>
            </div>
          </Html>
        );
      })}

      <OrbitControls
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.5}
        zoomSpeed={0.8}
        panSpeed={0.6}
        minDistance={8}
        maxDistance={75}
      />
    </>
  );
}

export function GitTreeScene({ issues = [], selectedIssue, onSelectIssue, fallback }) {
  return (
    <div className="w-full h-full relative select-none">
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
            />
          </Canvas>
        </Suspense>
      </ErrorBoundary3D>
    </div>
  );
}
