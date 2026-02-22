"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  dueDate: string | null;
  projectId: string;
}

const COLUMNS = [
  { key: "created", label: "Created", color: "border-gray-300 bg-gray-50" },
  { key: "ready", label: "Ready", color: "border-blue-300 bg-blue-50" },
  { key: "in_progress", label: "In Progress", color: "border-purple-300 bg-purple-50" },
  { key: "review", label: "Review", color: "border-yellow-300 bg-yellow-50" },
  { key: "completed", label: "Completed", color: "border-green-300 bg-green-50" },
  { key: "blocked", label: "Blocked", color: "border-red-300 bg-red-50" },
  { key: "cancelled", label: "Cancelled", color: "border-gray-400 bg-gray-100" },
];

const priorityColors: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-blue-500",
  low: "bg-gray-400",
};

export default function KanbanPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getTasks({ limit: 500 })
      .then((res) => setTasks(res.data))
      .catch(() => setError("Failed to load tasks"))
      .finally(() => setLoading(false));
  }, []);

  const tasksByStatus = COLUMNS.reduce<Record<string, Task[]>>((acc, col) => {
    acc[col.key] = tasks.filter((t) => t.status === col.key);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="flex gap-4 overflow-x-auto">
          {COLUMNS.map((col) => (
            <div key={col.key} className="w-64 flex-shrink-0">
              <div className="h-6 w-24 bg-gray-200 rounded animate-pulse mb-3" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-white rounded border animate-pulse mb-2" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kanban Board</h1>
        <span className="text-xs text-gray-400">{tasks.length} tasks total</span>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const colTasks = tasksByStatus[col.key] ?? [];
          return (
            <div key={col.key} className="w-64 flex-shrink-0">
              {/* Column header */}
              <div className={`rounded-t-lg border-t-2 px-3 py-2 ${col.color}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-gray-700">
                    {col.label}
                  </h3>
                  <span className="text-xs text-gray-400 bg-white/80 px-1.5 py-0.5 rounded-full">
                    {colTasks.length}
                  </span>
                </div>
              </div>

              {/* Column body */}
              <div className="space-y-2 mt-2 min-h-[200px]">
                {colTasks.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center py-8 border border-dashed rounded-lg">
                    No tasks
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <Link
                      key={task.id}
                      href={`/tasks/${task.id}`}
                      className="block bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow p-3"
                    >
                      <div className="flex items-start gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${priorityColors[task.priority] ?? "bg-gray-400"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">{task.title}</p>
                          {task.dueDate && (
                            <p className={`text-[10px] mt-1 ${
                              new Date(task.dueDate) < new Date()
                                ? "text-red-500 font-medium"
                                : "text-gray-400"
                            }`}>
                              Due {new Date(task.dueDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="text-[10px] text-gray-400 capitalize">{task.priority}</span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
