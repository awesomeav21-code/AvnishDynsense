"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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

const PROJECT_STATUSES = ["active", "on_hold", "completed", "cancelled"];

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [userRole, setUserRole] = useState<string>("");

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canEdit = userRole === "site_admin" || userRole === "pm";
  const canDelete = userRole === "site_admin";

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
      }
      try {
        const meRes = await api.getMe();
        setUserRole(meRes.role);
      } catch {
        setUserRole("site_admin");
      }
      setLoading(false);
    }
    load();
  }, [projectId]);

  async function handleCreateTask() {
    if (!newTaskTitle.trim()) return;
    try {
      const res = await api.createTask({ projectId, title: newTaskTitle });
      setTasks((prev) => [{ ...res.data, status: "created", priority: "medium", assigneeId: null, dueDate: null, projectId } as Task, ...prev]);
      setNewTaskTitle("");
      setShowCreateTask(false);
    } catch {
      setError("Failed to create task");
    }
  }

  function startEditing() {
    if (!project) return;
    setEditName(project.name);
    setEditDesc(project.description ?? "");
    setEditStatus(project.status);
    setEditing(true);
  }

  const handleSaveEdit = useCallback(async () => {
    if (!editName.trim() || !project) return;
    setSaving(true);
    try {
      const res = await api.updateProject(projectId, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        status: editStatus,
      });
      setProject({ ...project, name: res.data.name, description: res.data.description, status: res.data.status });
      setEditing(false);
    } catch {
      setError("Failed to update project");
    } finally {
      setSaving(false);
    }
  }, [editName, editDesc, editStatus, project, projectId]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.deleteProject(projectId);
      router.push("/projects");
    } catch {
      setError("Failed to delete project");
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

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
        {editing ? (
          <div className="space-y-3">
            <input
              type="text"
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setEditing(false); }}
              className="w-full text-lg font-bold px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ai/50"
            />
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full text-sm px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ai/50 resize-none"
            />
            <div className="flex items-center gap-3">
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="text-xs px-2 py-1.5 border rounded-md"
              >
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace("_", " ")}</option>
                ))}
              </select>
              <button
                onClick={handleSaveEdit}
                disabled={saving || !editName.trim()}
                className="px-4 py-1.5 text-xs font-medium text-white bg-ai rounded-md hover:bg-ai/90 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 border rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold">{project.name}</h1>
                {project.description && (
                  <p className="text-sm text-gray-600 mt-1">{project.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  project.status === "active" ? "bg-green-100 text-green-700"
                    : project.status === "on_hold" ? "bg-yellow-100 text-yellow-700"
                    : project.status === "completed" ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-600"
                }`}>
                  {project.status.replace("_", " ")}
                </span>
                {canEdit && (
                  <button
                    onClick={startEditing}
                    className="p-1.5 text-gray-400 hover:text-ai rounded hover:bg-gray-100 transition-colors"
                    title="Edit project"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                    title="Delete project"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
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
          </>
        )}
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-red-800">Delete &ldquo;{project.name}&rdquo;?</p>
            <p className="text-xs text-red-600 mt-0.5">This action cannot be undone.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 border rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Task list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Tasks ({tasks.length})</h2>
          {canEdit && (
            <button
              onClick={() => setShowCreateTask(true)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-ai rounded-md hover:bg-ai/90"
            >
              + New Task
            </button>
          )}
        </div>

        {/* Create task inline form */}
        {showCreateTask && (
          <div className="bg-white rounded-lg border p-4 mb-4 space-y-3">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Task title"
              className="w-full px-3 py-2 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-ai/50"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateTask}
                disabled={!newTaskTitle.trim()}
                className="px-3 py-1.5 text-xs font-medium text-white bg-ai rounded-md disabled:opacity-50"
              >
                Create
              </button>
              <button
                onClick={() => { setShowCreateTask(false); setNewTaskTitle(""); }}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 border rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {tasks.length === 0 && !showCreateTask ? (
          <div className="text-sm text-gray-500 bg-white rounded-lg border p-6 text-center">
            No tasks in this project yet.
          </div>
        ) : (
          <div className="bg-white rounded-lg border divide-y">
            {tasks.map((task) => (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
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
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
