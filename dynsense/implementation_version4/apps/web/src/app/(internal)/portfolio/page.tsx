"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// FR-161: Portfolio dashboard — cross-project overview
interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  taskCount: number;
  completedCount: number;
  overdueCount: number;
}

export default function PortfolioPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getProjects().then(async (res) => {
      const summaries: ProjectSummary[] = [];

      for (const project of res.data) {
        try {
          const taskRes = await api.getTasks({ projectId: project.id });
          const allTasks = taskRes.data;
          const now = new Date();

          summaries.push({
            id: project.id,
            name: project.name,
            status: project.status,
            taskCount: allTasks.length,
            completedCount: allTasks.filter((t: { status: string }) => t.status === "completed").length,
            overdueCount: allTasks.filter((t: { status: string; dueDate: string | null }) =>
              t.dueDate && new Date(t.dueDate) < now && t.status !== "completed"
            ).length,
          });
        } catch {
          summaries.push({
            id: project.id,
            name: project.name,
            status: project.status,
            taskCount: 0,
            completedCount: 0,
            overdueCount: 0,
          });
        }
      }

      setProjects(summaries);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold">Portfolio Dashboard</h1>
        <div className="animate-pulse grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const totalTasks = projects.reduce((s, p) => s + p.taskCount, 0);
  const totalCompleted = projects.reduce((s, p) => s + p.completedCount, 0);
  const totalOverdue = projects.reduce((s, p) => s + p.overdueCount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold">Portfolio Dashboard</h1>
        <p className="text-xs text-gray-500 mt-1">Cross-project overview and health metrics</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{projects.length}</div>
          <div className="text-xs text-gray-500">Projects</div>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-gray-800">{totalTasks}</div>
          <div className="text-xs text-gray-500">Total Tasks</div>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{totalCompleted}</div>
          <div className="text-xs text-gray-500">Completed</div>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{totalOverdue}</div>
          <div className="text-xs text-gray-500">Overdue</div>
        </div>
      </div>

      {/* Project cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => {
          const progress = project.taskCount > 0
            ? Math.round((project.completedCount / project.taskCount) * 100)
            : 0;

          return (
            <div key={project.id} className="bg-white rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium truncate">{project.name}</h3>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  project.status === "active" ? "bg-green-100 text-green-700" :
                  project.status === "completed" ? "bg-blue-100 text-blue-700" :
                  "bg-gray-100 text-gray-700"
                }`}>{project.status}</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex justify-between text-xs text-gray-500">
                <span>{progress}% complete</span>
                <span>{project.completedCount}/{project.taskCount} tasks</span>
              </div>

              {project.overdueCount > 0 && (
                <div className="text-xs text-red-600">
                  {project.overdueCount} overdue task{project.overdueCount > 1 ? "s" : ""}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
