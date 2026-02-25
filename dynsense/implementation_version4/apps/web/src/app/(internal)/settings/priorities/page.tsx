"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface PriorityLevel {
  key: string;
  label: string;
  color: string;
  bgClass: string;
  description: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  projectId: string;
}

const DEFAULT_PRIORITIES: PriorityLevel[] = [
  { key: "critical", label: "Critical", color: "#EF4444", bgClass: "bg-red-100 text-red-700", description: "Blocking issues that need immediate attention" },
  { key: "high", label: "High", color: "#F97316", bgClass: "bg-orange-100 text-orange-700", description: "Important tasks that should be done soon" },
  { key: "medium", label: "Medium", color: "#3B82F6", bgClass: "bg-blue-100 text-blue-700", description: "Normal priority work" },
  { key: "low", label: "Low", color: "#9CA3AF", bgClass: "bg-gray-100 text-gray-700", description: "Nice to have, no urgency" },
];

const statusColors: Record<string, string> = {
  created: "bg-gray-100 text-gray-600",
  ready: "bg-blue-100 text-blue-700",
  in_progress: "bg-purple-100 text-purple-700",
  review: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  blocked: "bg-red-100 text-red-700",
  cancelled: "bg-gray-200 text-gray-500",
};

export default function PrioritiesPage() {
  const [priorities] = useState<PriorityLevel[]>(DEFAULT_PRIORITIES);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectMap, setProjectMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getTasks({ limit: 500 }), api.getProjects()])
      .then(([tasksRes, projRes]) => {
        setTasks(tasksRes.data);
        const map: Record<string, string> = {};
        for (const p of projRes.data) {
          map[p.id] = p.name;
        }
        setProjectMap(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const tasksByPriority = priorities.reduce<Record<string, Task[]>>((acc, p) => {
    acc[p.key] = tasks.filter((t) => t.priority === p.key);
    return acc;
  }, {});

  function startEdit(p: PriorityLevel) {
    setEditingKey(p.key);
    setEditLabel(p.label);
    setEditDesc(p.description);
  }

  function cancelEdit() {
    setEditingKey(null);
    setEditLabel("");
    setEditDesc("");
  }

  function toggleExpand(key: string) {
    setExpandedKey(expandedKey === key ? null : key);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold">Priorities</h1>
        <p className="text-xs text-gray-500 mt-0.5">Configure the priority levels used across all tasks.</p>
      </div>

      <div className="bg-white rounded-lg border divide-y">
        {priorities.map((p, index) => {
          const groupTasks = tasksByPriority[p.key] ?? [];
          const isExpanded = expandedKey === p.key;

          return (
            <div key={p.key}>
              <div className="px-4 py-4">
                {editingKey === p.key ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                      <input
                        type="text"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="text-sm font-medium px-2 py-1 border rounded-md focus:outline-none focus:ring-1 focus:ring-ai/50"
                        autoFocus
                      />
                    </div>
                    <input
                      type="text"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="w-full text-xs px-2 py-1 border rounded-md focus:outline-none focus:ring-1 focus:ring-ai/50"
                      placeholder="Description"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1 text-xs font-medium text-gray-600 border rounded-md hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div
                      className="flex items-center gap-4 cursor-pointer select-none"
                      onClick={() => toggleExpand(p.key)}
                    >
                      <div className="flex items-center gap-1 text-xs text-gray-400 w-6">
                        {index + 1}
                      </div>
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">{p.label}</div>
                        <div className="text-xs text-gray-500">{p.description}</div>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.bgClass}`}>
                        {loading ? "…" : groupTasks.length}
                      </span>
                      <span className="text-xs font-mono text-gray-400 px-2 py-0.5 bg-gray-50 rounded">
                        {p.key}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(p);
                        }}
                        className="text-xs text-gray-400 hover:text-ai px-2 py-1 transition-colors"
                      >
                        Edit
                      </button>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 ml-10">
                        {groupTasks.length === 0 ? (
                          <p className="text-xs text-gray-400 py-2">No tasks at this priority level.</p>
                        ) : (
                          <div className="border rounded-md divide-y">
                            {groupTasks.map((task) => (
                              <div key={task.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors">
                                <Link
                                  href={`/tasks/${task.id}`}
                                  className="text-sm font-medium text-gray-900 truncate hover:text-ai transition-colors flex-1 min-w-0"
                                >
                                  {task.title}
                                </Link>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${statusColors[task.status] ?? ""}`}>
                                  {task.status.replace("_", " ")}
                                </span>
                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                  {projectMap[task.projectId] ?? "—"}
                                </span>
                                {task.dueDate ? (
                                  <span
                                    className={`text-xs whitespace-nowrap ${
                                      new Date(task.dueDate) < new Date() && task.status !== "completed" && task.status !== "cancelled"
                                        ? "text-red-500 font-medium"
                                        : "text-gray-500"
                                    }`}
                                  >
                                    {new Date(task.dueDate).toLocaleDateString()}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-300">&mdash;</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-xs text-blue-700">
          Priority levels are system-wide and apply to all tasks across all projects. The order shown here represents the severity ranking from highest to lowest.
        </p>
      </div>
    </div>
  );
}
