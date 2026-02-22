"use client";

import { useEffect, useState, useMemo } from "react";
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

const priorityDotColors: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-blue-500",
  low: "bg-gray-400",
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    api.getTasks({ limit: 500 })
      .then((res) => setTasks(res.data))
      .catch(() => setError("Failed to load tasks"))
      .finally(() => setLoading(false));
  }, []);

  // Group tasks by their due date key
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const d = new Date(task.dueDate);
      const key = dateKey(d);
      if (!map[key]) map[key] = [];
      map[key].push(task);
    }
    return map;
  }, [tasks]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const todayKey = dateKey(new Date());

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  // Build calendar grid cells
  const cells: Array<{ day: number | null; key: string }> = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push({ day: null, key: `empty-${i}` });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, key });
  }

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
          <button
            onClick={prevMonth}
            className="px-2 py-1 text-xs text-gray-600 bg-white border rounded hover:bg-gray-50 transition-colors"
          >
            &larr; Prev
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1 text-xs text-ai bg-ai/10 border border-ai/20 rounded hover:bg-ai/20 transition-colors"
          >
            Today
          </button>
          <button
            onClick={nextMonth}
            className="px-2 py-1 text-xs text-gray-600 bg-white border rounded hover:bg-gray-50 transition-colors"
          >
            Next &rarr;
          </button>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-700">{formatMonthYear(year, month)}</h2>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</div>
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

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {cells.map((cell) => {
            const isToday = cell.key === todayKey;
            const dayTasks = cell.day ? (tasksByDate[cell.key] ?? []) : [];

            return (
              <div
                key={cell.key}
                className={`min-h-[100px] border-b border-r p-1.5 ${
                  cell.day === null ? "bg-gray-50" : "bg-white"
                } ${isToday ? "ring-2 ring-inset ring-ai/30" : ""}`}
              >
                {cell.day !== null && (
                  <>
                    <div className={`text-xs font-medium mb-1 ${
                      isToday ? "text-ai font-bold" : "text-gray-500"
                    }`}>
                      {cell.day}
                    </div>
                    <div className="space-y-0.5">
                      {dayTasks.slice(0, 3).map((task) => (
                        <Link
                          key={task.id}
                          href={`/tasks/${task.id}`}
                          className="flex items-center gap-1 group"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priorityDotColors[task.priority] ?? "bg-gray-400"}`} />
                          <span className="text-[10px] text-gray-700 truncate group-hover:text-ai transition-colors">
                            {task.title}
                          </span>
                        </Link>
                      ))}
                      {dayTasks.length > 3 && (
                        <span className="text-[10px] text-gray-400 pl-3">
                          +{dayTasks.length - 3} more
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="font-medium">Priority:</span>
        {Object.entries(priorityDotColors).map(([name, color]) => (
          <span key={name} className="flex items-center gap-1 capitalize">
            <span className={`w-2 h-2 rounded-full ${color}`} />
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
