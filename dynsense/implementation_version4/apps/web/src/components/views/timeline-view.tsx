"use client";

import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";

interface TimelineTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assigneeId: string | null;
  projectId: string;
  createdAt?: string;
}

const DAY_MS = 86_400_000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const priorityColor: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-400",
  medium: "bg-blue-400",
  low: "bg-gray-300",
};

const statusBarColor: Record<string, string> = {
  created: "bg-gray-400",
  in_progress: "bg-blue-500",
  completed: "bg-green-500",
  blocked: "bg-red-400",
  cancelled: "bg-gray-300",
};

const statusIcon: Record<string, string> = {
  created: "○",
  in_progress: "◐",
  completed: "●",
  blocked: "⊘",
  cancelled: "✕",
};

export function TimelineView() {
  const [tasks, setTasks] = useState<TimelineTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [projectId, setProjectId] = useState<string>("");

  useEffect(() => {
    api.getProjects().then((res) => {
      setProjects(res.data);
      if (res.data.length > 0) setProjectId(res.data[0]!.id);
    });
  }, []);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    api.getTasks({ projectId })
      .then((res) => setTasks(res.data))
      .finally(() => setLoading(false));
  }, [projectId]);

  const { sortedTasks, timelineStart, totalDays, weekMarkers } = useMemo(() => {
    const now = new Date();
    const tasksWithDates = tasks.filter((t) => t.dueDate);
    const tasksWithoutDates = tasks.filter((t) => !t.dueDate);

    const sorted = [
      ...tasksWithDates.sort(
        (a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime(),
      ),
      ...tasksWithoutDates,
    ];

    if (tasksWithDates.length === 0) {
      return {
        sortedTasks: sorted,
        timelineStart: addDays(now, -7),
        timelineEnd: addDays(now, 28),
        totalDays: 35,
        weekMarkers: [] as Date[],
      };
    }

    const allDates = tasksWithDates.map((t) => new Date(t.dueDate!).getTime());
    const minDate = new Date(Math.min(...allDates));
    const maxDate = new Date(Math.max(...allDates));

    const start = addDays(minDate, -7);
    const end = addDays(maxDate, 7);
    const days = Math.max(daysBetween(start, end), 14);

    const markers: Date[] = [];
    const cursor = new Date(start);
    cursor.setDate(cursor.getDate() - cursor.getDay() + 1);
    while (cursor <= end) {
      markers.push(new Date(cursor));
      cursor.setTime(cursor.getTime() + 7 * DAY_MS);
    }

    return { sortedTasks: sorted, timelineStart: start, timelineEnd: end, totalDays: days, weekMarkers: markers };
  }, [tasks]);

  const getLeftPercent = (date: Date) => {
    const offset = daysBetween(timelineStart, date);
    return Math.max(0, Math.min(100, (offset / totalDays) * 100));
  };

  const todayPercent = getLeftPercent(new Date());

  if (loading && !projectId) {
    return <div className="animate-pulse h-64 bg-gray-200 rounded-lg" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="text-xs border rounded px-3 py-1.5"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-3 text-xs text-gray-500">
          {Object.entries(statusBarColor).map(([status, color]) => (
            <span key={status} className="flex items-center gap-1">
              <span className={`w-3 h-2 rounded-sm ${color}`} />
              {status.replace("_", " ")}
            </span>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-gray-200 rounded" />
          ))}
        </div>
      ) : sortedTasks.length === 0 ? (
        <p className="text-xs text-gray-500">No tasks in this project yet.</p>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          {/* Header: week markers */}
          <div className="relative h-8 border-b bg-gray-50">
            {weekMarkers.map((date, i) => (
              <div
                key={i}
                className="absolute top-0 h-full border-l border-gray-200 px-1 flex items-center"
                style={{ left: `${Math.max(160, 160 + ((getLeftPercent(date) / 100) * (100 - 20)))}px` }}
              >
                <span className="text-[10px] text-gray-400 whitespace-nowrap">{formatShortDate(date)}</span>
              </div>
            ))}
          </div>

          {/* Gantt rows */}
          <div className="relative">
            {/* Today line */}
            <div
              className="absolute top-0 bottom-0 w-px bg-red-400 z-10"
              style={{ left: `${160 + (todayPercent / 100) * (100 - 20)}px` }}
            >
              <div className="absolute -top-0 -left-2 text-[9px] text-red-500 font-medium bg-red-50 px-1 rounded">
                Today
              </div>
            </div>

            {sortedTasks.map((task) => {
              const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "completed";
              const dueDate = task.dueDate ? new Date(task.dueDate) : null;
              const startDate = task.createdAt
                ? new Date(task.createdAt)
                : dueDate
                  ? addDays(dueDate, -5)
                  : null;

              const barLeft = startDate ? getLeftPercent(startDate) : 0;
              const barRight = dueDate ? getLeftPercent(dueDate) : barLeft + 5;
              const barWidth = Math.max(barRight - barLeft, 2);

              return (
                <div
                  key={task.id}
                  className={`flex items-center h-10 border-b hover:bg-gray-50 ${isOverdue ? "bg-red-50/50" : ""}`}
                >
                  <div className="w-40 min-w-[160px] flex items-center gap-2 px-3 border-r bg-white">
                    <span className="text-sm w-4 shrink-0">{statusIcon[task.status] ?? "○"}</span>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${priorityColor[task.priority] ?? "bg-gray-300"}`} />
                    <span className="text-xs truncate" title={task.title}>{task.title}</span>
                  </div>

                  <div className="flex-1 relative h-full">
                    {dueDate && (
                      <div
                        className={`absolute top-2 h-6 rounded ${statusBarColor[task.status] ?? "bg-gray-400"} opacity-80 flex items-center px-1.5`}
                        style={{
                          left: `${(barLeft / 100) * 100}%`,
                          width: `${barWidth}%`,
                          minWidth: "24px",
                        }}
                      >
                        <span className="text-[10px] text-white font-medium truncate">
                          {formatShortDate(dueDate)}
                        </span>
                        {isOverdue && (
                          <span className="ml-1 text-[9px] bg-white/30 text-white px-1 rounded">!</span>
                        )}
                      </div>
                    )}
                    {!dueDate && (
                      <div className="absolute top-3 left-2 text-[10px] text-gray-300 italic">
                        No due date
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary footer */}
          <div className="px-4 py-2 border-t bg-gray-50 flex items-center gap-4 text-xs text-gray-500">
            <span>{sortedTasks.length} tasks</span>
            <span>{sortedTasks.filter((t) => t.status === "completed").length} completed</span>
            <span className="text-red-500">
              {sortedTasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "completed").length} overdue
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
