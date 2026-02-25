"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
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

interface User {
  id: string;
  name: string;
  email: string;
}

const STATUSES = ["created", "ready", "in_progress", "review", "completed", "blocked", "cancelled"];
const PRIORITIES = ["critical", "high", "medium", "low"];

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

type SortField = "title" | "status" | "priority" | "dueDate" | "assignee";
type SortDir = "asc" | "desc";

const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const statusOrder: Record<string, number> = {
  blocked: 0, in_progress: 1, review: 2, ready: 3, created: 4, completed: 5, cancelled: 6,
};

export function TableView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editingCell, setEditingCell] = useState<{ taskId: string; field: string } | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    Promise.all([
      api.getTasks({ limit: 500 }),
      api.getUsers(),
      api.getMe().catch(() => null),
    ])
      .then(([tasksRes, usersRes, meRes]) => {
        setTasks(tasksRes.data);
        setUsers(usersRes.data);
        if (meRes) setUserRole(meRes.role);
      })
      .catch(() => setError("Failed to load data"))
      .finally(() => setLoading(false));
  }, []);

  const canEdit = userRole === "site_admin" || userRole === "pm" || userRole === "developer";

  const userMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const u of users) m[u.id] = u.name;
    return m;
  }, [users]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const updateTaskField = useCallback(async (taskId: string, field: string, value: string) => {
    setSavingIds((prev) => new Set(prev).add(taskId));
    setEditingCell(null);
    const original = tasks.find((t) => t.id === taskId);
    try {
      if (field === "status") {
        setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: value } : t));
        await api.updateTaskStatus(taskId, value);
      } else if (field === "priority") {
        setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, priority: value } : t));
        await api.updateTask(taskId, { priority: value });
      } else if (field === "assignee") {
        setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, assigneeId: value || null } : t));
        if (value) {
          await api.assignTask(taskId, value);
        }
      } else if (field === "dueDate") {
        setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, dueDate: value || null } : t));
        await api.updateTask(taskId, { dueDate: value || undefined });
      }
    } catch {
      if (original) {
        setTasks((prev) => prev.map((t) => t.id === taskId ? original : t));
      }
      setError(`Failed to update ${field}`);
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  }, [tasks]);

  const sorted = useMemo(() => {
    const arr = [...tasks];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortField) {
        case "title":
          return dir * a.title.localeCompare(b.title);
        case "status":
          return dir * ((statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));
        case "priority":
          return dir * ((priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9));
        case "dueDate": {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return dir;
          if (!b.dueDate) return -dir;
          return dir * (new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        }
        case "assignee": {
          const aName = a.assigneeId ? (userMap[a.assigneeId] ?? "") : "";
          const bName = b.assigneeId ? (userMap[b.assigneeId] ?? "") : "";
          return dir * aName.localeCompare(bName);
        }
        default:
          return 0;
      }
    });
    return arr;
  }, [tasks, sortField, sortDir, userMap]);

  function handleExportCsv() {
    const rows = sorted.map((t) => [
      t.title,
      t.status,
      t.priority,
      t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "",
      t.assigneeId ? (userMap[t.assigneeId] ?? "Unknown") : "Unassigned",
    ]);
    const csv = [
      "Title,Status,Priority,Due Date,Assignee",
      ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tasks-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleSelect(taskId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map((t) => t.id)));
    }
  }

  async function handleBulkAction() {
    if (!bulkAction || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setSavingIds(new Set(ids));
    try {
      if (STATUSES.includes(bulkAction)) {
        setTasks((prev) => prev.map((t) => ids.includes(t.id) ? { ...t, status: bulkAction } : t));
        await Promise.all(ids.map((id) => api.updateTaskStatus(id, bulkAction)));
      } else if (PRIORITIES.includes(bulkAction)) {
        setTasks((prev) => prev.map((t) => ids.includes(t.id) ? { ...t, priority: bulkAction } : t));
        await Promise.all(ids.map((id) => api.updateTask(id, { priority: bulkAction })));
      }
      setSelectedIds(new Set());
      setBulkAction("");
    } catch {
      setError("Some bulk updates failed");
    } finally {
      setSavingIds(new Set());
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) {
      return <span className="text-gray-300 ml-1">&udarr;</span>;
    }
    return <span className="text-ai ml-1">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-lg border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 border-b animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{tasks.length} tasks{canEdit ? " \u00b7 Click cells to edit" : ""}</span>
        <button
          onClick={handleExportCsv}
          disabled={tasks.length === 0}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 border rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-ai/5 border border-ai/20 rounded-lg px-4 py-2">
          <span className="text-xs font-medium text-ai">{selectedIds.size} selected</span>
          <select
            value={bulkAction}
            onChange={(e) => setBulkAction(e.target.value)}
            className="text-xs border rounded px-2 py-1"
          >
            <option value="">Choose action...</option>
            <optgroup label="Set Status">
              {STATUSES.map((s) => (
                <option key={`s-${s}`} value={s}>{s.replace("_", " ")}</option>
              ))}
            </optgroup>
            <optgroup label="Set Priority">
              {PRIORITIES.map((p) => (
                <option key={`p-${p}`} value={p}>{p}</option>
              ))}
            </optgroup>
          </select>
          <button
            onClick={handleBulkAction}
            disabled={!bulkAction}
            className="px-3 py-1 text-xs font-medium text-white bg-ai rounded-md disabled:opacity-50"
          >
            Apply
          </button>
          <button
            onClick={() => { setSelectedIds(new Set()); setBulkAction(""); }}
            className="text-xs text-gray-500 hover:text-gray-700 ml-auto"
          >
            Clear selection
          </button>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">
          {error}
          <button onClick={() => setError("")} className="ml-2 text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="text-sm text-gray-500 bg-white rounded-lg border p-6 text-center">
          No tasks found. Create tasks in a project to see them here.
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b">
                {canEdit && (
                  <th className="px-3 py-2.5 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === sorted.length && sorted.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                )}
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600 cursor-pointer hover:text-gray-900 select-none" onClick={() => handleSort("title")}>
                  Title <SortIcon field="title" />
                </th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600 cursor-pointer hover:text-gray-900 select-none w-32" onClick={() => handleSort("status")}>
                  Status <SortIcon field="status" />
                </th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600 cursor-pointer hover:text-gray-900 select-none w-28" onClick={() => handleSort("priority")}>
                  Priority <SortIcon field="priority" />
                </th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600 cursor-pointer hover:text-gray-900 select-none w-32" onClick={() => handleSort("dueDate")}>
                  Due Date <SortIcon field="dueDate" />
                </th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600 cursor-pointer hover:text-gray-900 select-none w-36" onClick={() => handleSort("assignee")}>
                  Assignee <SortIcon field="assignee" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sorted.map((task) => {
                const isSaving = savingIds.has(task.id);
                return (
                  <tr key={task.id} className={`transition-colors ${isSaving ? "opacity-60" : "hover:bg-gray-50"} ${selectedIds.has(task.id) ? "bg-ai/5" : ""}`}>
                    {canEdit && (
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(task.id)}
                          onChange={() => toggleSelect(task.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                    )}
                    <td className="px-4 py-2.5">
                      <Link href={`/tasks/${task.id}`} className="text-gray-900 font-medium hover:text-ai transition-colors">
                        {task.title}
                      </Link>
                    </td>

                    <td className="px-4 py-2.5">
                      {canEdit && editingCell?.taskId === task.id && editingCell.field === "status" ? (
                        <select
                          autoFocus
                          value={task.status}
                          onChange={(e) => updateTaskField(task.id, "status", e.target.value)}
                          onBlur={() => setEditingCell(null)}
                          className="text-[10px] px-1 py-0.5 border rounded w-full"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>{s.replace("_", " ")}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          onClick={canEdit ? () => setEditingCell({ taskId: task.id, field: "status" }) : undefined}
                          className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${canEdit ? "cursor-pointer hover:ring-2 hover:ring-ai/30" : ""} transition-all ${statusColors[task.status] ?? ""}`}
                        >
                          {task.status.replace("_", " ")}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-2.5">
                      {canEdit && editingCell?.taskId === task.id && editingCell.field === "priority" ? (
                        <select
                          autoFocus
                          value={task.priority}
                          onChange={(e) => updateTaskField(task.id, "priority", e.target.value)}
                          onBlur={() => setEditingCell(null)}
                          className="text-[10px] px-1 py-0.5 border rounded w-full"
                        >
                          {PRIORITIES.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          onClick={canEdit ? () => setEditingCell({ taskId: task.id, field: "priority" }) : undefined}
                          className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap capitalize ${canEdit ? "cursor-pointer hover:ring-2 hover:ring-ai/30" : ""} transition-all ${priorityColors[task.priority] ?? ""}`}
                        >
                          {task.priority}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-2.5">
                      {canEdit && editingCell?.taskId === task.id && editingCell.field === "dueDate" ? (
                        <input
                          type="date"
                          autoFocus
                          value={task.dueDate ? task.dueDate.slice(0, 10) : ""}
                          onChange={(e) => updateTaskField(task.id, "dueDate", e.target.value)}
                          onBlur={() => setEditingCell(null)}
                          className="text-[10px] px-1 py-0.5 border rounded w-full"
                        />
                      ) : (
                        <span className={`${canEdit ? "cursor-pointer hover:ring-2 hover:ring-ai/30" : ""} rounded px-1 py-0.5 transition-all`}
                          onClick={canEdit ? () => setEditingCell({ taskId: task.id, field: "dueDate" }) : undefined}
                        >
                          {task.dueDate ? (
                            <span className={
                              new Date(task.dueDate) < new Date() && task.status !== "completed" && task.status !== "cancelled"
                                ? "text-red-500 font-medium" : "text-gray-500"
                            }>
                              {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-gray-300">&mdash;</span>
                          )}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-2.5">
                      {canEdit && editingCell?.taskId === task.id && editingCell.field === "assignee" ? (
                        <select
                          autoFocus
                          value={task.assigneeId ?? ""}
                          onChange={(e) => updateTaskField(task.id, "assignee", e.target.value)}
                          onBlur={() => setEditingCell(null)}
                          className="text-[10px] px-1 py-0.5 border rounded w-full"
                        >
                          <option value="">Unassigned</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          onClick={canEdit ? () => setEditingCell({ taskId: task.id, field: "assignee" }) : undefined}
                          className={`${canEdit ? "cursor-pointer hover:ring-2 hover:ring-ai/30" : ""} rounded px-1 py-0.5 transition-all`}
                        >
                          {task.assigneeId ? (
                            <span className="text-gray-700">{userMap[task.assigneeId] ?? "Unknown"}</span>
                          ) : (
                            <span className="text-gray-300">Unassigned</span>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
