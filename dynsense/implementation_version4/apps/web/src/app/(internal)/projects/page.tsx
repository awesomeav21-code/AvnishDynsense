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

export default function ProjectsListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    api.getProjects()
      .then((res) => setProjects(res.data))
      .catch(() => setError("Failed to load projects"))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      const res = await api.createProject({ name: newName, description: newDesc || undefined });
      setProjects((prev) => [{ ...res.data, status: "active", description: newDesc || null, createdAt: new Date().toISOString() } as Project, ...prev]);
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
    } catch {
      setError("Failed to create project");
    }
  }

  const filtered = filterStatus === "all" ? projects : projects.filter((p) => p.status === filterStatus);
  const statuses = ["all", ...new Set(projects.map((p) => p.status))];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-white rounded-lg border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-3 py-1.5 text-xs font-medium text-white bg-ai rounded-md hover:bg-ai/90"
        >
          + New Project
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">
          {error}
        </div>
      )}

      {/* Create project form */}
      {showCreate && (
        <div className="bg-white rounded-lg border p-4 space-y-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Project name"
            className="w-full px-3 py-2 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-ai/50"
            autoFocus
          />
          <textarea
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full px-3 py-2 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-ai/50 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="px-3 py-1.5 text-xs font-medium text-white bg-ai rounded-md disabled:opacity-50"
            >
              Create
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewName(""); setNewDesc(""); }}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 border rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              filterStatus === s
                ? "bg-ai text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s === "all" ? "All" : s.replace("_", " ")} ({s === "all" ? projects.length : projects.filter((p) => p.status === s).length})
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-sm text-gray-500 bg-white rounded-lg border p-6 text-center">
          {projects.length === 0 ? "No projects yet. Create one to get started." : "No projects match this filter."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => (
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
              <p className="text-xs text-gray-400 mt-3">
                Created {new Date(project.createdAt).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
