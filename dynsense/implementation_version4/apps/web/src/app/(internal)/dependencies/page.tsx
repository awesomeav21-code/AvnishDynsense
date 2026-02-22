"use client";

import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";

// FR-159: Dependency chain DAG visualization page
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
}

interface NodePosition {
  x: number;
  y: number;
  layer: number;
}

const NODE_W = 160;
const NODE_H = 44;
const LAYER_GAP_X = 220;
const NODE_GAP_Y = 60;
const PADDING = 40;

const statusColor: Record<string, string> = {
  created: "#9ca3af",
  in_progress: "#3b82f6",
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

  useEffect(() => {
    api.getProjects().then((res) => {
      setProjects(res.data);
      if (res.data.length > 0) {
        setProjectId(res.data[0].id);
      }
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    api.getTasks({ projectId })
      .then(async (res) => {
        setTasks(res.data);
        const allDeps: Dependency[] = [];
        for (const task of res.data.slice(0, 20)) {
          try {
            const depRes = await api.getDependencies(task.id);
            allDeps.push(...depRes.data);
          } catch { /* skip */ }
        }
        const unique = Array.from(new Map(allDeps.map(d => [d.id, d])).values());
        setDeps(unique);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  const getTaskTitle = (taskId: string) =>
    tasks.find(t => t.id === taskId)?.title ?? taskId.slice(0, 8);

  const getTaskStatus = (taskId: string) =>
    tasks.find(t => t.id === taskId)?.status ?? "created";

  // Build DAG layout using topological layering
  const { positions, svgWidth, svgHeight, edges, connectedNodeIds } = useMemo(() => {
    if (deps.length === 0) {
      return { positions: new Map<string, NodePosition>(), svgWidth: 0, svgHeight: 0, edges: [] as Array<{ from: string; to: string; type: string }>, connectedNodeIds: new Set<string>() };
    }

    // Collect all node IDs that participate in dependencies
    const nodeIds = new Set<string>();
    const edgeList: Array<{ from: string; to: string; type: string }> = [];
    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const dep of deps) {
      nodeIds.add(dep.blockerTaskId);
      nodeIds.add(dep.blockedTaskId);
      edgeList.push({ from: dep.blockerTaskId, to: dep.blockedTaskId, type: dep.type });

      if (!adjacency.has(dep.blockerTaskId)) adjacency.set(dep.blockerTaskId, []);
      adjacency.get(dep.blockerTaskId)!.push(dep.blockedTaskId);

      inDegree.set(dep.blockedTaskId, (inDegree.get(dep.blockedTaskId) ?? 0) + 1);
      if (!inDegree.has(dep.blockerTaskId)) inDegree.set(dep.blockerTaskId, 0);
    }

    // Topological sort for layer assignment (Kahn's algorithm)
    const layers = new Map<string, number>();
    const queue: string[] = [];
    for (const id of nodeIds) {
      if ((inDegree.get(id) ?? 0) === 0) {
        queue.push(id);
        layers.set(id, 0);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentLayer = layers.get(current) ?? 0;
      for (const neighbor of adjacency.get(current) ?? []) {
        const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDeg);
        layers.set(neighbor, Math.max(layers.get(neighbor) ?? 0, currentLayer + 1));
        if (newDeg === 0) queue.push(neighbor);
      }
    }

    // Handle cycles: assign remaining nodes to max layer + 1
    const maxLayer = Math.max(0, ...Array.from(layers.values()));
    for (const id of nodeIds) {
      if (!layers.has(id)) layers.set(id, maxLayer + 1);
    }

    // Group nodes by layer
    const layerGroups = new Map<number, string[]>();
    for (const [id, layer] of layers) {
      if (!layerGroups.has(layer)) layerGroups.set(layer, []);
      layerGroups.get(layer)!.push(id);
    }

    // Position nodes
    const pos = new Map<string, NodePosition>();
    const numLayers = Math.max(1, (Math.max(...layerGroups.keys()) ?? 0) + 1);

    for (const [layer, ids] of layerGroups) {
      ids.forEach((id, idx) => {
        pos.set(id, {
          x: PADDING + layer * LAYER_GAP_X,
          y: PADDING + idx * NODE_GAP_Y,
          layer,
        });
      });
    }

    const maxNodesInLayer = Math.max(...Array.from(layerGroups.values()).map(g => g.length));
    const width = PADDING * 2 + numLayers * LAYER_GAP_X;
    const height = PADDING * 2 + maxNodesInLayer * NODE_GAP_Y;

    return {
      positions: pos,
      svgWidth: Math.max(width, 400),
      svgHeight: Math.max(height, 200),
      edges: edgeList,
      connectedNodeIds: nodeIds,
    };
  }, [deps]);

  // Highlight connected edges on hover
  const highlightedEdges = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    const highlighted = new Set<string>();
    for (const edge of edges) {
      if (edge.from === hoveredNode || edge.to === hoveredNode) {
        highlighted.add(`${edge.from}-${edge.to}`);
      }
    }
    return highlighted;
  }, [hoveredNode, edges]);

  if (loading && !projects.length) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold">Dependency Graph</h1>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold">Dependency Graph</h1>
        <p className="text-xs text-gray-500 mt-1">Interactive DAG visualization of task dependency chains</p>
      </div>

      <div className="flex items-center gap-4">
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="text-xs border rounded px-3 py-1.5"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {Object.entries(statusColor).map(([status, color]) => (
            <span key={status} className="flex items-center gap-1">
              <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: color }} />
              {status.replace("_", " ")}
            </span>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-12 bg-gray-200 rounded-lg" />
          ))}
        </div>
      ) : deps.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center">
          <p className="text-xs text-gray-500">No dependencies found for this project.</p>
          <p className="text-xs text-gray-400 mt-1">Add task dependencies to see the DAG visualization.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-auto">
          <svg
            width={svgWidth}
            height={svgHeight}
            className="min-w-full"
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="6"
                refX="8"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#9ca3af" />
              </marker>
              <marker
                id="arrowhead-active"
                markerWidth="8"
                markerHeight="6"
                refX="8"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#3b82f6" />
              </marker>
            </defs>

            {/* Edges */}
            {edges.map((edge) => {
              const from = positions.get(edge.from);
              const to = positions.get(edge.to);
              if (!from || !to) return null;

              const x1 = from.x + NODE_W;
              const y1 = from.y + NODE_H / 2;
              const x2 = to.x;
              const y2 = to.y + NODE_H / 2;
              const isHighlighted = highlightedEdges.has(`${edge.from}-${edge.to}`);

              // Bezier curve for smooth edges
              const midX = (x1 + x2) / 2;

              return (
                <g key={`${edge.from}-${edge.to}`}>
                  <path
                    d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke={isHighlighted ? "#3b82f6" : "#d1d5db"}
                    strokeWidth={isHighlighted ? 2 : 1.5}
                    markerEnd={isHighlighted ? "url(#arrowhead-active)" : "url(#arrowhead)"}
                    className="transition-colors"
                  />
                  {/* Edge label */}
                  <text
                    x={midX}
                    y={(y1 + y2) / 2 - 6}
                    textAnchor="middle"
                    className="text-[9px]"
                    fill={isHighlighted ? "#3b82f6" : "#9ca3af"}
                  >
                    {edge.type}
                  </text>
                </g>
              );
            })}

            {/* Nodes */}
            {Array.from(positions.entries()).map(([nodeId, pos]) => {
              const status = getTaskStatus(nodeId);
              const fill = statusColor[status] ?? "#9ca3af";
              const isHovered = hoveredNode === nodeId;

              return (
                <g
                  key={nodeId}
                  onMouseEnter={() => setHoveredNode(nodeId)}
                  onMouseLeave={() => setHoveredNode(null)}
                  className="cursor-pointer"
                >
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={NODE_W}
                    height={NODE_H}
                    rx={6}
                    fill={isHovered ? fill : "white"}
                    stroke={fill}
                    strokeWidth={isHovered ? 2.5 : 2}
                    className="transition-all"
                  />
                  {/* Status bar on left */}
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={4}
                    height={NODE_H}
                    rx={2}
                    fill={fill}
                  />
                  <text
                    x={pos.x + 12}
                    y={pos.y + 18}
                    className="text-xs font-medium"
                    fill={isHovered ? "white" : "#111827"}
                  >
                    {getTaskTitle(nodeId).slice(0, 18)}
                    {getTaskTitle(nodeId).length > 18 ? "..." : ""}
                  </text>
                  <text
                    x={pos.x + 12}
                    y={pos.y + 32}
                    className="text-[10px]"
                    fill={isHovered ? "rgba(255,255,255,0.8)" : "#6b7280"}
                  >
                    {status.replace("_", " ")}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Summary */}
          <div className="px-4 py-2 border-t bg-gray-50 flex items-center gap-4 text-xs text-gray-500">
            <span>{connectedNodeIds.size} connected tasks</span>
            <span>{deps.length} dependencies</span>
            <span>{edges.filter(e => getTaskStatus(e.from) === "blocked" || getTaskStatus(e.to) === "blocked").length} blocked chains</span>
          </div>
        </div>
      )}
    </div>
  );
}
