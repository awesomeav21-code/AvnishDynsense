"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface Dependency {
  id: string;
  blockerTaskId: string;
  blockedTaskId: string;
  type: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
}

const statusColor: Record<string, string> = {
  created: "#9ca3af",
  ready: "#6366f1",
  in_progress: "#3b82f6",
  review: "#f59e0b",
  completed: "#22c55e",
  blocked: "#ef4444",
  cancelled: "#d1d5db",
};

export default function DependenciesPage() {
  const [deps, setDeps] = useState<Dependency[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState<string>("");
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    api.getProjects().then((res) => {
      setProjects(res.data);
      if (res.data.length > 0) setProjectId(res.data[0].id);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    api.getTasks({ projectId, limit: 200 })
      .then(async (res) => {
        setTasks(res.data);
        const allDeps: Dependency[] = [];
        for (const task of res.data) {
          try {
            const depRes = await api.getDependencies(task.id);
            allDeps.push(...depRes.data);
          } catch { /* skip */ }
        }
        setDeps(Array.from(new Map(allDeps.map(d => [d.id, d])).values()));
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  // Build graph layout
  const graph = useMemo(() => {
    if (tasks.length === 0) return null;

    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const taskIds = new Set(tasks.map(t => t.id));

    // Filter deps to this project only
    const projectDeps = deps.filter(d => taskIds.has(d.blockerTaskId) && taskIds.has(d.blockedTaskId));
    const edges = projectDeps.map(d => ({ from: d.blockerTaskId, to: d.blockedTaskId }));

    // Find connected components
    const connectedIds = new Set<string>();
    for (const e of edges) { connectedIds.add(e.from); connectedIds.add(e.to); }

    // Topological layering for connected tasks
    const adj = new Map<string, string[]>();
    const inDeg = new Map<string, number>();
    for (const id of connectedIds) { adj.set(id, []); inDeg.set(id, 0); }
    for (const e of edges) {
      adj.get(e.from)!.push(e.to);
      inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1);
    }

    const layers = new Map<string, number>();
    const queue: string[] = [];
    for (const id of connectedIds) {
      if ((inDeg.get(id) ?? 0) === 0) { queue.push(id); layers.set(id, 0); }
    }
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const curLayer = layers.get(cur) ?? 0;
      for (const nb of adj.get(cur) ?? []) {
        const nd = (inDeg.get(nb) ?? 1) - 1;
        inDeg.set(nb, nd);
        layers.set(nb, Math.max(layers.get(nb) ?? 0, curLayer + 1));
        if (nd === 0) queue.push(nb);
      }
    }
    // Cycles fallback
    const maxLayer = layers.size > 0 ? Math.max(...layers.values()) : 0;
    for (const id of connectedIds) {
      if (!layers.has(id)) layers.set(id, maxLayer + 1);
    }

    // Position connected nodes
    const NODE_W = 200;
    const NODE_H = 56;
    const H_GAP = 100;
    const V_GAP = 24;
    const PAD = 60;

    const layerGroups = new Map<number, string[]>();
    for (const [id, l] of layers) {
      if (!layerGroups.has(l)) layerGroups.set(l, []);
      layerGroups.get(l)!.push(id);
    }

    const positions = new Map<string, { x: number; y: number }>();
    const sortedLayers = Array.from(layerGroups.keys()).sort((a, b) => a - b);

    for (let col = 0; col < sortedLayers.length; col++) {
      const ids = layerGroups.get(sortedLayers[col]!)!;
      const totalH = ids.length * NODE_H + (ids.length - 1) * V_GAP;
      const startY = PAD;
      ids.forEach((id, row) => {
        positions.set(id, {
          x: PAD + col * (NODE_W + H_GAP),
          y: startY + row * (NODE_H + V_GAP),
        });
      });
    }

    // Position standalone tasks in a grid below
    const standaloneIds = tasks.filter(t => !connectedIds.has(t.id)).map(t => t.id);
    const connectedMaxY = positions.size > 0
      ? Math.max(...Array.from(positions.values()).map(p => p.y)) + NODE_H + 60
      : PAD;
    const GRID_COLS = 4;
    standaloneIds.forEach((id, i) => {
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      positions.set(id, {
        x: PAD + col * (NODE_W + 20),
        y: connectedMaxY + row * (NODE_H + V_GAP),
      });
    });

    const allX = Array.from(positions.values()).map(p => p.x);
    const allY = Array.from(positions.values()).map(p => p.y);
    const svgW = Math.max((allX.length > 0 ? Math.max(...allX) : 0) + NODE_W + PAD, 500);
    const svgH = Math.max((allY.length > 0 ? Math.max(...allY) : 0) + NODE_H + PAD, 300);

    return {
      positions, edges, connectedIds, standaloneIds,
      svgW, svgH, NODE_W, NODE_H, taskMap,
      connectedMaxY,
    };
  }, [tasks, deps]);

  // Hover highlighting
  const { hlEdges, hlNodes } = useMemo(() => {
    if (!hoveredNode || !graph) return { hlEdges: new Set<string>(), hlNodes: new Set<string>() };
    const es = new Set<string>();
    const ns = new Set<string>([hoveredNode]);
    for (const e of graph.edges) {
      if (e.from === hoveredNode || e.to === hoveredNode) {
        es.add(`${e.from}-${e.to}`);
        ns.add(e.from);
        ns.add(e.to);
      }
    }
    return { hlEdges: es, hlNodes: ns };
  }, [hoveredNode, graph]);

  if (loading && !projects.length) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold">Dependency Graph</h1>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-200 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold">Dependency Graph</h1>
        <p className="text-xs text-gray-500 mt-1">Hover a task to highlight its dependency chain · Click to jump to it in My Tasks</p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="text-xs border rounded px-3 py-1.5"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
          {Object.entries(statusColor).map(([s, c]) => (
            <span key={s} className="flex items-center gap-1">
              <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: c }} />
              {s.replace("_", " ")}
            </span>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-12 bg-gray-200 rounded-lg" />)}
        </div>
      ) : !graph || tasks.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center">
          <p className="text-xs text-gray-500">No tasks found for this project.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-auto">
          <svg width={graph.svgW} height={graph.svgH}>
            <defs>
              <marker id="ah" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
                <polygon points="0 0, 10 4, 0 8" fill="#64748b" />
              </marker>
              <marker id="ah-hl" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
                <polygon points="0 0, 10 4, 0 8" fill="#2563eb" />
              </marker>
            </defs>

            {/* Separator between linked and standalone */}
            {graph.standaloneIds.length > 0 && graph.connectedIds.size > 0 && (
              <g>
                <line
                  x1={30} y1={graph.connectedMaxY - 30}
                  x2={graph.svgW - 30} y2={graph.connectedMaxY - 30}
                  stroke="#e2e8f0" strokeWidth={1} strokeDasharray="6 4"
                />
                <text x={40} y={graph.connectedMaxY - 38} className="text-[10px]" fill="#94a3b8">
                  Tasks without dependencies
                </text>
              </g>
            )}

            {/* Dependency arrows */}
            {graph.edges.map((edge) => {
              const from = graph.positions.get(edge.from);
              const to = graph.positions.get(edge.to);
              if (!from || !to) return null;

              const x1 = from.x + graph.NODE_W;
              const y1 = from.y + graph.NODE_H / 2;
              const x2 = to.x;
              const y2 = to.y + graph.NODE_H / 2;
              const key = `${edge.from}-${edge.to}`;
              const hl = hlEdges.has(key);
              const dimmed = hoveredNode && !hl;

              const dx = x2 - x1;
              let d: string;
              if (dx > 30) {
                const cx = dx * 0.4;
                d = `M${x1},${y1} C${x1 + cx},${y1} ${x2 - cx},${y2} ${x2},${y2}`;
              } else {
                // backwards/same-column: arc above
                const midY = Math.min(y1, y2) - 60;
                d = `M${x1},${y1} C${x1 + 60},${midY} ${x2 - 60},${midY} ${x2},${y2}`;
              }

              return (
                <path
                  key={key}
                  d={d}
                  fill="none"
                  stroke={hl ? "#2563eb" : "#94a3b8"}
                  strokeWidth={hl ? 3 : 2}
                  markerEnd={hl ? "url(#ah-hl)" : "url(#ah)"}
                  opacity={dimmed ? 0.15 : 1}
                  className="transition-all duration-200"
                />
              );
            })}

            {/* Task nodes */}
            {Array.from(graph.positions.entries()).map(([id, pos]) => {
              const task = graph.taskMap.get(id);
              if (!task) return null;
              const color = statusColor[task.status] ?? "#9ca3af";
              const isHovered = hoveredNode === id;
              const isRelated = hlNodes.has(id);
              const dimmed = hoveredNode && !isRelated;
              const isLinked = graph.connectedIds.has(id);

              return (
                <g
                  key={id}
                  onMouseEnter={() => setHoveredNode(id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => router.push(`/my-tasks?highlight=${id}`)}
                  className="cursor-pointer"
                  opacity={dimmed ? 0.2 : 1}
                >
                  {/* Shadow for linked nodes */}
                  {isLinked && (
                    <rect
                      x={pos.x + 2} y={pos.y + 2}
                      width={graph.NODE_W} height={graph.NODE_H}
                      rx={8} fill="#00000008"
                    />
                  )}
                  {/* Node background */}
                  <rect
                    x={pos.x} y={pos.y}
                    width={graph.NODE_W} height={graph.NODE_H}
                    rx={8}
                    fill={isHovered ? color : "white"}
                    stroke={isRelated ? "#2563eb" : color}
                    strokeWidth={isHovered ? 3 : isRelated ? 2.5 : 1.5}
                  />
                  {/* Left accent bar */}
                  <rect x={pos.x + 1} y={pos.y + 6} width={4} height={graph.NODE_H - 12} rx={2} fill={color} />
                  {/* Task title */}
                  <text
                    x={pos.x + 14} y={pos.y + 22}
                    className="text-[11px] font-semibold"
                    fill={isHovered ? "white" : "#1e293b"}
                  >
                    {task.title.length > 24 ? task.title.slice(0, 24) + "…" : task.title}
                  </text>
                  {/* Status badge */}
                  <rect
                    x={pos.x + 14} y={pos.y + 30}
                    width={task.status.replace("_", " ").length * 6 + 10} height={14}
                    rx={3}
                    fill={isHovered ? "rgba(255,255,255,0.25)" : color + "18"}
                  />
                  <text
                    x={pos.x + 19} y={pos.y + 40}
                    className="text-[9px] font-medium"
                    fill={isHovered ? "rgba(255,255,255,0.9)" : color}
                  >
                    {task.status.replace("_", " ")}
                  </text>
                  {/* Priority indicator */}
                  <text
                    x={pos.x + graph.NODE_W - 12} y={pos.y + 22}
                    textAnchor="end"
                    className="text-[9px]"
                    fill={isHovered ? "rgba(255,255,255,0.7)" : "#94a3b8"}
                  >
                    {task.priority}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Footer */}
          <div className="px-4 py-2 border-t bg-gray-50 flex items-center gap-4 text-xs text-gray-500">
            <span>{tasks.length} tasks</span>
            <span>{graph.connectedIds.size} linked</span>
            <span>{graph.edges.length} dependencies</span>
          </div>
        </div>
      )}
    </div>
  );
}
