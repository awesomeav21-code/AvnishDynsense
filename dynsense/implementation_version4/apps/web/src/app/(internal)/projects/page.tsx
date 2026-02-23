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
  const [showClone, setShowClone] = useState(false);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; description: string | null }>>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [cloneName, setCloneName] = useState("");
  const [cloning, setCloning] = useState(false);
  const [userRole, setUserRole] = useState<string>("");

  const canCreate = userRole === "site_admin" || userRole === "pm";
  const canEdit = userRole === "site_admin" || userRole === "pm";
  const canDelete = userRole === "site_admin";

  useEffect(() => {
    async function load() {
      try {
        const projRes = await api.getProjects();
        setProjects(projRes.data);
      } catch {
        setError("Failed to load projects");
      }
      try {
        const meRes = await api.getMe();
        setUserRole(meRes.role);
      } catch {
        // Default to site_admin if getMe fails so buttons remain usable
        setUserRole("site_admin");
      }
      setLoading(false);
    }
    load();
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

  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await api.deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch {
      setError("Failed to delete project");
    } finally {
      setDeletingId(null);
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
        <h1 className="text-lg font-bold">Projects</h1>
        {canCreate && (
          <div className="flex gap-2">
            <button
              onClick={async () => {
                setShowClone(true);
                try {
                  const res = await api.getTemplates();
                  setTemplates(res.data);
                } catch { /* ignore */ }
              }}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 border rounded-md hover:bg-gray-50"
            >
              Clone from Template
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-ai rounded-md hover:bg-ai/90"
            >
              + New Project
            </button>
          </div>
        )}
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

      {/* Clone from template dialog */}
      {showClone && (
        <div className="bg-white rounded-lg border p-4 space-y-3">
          <h3 className="text-xs font-semibold">Clone from Template</h3>
          {templates.length === 0 ? (
            <p className="text-xs text-gray-500">No templates available. Create a project first to use it as a template.</p>
          ) : (
            <>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full text-xs border rounded px-3 py-1.5"
              >
                <option value="">Select a template...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}{t.description ? ` — ${t.description}` : ""}</option>
                ))}
              </select>
              <input
                type="text"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                placeholder="New project name"
                className="w-full text-xs border rounded px-3 py-1.5"
              />
            </>
          )}
          <div className="flex gap-2">
            {templates.length > 0 && (
              <button
                onClick={async () => {
                  if (!selectedTemplate || !cloneName.trim()) return;
                  setCloning(true);
                  try {
                    const res = await api.cloneProject({ sourceProjectId: selectedTemplate, name: cloneName.trim() });
                    const cloned = res.data;
                    setProjects((prev) => [{ id: (cloned.project as { id: string }).id, name: cloneName.trim(), status: "active", description: null, createdAt: new Date().toISOString() }, ...prev]);
                    setShowClone(false);
                    setSelectedTemplate("");
                    setCloneName("");
                  } catch {
                    setError("Failed to clone project");
                  } finally {
                    setCloning(false);
                  }
                }}
                disabled={cloning || !selectedTemplate || !cloneName.trim()}
                className="px-3 py-1.5 text-xs font-medium text-white bg-ai rounded-md disabled:opacity-50"
              >
                {cloning ? "Cloning..." : "Clone"}
              </button>
            )}
            <button
              onClick={() => { setShowClone(false); setSelectedTemplate(""); setCloneName(""); }}
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
            <div
              key={project.id}
              className={`bg-white rounded-lg border p-4 hover:border-ai/50 hover:shadow-sm transition-all ${deletingId === project.id ? "opacity-50" : ""}`}
            >
              <div className="flex items-start justify-between">
                <Link href={`/projects/${project.id}`} className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-900 hover:text-ai transition-colors">{project.name}</h3>
                </Link>
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    project.status === "active"
                      ? "bg-green-100 text-green-700"
                      : project.status === "on_hold"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {project.status}
                  </span>
                  {canEdit && (
                    <Link
                      href={`/projects/${project.id}`}
                      className="p-1 text-gray-300 hover:text-ai rounded hover:bg-gray-100 transition-colors"
                      title="Edit project"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </Link>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => { if (confirm(`Delete "${project.name}"? This cannot be undone.`)) handleDelete(project.id); }}
                      className="p-1 text-gray-300 hover:text-red-500 rounded hover:bg-red-50 transition-colors"
                      title="Delete project"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <Link href={`/projects/${project.id}`}>
                {project.description && (
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2">{project.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-3">
                  Created {new Date(project.createdAt).toLocaleDateString()}
                </p>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
