"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { UserSearchCombobox } from "@/components/user-search-combobox";

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

interface Phase {
  id: string;
  projectId: string;
  name: string;
  position: number;
}

interface Tag {
  id: string;
  name: string;
  color: string;
  archived: boolean;
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

  // --- New task form state (matches my-tasks) ---
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPhaseId, setNewPhaseId] = useState("");
  const [newAssigneeId, setNewAssigneeId] = useState("");
  const [newReportedBy, setNewReportedBy] = useState("");
  const [newSprint, setNewSprint] = useState("R0");
  const [newPriority, setNewPriority] = useState("medium");
  const [newStartDate, setNewStartDate] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newEstimatedEffort, setNewEstimatedEffort] = useState("");
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
  const [newComment, setNewComment] = useState("");
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [subtaskInput, setSubtaskInput] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string; role: string } | null>(null);

  const canEdit = userRole === "site_admin" || userRole === "pm";
  const canDelete = userRole === "site_admin";

  useEffect(() => {
    async function load() {
      try {
        const [projRes, tasksRes, phasesRes, tagsRes, meRes] = await Promise.all([
          api.getProject(projectId),
          api.getTasks({ projectId }),
          api.getPhases(projectId),
          api.getTags(),
          api.getMe(),
        ]);
        setProject(projRes.data);
        setTasks(tasksRes.data);
        setPhases(phasesRes.data);
        setTags(tagsRes.data.filter((t) => !t.archived));
        setCurrentUser(meRes);
        setUserRole(meRes.role);
        setNewReportedBy(meRes.id);
      } catch {
        setError("Failed to load project");
        try {
          const meRes = await api.getMe();
          setUserRole(meRes.role);
        } catch {
          setUserRole("site_admin");
        }
      }
      setLoading(false);
    }
    load();
  }, [projectId]);

  const resetTaskForm = useCallback(() => {
    setNewTitle("");
    setNewDescription("");
    setNewPhaseId("");
    setNewAssigneeId("");
    setNewReportedBy(currentUser?.id ?? "");
    setNewSprint("R0");
    setNewPriority("medium");
    setNewStartDate("");
    setNewDueDate("");
    setNewEstimatedEffort("");
    setNewComment("");
    setSubtasks([]);
    setSubtaskInput("");
    setSelectedTagIds(new Set());
  }, [currentUser]);

  const handleCreateTask = useCallback(async () => {
    if (!newTitle.trim() || !newDescription.trim() || !newPhaseId || !newAssigneeId || !newReportedBy || !newStartDate || !newDueDate || !newEstimatedEffort || subtasks.length === 0 || !newComment.trim() || selectedTagIds.size === 0) return;
    setCreating(true);
    try {
      const effort = newEstimatedEffort ? parseFloat(newEstimatedEffort) : undefined;
      const res = await api.createTask({
        projectId,
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        priority: newPriority,
        startDate: newStartDate || undefined,
        dueDate: newDueDate || undefined,
        estimatedEffort: effort && !isNaN(effort) ? effort : undefined,
        phaseId: newPhaseId || undefined,
        sprint: newSprint || undefined,
        reportedBy: newReportedBy || undefined,
      });

      // Assign user if selected
      if (newAssigneeId) {
        await api.assignTask(res.data.id, newAssigneeId).catch(() => {});
      }

      // Create subtasks
      if (subtasks.length > 0) {
        await Promise.allSettled(
          subtasks.map((title) =>
            api.createTask({
              projectId,
              title,
              priority: newPriority,
              parentTaskId: res.data.id,
            })
          )
        );
      }

      // Attach selected tags
      if (selectedTagIds.size > 0) {
        await Promise.allSettled(
          Array.from(selectedTagIds).map((tagId) =>
            api.addTagToTask(res.data.id, tagId)
          )
        );
      }

      // Post initial comment if provided
      if (newComment.trim()) {
        await api.addComment(res.data.id, newComment.trim()).catch(() => {});
      }

      setTasks((prev) => [
        {
          id: res.data.id,
          title: newTitle.trim(),
          status: "created",
          priority: newPriority,
          assigneeId: newAssigneeId || null,
          dueDate: newDueDate || null,
          projectId,
        },
        ...prev,
      ]);
      resetTaskForm();
      setShowCreateTask(false);
    } catch {
      setError("Failed to create task");
    } finally {
      setCreating(false);
    }
  }, [projectId, newTitle, newDescription, newPriority, newStartDate, newDueDate, newEstimatedEffort, newAssigneeId, newPhaseId, newSprint, newReportedBy, subtasks, selectedTagIds, newComment, resetTaskForm]);

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

  if (error && !project) {
    return (
      <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">
        {error || "Project not found"}
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">
        Project not found
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

      {/* Error banner */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">
          {error}
          <button onClick={() => setError("")} className="ml-2 text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}

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
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-ai rounded-md hover:bg-ai/90"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Task
            </button>
          )}
        </div>

        {/* Full create task form (matches my-tasks) */}
        {showCreateTask && (
          <div className="bg-white rounded-lg border p-4 mb-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Create New Task</h3>
              <button onClick={() => { setShowCreateTask(false); resetTaskForm(); }} className="text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Title */}
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-1">Title <span className="text-red-500">*</span></label>
              <input
                type="text"
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") { setShowCreateTask(false); resetTaskForm(); } }}
                placeholder="Task title..."
                className="w-full text-sm px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ai/50"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-1">Description <span className="text-red-500">*</span></label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Add details about this task..."
                rows={3}
                className="w-full text-xs px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ai/50 resize-none"
              />
            </div>

            {/* Row 1: Project (read-only), Phase, Assignee */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-1">Project</label>
                <div className="w-full text-xs px-2 py-1.5 border rounded-md bg-gray-50 text-gray-700">
                  {project.name}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-1">Phase <span className="text-red-500">*</span></label>
                <select
                  value={newPhaseId}
                  onChange={(e) => setNewPhaseId(e.target.value)}
                  className="w-full text-xs px-2 py-1.5 border rounded-md"
                >
                  <option value="">No phase</option>
                  {phases.map((ph) => (
                    <option key={ph.id} value={ph.id}>{ph.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-1">Assign To <span className="text-red-500">*</span></label>
                <UserSearchCombobox
                  value={newAssigneeId}
                  onChange={setNewAssigneeId}
                  currentUser={currentUser}
                  placeholder="Search users..."
                />
              </div>
            </div>

            {/* Reported By */}
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-1">Reported By <span className="text-red-500">*</span></label>
              <UserSearchCombobox
                value={newReportedBy}
                onChange={setNewReportedBy}
                currentUser={currentUser}
                placeholder="Search users..."
              />
            </div>

            {/* Sprint */}
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-1">Sprint</label>
              <select
                value={newSprint}
                onChange={(e) => setNewSprint(e.target.value)}
                className="w-full text-xs px-2 py-1.5 border rounded-md"
              >
                <option value="R0">R0</option>
                <option value="R1">R1</option>
              </select>
            </div>

            {/* Row 2: Priority, Start Date, Due Date, Estimated Effort */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-1">Priority <span className="text-red-500">*</span></label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="w-full text-xs px-2 py-1.5 border rounded-md"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-1">Start Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  className="w-full text-xs px-2 py-1.5 border rounded-md"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-1">Due Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={newDueDate}
                  min={newStartDate || undefined}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className={`w-full text-xs px-2 py-1.5 border rounded-md ${
                    newDueDate && newDueDate < new Date().toISOString().split("T")[0]!
                      ? "border-red-400 text-red-600"
                      : ""
                  }`}
                />
                {newDueDate && newDueDate < new Date().toISOString().split("T")[0]! && (
                  <span className="text-[10px] text-red-500 mt-0.5 block">Overdue</span>
                )}
              </div>
              <div ref={effortRef}>
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-1">Estimated Effort (pts) <span className="text-red-500">*</span></label>
                <div className="flex flex-wrap items-center gap-1">
                  {[...new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ...customPoints])].sort((a, b) => a - b).map((pt) => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => setNewEstimatedEffort(String(pt))}
                      className={`w-7 h-7 text-xs font-medium rounded-md border transition-colors ${
                        newEstimatedEffort === String(pt)
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
                        e.preventDefault();
                        const val = parseFloat(customPointInput);
                        if (val > 0) {
                          if (![1,2,3,4,5,6,7,8,9,10].includes(val) && !customPoints.includes(val)) {
                            setCustomPoints((prev) => [...prev, val]);
                          }
                          setNewEstimatedEffort(String(val));
                          setCustomPointInput("");
                        }
                      }
                    }}
                    placeholder="+"
                    className="w-7 h-7 text-xs text-center border border-dashed border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-ai/50 hover:border-ai/50"
                  />
                </div>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-1">Tags <span className="text-red-500">*</span></label>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => {
                    const isSelected = selectedTagIds.has(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          setSelectedTagIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(tag.id)) next.delete(tag.id);
                            else next.add(tag.id);
                            return next;
                          });
                        }}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border transition-colors ${
                          isSelected
                            ? "border-transparent text-white"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                        style={isSelected ? { backgroundColor: tag.color } : undefined}
                      >
                        {!isSelected && (
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                        )}
                        {tag.name}
                        {isSelected && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Subtasks */}
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-1">Subtasks <span className="text-red-500">*</span></label>
              {subtasks.length > 0 && (
                <div className="space-y-1 mb-2">
                  {subtasks.map((st, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs bg-gray-50 rounded px-2 py-1.5 border">
                      <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="flex-1 text-gray-700 truncate">{st}</span>
                      <button
                        type="button"
                        onClick={() => setSubtasks((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-gray-400 hover:text-red-500 flex-shrink-0"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={subtaskInput}
                  onChange={(e) => setSubtaskInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && subtaskInput.trim()) {
                      e.preventDefault();
                      setSubtasks((prev) => [...prev, subtaskInput.trim()]);
                      setSubtaskInput("");
                    }
                  }}
                  placeholder="Add a subtask and press Enter..."
                  className="flex-1 text-xs px-2 py-1.5 border rounded-md focus:outline-none focus:ring-2 focus:ring-ai/50"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (subtaskInput.trim()) {
                      setSubtasks((prev) => [...prev, subtaskInput.trim()]);
                      setSubtaskInput("");
                    }
                  }}
                  disabled={!subtaskInput.trim()}
                  className="px-2 py-1.5 text-xs text-gray-600 border rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Comment Trail */}
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-1">Comment Trail <span className="text-red-500">*</span></label>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add an initial comment to this task..."
                rows={3}
                className="w-full text-xs px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ai/50 resize-none"
              />
              <p className="text-[10px] text-gray-400 mt-0.5">This will become the first comment on the task.</p>
            </div>

            {/* Actions */}
            <div className="flex justify-end pt-1">
              <button
                onClick={() => { setShowCreateTask(false); resetTaskForm(); }}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 border rounded-md hover:bg-gray-50 mr-2"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTask}
                disabled={creating || !newTitle.trim() || !newDescription.trim() || !newPhaseId || !newAssigneeId || !newReportedBy || !newStartDate || !newDueDate || !newEstimatedEffort || subtasks.length === 0 || !newComment.trim() || selectedTagIds.size === 0}
                className="px-4 py-1.5 text-xs font-medium text-white bg-ai rounded-md hover:bg-ai/90 disabled:opacity-50 transition-colors"
              >
                {creating ? "Creating..." : "Create Task"}
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
