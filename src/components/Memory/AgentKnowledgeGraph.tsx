'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, RefreshCw, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { AgentStatus } from '@/types/electron';

// ── Node / edge types ─────────────────────────────────────────────────────────

type NodeKind = 'agent' | 'skill' | 'memory' | 'plugin' | 'mcp';

interface GraphNode {
  id: string;
  label: string;
  kind: NodeKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number; // radius
  fixed?: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ── Visual config ─────────────────────────────────────────────────────────────

const KIND_COLOR: Record<NodeKind, { fill: string; glow: string; label: string }> = {
  agent:   { fill: '#8b5cf6', glow: 'rgba(139,92,246,0.4)',  label: '#e9d5ff' },
  skill:   { fill: '#3b82f6', glow: 'rgba(59,130,246,0.3)',  label: '#bfdbfe' },
  memory:  { fill: '#10b981', glow: 'rgba(16,185,129,0.3)',  label: '#a7f3d0' },
  plugin:  { fill: '#f59e0b', glow: 'rgba(245,158,11,0.3)',  label: '#fde68a' },
  mcp:     { fill: '#ec4899', glow: 'rgba(236,72,153,0.3)',  label: '#fbcfe8' },
};

const KIND_RADIUS: Record<NodeKind, number> = {
  agent:  18,
  skill:  10,
  memory: 8,
  plugin: 9,
  mcp:    9,
};

// ── Force simulation ──────────────────────────────────────────────────────────

const REPULSION   = 3500;
const ATTRACTION  = 0.04;
const DAMPING     = 0.82;
const CENTER_PULL = 0.012;
const ITERATIONS  = 1;

function tickForce(nodes: GraphNode[], edges: GraphEdge[], cx: number, cy: number) {
  const n = nodes.length;
  const idx = new Map(nodes.map((nd, i) => [nd.id, i]));

  for (let iter = 0; iter < ITERATIONS; iter++) {
    // Repulsion between all pairs
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x - a.x || 0.1;
        const dy = b.y - a.y || 0.1;
        const dist2 = dx * dx + dy * dy;
        const force = REPULSION / dist2;
        const fx = force * dx / Math.sqrt(dist2);
        const fy = force * dy / Math.sqrt(dist2);
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }
    }

    // Attraction along edges (spring)
    for (const edge of edges) {
      const ai = idx.get(edge.source);
      const bi = idx.get(edge.target);
      if (ai === undefined || bi === undefined) continue;
      const a = nodes[ai], b = nodes[bi];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const idealLen = (a.r + b.r) * 5;
      const delta = (dist - idealLen) * ATTRACTION;
      const fx = (dx / dist) * delta;
      const fy = (dy / dist) * delta;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    }

    // Center pull
    for (const nd of nodes) {
      nd.vx += (cx - nd.x) * CENTER_PULL;
      nd.vy += (cy - nd.y) * CENTER_PULL;
    }

    // Integrate
    for (const nd of nodes) {
      if (nd.fixed) continue;
      nd.vx *= DAMPING;
      nd.vy *= DAMPING;
      nd.x += nd.vx;
      nd.y += nd.vy;
    }
  }
}

// ── Build graph from agent list + claude data ─────────────────────────────────

function buildGraph(
  agents: AgentStatus[],
  claudeData: {
    plugins: Array<{ name?: string; enabled?: boolean }>;
    skills: Array<{ name: string; source: string }>;
  } | null,
  selectedAgentId: string | null,
  cx: number,
  cy: number,
): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const added = new Set<string>();

  const addNode = (node: Omit<GraphNode, 'vx' | 'vy'> & { vx?: number; vy?: number }) => {
    if (added.has(node.id)) return;
    added.add(node.id);
    nodes.push({ vx: 0, vy: 0, ...node });
  };

  const relevantAgents = selectedAgentId
    ? agents.filter(a => a.id === selectedAgentId)
    : agents;

  const angle = (2 * Math.PI) / Math.max(relevantAgents.length, 1);

  relevantAgents.forEach((agent, i) => {
    const spread = Math.min(200, 80 + relevantAgents.length * 20);
    const ax = cx + Math.cos(i * angle) * spread * 0.6;
    const ay = cy + Math.sin(i * angle) * spread * 0.6;

    addNode({
      id: agent.id,
      label: agent.name || `Agent ${agent.id.slice(0, 6)}`,
      kind: 'agent',
      x: ax, y: ay,
      r: KIND_RADIUS.agent,
    });

    // Skills
    for (const skill of agent.skills ?? []) {
      const skillId = `skill:${skill}`;
      if (!added.has(skillId)) {
        const theta = Math.random() * 2 * Math.PI;
        addNode({ id: skillId, label: skill, kind: 'skill', x: ax + Math.cos(theta) * 60, y: ay + Math.sin(theta) * 60, r: KIND_RADIUS.skill });
      }
      edges.push({ source: agent.id, target: skillId });
    }

    // Memory files from project (derive from projectPath name)
    const projName = agent.projectPath?.split('/').pop() ?? 'project';
    const memId = `mem:${agent.projectPath}`;
    if (!added.has(memId)) {
      addNode({ id: memId, label: projName, kind: 'memory', x: ax + 80, y: ay - 40, r: KIND_RADIUS.memory });
    }
    edges.push({ source: agent.id, target: memId });
  });

  // Global skills (from claude data)
  if (claudeData?.skills) {
    for (const skill of claudeData.skills.slice(0, 30)) {
      const skillId = `globalskill:${skill.name}`;
      if (!added.has(skillId)) {
        const theta = Math.random() * 2 * Math.PI;
        const dist = 120 + Math.random() * 80;
        addNode({ id: skillId, label: skill.name, kind: 'skill', x: cx + Math.cos(theta) * dist, y: cy + Math.sin(theta) * dist, r: KIND_RADIUS.skill - 1 });
      }
    }
  }

  // Plugins
  if (claudeData?.plugins) {
    const pluginArr = claudeData.plugins as Array<{ name?: string; displayName?: string }>;
    for (const plugin of pluginArr.slice(0, 12)) {
      const name = (plugin.name ?? plugin.displayName ?? 'plugin').toString();
      const pluginId = `plugin:${name}`;
      if (!added.has(pluginId)) {
        const theta = Math.random() * 2 * Math.PI;
        const dist = 150 + Math.random() * 80;
        addNode({ id: pluginId, label: name, kind: 'plugin', x: cx + Math.cos(theta) * dist, y: cy + Math.sin(theta) * dist, r: KIND_RADIUS.plugin });
      }
      // Connect plugins to all agents
      for (const agent of relevantAgents) {
        edges.push({ source: agent.id, target: pluginId });
      }
    }
  }

  return { nodes, edges };
}

// ── Canvas renderer ───────────────────────────────────────────────────────────

function drawGraph(
  ctx: CanvasRenderingContext2D,
  graph: GraphData,
  hoveredId: string | null,
  transform: { x: number; y: number; scale: number },
) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.scale, transform.scale);

  // Draw edges
  for (const edge of graph.edges) {
    const a = graph.nodes.find(n => n.id === edge.source);
    const b = graph.nodes.find(n => n.id === edge.target);
    if (!a || !b) continue;
    const hovered = hoveredId === a.id || hoveredId === b.id;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = hovered ? 'rgba(139,92,246,0.5)' : 'rgba(139,92,246,0.12)';
    ctx.lineWidth = hovered ? 1.2 : 0.6;
    ctx.stroke();
  }

  // Draw nodes
  for (const nd of graph.nodes) {
    const colors = KIND_COLOR[nd.kind];
    const hovered = nd.id === hoveredId;
    const r = nd.r * (hovered ? 1.25 : 1);

    // Glow
    if (hovered || nd.kind === 'agent') {
      ctx.shadowColor = colors.glow;
      ctx.shadowBlur = nd.kind === 'agent' ? 20 : 12;
    } else {
      ctx.shadowBlur = 0;
    }

    // Circle
    ctx.beginPath();
    ctx.arc(nd.x, nd.y, r, 0, Math.PI * 2);
    ctx.fillStyle = hovered ? colors.fill : colors.fill + 'cc';
    ctx.fill();

    // Border ring for agents
    if (nd.kind === 'agent') {
      ctx.beginPath();
      ctx.arc(nd.x, nd.y, r + 2, 0, Math.PI * 2);
      ctx.strokeStyle = colors.fill + '60';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.shadowBlur = 0;

    // Label
    const showLabel = hovered || nd.kind === 'agent' || nd.r >= 9;
    if (showLabel) {
      const fontSize = nd.kind === 'agent' ? 11 : 9;
      ctx.font = `${nd.kind === 'agent' ? '600' : '400'} ${fontSize}px ui-sans-serif,system-ui,sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const maxW = nd.kind === 'agent' ? 90 : 70;
      let label = nd.label;
      if (ctx.measureText(label).width > maxW) {
        while (ctx.measureText(label + '…').width > maxW && label.length > 1) {
          label = label.slice(0, -1);
        }
        label += '…';
      }

      const ly = nd.y + r + 3;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(label, nd.x + 0.5, ly + 0.5);
      ctx.fillStyle = hovered ? '#ffffff' : colors.label;
      ctx.fillText(label, nd.x, ly);
    }
  }

  ctx.restore();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AgentKnowledgeGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);
  const graphRef  = useRef<GraphData>({ nodes: [], edges: [] });
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const hoveredRef = useRef<string | null>(null);
  const dragRef = useRef<{ nodeId: string | null; panStart: { x: number; y: number } | null }>({ nodeId: null, panStart: null });
  const warmupRef = useRef(0);

  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(true);

  // ── Load data ──
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [agentList, claudeData] = await Promise.all([
        window.electronAPI?.agent.list().catch(() => []) ?? [],
        window.electronAPI?.claude?.getData().catch(() => null) ?? null,
      ]);

      setAgents(agentList as AgentStatus[]);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      const graph = buildGraph(
        agentList as AgentStatus[],
        claudeData as { plugins: Array<{ name?: string }>; skills: Array<{ name: string; source: string }> } | null,
        null,
        cx, cy,
      );
      graphRef.current = graph;
      warmupRef.current = 300; // run simulation for 300 ticks before showing
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Rebuild graph when filter changes
  useEffect(() => {
    if (loading) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.width / 2 / transformRef.current.scale;
    const cy = canvas.height / 2 / transformRef.current.scale;
    graphRef.current = buildGraph(
      agents,
      null,
      selectedAgentId,
      cx, cy,
    );
    warmupRef.current = 200;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgentId, agents]);

  // ── Animation loop ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      animRef.current = requestAnimationFrame(loop);
      const graph = graphRef.current;
      const t = transformRef.current;
      const cx = (canvas.width / 2 - t.x) / t.scale;
      const cy = (canvas.height / 2 - t.y) / t.scale;
      tickForce(graph.nodes, graph.edges, cx, cy);
      if (warmupRef.current > 0) { warmupRef.current--; return; }
      drawGraph(ctx, graph, hoveredRef.current, t);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [loading]);

  // ── Canvas resize ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    });
    ro.observe(canvas);
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    return () => ro.disconnect();
  }, []);

  // ── Hit-test helper ──
  const hitTest = useCallback((ex: number, ey: number) => {
    const t = transformRef.current;
    const wx = (ex - t.x) / t.scale;
    const wy = (ey - t.y) / t.scale;
    for (const nd of [...graphRef.current.nodes].reverse()) {
      const dx = wx - nd.x, dy = wy - nd.y;
      if (dx * dx + dy * dy <= (nd.r + 4) ** 2) return nd;
    }
    return null;
  }, []);

  // ── Pointer events ──
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const ex = e.clientX - rect.left;
    const ey = e.clientY - rect.top;

    if (dragRef.current.nodeId) {
      const t = transformRef.current;
      const nd = graphRef.current.nodes.find(n => n.id === dragRef.current.nodeId);
      if (nd) {
        nd.x = (ex - t.x) / t.scale;
        nd.y = (ey - t.y) / t.scale;
        nd.vx = 0; nd.vy = 0;
      }
      return;
    }

    if (dragRef.current.panStart) {
      const { x: sx, y: sy } = dragRef.current.panStart;
      transformRef.current = {
        ...transformRef.current,
        x: transformRef.current.x + (ex - sx),
        y: transformRef.current.y + (ey - sy),
      };
      dragRef.current.panStart = { x: ex, y: ey };
      return;
    }

    const hit = hitTest(ex, ey);
    const prev = hoveredRef.current;
    hoveredRef.current = hit?.id ?? null;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = hit ? 'pointer' : 'grab';
    }
    if (prev !== hoveredRef.current) warmupRef.current = 0;
  }, [hitTest]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const ex = e.clientX - rect.left;
    const ey = e.clientY - rect.top;
    const hit = hitTest(ex, ey);
    if (hit) {
      dragRef.current.nodeId = hit.id;
    } else {
      dragRef.current.panStart = { x: ex, y: ey };
    }
  }, [hitTest]);

  const handleMouseUp = useCallback(() => {
    dragRef.current.nodeId = null;
    dragRef.current.panStart = null;
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const ex = e.clientX - rect.left;
    const ey = e.clientY - rect.top;
    const delta = e.deltaY < 0 ? 1.1 : 0.9;
    const t = transformRef.current;
    const newScale = Math.min(4, Math.max(0.2, t.scale * delta));
    transformRef.current = {
      scale: newScale,
      x: ex - (ex - t.x) * (newScale / t.scale),
      y: ey - (ey - t.y) * (newScale / t.scale),
    };
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
    if (hit?.kind === 'agent') {
      setSelectedAgentId(prev => prev === hit.id ? null : hit.id);
    }
  }, [hitTest]);

  const resetView = () => {
    transformRef.current = { x: 0, y: 0, scale: 1 };
    warmupRef.current = 0;
  };

  const zoom = (factor: number) => {
    const t = transformRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const newScale = Math.min(4, Math.max(0.2, t.scale * factor));
    transformRef.current = {
      scale: newScale,
      x: cx - (cx - t.x) * (newScale / t.scale),
      y: cy - (cy - t.y) * (newScale / t.scale),
    };
    warmupRef.current = 0;
  };

  return (
    <div className="relative w-full h-full bg-[#0d0d14] rounded-xl overflow-hidden border border-border">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ cursor: 'grab' }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleClick}
      />

      {/* Loading */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
        </div>
      )}

      {/* Top controls */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        {/* Agent filter pills */}
        <div className="flex flex-wrap gap-1.5 pointer-events-auto">
          <button
            onClick={() => setSelectedAgentId(null)}
            className={`px-2.5 py-1 text-[10px] font-medium rounded-full border transition-colors ${
              selectedAgentId === null
                ? 'bg-violet-500/30 border-violet-500/60 text-violet-200'
                : 'bg-black/40 border-white/10 text-white/50 hover:text-white/80'
            }`}
          >
            All agents
          </button>
          {agents.map(agent => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgentId(prev => prev === agent.id ? null : agent.id)}
              className={`px-2.5 py-1 text-[10px] font-medium rounded-full border transition-colors ${
                selectedAgentId === agent.id
                  ? 'bg-violet-500/30 border-violet-500/60 text-violet-200'
                  : 'bg-black/40 border-white/10 text-white/50 hover:text-white/80'
              }`}
            >
              {agent.name || agent.id.slice(0, 8)}
            </button>
          ))}
        </div>

        {/* Zoom + reset */}
        <div className="flex items-center gap-1 pointer-events-auto">
          <button onClick={() => zoom(1.2)} className="p-1.5 rounded-lg bg-black/50 border border-white/10 text-white/60 hover:text-white transition-colors">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => zoom(0.8)} className="p-1.5 rounded-lg bg-black/50 border border-white/10 text-white/60 hover:text-white transition-colors">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button onClick={resetView} className="p-1.5 rounded-lg bg-black/50 border border-white/10 text-white/60 hover:text-white transition-colors">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={loadData} className="p-1.5 rounded-lg bg-black/50 border border-white/10 text-white/60 hover:text-white transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 right-3">
        {legendOpen ? (
          <div className="bg-black/70 border border-white/10 rounded-xl p-3 text-[10px] text-white/70 space-y-1.5 backdrop-blur-sm min-w-[130px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/40 uppercase tracking-wider text-[9px]">Legend</span>
              <button onClick={() => setLegendOpen(false)} className="text-white/30 hover:text-white/70">✕</button>
            </div>
            {(Object.entries(KIND_COLOR) as [NodeKind, typeof KIND_COLOR[NodeKind]][]).map(([kind, c]) => (
              <div key={kind} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.fill }} />
                <span className="capitalize">{kind}</span>
              </div>
            ))}
            <p className="text-white/30 text-[9px] mt-2 border-t border-white/10 pt-2">Scroll to zoom · drag to pan<br/>Click agent to isolate</p>
          </div>
        ) : (
          <button
            onClick={() => setLegendOpen(true)}
            className="px-2.5 py-1 text-[10px] bg-black/50 border border-white/10 rounded-lg text-white/40 hover:text-white/70 transition-colors"
          >
            Legend
          </button>
        )}
      </div>

      {/* Node count */}
      <div className="absolute bottom-3 left-3 text-[10px] text-white/25">
        {graphRef.current.nodes.length} nodes · {graphRef.current.edges.length} edges
      </div>
    </div>
  );
}
