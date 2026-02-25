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
  const [resolvedReporter, setResolvedReporter] = useState<string>("Unknown");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    async function load() {
      try {
        const [taskRes, commentsRes, checklistsRes, usersRes, meRes] = await Promise.all([
          api.getTask(taskId),
          api.getComments(taskId).catch(() => ({ data: [] as Comment[] })),
          api.getChecklists(taskId).catch(() => ({ data: [] as Checklist[] })),
          api.getUsers().catch(() => ({ data: [] as Array<{ id: string; name: string }> })),
          api.getMe().catch(() => null),
        ]);
        const t = taskRes.data as Task;
        setTask(t);
        setComments(commentsRes.data as Comment[]);
        setChecklists(checklistsRes.data as Checklist[]);
        if (meRes) setUserRole(meRes.role);

        if (t.reporterName) {
          setResolvedReporter(t.reporterName);
        } else if (t.reportedBy) {
          const match = usersRes.data.find((u) => u.id === t.reportedBy);
          setResolvedReporter(match?.name ?? "Unknown");
        }
      } catch {
        setError("Failed to load task");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [taskId]);

  const canComment = userRole !== "client";
  const canTransition = userRole === "site_admin" || userRole === "pm" || userRole === "developer";

  async function handleStatusChange(status: string) {
    try {
      await api.updateTaskStatus(taskId, status);
      setTask((prev) => prev ? { ...prev, status } : prev);
    } catch {
      setError("Failed to update status");
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

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Link href="/dashboard" className="hover:text-gray-700">Dashboard</Link>
        <span>/</span>
        <Link href={`/projects/${task.projectId}`} className="hover:text-gray-700">Project</Link>
        <span>/</span>
        <span className="text-gray-900 truncate max-w-[200px]">{task.title}</span>
      </div>

      {/* Three-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border p-6">
            <h1 className="text-xl font-bold">{task.title}</h1>
            {task.description && (
              <p className="text-sm text-gray-600 mt-3 whitespace-pre-wrap">{task.description}</p>
            )}
          </div>

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

          {/* Comments / Activity */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-sm font-semibold mb-3">Activity</h2>
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
            {canComment && (
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
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border p-4 space-y-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Status</label>
              {canTransition ? (
                <select
                  value={task.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="w-full text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ai/50"
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>{s.replace("_", " ")}</option>
                  ))}
                </select>
              ) : (
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[task.status] ?? ""}`}>
                  {task.status.replace("_", " ")}
                </span>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Priority</label>
              <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColors[task.priority] ?? ""}`}>
                {task.priority}
              </span>
            </div>

            {task.startDate && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">Start Date</label>
                <span className="text-xs">{new Date(task.startDate).toLocaleDateString()}</span>
              </div>
            )}

            {task.dueDate && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">Due Date</label>
                <span className="text-xs">{new Date(task.dueDate).toLocaleDateString()}</span>
              </div>
            )}

            {task.estimatedEffort && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">Estimated Effort</label>
                <span className="text-xs">{task.estimatedEffort}h</span>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-500 block mb-1">Created</label>
              <span className="text-xs">{new Date(task.createdAt).toLocaleDateString()}</span>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Updated</label>
              <span className="text-xs">{new Date(task.updatedAt).toLocaleDateString()}</span>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Reported By</label>
              <span className="text-xs">{resolvedReporter}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
