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

interface ProjectMember {
  userId: string;
  role: string;
  assignedAt: string;
  userName: string;
  userEmail: string;
}

interface InviteLink {
  id: string;
  token: string;
  projectId: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
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
  const [existingSubtasks, setExistingSubtasks] = useState<Array<{ id: string; title: string }>>([]);
  const [existingTaskSearch, setExistingTaskSearch] = useState("");
  const [existingTaskResults, setExistingTaskResults] = useState<Array<{ id: string; title: string }>>([]);
  const [showExistingSearch, setShowExistingSearch] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string; role: string } | null>(null);

  // Project members state
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [membersOpen, setMembersOpen] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberSearchResults, setMemberSearchResults] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);
  const [showMemberSearch, setShowMemberSearch] = useState(false);
  const [addMemberRole, setAddMemberRole] = useState("client");
  const [addingMember, setAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const memberSearchRef = useRef<HTMLDivElement>(null);

  const canEdit = userRole === "site_admin" || userRole === "pm";
  const canDelete = userRole === "site_admin";
  const canManageMembers = userRole === "site_admin" || userRole === "pm";

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

        // Load members & invite links for PMs/admins
        if (meRes.role === "site_admin" || meRes.role === "pm") {
          const [membersRes, linksRes] = await Promise.all([
            api.getProjectMembers(projectId).catch(() => ({ data: [] })),
            api.getInviteLinks(projectId).catch(() => ({ data: [] })),
          ]);
          setMembers(membersRes.data);
          setInviteLinks(linksRes.data);
        }
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
    setExistingSubtasks([]);
    setExistingTaskSearch("");
    setSelectedTagIds(new Set());
  }, [currentUser]);

  // Search existing tasks for subtask linking
  useEffect(() => {
    if (!existingTaskSearch.trim()) {
      setExistingTaskResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.request<{ data: Array<{ id: string; title: string }> }>(`/search?q=${encodeURIComponent(existingTaskSearch.trim())}&limit=5&type=tasks`);
        const alreadyAdded = new Set(existingSubtasks.map((t) => t.id));
        setExistingTaskResults(res.data.filter((t) => !alreadyAdded.has(t.id)));
      } catch {
        // Fallback: filter from loaded tasks
        const q = existingTaskSearch.trim().toLowerCase();
        const alreadyAdded = new Set(existingSubtasks.map((t) => t.id));
        setExistingTaskResults(tasks.filter((t) => t.title.toLowerCase().includes(q) && !alreadyAdded.has(t.id)).slice(0, 5));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [existingTaskSearch, existingSubtasks, tasks]);

  const handleCreateTask = useCallback(async () => {
    if (!newTitle.trim() || !newDescription.trim() || !newPhaseId || !newAssigneeId || !newReportedBy || !newStartDate || !newDueDate || !newEstimatedEffort || (subtasks.length === 0 && existingSubtasks.length === 0) || !newComment.trim() || selectedTagIds.size === 0) return;
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

      // Demote existing tasks as subtasks
      if (existingSubtasks.length > 0) {
        const demoteResults = await Promise.allSettled(
          existingSubtasks.map((t) =>
            api.request(`/tasks/${t.id}/demote`, {
              method: "POST",
              body: JSON.stringify({ parentTaskId: res.data.id }),
            })
          )
        );
        const failCount = demoteResults.filter((r) => r.status === "rejected").length;
        if (failCount > 0) {
          setError(`Task created, but ${failCount} existing subtask${failCount > 1 ? "s" : ""} could not be linked.`);
        }
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
  }, [projectId, newTitle, newDescription, newPriority, newStartDate, newDueDate, newEstimatedEffort, newAssigneeId, newPhaseId, newSprint, newReportedBy, subtasks, existingSubtasks, selectedTagIds, newComment, resetTaskForm]);

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

  // Member search with debounce
  useEffect(() => {
    if (!memberSearch.trim()) {
      setMemberSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.searchUsers(memberSearch.trim(), 10);
        const existingIds = new Set(members.map((m) => m.userId));
        setMemberSearchResults(res.data.filter((u) => !existingIds.has(u.id) && u.status === "active"));
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [memberSearch, members]);

  // Close member search dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (memberSearchRef.current && !memberSearchRef.current.contains(e.target as Node)) {
        setShowMemberSearch(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleAddMember(userId: string, userName: string, userEmail: string) {
    setAddingMember(true);
    try {
      await api.addProjectMember(projectId, userId, addMemberRole);
      setMembers((prev) => [...prev, { userId, role: addMemberRole, assignedAt: new Date().toISOString(), userName, userEmail }]);
      setMemberSearch("");
      setMemberSearchResults([]);
      setShowMemberSearch(false);
    } catch {
      setError("Failed to add member");
    } finally {
      setAddingMember(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    setRemovingMemberId(userId);
    try {
      await api.removeProjectMember(projectId, userId);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch {
      setError("Failed to remove member");
    } finally {
      setRemovingMemberId(null);
    }
  }

  async function handleGenerateInviteLink() {
    setGeneratingLink(true);
    try {
      const res = await api.createInviteLink(projectId);
      setInviteLinks((prev) => [res.data, ...prev]);
    } catch {
      setError("Failed to generate invite link");
    } finally {
      setGeneratingLink(false);
    }
  }

  function copyInviteLink(link: InviteLink) {
    const url = `${window.location.origin}/join/${link.token}`;
    navigator.clipboard.writeText(url);
    setCopiedLinkId(link.id);
    setTimeout(() => setCopiedLinkId(null), 2000);
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

      {/* Project Members (PM/Admin only) */}
      {canManageMembers && (
        <div className="bg-white rounded-lg border">
          <button
            onClick={() => setMembersOpen(!membersOpen)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span className="text-sm font-semibold">Members ({members.length})</span>
            </div>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${membersOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {membersOpen && (
            <div className="border-t px-4 py-4 space-y-4">
              {/* Add member */}
              <div ref={memberSearchRef} className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => { setMemberSearch(e.target.value); setShowMemberSearch(true); }}
                      onFocus={() => setShowMemberSearch(true)}
                      placeholder="Search users to add..."
                      className="w-full text-xs px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ai/50"
                    />
                    {showMemberSearch && memberSearchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {memberSearchResults.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => handleAddMember(u.id, u.name, u.email)}
                            disabled={addingMember}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0 disabled:opacity-50"
                          >
                            <div className="text-xs font-medium text-gray-900">{u.name}</div>
                            <div className="text-xs text-gray-500">{u.email}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <select
                    value={addMemberRole}
                    onChange={(e) => setAddMemberRole(e.target.value)}
                    className="text-xs px-2 py-2 border rounded-md"
                  >
                    <option value="client">Client</option>
                    <option value="developer">Developer</option>
                    <option value="pm">PM</option>
                  </select>
                </div>
              </div>

              {/* Members list */}
              {members.length === 0 ? (
                <div className="text-xs text-gray-500 text-center py-4">
                  No members assigned yet. Search above to add members.
                </div>
              ) : (
                <div className="divide-y rounded-md border">
                  {members.map((m) => (
                    <div key={m.userId} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0">
                        {m.userName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-900 truncate">{m.userName}</div>
                        <div className="text-xs text-gray-500 truncate">{m.userEmail}</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        m.role === "pm" ? "bg-purple-100 text-purple-700"
                          : m.role === "developer" ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {m.role}
                      </span>
                      <button
                        onClick={() => handleRemoveMember(m.userId)}
                        disabled={removingMemberId === m.userId}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 flex-shrink-0"
                      >
                        {removingMemberId === m.userId ? "..." : "Remove"}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Invite links */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-700">Invite Links</span>
                  {(() => {
                    const hasActiveLink = inviteLinks.some((l) => !l.usedAt && new Date(l.expiresAt) > new Date());
                    return (
                      <button
                        onClick={handleGenerateInviteLink}
                        disabled={generatingLink || hasActiveLink}
                        title={hasActiveLink ? "An active invite link already exists for this project" : undefined}
                        className="text-xs text-ai hover:text-ai/80 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {generatingLink ? "Generating..." : hasActiveLink ? "Active link exists" : "+ Generate Link"}
                      </button>
                    );
                  })()}
                </div>
                {inviteLinks.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center py-2">
                    No invite links yet.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {inviteLinks.map((link) => {
                      const expired = new Date(link.expiresAt) < new Date();
                      const used = !!link.usedAt;
                      return (
                        <div key={link.id} className="flex items-center gap-2 text-xs bg-gray-50 rounded px-3 py-2 border">
                          <span className="flex-1 font-mono text-gray-600 truncate">
                            {link.token.substring(0, 16)}...
                          </span>
                          {used ? (
                            <span className="text-green-600 px-1.5 py-0.5 rounded bg-green-50">Used</span>
                          ) : expired ? (
                            <span className="text-red-600 px-1.5 py-0.5 rounded bg-red-50">Expired</span>
                          ) : (
                            <span className="text-blue-600 px-1.5 py-0.5 rounded bg-blue-50">
                              Expires {new Date(link.expiresAt).toLocaleDateString()}
                            </span>
                          )}
                          {!used && !expired && (
                            <button
                              onClick={() => copyInviteLink(link)}
                              className="text-xs text-ai hover:text-ai/80"
                            >
                              {copiedLinkId === link.id ? "Copied!" : "Copy"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
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
              {(subtasks.length > 0 || existingSubtasks.length > 0) && (
                <div className="space-y-1 mb-2">
                  {existingSubtasks.map((et) => (
                    <div key={et.id} className="flex items-center gap-2 text-xs bg-blue-50 rounded px-2 py-1.5 border border-blue-200">
                      <svg className="w-3 h-3 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                      </svg>
                      <span className="flex-1 text-blue-700 truncate">{et.title}</span>
                      <span className="text-[10px] text-blue-400">existing</span>
                      <button
                        type="button"
                        onClick={() => setExistingSubtasks((prev) => prev.filter((t) => t.id !== et.id))}
                        className="text-blue-400 hover:text-red-500 flex-shrink-0"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
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
              {/* Link existing task as subtask */}
              <div className="relative mt-2">
                <input
                  type="text"
                  value={existingTaskSearch}
                  onChange={(e) => { setExistingTaskSearch(e.target.value); setShowExistingSearch(true); }}
                  onFocus={() => setShowExistingSearch(true)}
                  placeholder="Search existing task to add as subtask..."
                  className="w-full text-xs px-2 py-1.5 border rounded-md focus:outline-none focus:ring-2 focus:ring-ai/50"
                />
                {showExistingSearch && existingTaskResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {existingTaskResults.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setExistingSubtasks((prev) => [...prev, { id: t.id, title: t.title }]);
                          setExistingTaskSearch("");
                          setShowExistingSearch(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b last:border-b-0"
                      >
                        {t.title}
                      </button>
                    ))}
                  </div>
                )}
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
                disabled={creating || !newTitle.trim() || !newDescription.trim() || !newPhaseId || !newAssigneeId || !newReportedBy || !newStartDate || !newDueDate || !newEstimatedEffort || (subtasks.length === 0 && existingSubtasks.length === 0) || !newComment.trim() || selectedTagIds.size === 0}
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
