"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { KanbanView } from "@/components/views/kanban-view";
import { CalendarView } from "@/components/views/calendar-view";
import { TableView } from "@/components/views/table-view";

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

const STATUSES = ["created", "ready", "in_progress", "review", "completed", "blocked", "cancelled"];
const statusTabs = ["all", "in_progress", "ready", "review", "blocked", "completed"];

type ViewMode = "list" | "kanban" | "calendar" | "table";

const viewTabs: { key: ViewMode; label: string; icon: React.ReactNode }[] = [
  {
    key: "list",
    label: "List",
    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>,
  },
  {
    key: "kanban",
    label: "Kanban",
    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>,
  },
  {
    key: "calendar",
    label: "Calendar",
    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  },
  {
    key: "table",
    label: "Table",
    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  },
];

interface Project {
  id: string;
  name: string;
}

export default function MyTasksPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProjectId, setFilterProjectId] = useState("all");
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  // New task form state
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newProjectId, setNewProjectId] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newDueDate, setNewDueDate] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getTasks({ limit: 200 }),
      api.getProjects(),
    ])
      .then(([tasksRes, projectsRes]) => {
        setTasks(tasksRes.data);
        setProjects(projectsRes.data);
        if (projectsRes.data.length > 0) {
          setNewProjectId(projectsRes.data[0]!.id);
        }
      })
      .catch(() => setError("Failed to load tasks"))
      .finally(() => setLoading(false));
  }, []);

  const handleCreateTask = useCallback(async () => {
    if (!newTitle.trim() || !newProjectId) return;
    setCreating(true);
    try {
      const res = await api.createTask({
        projectId: newProjectId,
        title: newTitle.trim(),
        priority: newPriority,
        dueDate: newDueDate || undefined,
      });
      setTasks((prev) => [
        {
          id: res.data.id,
          title: newTitle.trim(),
          status: "created",
          priority: newPriority,
          assigneeId: null,
          dueDate: newDueDate || null,
          projectId: newProjectId,
        },
        ...prev,
      ]);
      setNewTitle("");
      setNewPriority("medium");
      setNewDueDate("");
      setShowNewTask(false);
    } catch {
      setError("Failed to create task");
    } finally {
      setCreating(false);
    }
  }, [newTitle, newProjectId, newPriority, newDueDate]);

  const handleStatusChange = useCallback(async (taskId: string, newStatus: string) => {
    setChangingStatusId(null);
    setSavingIds((prev) => new Set(prev).add(taskId));
    const original = tasks.find((t) => t.id === taskId);
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    try {
      await api.updateTaskStatus(taskId, newStatus);
    } catch {
      if (original) setTasks((prev) => prev.map((t) => t.id === taskId ? original : t));
      setError("Failed to update status");
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  }, [tasks]);

  const projectFiltered = filterProjectId === "all" ? tasks : tasks.filter((t) => t.projectId === filterProjectId);
  const filtered = filterStatus === "all" ? projectFiltered : projectFiltered.filter((t) => t.status === filterStatus);

  const urgentTasks = projectFiltered.filter((t) =>
    t.status !== "completed" && t.status !== "cancelled" &&
    (t.priority === "critical" || t.priority === "high")
  );
  const overdueTasks = projectFiltered.filter((t) =>
    t.status !== "completed" && t.status !== "cancelled" &&
    t.dueDate && new Date(t.dueDate) < new Date()
  );

  return (
    <div className="space-y-6">
      {/* Header with view switcher */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">My Tasks</h1>
          <button
            onClick={() => setShowNewTask((prev) => !prev)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-ai rounded-md hover:bg-ai/90 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Task
          </button>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {viewTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setViewMode(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
                viewMode === tab.key
                  ? "bg-white text-ai font-medium shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* New task form */}
      {showNewTask && (
        <div className="bg-white rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Create New Task</h3>
            <button onClick={() => setShowNewTask(false)} className="text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <input
            type="text"
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateTask(); if (e.key === "Escape") setShowNewTask(false); }}
            placeholder="Task title..."
            className="w-full text-sm px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ai/50"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={newProjectId}
              onChange={(e) => setNewProjectId(e.target.value)}
              className="text-xs px-2 py-1.5 border rounded-md"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
              className="text-xs px-2 py-1.5 border rounded-md"
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="text-xs px-2 py-1.5 border rounded-md"
            />
            <button
              onClick={handleCreateTask}
              disabled={creating || !newTitle.trim() || !newProjectId}
              className="ml-auto px-4 py-1.5 text-xs font-medium text-white bg-ai rounded-md hover:bg-ai/90 disabled:opacity-50 transition-colors"
            >
              {creating ? "Creating..." : "Create Task"}
            </button>
          </div>
        </div>
      )}

      {/* Render the active view */}
      {viewMode === "kanban" && <KanbanView />}
      {viewMode === "calendar" && <CalendarView />}
      {viewMode === "table" && <TableView />}

      {/* List view (original My Tasks content) */}
      {viewMode === "list" && (
        <>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-white rounded border animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">
                  {error}
                  <button onClick={() => setError("")} className="ml-2 text-red-400 hover:text-red-600">&times;</button>
                </div>
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

              {/* Project switcher */}
              {projects.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setFilterProjectId("all")}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      filterProjectId === "all"
                        ? "bg-ai text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    All Projects ({tasks.length})
                  </button>
                  {projects.map((p) => {
                    const count = tasks.filter((t) => t.projectId === p.id).length;
                    if (count === 0) return null;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setFilterProjectId(p.id)}
                        className={`px-3 py-1 text-xs rounded-full transition-colors ${
                          filterProjectId === p.id
                            ? "bg-ai text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {p.name} ({count})
                      </button>
                    );
                  })}
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
                    {s === "all" ? "All" : s.replace("_", " ")} ({s === "all" ? projectFiltered.length : projectFiltered.filter((t) => t.status === s).length})
                  </button>
                ))}
              </div>

              {/* Task list */}
              {filtered.length === 0 ? (
                <div className="text-sm text-gray-500 bg-white rounded-lg border p-6 text-center">
                  {tasks.length === 0 ? "No tasks assigned to you yet." : "No tasks match the selected filters."}
                </div>
              ) : (
                <div className="bg-white rounded-lg border divide-y">
                  {filtered.map((task) => {
                    const isSaving = savingIds.has(task.id);
                    const isChanging = changingStatusId === task.id;

                    return (
                      <div
                        key={task.id}
                        className={`flex items-center gap-4 px-4 py-3 transition-colors ${isSaving ? "opacity-60" : "hover:bg-gray-50"}`}
                      >
                        <div className="flex-1 min-w-0">
                          <Link href={`/tasks/${task.id}`} className="text-sm font-medium text-gray-900 truncate hover:text-ai transition-colors block">
                            {task.title}
                          </Link>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${priorityColors[task.priority] ?? ""}`}>
                          {task.priority}
                        </span>

                        {isChanging ? (
                          <select
                            autoFocus
                            value={task.status}
                            onChange={(e) => handleStatusChange(task.id, e.target.value)}
                            onBlur={() => setChangingStatusId(null)}
                            className="text-xs px-2 py-0.5 border rounded"
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>{s.replace("_", " ")}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => setChangingStatusId(task.id)}
                            className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap cursor-pointer hover:ring-2 hover:ring-ai/30 transition-all ${statusColors[task.status] ?? ""}`}
                          >
                            {task.status.replace("_", " ")}
                          </button>
                        )}

                        {task.dueDate && (
                          <span className={`text-xs whitespace-nowrap ${
                            new Date(task.dueDate) < new Date() ? "text-red-500 font-medium" : "text-gray-400"
                          }`}>
                            {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
