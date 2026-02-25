"use client";

import { useEffect, useState, useCallback } from "react";
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

export function KanbanView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTargetCol, setDropTargetCol] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    Promise.all([
      api.getTasks({ limit: 500 }).catch(() => null),
      api.getMe().catch(() => null),
    ]).then(([tasksRes, meRes]) => {
      if (tasksRes) setTasks(tasksRes.data);
      else setError("Failed to load tasks");
      if (meRes) setUserRole(meRes.role);
    }).finally(() => setLoading(false));
  }, []);

  const canTransition = userRole === "site_admin" || userRole === "pm" || userRole === "developer";

  const tasksByStatus = COLUMNS.reduce<Record<string, Task[]>>((acc, col) => {
    acc[col.key] = tasks.filter((t) => t.status === col.key);
    return acc;
  }, {});

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedTaskId(null);
    setDropTargetCol(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTargetCol(colKey);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTargetCol(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    setDropTargetCol(null);

    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    const previousStatus = task.status;
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
    );
    setUpdatingTaskId(taskId);

    try {
      await api.updateTaskStatus(taskId, newStatus);
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: previousStatus } : t)),
      );
      setError(`Failed to move task to ${newStatus}`);
    } finally {
      setUpdatingTaskId(null);
    }
  }, [tasks]);

  if (loading) {
    return (
      <div className="space-y-4">
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
        <span className="text-xs text-gray-400">{tasks.length} tasks total{canTransition ? " — drag cards to change status" : ""}</span>
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-4 py-2 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-600">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const colTasks = tasksByStatus[col.key] ?? [];
          const isDropTarget = dropTargetCol === col.key && draggedTaskId !== null;

          return (
            <div
              key={col.key}
              className="w-64 flex-shrink-0"
              onDragOver={canTransition ? (e) => handleDragOver(e, col.key) : undefined}
              onDragLeave={canTransition ? handleDragLeave : undefined}
              onDrop={canTransition ? (e) => handleDrop(e, col.key) : undefined}
            >
              <div className={`rounded-t-lg border-t-2 px-3 py-2 ${col.color}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-gray-700">{col.label}</h3>
                  <span className="text-xs text-gray-400 bg-white/80 px-1.5 py-0.5 rounded-full">
                    {colTasks.length}
                  </span>
                </div>
              </div>

              <div
                className={`space-y-2 mt-2 min-h-[200px] rounded-b-lg transition-colors ${
                  isDropTarget ? "bg-blue-50 ring-2 ring-blue-300 ring-inset" : ""
                }`}
              >
                {colTasks.length === 0 && !isDropTarget ? (
                  <div className="text-xs text-gray-400 text-center py-8 border border-dashed rounded-lg">
                    No tasks
                  </div>
                ) : (
                  colTasks.map((task) => {
                    const isDragging = draggedTaskId === task.id;
                    const isUpdating = updatingTaskId === task.id;

                    return (
                      <div
                        key={task.id}
                        draggable={canTransition}
                        onDragStart={canTransition ? (e) => handleDragStart(e, task.id) : undefined}
                        onDragEnd={canTransition ? handleDragEnd : undefined}
                        className={`bg-white rounded-lg border shadow-sm p-3 ${canTransition ? "cursor-grab active:cursor-grabbing" : ""} transition-all ${
                          isDragging ? "opacity-50 scale-95" : "hover:shadow-md"
                        } ${isUpdating ? "ring-2 ring-blue-400 animate-pulse" : ""}`}
                      >
                        <Link href={`/tasks/${task.id}`} className="block" onClick={(e) => { if (isDragging) e.preventDefault(); }}>
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
                            {isUpdating && <span className="text-[10px] text-blue-500">Updating...</span>}
                          </div>
                        </Link>
                      </div>
                    );
                  })
                )}

                {isDropTarget && (
                  <div className="border-2 border-dashed border-blue-300 rounded-lg py-4 text-center">
                    <span className="text-xs text-blue-500">Drop here</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
