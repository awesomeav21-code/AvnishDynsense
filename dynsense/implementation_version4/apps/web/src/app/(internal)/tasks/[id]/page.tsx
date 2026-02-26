"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
interface Subtask { id: string; title: string; status: string; children?: Subtask[] }
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

const MAX_DEPTH = 5;

interface SubtaskDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  startDate: string | null;
  dueDate: string | null;
  estimatedEffort: string | null;
  sprint: string | null;
}

function SubtaskNode({
  subtask,
  projectId,
  parentPriority,
  depth,
  statusColors: sc,
  users,
}: {
  subtask: Subtask;
  projectId: string;
  parentPriority: string;
  depth: number;
  statusColors: Record<string, string>;
  users: User[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<Subtask[]>(subtask.children ?? []);
  const [loaded, setLoaded] = useState(false);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [displayTitle, setDisplayTitle] = useState(subtask.title);
  const [displayStatus, setDisplayStatus] = useState(subtask.status);

  // Inline edit panel
  const [editing, setEditing] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editFields, setEditFields] = useState<SubtaskDetail | null>(null);

  const loadChildren = useCallback(async () => {
    if (loaded) return;
    setLoadingChildren(true);
    try {
      const res = await api.request<{ data: Subtask[] }>(`/tasks/${subtask.id}/subtasks`);
      setChildren(res.data);
    } catch { /* ignore */ }
    setLoaded(true);
    setLoadingChildren(false);
  }, [subtask.id, loaded]);

  const handleToggle = useCallback(() => {
    if (!expanded) loadChildren();
    setExpanded((v) => !v);
  }, [expanded, loadChildren]);

  const handleAdd = useCallback(async () => {
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      const res = await api.createTask({
        projectId,
        title: newTitle.trim(),
        parentTaskId: subtask.id,
        priority: parentPriority,
      });
      setChildren((prev) => [...prev, { id: res.data.id, title: res.data.title, status: "created" }]);
      setNewTitle("");
      setShowAdd(false);
      setExpanded(true);
      setLoaded(true);
    } catch { /* ignore */ }
    setAdding(false);
  }, [newTitle, projectId, subtask.id, parentPriority]);

  const handleEditOpen = useCallback(async () => {
    setEditing(true);
    setLoadingDetail(true);
    try {
      const res = await api.getTask(subtask.id);
      const d = res.data as SubtaskDetail;
      setEditFields(d);
    } catch { /* ignore */ }
    setLoadingDetail(false);
  }, [subtask.id]);

  const handleEditSave = useCallback(async () => {
    if (!editFields) return;
    try {
      await api.updateTask(subtask.id, {
        title: editFields.title,
        description: editFields.description || undefined,
        priority: editFields.priority,
        sprint: editFields.sprint,
        startDate: editFields.startDate,
        dueDate: editFields.dueDate,
        estimatedEffort: editFields.estimatedEffort ? parseFloat(editFields.estimatedEffort) : null,
      });
      if (editFields.status !== displayStatus) {
        await api.updateTaskStatus(subtask.id, editFields.status);
        setDisplayStatus(editFields.status);
      }
      if (editFields.assigneeId) {
        await api.assignTask(subtask.id, editFields.assigneeId).catch(() => {});
      }
      setDisplayTitle(editFields.title);
    } catch { /* ignore */ }
    setEditing(false);
  }, [editFields, subtask.id, displayStatus]);

  const canNest = depth < MAX_DEPTH;

  return (
    <div>
      <div className="flex items-center gap-1 group">
        {/* Expand/collapse toggle */}
        <button
          onClick={handleToggle}
          className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 flex-shrink-0 rounded hover:bg-gray-100"
        >
          {loadingChildren ? (
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          ) : (
            <svg className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </button>

        {/* Status dot */}
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc[displayStatus]?.split(" ")[0] ?? "bg-gray-200"}`} />

        {/* Title */}
        <Link href={`/tasks/${subtask.id}`} className="flex-1 text-xs truncate hover:text-blue-600 transition-colors">
          {displayTitle}
        </Link>

        {/* Status badge */}
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${sc[displayStatus] ?? "bg-gray-100 text-gray-600"}`}>
          {displayStatus.replace("_", " ")}
        </span>

        {/* Edit button */}
        {!editing && (
          <button
            onClick={(e) => { e.stopPropagation(); handleEditOpen(); }}
            className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center text-gray-400 hover:text-ai flex-shrink-0 transition-opacity"
            title="Edit subtask"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}

        {/* Add child button */}
        {canNest && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowAdd(true); setExpanded(true); if (!loaded) loadChildren(); }}
            className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center text-gray-400 hover:text-blue-600 flex-shrink-0 transition-opacity"
            title="Add sub-subtask"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>

      {/* Inline edit panel */}
      {editing && (
        <div className="ml-5 mt-1.5 mb-1.5 p-3 bg-gray-50 border rounded-lg space-y-3">
          {loadingDetail ? (
            <div className="text-[10px] text-gray-400 animate-pulse">Loading...</div>
          ) : editFields ? (
            <>
              {/* Title */}
              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-0.5">Title</label>
                <input
                  type="text"
                  value={editFields.title}
                  onChange={(e) => setEditFields({ ...editFields, title: e.target.value })}
                  className="w-full text-xs px-2 py-1.5 border rounded-md focus:outline-none focus:ring-1 focus:ring-ai/50"
                />
              </div>
              {/* Description */}
              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-0.5">Description</label>
                <textarea
                  value={editFields.description ?? ""}
                  onChange={(e) => setEditFields({ ...editFields, description: e.target.value })}
                  rows={2}
                  placeholder="Add a description..."
                  className="w-full text-xs px-2 py-1.5 border rounded-md focus:outline-none focus:ring-1 focus:ring-ai/50 resize-none"
                />
              </div>
              {/* Status + Priority + Sprint */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-0.5">Status</label>
                  <select
                    value={editFields.status}
                    onChange={(e) => setEditFields({ ...editFields, status: e.target.value })}
                    className="w-full text-xs px-2 py-1.5 border rounded-md"
                  >
                    {statusOptions.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-0.5">Priority</label>
                  <select
                    value={editFields.priority}
                    onChange={(e) => setEditFields({ ...editFields, priority: e.target.value })}
                    className="w-full text-xs px-2 py-1.5 border rounded-md"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-0.5">Sprint</label>
                  <select
                    value={editFields.sprint ?? "R0"}
                    onChange={(e) => setEditFields({ ...editFields, sprint: e.target.value })}
                    className="w-full text-xs px-2 py-1.5 border rounded-md"
                  >
                    <option value="R0">R0</option>
                    <option value="R1">R1</option>
                  </select>
                </div>
              </div>
              {/* Assignee + Effort */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-0.5">Assignee</label>
                  <select
                    value={editFields.assigneeId ?? ""}
                    onChange={(e) => setEditFields({ ...editFields, assigneeId: e.target.value || null })}
                    className="w-full text-xs px-2 py-1.5 border rounded-md"
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-0.5">Estimated Effort (pts)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editFields.estimatedEffort ?? ""}
                    onChange={(e) => setEditFields({ ...editFields, estimatedEffort: e.target.value || null })}
                    placeholder="e.g. 5"
                    className="w-full text-xs px-2 py-1.5 border rounded-md focus:outline-none focus:ring-1 focus:ring-ai/50"
                  />
                </div>
              </div>
              {/* Start Date + Due Date */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-0.5">Start Date</label>
                  <input
                    type="date"
                    value={editFields.startDate ? new Date(editFields.startDate).toISOString().split("T")[0] : ""}
                    onChange={(e) => setEditFields({ ...editFields, startDate: e.target.value || null })}
                    className="w-full text-xs px-2 py-1.5 border rounded-md"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-0.5">Due Date</label>
                  <input
                    type="date"
                    value={editFields.dueDate ? new Date(editFields.dueDate).toISOString().split("T")[0] : ""}
                    onChange={(e) => setEditFields({ ...editFields, dueDate: e.target.value || null })}
                    className="w-full text-xs px-2 py-1.5 border rounded-md"
                  />
                </div>
              </div>
              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleEditSave}
                  className="px-3 py-1.5 text-[10px] font-medium text-white bg-ai rounded-md hover:bg-ai/90"
                >
                  Save
                </button>
                <button
                  onClick={() => { setEditing(false); setEditFields(null); }}
                  className="px-3 py-1.5 text-[10px] font-medium text-gray-600 border rounded-md hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Expanded children */}
      {expanded && (
        <div className="ml-5 mt-1 space-y-1 border-l border-gray-200 pl-2">
          {children.map((child) => (
            <SubtaskNode
              key={child.id}
              subtask={child}
              projectId={projectId}
              parentPriority={parentPriority}
              depth={depth + 1}
              statusColors={sc}
              users={users}
            />
          ))}

          {/* Inline add input */}
          {showAdd && (
            <div className="flex items-center gap-1.5 mt-1">
              <input
                type="text"
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") { setShowAdd(false); setNewTitle(""); }
                }}
                placeholder="Subtask title..."
                className="flex-1 px-2 py-1 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400/50"
              />
              <button
                onClick={handleAdd}
                disabled={adding || !newTitle.trim()}
                className="px-2 py-1 text-[10px] font-medium text-white bg-ai rounded disabled:opacity-50"
              >
                {adding ? "..." : "Add"}
              </button>
              <button
                onClick={() => { setShowAdd(false); setNewTitle(""); }}
                className="px-1 py-1 text-[10px] text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = params.id as string;

  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [allAvailableTags, setAllAvailableTags] = useState<Tag[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [projectName, setProjectName] = useState<string>("");
  const [allProjects, setAllProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentBody, setEditCommentBody] = useState("");

  // Editable fields
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState("");

  // Custom effort points added by user
  const [customPoints, setCustomPoints] = useState<number[]>([]);
  const [customPointInput, setCustomPointInput] = useState("");
  const [effortFocused, setEffortFocused] = useState(false);
  const effortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (effortRef.current && !effortRef.current.contains(e.target as Node)) {
        setEffortFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Click-to-edit sidebar fields
  const [editingField, setEditingField] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [taskRes, commentsRes, checklistsRes, usersRes, meRes, allTagsRes] = await Promise.all([
          api.getTask(taskId),
          api.getComments(taskId).catch(() => ({ data: [] as Comment[] })),
          api.getChecklists(taskId).catch(() => ({ data: [] as Checklist[] })),
          api.getUsers().catch(() => ({ data: [] as User[] })),
          api.getMe().catch(() => null),
          api.getTags().catch(() => ({ data: [] as Array<{ id: string; name: string; color: string; archived: boolean }> })),
        ]);
        const t = taskRes.data as Task;

        if (!statusOptions.includes(t.status)) {
          t.status = "created";
          api.updateTaskStatus(taskId, "created").catch(() => {});
        }

        // Get available tags and assign one to this task deterministically
        const availableTags = (allTagsRes as { data: Array<{ id: string; name: string; color: string; archived?: boolean }> }).data
          .filter((tag) => !tag.archived);
        let taskTag: Tag | null = null;

        // Try to get the task's existing tag
        try {
          const tagsRes = await api.getTaskTags(taskId);
          const assigned = (tagsRes as { data: Tag[] }).data;
          if (assigned.length > 0) {
            taskTag = assigned[0]!;
          }
        } catch { /* ignore */ }

        // If no tag assigned, auto-assign one based on task position for variety
        if (!taskTag && availableTags.length > 0) {
          // Use a simple hash of the taskId to pick a tag deterministically
          let hash = 0;
          for (let i = 0; i < taskId.length; i++) {
            hash = ((hash << 5) - hash + taskId.charCodeAt(i)) | 0;
          }
          const idx = Math.abs(hash) % availableTags.length;
          taskTag = availableTags[idx]!;
          // Persist the assignment
          api.addTagToTask(taskId, taskTag.id).catch(() => {});
        }

        setTask(t);
        setComments(commentsRes.data as Comment[]);
        setChecklists(checklistsRes.data as Checklist[]);
        setTags(taskTag ? [taskTag] : []);
        setAllAvailableTags(availableTags as Tag[]);
        setUsers(usersRes.data as User[]);
        if (meRes && typeof meRes === "object" && "id" in meRes) {
          setCurrentUserId((meRes as { id: string }).id);
        }
        setEditTitle(t.title);
        setEditDesc(t.description ?? "");

        api.getProject(t.projectId).then((res) => {
          setProjectName((res.data as { name: string }).name);
        }).catch(() => {});

        api.getProjects().then((res) => {
          setAllProjects((res.data as Array<{ id: string; name: string }>));
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

  async function handleAddSubtask() {
    if (!newSubtaskTitle.trim() || !task) return;
    setAddingSubtask(true);
    try {
      const res = await api.createTask({
        projectId: task.projectId,
        title: newSubtaskTitle.trim(),
        parentTaskId: taskId,
        priority: task.priority,
      });
      setSubtasks((prev) => [...prev, { id: res.data.id, title: res.data.title, status: "created" }]);
      setNewSubtaskTitle("");
    } catch {
      setError("Failed to add subtask");
    } finally {
      setAddingSubtask(false);
    }
  }

  async function handleUpdateComment(commentId: string) {
    if (!editCommentBody.trim()) return;
    try {
      const res = await api.updateComment(commentId, editCommentBody.trim());
      setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, body: res.data.body } : c));
      setEditingCommentId(null);
      setEditCommentBody("");
    } catch {
      setError("Failed to update comment");
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

          {/* Subtasks (recursive tree) */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-sm font-semibold mb-3">Subtasks</h2>
            {subtasks.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {subtasks.map((st) => (
                  <SubtaskNode
                    key={st.id}
                    subtask={st}
                    projectId={task.projectId}
                    parentPriority={task.priority}
                    depth={1}
                    statusColors={statusColors}
                    users={users}
                  />
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSubtask()}
                placeholder="Add a subtask..."
                className="flex-1 px-3 py-2 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-ai/50"
              />
              <button
                onClick={handleAddSubtask}
                disabled={addingSubtask || !newSubtaskTitle.trim()}
                className="px-3 py-2 text-xs font-medium text-white bg-ai rounded-md disabled:opacity-50"
              >
                {addingSubtask ? "..." : "Add"}
              </button>
            </div>
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

          {/* Comments */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-sm font-semibold mb-3">Comments</h2>
            <div className="space-y-3 mb-4">
              {comments.length === 0 ? (
                <p className="text-xs text-gray-400">No comments yet</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="text-xs border-l-2 border-gray-200 pl-3 py-1">
                    {editingCommentId === c.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editCommentBody}
                          onChange={(e) => setEditCommentBody(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleUpdateComment(c.id); } }}
                          autoFocus
                          rows={2}
                          className="w-full px-2 py-1.5 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-ai/50 resize-none"
                        />
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleUpdateComment(c.id)}
                            className="px-2 py-1 text-[10px] font-medium text-white bg-ai rounded disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => { setEditingCommentId(null); setEditCommentBody(""); }}
                            className="px-2 py-1 text-[10px] font-medium text-gray-500 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-gray-700">{c.body}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-gray-400">{new Date(c.createdAt).toLocaleString()}</span>
                          {c.authorId === currentUserId && (
                            <button
                              onClick={() => { setEditingCommentId(c.id); setEditCommentBody(c.body); }}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </>
                    )}
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
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">Status</label>
                <button onClick={() => setEditingField(editingField === "status" ? null : "status")} className="text-[10px] text-gray-400 hover:text-gray-600">
                  {editingField === "status" ? "Done" : "Edit"}
                </button>
              </div>
              {editingField === "status" ? (
                <select
                  value={task.status}
                  onChange={(e) => { handleStatusChange(e.target.value); setEditingField(null); }}
                  autoFocus
                  className="w-full text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ai/50"
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>{s.replace("_", " ")}</option>
                  ))}
                </select>
              ) : (
                <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full ${statusColors[task.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {task.status.replace("_", " ")}
                </span>
              )}
            </div>

            {/* Sprint */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">Sprint</label>
                <button onClick={() => setEditingField(editingField === "sprint" ? null : "sprint")} className="text-[10px] text-gray-400 hover:text-gray-600">
                  {editingField === "sprint" ? "Done" : "Edit"}
                </button>
              </div>
              {editingField === "sprint" ? (
                <select
                  value={task.sprint || "R0"}
                  onChange={(e) => { updateField({ sprint: e.target.value }); setEditingField(null); }}
                  autoFocus
                  className="w-full text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ai/50"
                >
                  <option value="R0">R0</option>
                  <option value="R1">R1</option>
                </select>
              ) : (
                <span className="text-xs text-gray-900">{task.sprint || "R0"}</span>
              )}
            </div>

            {/* Priority */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">Priority</label>
                <button onClick={() => setEditingField(editingField === "priority" ? null : "priority")} className="text-[10px] text-gray-400 hover:text-gray-600">
                  {editingField === "priority" ? "Done" : "Edit"}
                </button>
              </div>
              {editingField === "priority" ? (
                <select
                  value={task.priority}
                  onChange={(e) => { updateField({ priority: e.target.value }); setEditingField(null); }}
                  autoFocus
                  className="w-full text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ai/50"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              ) : (
                <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full ${priorityColors[task.priority] ?? "bg-gray-100 text-gray-600"}`}>
                  {task.priority}
                </span>
              )}
            </div>

            {/* Project */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">Project</label>
                <button onClick={() => setEditingField(editingField === "project" ? null : "project")} className="text-[10px] text-gray-400 hover:text-gray-600">
                  {editingField === "project" ? "Done" : "Edit"}
                </button>
              </div>
              {editingField === "project" ? (
                <select
                  value={task.projectId}
                  onChange={(e) => {
                    const newProjectId = e.target.value;
                    updateField({ projectId: newProjectId, phaseId: null });
                    const newName = allProjects.find((p) => p.id === newProjectId)?.name ?? "";
                    setProjectName(newName);
                    api.getPhases(newProjectId).then((res) => setPhases(res.data as Phase[])).catch(() => {});
                    setEditingField(null);
                  }}
                  autoFocus
                  className="w-full text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ai/50"
                >
                  {allProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              ) : (
                <Link href={`/projects/${task.projectId}`} className="text-xs text-ai hover:underline">
                  {projectName || "—"}
                </Link>
              )}
            </div>

            {/* Phase */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">Phase</label>
                <button onClick={() => setEditingField(editingField === "phase" ? null : "phase")} className="text-[10px] text-gray-400 hover:text-gray-600">
                  {editingField === "phase" ? "Done" : "Edit"}
                </button>
              </div>
              {editingField === "phase" ? (
                <select
                  value={task.phaseId ?? ""}
                  onChange={(e) => { updateField({ phaseId: e.target.value || null }); setEditingField(null); }}
                  autoFocus
                  className="w-full text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ai/50"
                >
                  <option value="">No phase</option>
                  {phases.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-gray-900">{phases.find((p) => p.id === task.phaseId)?.name || "—"}</span>
              )}
            </div>

            {/* Assignee */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">Assignee</label>
                <button onClick={() => setEditingField(editingField === "assignee" ? null : "assignee")} className="text-[10px] text-gray-400 hover:text-gray-600">
                  {editingField === "assignee" ? "Done" : "Edit"}
                </button>
              </div>
              {editingField === "assignee" ? (
                <select
                  value={task.assigneeId ?? ""}
                  onChange={(e) => { handleAssigneeChange(e.target.value); setEditingField(null); }}
                  autoFocus
                  className="w-full text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ai/50"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-gray-900">{users.find((u) => u.id === task.assigneeId)?.name || "Unassigned"}</span>
              )}
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
            <div ref={effortRef}>
              <label className="text-xs text-gray-500 block mb-1">Estimated Effort (pts)</label>
              <div className="flex flex-wrap items-center gap-1.5">
                {[...new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ...customPoints])].sort((a, b) => a - b).map((pt) => (
                  <button
                    key={pt}
                    onClick={() => { updateField({ estimatedEffort: pt }); setEffortFocused(true); }}
                    className={`w-8 h-8 text-xs font-medium rounded-md border transition-colors ${
                      Number(task.estimatedEffort) === pt && effortFocused
                        ? "bg-ai text-white border-ai"
                        : "bg-white text-gray-600 border-gray-200 hover:border-ai/50 hover:text-ai"
                    }`}
                  >
                    {pt}
                  </button>
                ))}
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={customPointInput}
                  onChange={(e) => setCustomPointInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = parseFloat(customPointInput);
                      if (val > 0) {
                        if (![1,2,3,4,5,6,7,8,9,10].includes(val) && !customPoints.includes(val)) {
                          setCustomPoints((prev) => [...prev, val]);
                        }
                        updateField({ estimatedEffort: val });
                        setEffortFocused(true);
                        setCustomPointInput("");
                      }
                    }
                  }}
                  placeholder="+"
                  className="w-8 h-8 text-xs text-center border border-dashed border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-ai/50 hover:border-ai/50"
                />
              </div>
            </div>

            {/* Tag */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">Tag</label>
                <button onClick={() => setEditingField(editingField === "tag" ? null : "tag")} className="text-[10px] text-gray-400 hover:text-gray-600">
                  {editingField === "tag" ? "Done" : "Edit"}
                </button>
              </div>
              {editingField === "tag" ? (
                <select
                  value={tags[0]?.id ?? ""}
                  onChange={async (e) => {
                    const newTagId = e.target.value;
                    try {
                      if (tags[0]) await api.removeTagFromTask(taskId, tags[0].id);
                      if (newTagId) {
                        await api.addTagToTask(taskId, newTagId);
                        const selected = allAvailableTags.find((t) => t.id === newTagId);
                        setTags(selected ? [selected] : []);
                      } else {
                        setTags([]);
                      }
                    } catch { setError("Failed to update tag"); }
                    setEditingField(null);
                  }}
                  autoFocus
                  className="w-full text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ai/50"
                >
                  <option value="">No tag</option>
                  {allAvailableTags.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              ) : (
                tags[0] ? (
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tags[0].color }} />
                    <span className="text-xs text-gray-900">{tags[0].name}</span>
                  </div>
                ) : <span className="text-xs text-gray-400">No tag</span>
              )}
            </div>

            {/* Reported By */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">Reported By</label>
                <button onClick={() => setEditingField(editingField === "reportedBy" ? null : "reportedBy")} className="text-[10px] text-gray-400 hover:text-gray-600">
                  {editingField === "reportedBy" ? "Done" : "Edit"}
                </button>
              </div>
              {editingField === "reportedBy" ? (
                <select
                  value={task.reportedBy ?? ""}
                  onChange={(e) => { updateField({ reportedBy: e.target.value || null }); setEditingField(null); }}
                  autoFocus
                  className="w-full text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ai/50"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-gray-900">{reporterName}</span>
              )}
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
