"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { KanbanView } from "@/components/views/kanban-view";
import { CalendarView } from "@/components/views/calendar-view";
import { TableView } from "@/components/views/table-view";
import { TimelineView } from "@/components/views/timeline-view";
import { UserSearchCombobox } from "@/components/user-search-combobox";

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

type ViewMode = "list" | "kanban" | "calendar" | "table" | "timeline";

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
  {
    key: "timeline",
    label: "Timeline",
    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  },
];

interface Project {
  id: string;
  name: string;
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
  taskCount: number;
}

export default function MyTasksPage() {
  return (
    <Suspense fallback={
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-white rounded border animate-pulse" />
        ))}
      </div>
    }>
      <MyTasksContent />
    </Suspense>
  );
}

function MyTasksContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const highlightParam = searchParams.get("highlight");
  const viewParam = searchParams.get("view") as ViewMode | null;

  const [viewMode, setViewModeState] = useState<ViewMode>(
    viewParam && ["list", "kanban", "calendar", "table", "timeline"].includes(viewParam) ? viewParam : "list"
  );

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", mode);
    router.replace(`/my-tasks?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProjectId, setFilterProjectId] = useState("all");
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const projectDropdownRef = useRef<HTMLDivElement>(null);
  const [expandedOverdue, setExpandedOverdue] = useState(false);
  const [expandedCritical, setExpandedCritical] = useState(false);
  const [expandedHigh, setExpandedHigh] = useState(false);

  // New task form state
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newProjectId, setNewProjectId] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newStartDate, setNewStartDate] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newDescription, setNewDescription] = useState("");
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

  const [newAssigneeId, setNewAssigneeId] = useState("");
  const [newPhaseId, setNewPhaseId] = useState("");
  const [newSprint, setNewSprint] = useState("R0");
  const [creating, setCreating] = useState(false);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string; role: string } | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [subtaskInput, setSubtaskInput] = useState("");
  const [newComment, setNewComment] = useState("");
  const [newReportedBy, setNewReportedBy] = useState("");

  useEffect(() => {
    Promise.all([
      api.getTasks({ limit: 200 }),
      api.getProjects(),
      api.getMe(),
      api.getTags(),
    ])
      .then(([tasksRes, projectsRes, meRes, tagsRes]) => {
        setTasks(tasksRes.data);
        setProjects(projectsRes.data);
        setCurrentUser(meRes);
        setNewReportedBy(meRes.id);
        setTags(tagsRes.data.filter((t) => !t.archived));
        setNewProjectId("");
      })
      .catch(() => setError("Failed to load tasks"))
      .finally(() => setLoading(false));
  }, []);

  // Fetch phases when selected project changes
  useEffect(() => {
    if (!newProjectId) { setPhases([]); return; }
    api.getPhases(newProjectId)
      .then((res) => setPhases(res.data))
      .catch(() => setPhases([]));
  }, [newProjectId]);

  // Close project dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Handle highlight param from dependency graph navigation
  useEffect(() => {
    if (highlightParam && !loading) {
      setViewMode("list");
      setFilterStatus("all");
      setFilterProjectId("all");
      setHighlightedTaskId(highlightParam);

      // Clean up the URL query param without a full navigation
      router.replace("/my-tasks", { scroll: false });

      // Wait for render then scroll to the task
      requestAnimationFrame(() => {
        setTimeout(() => {
          highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      });

      // Auto-clear highlight after 3 seconds
      const timer = setTimeout(() => setHighlightedTaskId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightParam, loading, router]);

  const handleCreateTask = useCallback(async () => {
    if (!newTitle.trim() || !newProjectId || !newDescription.trim() || !newPhaseId || !newAssigneeId || !newReportedBy || !newStartDate || !newDueDate || !newEstimatedEffort || subtasks.length === 0 || !newComment.trim() || selectedTagIds.size === 0) return;
    setCreating(true);
    try {
      const effort = newEstimatedEffort ? parseFloat(newEstimatedEffort) : undefined;
      const res = await api.createTask({
        projectId: newProjectId,
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
              projectId: newProjectId,
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
          projectId: newProjectId,
        },
        ...prev,
      ]);
      setNewTitle("");
      setNewDescription("");
      setNewPriority("medium");
      setNewStartDate("");
      setNewDueDate("");
      setNewEstimatedEffort("");
      setNewAssigneeId("");
      setNewPhaseId("");
      setNewSprint("R0");
      setNewReportedBy(currentUser?.id ?? "");
      setSubtasks([]);
      setSubtaskInput("");
      setSelectedTagIds(new Set());
      setNewComment("");
      setShowNewTask(false);
    } catch {
      setError("Failed to create task");
    } finally {
      setCreating(false);
    }
  }, [newTitle, newProjectId, newPriority, newStartDate, newDueDate, newDescription, newEstimatedEffort, newAssigneeId, newPhaseId, newSprint, newReportedBy, subtasks, selectedTagIds, newComment, currentUser]);

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

  const criticalTasks = projectFiltered.filter((t) =>
    t.status !== "completed" && t.status !== "cancelled" &&
    t.priority === "critical"
  );
  const highPriorityTasks = projectFiltered.filter((t) =>
    t.status !== "completed" && t.status !== "cancelled" &&
    t.priority === "high"
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
        <div className="bg-white rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Create New Task</h3>
            <button onClick={() => setShowNewTask(false)} className="text-gray-400 hover:text-gray-600">
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
              onKeyDown={(e) => { if (e.key === "Escape") setShowNewTask(false); }}
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

          {/* Row 1: Project, Phase, Assignee */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-1">Project <span className="text-red-500">*</span></label>
              <select
                value={newProjectId}
                onChange={(e) => { setNewProjectId(e.target.value); setNewPhaseId(""); }}
                className="w-full text-xs px-2 py-1.5 border rounded-md"
              >
                <option value="">Select a project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
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
              onClick={() => setShowNewTask(false)}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 border rounded-md hover:bg-gray-50 mr-2"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateTask}
              disabled={creating || !newTitle.trim() || !newProjectId || !newDescription.trim() || !newPhaseId || !newAssigneeId || !newReportedBy || !newStartDate || !newDueDate || !newEstimatedEffort || subtasks.length === 0 || !newComment.trim() || selectedTagIds.size === 0}
              className="px-4 py-1.5 text-xs font-medium text-white bg-ai rounded-md hover:bg-ai/90 disabled:opacity-50 transition-colors"
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
      {viewMode === "timeline" && <TimelineView />}

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
              {(criticalTasks.length > 0 || highPriorityTasks.length > 0 || overdueTasks.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {overdueTasks.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h3 className="text-xs font-semibold text-red-700 mb-2">Overdue ({overdueTasks.length})</h3>
                      {(expandedOverdue ? overdueTasks : overdueTasks.slice(0, 3)).map((t) => (
                        <Link key={t.id} href={`/tasks/${t.id}`} className="block text-xs text-red-600 hover:text-red-800 truncate py-0.5">
                          {t.title}
                        </Link>
                      ))}
                      {overdueTasks.length > 3 && (
                        <button onClick={() => setExpandedOverdue((v) => !v)} className="text-xs text-red-400 hover:text-red-600 mt-1 cursor-pointer">
                          {expandedOverdue ? "Show less" : `+${overdueTasks.length - 3} more`}
                        </button>
                      )}
                    </div>
                  )}
                  {criticalTasks.length > 0 && (
                    <div className="bg-red-50/70 border border-red-300 rounded-lg p-4">
                      <h3 className="text-xs font-semibold text-red-700 mb-2">Critical Priority ({criticalTasks.length})</h3>
                      {(expandedCritical ? criticalTasks : criticalTasks.slice(0, 3)).map((t) => (
                        <Link key={t.id} href={`/tasks/${t.id}`} className="block text-xs text-red-600 hover:text-red-800 truncate py-0.5">
                          {t.title}
                        </Link>
                      ))}
                      {criticalTasks.length > 3 && (
                        <button onClick={() => setExpandedCritical((v) => !v)} className="text-xs text-red-400 hover:text-red-600 mt-1 cursor-pointer">
                          {expandedCritical ? "Show less" : `+${criticalTasks.length - 3} more`}
                        </button>
                      )}
                    </div>
                  )}
                  {highPriorityTasks.length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <h3 className="text-xs font-semibold text-orange-700 mb-2">High Priority ({highPriorityTasks.length})</h3>
                      {(expandedHigh ? highPriorityTasks : highPriorityTasks.slice(0, 3)).map((t) => (
                        <Link key={t.id} href={`/tasks/${t.id}`} className="block text-xs text-orange-600 hover:text-orange-800 truncate py-0.5">
                          {t.title}
                        </Link>
                      ))}
                      {highPriorityTasks.length > 3 && (
                        <button onClick={() => setExpandedHigh((v) => !v)} className="text-xs text-orange-400 hover:text-orange-600 mt-1 cursor-pointer">
                          {expandedHigh ? "Show less" : `+${highPriorityTasks.length - 3} more`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Project switcher dropdown */}
              {projects.length > 0 && (
                <div className="relative" ref={projectDropdownRef}>
                  <button
                    onClick={() => setProjectDropdownOpen((o) => !o)}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-full bg-ai text-white transition-colors hover:bg-ai/90"
                  >
                    {filterProjectId === "all"
                      ? `All Projects (${tasks.length})`
                      : `${projects.find((p) => p.id === filterProjectId)?.name ?? "Project"} (${tasks.filter((t) => t.projectId === filterProjectId).length})`}
                    <svg className={`w-3 h-3 transition-transform ${projectDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {projectDropdownOpen && (
                    <div className="absolute z-20 mt-1 bg-white border rounded-lg shadow-lg py-1 min-w-[200px]">
                      <button
                        onClick={() => { setFilterProjectId("all"); setProjectDropdownOpen(false); }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${filterProjectId === "all" ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700"}`}
                      >
                        All Projects ({tasks.length})
                      </button>
                      {projects.map((p) => {
                        const count = tasks.filter((t) => t.projectId === p.id).length;
                        return (
                          <button
                            key={p.id}
                            onClick={() => { setFilterProjectId(p.id); setProjectDropdownOpen(false); }}
                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${filterProjectId === p.id ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700"}`}
                          >
                            {p.name} ({count})
                          </button>
                        );
                      })}
                    </div>
                  )}
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
                    const isHighlighted = highlightedTaskId === task.id;

                    return (
                      <div
                        key={task.id}
                        ref={isHighlighted ? highlightRef : undefined}
                        className={`flex items-center gap-4 px-4 py-3 transition-all duration-500 ${
                          isHighlighted
                            ? "bg-blue-50 ring-2 ring-blue-400 ring-inset animate-pulse"
                            : isSaving
                              ? "opacity-60"
                              : "hover:bg-gray-50"
                        }`}
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
