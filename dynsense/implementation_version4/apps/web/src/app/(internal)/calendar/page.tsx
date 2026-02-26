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

interface Project {
  id: string;
  name: string;
}

const priorityDotColors: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-blue-500",
  low: "bg-gray-400",
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type CalendarView = "month" | "week";

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatMonthYear(year: number, month: number): string {
  return new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function dateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function getWeekDates(date: Date): Date[] {
  const day = date.getDay();
  const start = new Date(date);
  start.setDate(start.getDate() - day);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

function formatWeekRange(dates: Date[]): string {
  if (dates.length === 0) return "";
  const first = dates[0]!;
  const last = dates[dates.length - 1]!;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${first.toLocaleDateString("en-US", opts)} — ${last.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

export default function CalendarPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [view, setView] = useState<CalendarView>("month");

  // Quick-create state
  const [quickCreateDate, setQuickCreateDate] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickProjectId, setQuickProjectId] = useState("");
  const [creating, setCreating] = useState(false);

  // Drag-to-reschedule state
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    Promise.all([
      api.getTasks({ limit: 500 }),
      api.getProjects(),
    ])
      .then(([tasksRes, projectsRes]) => {
        setTasks(tasksRes.data);
        setProjects(projectsRes.data);
        if (projectsRes.data.length > 0) {
          setQuickProjectId(projectsRes.data[0]!.id);
        }
      })
      .catch(() => setError("Failed to load data"))
      .finally(() => setLoading(false));
  }, []);

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const d = new Date(task.dueDate);
      const key = dateKey(d);
      if (!map[key]) map[key] = [];
      map[key]!.push(task);
    }
    return map;
  }, [tasks]);

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  function prevPeriod() {
    if (view === "month") {
      setCurrentDate(new Date(year, month - 1, 1));
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    }
  }

  function nextPeriod() {
    if (view === "month") {
      setCurrentDate(new Date(year, month + 1, 1));
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    }
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  function handleCellClick(key: string) {
    if (quickCreateDate === key) {
      setQuickCreateDate(null);
    } else {
      setQuickCreateDate(key);
      setQuickTitle("");
    }
  }

  async function handleQuickCreate() {
    if (!quickTitle.trim() || !quickProjectId || !quickCreateDate) return;
    setCreating(true);
    const dueDateValue = `${quickCreateDate}T12:00:00.000Z`;
    try {
      const res = await api.createTask({
        projectId: quickProjectId,
        title: quickTitle.trim(),
        dueDate: dueDateValue,
      });
      setTasks((prev) => [...prev, {
        id: res.data.id,
        title: quickTitle.trim(),
        status: "created",
        priority: "medium",
        assigneeId: null,
        dueDate: dueDateValue,
        projectId: quickProjectId,
      }]);
      setQuickCreateDate(null);
      setQuickTitle("");
    } catch {
      setError("Failed to create task");
    } finally {
      setCreating(false);
    }
  }

  const handleDrop = useCallback(async (targetDateKey: string) => {
    if (!dragTaskId) return;
    setDropTargetKey(null);
    const task = tasks.find((t) => t.id === dragTaskId);
    if (!task) return;
    const oldDate = task.dueDate;
    if (oldDate?.slice(0, 10) === targetDateKey) {
      setDragTaskId(null);
      return;
    }
    // Optimistic update — store with noon UTC to prevent timezone drift
    const dueDateValue = `${targetDateKey}T12:00:00.000Z`;
    setTasks((prev) => prev.map((t) => t.id === dragTaskId ? { ...t, dueDate: dueDateValue } : t));
    setDragTaskId(null);
    try {
      await api.updateTask(dragTaskId, { dueDate: dueDateValue });
    } catch {
      // Rollback
      setTasks((prev) => prev.map((t) => t.id === dragTaskId ? { ...t, dueDate: oldDate } : t));
      setError("Failed to reschedule task");
    }
  }, [dragTaskId, tasks]);

  // Month view cells
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const monthCells: Array<{ day: number | null; key: string }> = [];
  for (let i = 0; i < firstDay; i++) {
    monthCells.push({ day: null, key: `empty-${i}` });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    monthCells.push({ day: d, key });
  }

  // Week view dates
  const weekDates = getWeekDates(currentDate);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-24 bg-white rounded border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-gray-100 rounded-md p-0.5">
            {(["month", "week"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 py-1 text-xs rounded transition-colors capitalize ${
                  view === v ? "bg-white text-ai font-medium shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <button onClick={prevPeriod} className="px-2 py-1 text-xs text-gray-600 bg-white border rounded hover:bg-gray-50 transition-colors">
            &larr;
          </button>
          <button onClick={goToToday} className="px-3 py-1 text-xs text-ai bg-ai/10 border border-ai/20 rounded hover:bg-ai/20 transition-colors">
            Today
          </button>
          <button onClick={nextPeriod} className="px-2 py-1 text-xs text-gray-600 bg-white border rounded hover:bg-gray-50 transition-colors">
            &rarr;
          </button>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-700">
        {view === "month" ? formatMonthYear(year, month) : formatWeekRange(weekDates)}
      </h2>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">
          {error}
          <button onClick={() => setError("")} className="ml-2 text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}

      {/* Calendar grid */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b">
          {WEEKDAY_LABELS.map((day) => (
            <div key={day} className="text-xs font-semibold text-gray-500 text-center py-2 bg-gray-50">
              {day}
            </div>
          ))}
        </div>

        {/* Month view */}
        {view === "month" && (
          <div className="grid grid-cols-7">
            {monthCells.map((cell) => {
              const isToday = cell.key === todayKey;
              const dayTasks = cell.day ? (tasksByDate[cell.key] ?? []) : [];
              const isQuickCreate = quickCreateDate === cell.key;

              return (
                <div
                  key={cell.key}
                  onClick={() => cell.day !== null && handleCellClick(cell.key)}
                  onDragOver={(e) => { if (cell.day !== null) { e.preventDefault(); setDropTargetKey(cell.key); } }}
                  onDragLeave={() => setDropTargetKey(null)}
                  onDrop={(e) => { e.preventDefault(); if (cell.day !== null) handleDrop(cell.key); }}
                  className={`min-h-[100px] border-b border-r p-1.5 cursor-pointer transition-colors ${
                    cell.day === null ? "bg-gray-50 cursor-default" : "bg-white hover:bg-blue-50/30"
                  } ${isToday ? "ring-2 ring-inset ring-ai/30" : ""} ${isQuickCreate ? "bg-blue-50" : ""} ${dropTargetKey === cell.key ? "bg-ai/10 ring-2 ring-inset ring-ai/40" : ""}`}
                >
                  {cell.day !== null && (
                    <>
                      <div className={`text-xs font-medium mb-1 ${isToday ? "text-ai font-bold" : "text-gray-500"}`}>
                        {cell.day}
                      </div>

                      {/* Quick create form */}
                      {isQuickCreate && (
                        <div className="mb-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            autoFocus
                            value={quickTitle}
                            onChange={(e) => setQuickTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleQuickCreate();
                              if (e.key === "Escape") setQuickCreateDate(null);
                            }}
                            placeholder="New task..."
                            className="w-full text-[10px] px-1 py-0.5 border rounded focus:outline-none focus:ring-1 focus:ring-ai/50"
                          />
                          {projects.length > 1 && (
                            <select
                              value={quickProjectId}
                              onChange={(e) => setQuickProjectId(e.target.value)}
                              className="w-full text-[10px] mt-0.5 px-1 py-0.5 border rounded"
                            >
                              {projects.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          )}
                          <button
                            onClick={handleQuickCreate}
                            disabled={creating || !quickTitle.trim()}
                            className="mt-0.5 w-full text-[10px] bg-ai text-white px-1 py-0.5 rounded disabled:opacity-50"
                          >
                            {creating ? "..." : "+ Add"}
                          </button>
                        </div>
                      )}

                      <div className="space-y-0.5">
                        {dayTasks.slice(0, 3).map((task) => {
                          const isOverdue = cell.key < todayKey && task.status !== "completed" && task.status !== "cancelled";
                          return (
                          <Link
                            key={task.id}
                            href={`/tasks/${task.id}?from=calendar`}
                            draggable
                            onDragStart={(e) => { e.stopPropagation(); setDragTaskId(task.id); e.dataTransfer.effectAllowed = "move"; }}
                            onDragEnd={() => { setDragTaskId(null); setDropTargetKey(null); }}
                            className={`flex items-center gap-1 group ${dragTaskId === task.id ? "opacity-40" : ""}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOverdue ? "bg-red-500" : (priorityDotColors[task.priority] ?? "bg-gray-400")}`} />
                            <span className={`text-[10px] truncate transition-colors ${isOverdue ? "text-red-600 group-hover:text-red-800" : "text-gray-700 group-hover:text-ai"}`}>
                              {task.title}
                            </span>
                          </Link>
                          );
                        })}
                        {dayTasks.length > 3 && (
                          <span className="text-[10px] text-gray-400 pl-3">+{dayTasks.length - 3} more</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Week view */}
        {view === "week" && (
          <div className="grid grid-cols-7">
            {weekDates.map((date) => {
              const key = dateKey(date);
              const isToday = key === todayKey;
              const dayTasks = tasksByDate[key] ?? [];
              const isQuickCreate = quickCreateDate === key;

              return (
                <div
                  key={key}
                  onClick={() => handleCellClick(key)}
                  onDragOver={(e) => { e.preventDefault(); setDropTargetKey(key); }}
                  onDragLeave={() => setDropTargetKey(null)}
                  onDrop={(e) => { e.preventDefault(); handleDrop(key); }}
                  className={`min-h-[300px] border-r p-2 cursor-pointer transition-colors ${
                    isToday ? "ring-2 ring-inset ring-ai/30 bg-ai/5" : "bg-white hover:bg-blue-50/30"
                  } ${isQuickCreate ? "bg-blue-50" : ""} ${dropTargetKey === key ? "bg-ai/10 ring-2 ring-inset ring-ai/40" : ""}`}
                >
                  <div className={`text-xs font-medium mb-2 ${isToday ? "text-ai font-bold" : "text-gray-500"}`}>
                    {date.toLocaleDateString("en-US", { weekday: "short", day: "numeric" })}
                  </div>

                  {/* Quick create form */}
                  {isQuickCreate && (
                    <div className="mb-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        autoFocus
                        value={quickTitle}
                        onChange={(e) => setQuickTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleQuickCreate();
                          if (e.key === "Escape") setQuickCreateDate(null);
                        }}
                        placeholder="New task..."
                        className="w-full text-[10px] px-1.5 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-ai/50"
                      />
                      {projects.length > 1 && (
                        <select
                          value={quickProjectId}
                          onChange={(e) => setQuickProjectId(e.target.value)}
                          className="w-full text-[10px] mt-1 px-1.5 py-1 border rounded"
                        >
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      )}
                      <button
                        onClick={handleQuickCreate}
                        disabled={creating || !quickTitle.trim()}
                        className="mt-1 w-full text-[10px] bg-ai text-white px-1.5 py-1 rounded disabled:opacity-50"
                      >
                        {creating ? "..." : "+ Add Task"}
                      </button>
                    </div>
                  )}

                  <div className="space-y-1">
                    {dayTasks.map((task) => {
                      const isOverdue = key < todayKey && task.status !== "completed" && task.status !== "cancelled";
                      return (
                      <Link
                        key={task.id}
                        href={`/tasks/${task.id}?from=calendar`}
                        draggable
                        onDragStart={(e) => { e.stopPropagation(); setDragTaskId(task.id); e.dataTransfer.effectAllowed = "move"; }}
                        onDragEnd={() => { setDragTaskId(null); setDropTargetKey(null); }}
                        onClick={(e) => e.stopPropagation()}
                        className={`block px-1.5 py-1 rounded text-[10px] border transition-colors hover:border-ai/50 ${
                          task.status === "completed"
                            ? "bg-green-50 border-green-200 text-green-700 line-through"
                            : isOverdue
                              ? "bg-red-50 border-red-200 text-red-600"
                              : "bg-white border-gray-200 text-gray-700"
                        } ${dragTaskId === task.id ? "opacity-40" : ""}`}
                      >
                        <div className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOverdue ? "bg-red-500" : (priorityDotColors[task.priority] ?? "bg-gray-400")}`} />
                          <span className="truncate">{task.title}</span>
                        </div>
                      </Link>
                      );
                    }
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend + hint */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="font-medium">Priority:</span>
          {Object.entries(priorityDotColors).map(([name, color]) => (
            <span key={name} className="flex items-center gap-1 capitalize">
              <span className={`w-2 h-2 rounded-full ${color}`} />
              {name}
            </span>
          ))}
        </div>
        <span className="text-xs text-gray-400">Click a day to quick-create &middot; Drag tasks to reschedule</span>
      </div>
    </div>
  );
}
