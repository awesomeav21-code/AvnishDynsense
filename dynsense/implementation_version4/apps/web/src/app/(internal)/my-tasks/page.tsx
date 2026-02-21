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

const statusColors: Record<string, string> = {
  created: "bg-gray-100 text-gray-600",
  ready: "bg-blue-100 text-blue-700",
  in_progress: "bg-purple-100 text-purple-700",
  review: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  blocked: "bg-red-100 text-red-700",
  cancelled: "bg-gray-200 text-gray-500",
};
const priorityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-blue-100 text-blue-700",
  low: "bg-gray-100 text-gray-600",
};

const statusTabs = ["all", "in_progress", "ready", "review", "blocked", "completed"];

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    api.getTasks({ limit: 200 })
      .then((res) => setTasks(res.data))
      .catch(() => setError("Failed to load tasks"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filterStatus === "all" ? tasks : tasks.filter((t) => t.status === filterStatus);

  // Group by priority for the "What's Next" section
  const urgentTasks = tasks.filter((t) =>
    t.status !== "completed" && t.status !== "cancelled" &&
    (t.priority === "critical" || t.priority === "high")
  );
  const overdueTasks = tasks.filter((t) =>
    t.status !== "completed" && t.status !== "cancelled" &&
    t.dueDate && new Date(t.dueDate) < new Date()
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-white rounded border animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Tasks</h1>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</div>
      )}

      {/* What's Next cards */}
      {(urgentTasks.length > 0 || overdueTasks.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {overdueTasks.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-red-700 mb-2">Overdue ({overdueTasks.length})</h3>
              {overdueTasks.slice(0, 3).map((t) => (
                <Link key={t.id} href={`/tasks/${t.id}`} className="block text-xs text-red-600 hover:text-red-800 truncate py-0.5">
                  {t.title}
                </Link>
              ))}
              {overdueTasks.length > 3 && <span className="text-xs text-red-400">+{overdueTasks.length - 3} more</span>}
            </div>
          )}
          {urgentTasks.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-orange-700 mb-2">High Priority ({urgentTasks.length})</h3>
              {urgentTasks.slice(0, 3).map((t) => (
                <Link key={t.id} href={`/tasks/${t.id}`} className="block text-xs text-orange-600 hover:text-orange-800 truncate py-0.5">
                  {t.title}
                </Link>
              ))}
              {urgentTasks.length > 3 && <span className="text-xs text-orange-400">+{urgentTasks.length - 3} more</span>}
            </div>
          )}
        </div>
      )}

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        {statusTabs.map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              filterStatus === s
                ? "bg-ai text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s === "all" ? "All" : s.replace("_", " ")} ({s === "all" ? tasks.length : tasks.filter((t) => t.status === s).length})
          </button>
        ))}
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <div className="text-sm text-gray-500 bg-white rounded-lg border p-6 text-center">
          {tasks.length === 0 ? "No tasks assigned to you yet." : "No tasks match this filter."}
        </div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {filtered.map((task) => (
            <Link
              key={task.id}
              href={`/tasks/${task.id}`}
              className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{task.title}</div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${priorityColors[task.priority] ?? ""}`}>
                {task.priority}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${statusColors[task.status] ?? ""}`}>
                {task.status.replace("_", " ")}
              </span>
              {task.dueDate && (
                <span className={`text-xs whitespace-nowrap ${
                  new Date(task.dueDate) < new Date() ? "text-red-500 font-medium" : "text-gray-400"
                }`}>
                  {new Date(task.dueDate).toLocaleDateString()}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
