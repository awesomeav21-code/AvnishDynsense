"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  startDate: string | null;
  dueDate: string | null;
  projectId: string;
  phaseId: string | null;
  sprint: string | null;
  estimatedEffort: string | null;
  reportedBy: string | null;
  reporterName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Comment {
  id: string;
  body: string;
  authorId: string;
  createdAt: string;
}

interface Checklist {
  id: string;
  title: string;
  items: Array<{ id: string; label: string; completed: boolean }>;
  completionPercent: number;
}

interface Tag { id: string; name: string; color: string }
interface Subtask { id: string; title: string; status: string }
interface User { id: string; name: string }
interface Phase { id: string; name: string }

const statusOptions = ["created", "ready", "in_progress", "review", "completed", "blocked", "cancelled"];
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

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = params.id as string;

  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [projectName, setProjectName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Editable fields
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [taskRes, commentsRes, checklistsRes, tagsRes, usersRes, meRes] = await Promise.all([
          api.getTask(taskId),
          api.getComments(taskId).catch(() => ({ data: [] as Comment[] })),
          api.getChecklists(taskId).catch(() => ({ data: [] as Checklist[] })),
          api.getTaskTags(taskId).catch(() => ({ data: [] as Tag[] })),
          api.getUsers().catch(() => ({ data: [] as User[] })),
          api.getMe().catch(() => null),
        ]);
        const t = taskRes.data as Task;

        if (!statusOptions.includes(t.status)) {
          t.status = "created";
          api.updateTaskStatus(taskId, "created").catch(() => {});
        }

        setTask(t);
        setComments(commentsRes.data as Comment[]);
        setChecklists(checklistsRes.data as Checklist[]);
        setTags(tagsRes.data as Tag[]);
        setUsers(usersRes.data as User[]);
        setEditTitle(t.title);
        setEditDesc(t.description ?? "");

        api.getProject(t.projectId).then((res) => {
          setProjectName((res.data as { name: string }).name);
        }).catch(() => {});

        api.getPhases(t.projectId).then((res) => {
          setPhases(res.data as Phase[]);
        }).catch(() => {});

        api.request<{ data: Subtask[] }>(`/tasks/${taskId}/subtasks`).then((res) => {
          setSubtasks(res.data);
        }).catch(() => {});

      } catch {
        setError("Failed to load task");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [taskId]);

  async function updateField(data: Record<string, unknown>) {
    try {
      await api.updateTask(taskId, data as Parameters<typeof api.updateTask>[1]);
      setTask((prev) => prev ? { ...prev, ...data, updatedAt: new Date().toISOString() } as Task : prev);
    } catch {
      setError("Failed to update");
    }
  }

  async function handleStatusChange(status: string) {
    try {
      await api.updateTaskStatus(taskId, status);
      setTask((prev) => prev ? { ...prev, status } : prev);
    } catch {
      setError("Failed to update status");
    }
  }

  async function handleAssigneeChange(userId: string) {
    try {
      if (userId) {
        await api.assignTask(taskId, userId);
      }
      setTask((prev) => prev ? { ...prev, assigneeId: userId || null } : prev);
    } catch {
      setError("Failed to update assignee");
    }
  }

  async function handleAddComment() {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.addComment(taskId, newComment);
      setComments((prev) => [...prev, res.data]);
      setNewComment("");
    } catch {
      setError("Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
        <div className="h-48 bg-white rounded-lg border animate-pulse" />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">
        {error || "Task not found"}
      </div>
    );
  }

  const assigneeName = users.find((u) => u.id === task.assigneeId)?.name ?? "";
  const phaseName = phases.find((p) => p.id === task.phaseId)?.name ?? "";
  const reporterName = task.reporterName ?? users.find((u) => u.id === task.reportedBy)?.name ?? "Unknown";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Link href="/dashboard" className="hover:text-gray-700">Dashboard</Link>
        <span>/</span>
        <Link href={`/projects/${task.projectId}`} className="hover:text-gray-700">{projectName || "Project"}</Link>
        <span>/</span>
        <span className="text-gray-900 truncate max-w-[200px]">{task.title}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title */}
          <div className="bg-white rounded-lg border p-6">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setEditingTitle(false);
                      if (editTitle.trim() && editTitle !== task.title) updateField({ title: editTitle.trim() });
                    }
                    if (e.key === "Escape") { setEditTitle(task.title); setEditingTitle(false); }
                  }}
                  className="text-xl font-bold w-full border-b-2 border-ai focus:outline-none"
                />
                <button
                  onClick={() => {
                    setEditingTitle(false);
                    if (editTitle.trim() && editTitle !== task.title) updateField({ title: editTitle.trim() });
                  }}
                  className="text-xs px-2 py-1 text-white bg-ai rounded-md"
                >
                  Save
                </button>
                <button
                  onClick={() => { setEditTitle(task.title); setEditingTitle(false); }}
                  className="text-xs px-2 py-1 text-gray-600 border rounded-md"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold">{task.title}</h1>
                <button
                  onClick={() => setEditingTitle(true)}
                  className="text-xs px-2 py-1 text-gray-500 border rounded-md hover:bg-gray-50"
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Description</h2>
              {!editingDesc && (
                <button
                  onClick={() => setEditingDesc(true)}
                  className="text-xs px-2 py-1 text-gray-500 border rounded-md hover:bg-gray-50"
                >
                  Edit
                </button>
              )}
            </div>
            {editingDesc ? (
              <div>
                <textarea
                  autoFocus
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") { setEditDesc(task.description ?? ""); setEditingDesc(false); }
                  }}
                  rows={5}
                  className="w-full text-sm text-gray-600 border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ai/50 resize-none"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => {
                      setEditingDesc(false);
                      if (editDesc !== (task.description ?? "")) updateField({ description: editDesc || undefined });
                    }}
                    className="text-xs px-2 py-1 text-white bg-ai rounded-md"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setEditDesc(task.description ?? ""); setEditingDesc(false); }}
                    className="text-xs px-2 py-1 text-gray-600 border rounded-md"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              task.description ? (
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{task.description}</p>
              ) : (
                <p className="text-xs text-gray-400">No description provided</p>
              )
            )}
          </div>

          {/* Subtasks */}
          {subtasks.length > 0 && (
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-sm font-semibold mb-3">Subtasks</h2>
              <div className="space-y-1.5">
                {subtasks.map((st) => (
                  <Link key={st.id} href={`/tasks/${st.id}`} className="flex items-center gap-2 text-xs hover:bg-gray-50 rounded px-2 py-1.5 -mx-2">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColors[st.status]?.split(" ")[0] ?? "bg-gray-200"}`} />
                    <span className="flex-1 truncate">{st.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusColors[st.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {st.status.replace("_", " ")}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Checklists */}
          {checklists.length > 0 && (
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-sm font-semibold mb-3">Checklists</h2>
              {checklists.map((cl) => (
                <div key={cl.id} className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium">{cl.title}</span>
                    <span className="text-xs text-gray-500">{cl.completionPercent}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                    <div className="bg-ai h-1.5 rounded-full" style={{ width: `${cl.completionPercent}%` }} />
                  </div>
                  <div className="space-y-1">
                    {cl.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 text-xs">
                        <span className={item.completed ? "line-through text-gray-400" : ""}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Comments */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-sm font-semibold mb-3">Comments</h2>
            <div className="space-y-3 mb-4">
              {comments.length === 0 ? (
                <p className="text-xs text-gray-400">No comments yet</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="text-xs border-l-2 border-gray-200 pl-3 py-1">
                    <p className="text-gray-700">{c.body}</p>
                    <p className="text-gray-400 mt-1">{new Date(c.createdAt).toLocaleString()}</p>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                placeholder="Add a comment..."
                className="flex-1 px-3 py-2 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-ai/50"
              />
              <button
                onClick={handleAddComment}
                disabled={submitting || !newComment.trim()}
                className="px-3 py-2 text-xs font-medium text-white bg-ai rounded-md disabled:opacity-50"
              >
                {submitting ? "..." : "Send"}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar — all editable */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border p-4 space-y-4">
            {/* Status */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Status</label>
              <select
                value={task.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ai/50"
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{s.replace("_", " ")}</option>
                ))}
              </select>
            </div>

            {/* Sprint */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Sprint</label>
              <select
                value={task.sprint || "R0"}
                onChange={(e) => updateField({ sprint: e.target.value })}
                className="w-full text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ai/50"
              >
                <option value="R0">R0</option>
                <option value="R1">R1</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Priority</label>
              <select
                value={task.priority}
                onChange={(e) => updateField({ priority: e.target.value })}
                className="w-full text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ai/50"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Project */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Project</label>
              <Link href={`/projects/${task.projectId}`} className="text-xs text-ai hover:underline">
                {projectName || "—"}
              </Link>
            </div>

            {/* Phase */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Phase</label>
              <select
                value={task.phaseId ?? ""}
                onChange={(e) => updateField({ phaseId: e.target.value || null })}
                className="w-full text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ai/50"
              >
                <option value="">No phase</option>
                {phases.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Assignee</label>
              <select
                value={task.assigneeId ?? ""}
                onChange={(e) => handleAssigneeChange(e.target.value)}
                className="w-full text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ai/50"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Start Date</label>
              <input
                type="date"
                value={task.startDate ? new Date(task.startDate).toISOString().split("T")[0] : ""}
                onChange={(e) => updateField({ startDate: e.target.value || null })}
                className="w-full text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ai/50"
              />
            </div>

            {/* Due Date */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Due Date</label>
              <input
                type="date"
                value={task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""}
                onChange={(e) => updateField({ dueDate: e.target.value || null })}
                className="w-full text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ai/50"
              />
            </div>

            {/* Estimated Effort */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Estimated Effort (hrs)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={task.estimatedEffort ?? ""}
                onChange={(e) => {
                  const val = e.target.value ? parseFloat(e.target.value) : null;
                  updateField({ estimatedEffort: val });
                }}
                placeholder="e.g. 4"
                className="w-full text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ai/50"
              />
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">Tags</label>
                <div className="flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full text-white"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Reported By */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Reported By</label>
              <span className="text-xs">{reporterName}</span>
            </div>

            {/* Created */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Created</label>
              <span className="text-xs">{new Date(task.createdAt).toLocaleDateString()}</span>
            </div>

            {/* Updated */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Updated</label>
              <span className="text-xs">{new Date(task.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
