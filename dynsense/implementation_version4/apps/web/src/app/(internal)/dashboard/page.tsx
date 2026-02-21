"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Project {
  id: string;
  name: string;
  status: string;
  description: string | null;
  createdAt: string;
}

interface TaskStat {
  status: string;
  count: number;
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [taskStats, setTaskStats] = useState<TaskStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [projRes, statsRes] = await Promise.all([
          api.getProjects(),
          api.getTaskStats(),
        ]);
        setProjects(projRes.data);
        setTaskStats(statsRes.data);
      } catch {
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalTasks = taskStats.reduce((sum, s) => sum + s.count, 0);
  const completedTasks = taskStats.find((s) => s.status === "completed")?.count ?? 0;
  const inProgressTasks = taskStats.find((s) => s.status === "in_progress")?.count ?? 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-white rounded-lg border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs text-gray-500">Total Tasks</div>
          <div className="text-2xl font-bold mt-1">{totalTasks}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs text-gray-500">In Progress</div>
          <div className="text-2xl font-bold mt-1 text-ai">{inProgressTasks}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs text-gray-500">Completed</div>
          <div className="text-2xl font-bold mt-1 text-confidence-high">{completedTasks}</div>
        </div>
      </div>

      {/* Projects list */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Projects</h2>
        {projects.length === 0 ? (
          <div className="text-sm text-gray-500 bg-white rounded-lg border p-6 text-center">
            No projects yet. Create one to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block bg-white rounded-lg border p-4 hover:border-ai/50 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-medium text-gray-900">{project.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    project.status === "active"
                      ? "bg-green-100 text-green-700"
                      : project.status === "on_hold"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {project.status}
                  </span>
                </div>
                {project.description && (
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2">{project.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
