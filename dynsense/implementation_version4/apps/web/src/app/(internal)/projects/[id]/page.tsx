"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

interface Project {
  id: string;
  name: string;
  status: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  dueDate: string | null;
  projectId: string;
}

const priorityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-blue-100 text-blue-700",
  low: "bg-gray-100 text-gray-600",
};

const statusColors: Record<string, string> = {
  created: "bg-gray-100 text-gray-600",
  ready: "bg-blue-100 text-blue-700",
  in_progress: "bg-ai/10 text-ai",
  review: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  blocked: "bg-red-100 text-red-700",
  cancelled: "bg-gray-200 text-gray-500",
};

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [projRes, tasksRes] = await Promise.all([
          api.getProject(projectId),
          api.getTasks({ projectId }),
        ]);
        setProject(projRes.data);
        setTasks(tasksRes.data);
      } catch {
        setError("Failed to load project");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-96 bg-gray-200 rounded animate-pulse" />
        <div className="space-y-2 mt-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-white rounded border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">
        {error || "Project not found"}
      </div>
    );
  }

  const statusCounts = tasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Link href="/dashboard" className="hover:text-gray-700">Dashboard</Link>
        <span>/</span>
        <span className="text-gray-900">{project.name}</span>
      </div>

      {/* Project header */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            {project.description && (
              <p className="text-sm text-gray-600 mt-1">{project.description}</p>
            )}
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${
            project.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
          }`}>
            {project.status}
          </span>
        </div>

        {/* Mini stats */}
        <div className="flex gap-4 mt-4">
          {Object.entries(statusCounts).map(([status, count]) => (
            <div key={status} className="text-xs">
              <span className={`inline-block px-2 py-0.5 rounded-full ${statusColors[status] ?? "bg-gray-100 text-gray-600"}`}>
                {status.replace("_", " ")}: {count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Task list */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Tasks ({tasks.length})</h2>

        {tasks.length === 0 ? (
          <div className="text-sm text-gray-500 bg-white rounded-lg border p-6 text-center">
            No tasks in this project yet.
          </div>
        ) : (
          <div className="bg-white rounded-lg border divide-y">
            {tasks.map((task) => (
              <div key={task.id} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {task.title}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${priorityColors[task.priority] ?? ""}`}>
                  {task.priority}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${statusColors[task.status] ?? ""}`}>
                  {task.status.replace("_", " ")}
                </span>
                {task.dueDate && (
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {new Date(task.dueDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
