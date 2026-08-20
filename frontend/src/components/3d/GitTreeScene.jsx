import React, { useMemo, useRef, useState, useEffect, useCallback, Suspense, Component } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { GitNode } from './GitNode';
import { NebulaBackground } from './NebulaBackground';
import { ClusterHeader3D } from './ClusterHeader3D';
import { DynamicFilterRibbon } from '../hud/DynamicFilterRibbon';
import { MinimapRadar } from '../hud/MinimapRadar';
import { 
  ShieldAlert, 
  Flame, 
  Copy, 
  HelpCircle, 
  CheckCircle2, 
  AlertTriangle,
  RotateCcw,
  Compass,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
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

// Fallback high-quality seeds to guarantee minimum 3 nodes per sub-type
const DEFAULT_SUBTYPE_SEEDS = {
  security_urgent: [
    {
      number: 1042,
      repo: 'fastapi/typer',
      title: 'Remote code execution via YAML payload in config parser',
      body: 'A crafted config payload can trigger arbitrary code execution (RCE) during deserialization.',
      latest_categories: ['security-sensitive', 'urgent'],
      latest_escalate: true,
      comments_count: 5,
      author: 'security-lead',
    },
    {
      number: 1058,
      repo: 'fastapi/typer',
      title: 'Arbitrary file write via directory traversal in output path',
      body: 'Unsanitized user path parameters allow path traversal ../ writing outside workspace.',
      latest_categories: ['security-sensitive', 'urgent'],
      latest_escalate: true,
      comments_count: 4,
      author: 'audit-bot',
    },
    {
      number: 1077,
      repo: 'fastapi/typer',
      title: 'Buffer overflow / memory corruption in CLI token stream',
      body: 'Long CLI arguments trigger unchecked memory allocation and worker panic.',
      latest_categories: ['security-sensitive'],
      latest_escalate: true,
      comments_count: 7,
      author: 'fuzz-agent',
    },
  ],
  regression: [
    {
      number: 981,
      repo: 'fastapi/typer',
      title: 'Breaking change in v0.12.0 argument parser type coercion',
      body: 'Upgrading from v0.11 breaks custom Enum argument parsing. Regression introduced in commit e8f2a.',
      latest_categories: ['possible-regression'],
      latest_escalate: true,
      comments_count: 12,
      author: 'maintainer2',
    },
    {
      number: 994,
      repo: 'fastapi/typer',
      title: 'Subcommand help string truncated when using nested Typer instances',
      body: 'Help text for nested CLI groups no longer renders parameter descriptions after refactor.',
      latest_categories: ['possible-regression'],
      latest_escalate: true,
      comments_count: 6,
      author: 'cli-user',
    },
    {
      number: 1012,
      repo: 'fastapi/typer',
      title: 'Async callback execution order inverted in middleware chain',
      body: 'Async before/after hooks now fire in reverse sequence compared to v0.10 release.',
      latest_categories: ['possible-regression'],
      latest_escalate: true,
      comments_count: 9,
      author: 'dan_dev',
    },
  ],
  contentious: [
    {
      number: 842,
      repo: 'fastapi/typer',
      title: 'Proposal: Drop support for Python 3.8 and legacy typing syntax',
      body: 'Dispute over Python 3.8 EOL timeline. 24 comments discussing enterprise migration impact.',
      latest_categories: ['contentious'],
      latest_escalate: true,
      comments_count: 24,
      author: 'core-team',
    },
    {
      number: 876,
      repo: 'fastapi/typer',
      title: 'RFC: Replace Click backend with custom lightweight parser',
      body: 'Heated debate on architectural dependency vs performance benefits. 19 comments.',
      latest_categories: ['contentious'],
      latest_escalate: true,
      comments_count: 19,
      author: 'speed-enthusiast',
    },
    {
      number: 915,
      repo: 'fastapi/typer',
      title: 'Should Typer enforce strict TypeVar variance checks by default?',
      body: '15 comments diverging on developer ergonomics vs strict type safety guarantees.',
      latest_categories: ['contentious'],
      latest_escalate: true,
      comments_count: 15,
      author: 'type-checker',
    },
  ],
  duplicates: [
    {
      number: 1102,
      repo: 'fastapi/typer',
      title: 'Auto-complete script fails on Zsh with oh-my-zsh plugin',
      body: 'Likely duplicate of #1088. Zsh completion script generates syntax error on eval.',
      latest_categories: ['likely-duplicate'],
      latest_escalate: false,
      comments_count: 3,
      author: 'zsh-user',
    },
    {
      number: 1115,
      repo: 'fastapi/typer',
      title: 'Zsh shell completion syntax error near token `;;`',
      body: 'Duplicate of #1088. Same stack trace on macOS zsh 5.9.',
      latest_categories: ['likely-duplicate'],
      latest_escalate: false,
      comments_count: 2,
      author: 'mac-dev',
    },
    {
      number: 1129,
      repo: 'fastapi/typer',
      title: 'Completion command returns non-zero exit code on fish shell',
      body: 'Duplicate proposal matching #1044 with 92% semantic cosine similarity.',
      latest_categories: ['likely-duplicate'],
      latest_escalate: false,
      comments_count: 1,
      author: 'fish-fan',
    },
  ],
  needs_info: [
    {
      number: 1140,
      repo: 'fastapi/typer',
      title: 'CLI command randomly hangs on Windows Server 2022',
      body: 'Command hangs intermittently. Missing minimal reproduction code and Python version logs.',
      latest_categories: ['needs-more-info'],
      latest_escalate: false,
      comments_count: 2,
      author: 'win-admin',
    },
    {
      number: 1152,
      repo: 'fastapi/typer',
      title: 'Option parsing error with custom Pydantic validator model',
      body: 'Error thrown on startup. Awaiting user to provide sample Pydantic model definition.',
      latest_categories: ['needs-more-info'],
      latest_escalate: false,
      comments_count: 1,
      author: 'pydantic-coder',
    },
    {
      number: 1168,
      repo: 'fastapi/typer',
      title: 'Rich table formatting misaligned on custom terminal emulator',
      body: 'Reporter did not specify terminal dimensions, font, or TERM environment variable.',
      latest_categories: ['needs-more-info'],
      latest_escalate: false,
      comments_count: 1,
      author: 'term-user',
    },
  ],
  normal: [
    {
      number: 1020,
      repo: 'fastapi/typer',
      title: 'docs: Add tutorial for multi-command CLI with Rich progress bars',
      body: 'Standard documentation improvement request with sample markdown drafts.',
      latest_categories: [],
      latest_escalate: false,
      comments_count: 3,
      author: 'doc-writer',
    },
    {
      number: 1033,
      repo: 'fastapi/typer',
      title: 'feat: Support custom color palettes in help screen theme',
      body: 'Standard feature proposal for theming CLI help screens.',
      latest_categories: [],
      latest_escalate: false,
      comments_count: 4,
      author: 'ui-dev',
    },
    {
      number: 1049,
      repo: 'fastapi/typer',
      title: 'chore: Update development dependencies and pre-commit hooks',
      body: 'Routine maintenance updating ruff, mypy, and pytest to latest releases.',
      latest_categories: [],
      latest_escalate: false,
      comments_count: 2,
      author: 'dependabot',
    },
  ],
};

export const FILTER_KEYS = ['all', 'security_urgent', 'regression', 'contentious', 'duplicates', 'needs_info'];

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

// Procedural Constellation Shapes Generator for Isolated Filter Views
export function getConstellationFormation(count) {
  if (count <= 0) return { positions: [], connections: [] };

  if (count === 1) {
    return {
      positions: [[0, 0, 0]],
      connections: [],
    };
  }

  if (count === 2) {
    return {
      positions: [
        [-5.8, 0, 0],
        [5.8, 0, 0],
      ],
      connections: [[0, 1]],
    };
  }

  if (count === 3) {
    const r = 7.5;
    const p0 = [0, r, 0];
    const p1 = [-r * Math.sin(Math.PI / 3), -r * Math.cos(Math.PI / 3), 0.6];
    const p2 = [r * Math.sin(Math.PI / 3), -r * Math.cos(Math.PI / 3), -0.6];
    return {
      positions: [p0, p1, p2],
      connections: [[0, 1], [1, 2], [2, 0]],
    };
  }

  if (count === 4) {
    const rx = 8.5;
    const ry = 6.8;
    return {
      positions: [
        [0, ry, 0],
        [rx, 0, 0.8],
        [0, -ry, 0],
        [-rx, 0, -0.8],
      ],
      connections: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]],
    };
  }

  if (count === 5) {
    const r = 8.6;
    const positions = [];
    for (let i = 0; i < 5; i++) {
      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const zOffset = i % 2 === 0 ? 0.8 : -0.8;
      positions.push([Math.cos(angle) * r, -Math.sin(angle) * r, zOffset]);
    }
    const connections = [[0, 2], [2, 4], [4, 1], [1, 3], [3, 0]];
    return { positions, connections };
  }

  if (count === 6) {
    const positions = [
      [0, 7.2, 0],
      [-4.6, 2.6, 0.6],
      [4.6, 2.6, -0.6],
      [-7.2, -2.6, 1.0],
      [0, -2.6, 0],
      [7.2, -2.6, -1.0],
    ];
    const connections = [
      [0, 1], [0, 2], [1, 2],
      [1, 3], [2, 5], [3, 4], [4, 5],
    ];
    return { positions, connections };
  }

  if (count === 7) {
    const positions = [
      [0, 7.6, 0],
      [-4.6, 3.2, 0.6],
      [4.6, 3.2, -0.6],
      [-7.4, -1.2, 1.0],
      [0, -1.2, 0],
      [7.4, -1.2, -1.0],
      [0, -5.6, 0],
    ];
    const connections = [
      [0, 1], [0, 2], [1, 2],
      [1, 3], [2, 5], [3, 4], [4, 5],
      [4, 6],
    ];
    return { positions, connections };
  }

  if (count === 8) {
    const rOuter = 9.2;
    const rInner = 5.2;
    const positions = [];
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? rOuter : rInner;
      const angle = (i * 2 * Math.PI) / 8 - Math.PI / 2;
      positions.push([Math.cos(angle) * r, -Math.sin(angle) * r, i % 2 === 0 ? 1.0 : -1.0]);
    }
    const connections = [];
    for (let i = 0; i < 8; i++) {
      connections.push([i, (i + 1) % 8]);
    }
    return { positions, connections };
  }

  if (count === 9 || count === 10) {
    const innerCount = 3;
    const outerCount = count - innerCount;
    const rInner = 7.2;
    const rOuter = 15.5;
    const positions = [];
    const connections = [];

    for (let i = 0; i < innerCount; i++) {
      const angle = (i * 2 * Math.PI) / innerCount - Math.PI / 2;
      positions.push([Math.cos(angle) * rInner, Math.sin(angle) * rInner, 0.6]);
      connections.push([i, (i + 1) % innerCount]);
    }

    for (let j = 0; j < outerCount; j++) {
      const angle = (j * 2 * Math.PI) / outerCount - Math.PI / 2 + Math.PI / outerCount;
      const zOffset = j % 2 === 0 ? -1.8 : 1.8;
      const nodeIdx = innerCount + j;
      positions.push([Math.cos(angle) * rOuter, Math.sin(angle) * rOuter, zOffset]);
      connections.push([nodeIdx, innerCount + ((j + 1) % outerCount)]);

      const nearestInner = Math.floor((j / outerCount) * innerCount);
      connections.push([nearestInner, nodeIdx]);
    }

    return { positions, connections };
  }

  if (count >= 11 && count <= 14) {
    const positions = [];
    const connections = [];
    const pairs = Math.ceil(count / 2);
    const startY = (pairs - 1) * 2.2;

    for (let p = 0; p < pairs; p++) {
      const t = (p / Math.max(1, pairs - 1)) * Math.PI * 2.2;
      const y = startY - p * 4.4;
      const xLeft = -8.2 + Math.sin(t) * 2.8;
      const zLeft = Math.cos(t) * 3.6;
      const idxLeft = p * 2;
      positions.push([xLeft, y, zLeft]);

      if (idxLeft + 1 < count) {
        const xRight = 8.2 - Math.sin(t) * 2.8;
        const zRight = -Math.cos(t) * 3.6;
        const idxRight = idxLeft + 1;
        positions.push([xRight, y, zRight]);

        connections.push([idxLeft, idxRight]);

        if (p > 0) {
          connections.push([idxRight - 2, idxRight]);
        }
      }

      if (p > 0) {
        connections.push([idxLeft - 2, idxLeft]);
      }
    }

    return { positions, connections };
  }

  // 15+ nodes: Tri-Tier Solar Matrix
  const positions = [];
  const connections = [];
  const tier1Count = 3;
  const tier2Count = 6;
  const tier3Count = count - tier1Count - tier2Count;
  const r1 = 6.0;
  const r2 = 13.0;
  const r3 = 20.0;

  for (let i = 0; i < tier1Count; i++) {
    const angle = (i * 2 * Math.PI) / tier1Count - Math.PI / 2;
    positions.push([Math.cos(angle) * r1, Math.sin(angle) * r1, 0.6]);
    connections.push([i, (i + 1) % tier1Count]);
  }

  for (let j = 0; j < tier2Count; j++) {
    const angle = (j * 2 * Math.PI) / tier2Count - Math.PI / 2 + Math.PI / tier2Count;
    const idx = tier1Count + j;
    positions.push([Math.cos(angle) * r2, Math.sin(angle) * r2, j % 2 === 0 ? -1.4 : 1.4]);
    connections.push([idx, tier1Count + ((j + 1) % tier2Count)]);
    connections.push([j % tier1Count, idx]);
  }

  for (let k = 0; k < tier3Count; k++) {
    const angle = (k * 2 * Math.PI) / tier3Count - Math.PI / 2;
    const idx = tier1Count + tier2Count + k;
    positions.push([Math.cos(angle) * r3, Math.sin(angle) * r3, k % 2 === 0 ? 2.0 : -2.0]);
    connections.push([idx, tier1Count + tier2Count + ((k + 1) % tier3Count)]);
    const nearestMantle = tier1Count + (k % tier2Count);
    connections.push([nearestMantle, idx]);
  }

  return { positions, connections };
}

// Dynamic Camera Controller that auto-frames any cluster, preset, or selected node with smooth inertia
function SmoothCameraController({ 
  selectedPosition, 
  activeFilter, 
  viewPreset,
  resetTrigger, 
  autoFrameConfig, 
  isUserInteracting, 
  controlsRef 
}) {
  const { camera, size } = useThree();
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const targetCamPos = useRef(new THREE.Vector3(0, 4, 34));
  const animating = useRef(false);
  const animationFrames = useRef(0);

  useEffect(() => {
    if (selectedPosition) {
      targetLookAt.current.set(selectedPosition[0], selectedPosition[1], selectedPosition[2]);
      targetCamPos.current.set(
        selectedPosition[0] + 1.2,
        selectedPosition[1] + 1.4,
        selectedPosition[2] + 8.5
      );
      animating.current = true;
      animationFrames.current = 50;
    } else if (viewPreset === 'top') {
      targetLookAt.current.set(0, 0, 0);
      targetCamPos.current.set(0, 48, 0.1);
      animating.current = true;
      animationFrames.current = 50;
    } else if (autoFrameConfig) {
      const { center, distance } = autoFrameConfig;
      targetLookAt.current.set(center[0], center[1], center[2]);
      targetCamPos.current.set(center[0], center[1] + 1.2, center[2] + distance);
      animating.current = true;
      animationFrames.current = 50;
    }
  }, [selectedPosition, activeFilter, viewPreset, resetTrigger, autoFrameConfig, size.width, size.height]);

  useFrame(() => {
    if (isUserInteracting.current) {
      animating.current = false;
      return;
    }

    if (animating.current && animationFrames.current > 0) {
      if (controlsRef.current) {
        controlsRef.current.target.lerp(targetLookAt.current, 0.07);
      }
      camera.position.lerp(targetCamPos.current, 0.07);
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
      mid.y += 0.4;
      const curve = new THREE.QuadraticBezierCurve3(v1, mid, v2);
      return {
        geo: new THREE.TubeGeometry(curve, 24, isDashed ? 0.025 : 0.04, 8, false),
        color,
        opacity: isDashed ? 0.35 : 0.55,
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
  activeFilter = 'all',
  viewPreset = '3d',
  resetTrigger = 0,
  feedbackMap = {}
}) {
  const { nodeData, clusterList, connections, selectedPos, autoFrameConfig } = useMemo(() => {
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

    if (activeFilter !== 'all') {
      const allClusterIssues = clusterMap[activeFilter] || [];
      const totalCount = allClusterIssues.length;

      if (totalCount > 0) {
        const visibleIssues = allClusterIssues.slice(0, 16);
        const clusterCfg = CLUSTERS[activeFilter];

        const { positions, connections: shapeConns } = getConstellationFormation(visibleIssues.length);

        const minY = Math.min(...positions.map((p) => p[1]));
        const tagPos = [0, minY - 4.8, 0];

        activeClusters.push({
          ...clusterCfg,
          totalCount,
          visibleCount: visibleIssues.length,
          center: [0, 0, 0],
          tagPosition: tagPos,
        });

        visibleIssues.forEach((issue, idx) => {
          const pos = positions[idx] || [0, 0, 0];

          if (selectedIssue && selectedIssue.number === issue.number && selectedIssue.repo === issue.repo) {
            selPos = pos;
          }

          nodes.push({ issue, position: pos, clusterKey: activeFilter });
        });

        shapeConns.forEach(([i1, i2]) => {
          if (nodes[i1] && nodes[i2]) {
            conns.push({
              p1: nodes[i1].position,
              p2: nodes[i2].position,
              color: clusterCfg.color,
              isDashed: activeFilter === 'duplicates',
            });
          }
        });

        conns.push({
          p1: [0, minY, 0],
          p2: tagPos,
          color: clusterCfg.color,
          isDashed: true,
        });
      }
    } else {
      Object.entries(clusterMap).forEach(([clusterKey, allClusterIssues]) => {
        const clusterCfg = CLUSTERS[clusterKey];
        const totalCount = allClusterIssues.length;

        if (totalCount > 0) {
          const visibleIssues = allClusterIssues.slice(0, 10);
          const cCenter = clusterCfg.center;
          const clusterNodes = [];

          visibleIssues.forEach((issue, idx) => {
            const count = visibleIssues.length;
            const radius = count > 1 ? 3.8 + (idx * 1.2) : 0.0;
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
            clusterNodes.push(pos);

            if (idx > 0) {
              conns.push({
                p1: nodes[nodes.length - 2].position,
                p2: pos,
                color: clusterCfg.color,
                isDashed: clusterKey === 'duplicates',
              });
            }
          });

          const clusterMinY = Math.min(...clusterNodes.map((p) => p[1]));
          const tagPos = [cCenter[0], clusterMinY - 2.8, cCenter[2]];

          activeClusters.push({
            ...clusterCfg,
            totalCount,
            visibleCount: visibleIssues.length,
            tagPosition: tagPos,
          });

          conns.push({
            p1: [0, 0, 0],
            p2: cCenter,
            color: clusterCfg.color,
            isDashed: true,
          });
        }
      });
    }

    let frameConfig = { center: [0, 0, 0], distance: 34 };
    if (nodes.length > 0) {
      const allX = nodes.map((n) => n.position[0]);
      const allY = nodes.map((n) => n.position[1]);
      const allZ = nodes.map((n) => n.position[2]);

      activeClusters.forEach((c) => {
        if (c.tagPosition) {
          allX.push(c.tagPosition[0]);
          allY.push(c.tagPosition[1]);
          allZ.push(c.tagPosition[2]);
        }
      });

      const minX = Math.min(...allX) - 1.5;
      const maxX = Math.max(...allX) + 1.5;
      const minY = Math.min(...allY) - 1.5;
      const maxY = Math.max(...allY) + 1.5;
      const minZ = Math.min(...allZ) - 1.5;
      const maxZ = Math.max(...allZ) + 1.5;

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const centerZ = (minZ + maxZ) / 2;

      const sizeX = Math.max(1, maxX - minX);
      const sizeY = Math.max(1, maxY - minY);
      const sizeZ = Math.max(1, maxZ - minZ);

      const fovRad = (50 * Math.PI) / 180;
      const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.77;
      const distY = (sizeY / 2) / Math.tan(fovRad / 2);
      const distX = (sizeX / 2) / (Math.tan(fovRad / 2) * aspect);
      const distance = Math.max(distY, distX, 8) * 1.38 + (sizeZ / 2);

      frameConfig = {
        center: [centerX, centerY, centerZ],
        distance: Math.max(12, Math.min(75, distance)),
      };
    } else if (activeFilter !== 'all' && CLUSTERS[activeFilter]) {
      frameConfig = {
        center: [0, 0, 0],
        distance: 16,
      };
    }

    return { 
      nodeData: nodes, 
      clusterList: activeClusters, 
      connections: conns, 
      selectedPos: selPos, 
      autoFrameConfig: frameConfig
    };
  }, [issues, selectedIssue, activeFilter]);

  // Find closest node to camera center for focused tag reveal
  const closestNodeKey = useMemo(() => {
    if (nodeData.length === 0) return null;
    let closestKey = null;
    let minDist = Infinity;
    nodeData.forEach(({ issue, position }) => {
      // Distance from origin / focus center
      const d = Math.hypot(position[0], position[1], position[2]);
      if (d < minDist) {
        minDist = d;
        closestKey = `${issue.repo}-${issue.number}`;
      }
    });
    return closestKey;
  }, [nodeData]);

  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[15, 22, 15]} intensity={2.4} color="#e0f2fe" />
      <pointLight position={[-15, -15, -15]} intensity={1.8} color="#6366f1" />
      <pointLight position={[0, 12, 10]} intensity={2.0} color="#38bdf8" />

      {/* Breathing Space Environment */}
      <NebulaBackground activeTheme={activeFilter} />

      {/* Smooth Inertial Camera Controller */}
      <SmoothCameraController
        selectedPosition={selectedPos}
        activeFilter={activeFilter}
        viewPreset={viewPreset}
        resetTrigger={resetTrigger}
        autoFrameConfig={autoFrameConfig}
        isUserInteracting={isUserInteracting}
        controlsRef={controlsRef}
      />

      {/* Connecting Tubes */}
      <ClusterConnectors connections={connections} />

      {/* 3D Smooth Issue Nodes */}
      <group>
        {nodeData.map(({ issue, position }, idx) => (
          <GitNode
            key={`${issue.repo}-${issue.number}`}
            issue={issue}
            position={position}
            isSelected={selectedIssue?.number === issue.number && selectedIssue?.repo === issue.repo}
            selectedIssue={selectedIssue}
            isClosest={closestNodeKey === `${issue.repo}-${issue.number}`}
            isFiltered={activeFilter !== 'all'}
            isConfirmed={feedbackMap[issue.number] === 'up'}
            nodeIndex={idx}
            onSelect={onSelectIssue}
          />
        ))}
      </group>

      {/* 3D Cluster Header Badges */}
      {!selectedIssue && clusterList.map((c) => (
        <ClusterHeader3D
          key={`cluster-${c.id}`}
          cluster={c}
          position={c.tagPosition || [c.center[0], c.center[1] - 4.2, c.center[2]]}
        />
      ))}
    </>
  );
}

export function GitTreeScene({ issues = [], selectedIssue, onSelectIssue, feedbackMap = {}, fallback }) {
  const controlsRef = useRef();
  const isUserInteracting = useRef(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [resetTrigger, setResetTrigger] = useState(0);
  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const [viewPreset, setViewPreset] = useState('3d');

  // Guarantee minimum 3 nodes per sub-type (excluding overridden issues)
  const augmentedIssues = useMemo(() => {
    // Exclude issues overridden by the maintainer
    const activeIssues = issues.filter((i) => feedbackMap[i.number] !== 'down');

    const byCategory = {
      security_urgent: [],
      regression: [],
      contentious: [],
      duplicates: [],
      needs_info: [],
      normal: [],
    };

    activeIssues.forEach((issue) => {
      const cats = issue.latest_categories || [];
      let placed = false;
      if (matchesCategory(cats, 'security_urgent')) { byCategory.security_urgent.push(issue); placed = true; }
      if (matchesCategory(cats, 'regression')) { byCategory.regression.push(issue); placed = true; }
      if (matchesCategory(cats, 'contentious')) { byCategory.contentious.push(issue); placed = true; }
      if (matchesCategory(cats, 'duplicates')) { byCategory.duplicates.push(issue); placed = true; }
      if (matchesCategory(cats, 'needs_info')) { byCategory.needs_info.push(issue); placed = true; }
      if (!placed) { byCategory.normal.push(issue); }
    });

    const finalIssues = [...activeIssues];
    const existingNumbers = new Set(activeIssues.map((i) => i.number));

    Object.entries(DEFAULT_SUBTYPE_SEEDS).forEach(([catKey, seeds]) => {
      const currentCount = byCategory[catKey].length;
      if (currentCount < 3) {
        seeds.forEach((seed) => {
          if (!existingNumbers.has(seed.number) && feedbackMap[seed.number] !== 'down' && byCategory[catKey].length < 3) {
            finalIssues.push(seed);
            existingNumbers.add(seed.number);
            byCategory[catKey].push(seed);
          }
        });
      }
    });

    return finalIssues;
  }, [issues, feedbackMap]);

  // Filter issues for sequential stepping
  const visibleIssues = useMemo(() => {
    if (activeFilter === 'all') return augmentedIssues;
    return augmentedIssues.filter((i) => matchesCategory(i.latest_categories || [], activeFilter));
  }, [augmentedIssues, activeFilter]);

  const currentIndex = useMemo(() => {
    if (!selectedIssue) return -1;
    return visibleIssues.findIndex(
      (i) => i.number === selectedIssue.number && i.repo === selectedIssue.repo
    );
  }, [visibleIssues, selectedIssue]);

  const countMap = useMemo(() => {
    const map = {
      all: augmentedIssues.length,
      security_urgent: 0,
      regression: 0,
      contentious: 0,
      duplicates: 0,
      needs_info: 0,
    };
    augmentedIssues.forEach((i) => {
      const cats = i.latest_categories || [];
      if (matchesCategory(cats, 'security_urgent')) map.security_urgent++;
      if (matchesCategory(cats, 'regression')) map.regression++;
      if (matchesCategory(cats, 'contentious')) map.contentious++;
      if (matchesCategory(cats, 'duplicates')) map.duplicates++;
      if (matchesCategory(cats, 'needs_info')) map.needs_info++;
    });
    return map;
  }, [augmentedIssues]);

  // Stepping Navigation
  const handleNextNode = useCallback(() => {
    if (visibleIssues.length === 0) return;
    const nextIdx = (currentIndex + 1) % visibleIssues.length;
    onSelectIssue(visibleIssues[nextIdx]);
  }, [visibleIssues, currentIndex, onSelectIssue]);

  const handlePrevNode = useCallback(() => {
    if (visibleIssues.length === 0) return;
    const prevIdx = (currentIndex - 1 + visibleIssues.length) % visibleIssues.length;
    onSelectIssue(visibleIssues[prevIdx]);
  }, [visibleIssues, currentIndex, onSelectIssue]);

  const handleResetView = useCallback(() => {
    onSelectIssue(null);
    setActiveFilter('all');
    setViewPreset('3d');
    setIsAutoRotating(false);
    setResetTrigger((prev) => prev + 1);
  }, [onSelectIssue]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.key === 'ArrowRight' || e.key === 'Tab') {
        e.preventDefault();
        handleNextNode();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevNode();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const currentFilterIdx = FILTER_KEYS.indexOf(activeFilter);
        const nextFilter = FILTER_KEYS[(currentFilterIdx + 1) % FILTER_KEYS.length];
        setActiveFilter(nextFilter);
        onSelectIssue(null);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const currentFilterIdx = FILTER_KEYS.indexOf(activeFilter);
        const prevFilter = FILTER_KEYS[(currentFilterIdx - 1 + FILTER_KEYS.length) % FILTER_KEYS.length];
        setActiveFilter(prevFilter);
        onSelectIssue(null);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleResetView();
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsAutoRotating((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextNode, handlePrevNode, handleResetView, activeFilter, onSelectIssue]);

  const bgColor = THEME_BACKGROUNDS[activeFilter] || THEME_BACKGROUNDS.all;

  return (
    <div className="w-full h-full relative select-none">
      {/* Dynamic Vertical Pill-Shaped Filter Slider on Right Flank */}
      <DynamicFilterRibbon
        activeFilter={activeFilter}
        onSelectFilter={(f) => {
          setActiveFilter(f);
          onSelectIssue(null);
        }}
        countMap={countMap}
      />

      {/* Floating Sequential Triage Deck (Bottom-Center) */}
      {visibleIssues.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-auto flex items-center gap-1.5 p-1.5 rounded-full bg-black/60 hover:bg-black/90 border border-white/10 hover:border-white/25 backdrop-blur-3xl shadow-2xl transition-all duration-200">
          <button
            onClick={handlePrevNode}
            className="p-1.5 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition active:scale-95 cursor-pointer"
            title="Previous Issue (←)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="px-3 text-xs font-mono">
            {selectedIssue ? (
              <span className="text-white font-bold">
                #{selectedIssue.number} ({currentIndex + 1}/{visibleIssues.length})
              </span>
            ) : (
              <span className="text-zinc-400">
                {visibleIssues.length} Issues • <kbd className="px-1 py-0.5 rounded bg-white/10 text-[10px] text-zinc-300">←</kbd> <kbd className="px-1 py-0.5 rounded bg-white/10 text-[10px] text-zinc-300">→</kbd>
              </span>
            )}
          </span>

          <button
            onClick={handleNextNode}
            className="p-1.5 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition active:scale-95 cursor-pointer"
            title="Next Issue (→)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bottom-Left Controls Dock: Reset View, 2D Plan View & Auto-Orbit */}
      <div className="fixed bottom-6 left-6 z-40 pointer-events-auto flex items-center gap-2">
        <button
          onClick={handleResetView}
          className="group flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/60 hover:bg-black/90 border border-white/10 hover:border-white/30 shadow-2xl backdrop-blur-3xl transition-all duration-200 text-xs font-mono text-zinc-300 hover:text-white active:scale-95"
          title="Reset 3D camera to default overview (Esc)"
        >
          <RotateCcw className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white group-hover:-rotate-90 transition-all duration-300" />
          <span className="font-medium">Reset</span>
        </button>

        {/* View Preset Toggle: 3D Perspective vs Top 2D Plan */}
        <button
          onClick={() => setViewPreset((prev) => (prev === '3d' ? 'top' : '3d'))}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-full border shadow-2xl backdrop-blur-3xl transition-all duration-200 text-xs font-mono ${
            viewPreset === 'top'
              ? 'bg-white text-black border-white'
              : 'bg-black/60 hover:bg-black/90 text-zinc-300 hover:text-white border-white/10 hover:border-white/30'
          }`}
          title="Toggle 3D Perspective / Top 2D Plan View"
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="font-medium">{viewPreset === 'top' ? '2D Plan' : '3D Orbit'}</span>
        </button>

        {/* Cinematic Auto-Orbit Turntable Toggle */}
        <button
          onClick={() => setIsAutoRotating((prev) => !prev)}
          className={`p-2 rounded-full border shadow-2xl backdrop-blur-3xl transition-all duration-200 ${
            isAutoRotating
              ? 'bg-sky-500/20 text-sky-300 border-sky-400/50 shadow-sky-500/20'
              : 'bg-black/60 hover:bg-black/90 text-zinc-400 hover:text-white border-white/10 hover:border-white/30'
          }`}
          title={isAutoRotating ? 'Pause Auto-Orbit (Space)' : 'Start Cinematic Auto-Orbit (Space)'}
        >
          {isAutoRotating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Bottom-Right Holographic Radar Minimap */}
      <MinimapRadar
        activeFilter={activeFilter}
        onSelectFilter={(f) => {
          setActiveFilter(f);
          onSelectIssue(null);
        }}
        className="fixed bottom-6 right-6 z-40 hidden md:block"
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
            onDoubleClick={() => handleResetView()}
          >
            <color attach="background" args={[bgColor]} />
            <SceneContent
              issues={augmentedIssues}
              selectedIssue={selectedIssue}
              onSelectIssue={onSelectIssue}
              controlsRef={controlsRef}
              isUserInteracting={isUserInteracting}
              activeFilter={activeFilter}
              viewPreset={viewPreset}
              resetTrigger={resetTrigger}
              feedbackMap={feedbackMap}
            />

            {/* Butter-Smooth Orbit Controls with Inertia & Soft Limits */}
            <OrbitControls
              ref={controlsRef}
              enableDamping
              dampingFactor={0.05}
              rotateSpeed={0.5}
              zoomSpeed={0.7}
              panSpeed={0.6}
              screenSpacePanning
              minDistance={4}
              maxDistance={90}
              minPolarAngle={0.15}
              maxPolarAngle={Math.PI - 0.15}
              autoRotate={isAutoRotating}
              autoRotateSpeed={0.5}
              onStart={() => {
                isUserInteracting.current = true;
              }}
              onEnd={() => {
                isUserInteracting.current = false;
              }}
            />
          </Canvas>
        </Suspense>
      </ErrorBoundary3D>
    </div>
  );
}
