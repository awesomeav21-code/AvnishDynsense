"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

interface Project {
  id: string;
  name: string;
  status: string;
  description: string | null;
  createdAt: string;
}

interface TaskStat {
  status: string;
  count: number;
}

interface WhatsNextTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  projectId: string;
  reason: string;
}

interface FullTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
  completedAt: string | null;
  dueDate: string | null;
}

const STATUS_CHART_COLORS: Record<string, string> = {
  created: "#9CA3AF",
  ready: "#3B82F6",
  in_progress: "#6366F1",
  review: "#EAB308",
  completed: "#22C55E",
  blocked: "#EF4444",
  cancelled: "#D1D5DB",
};

const PRIORITY_CHART_COLORS: Record<string, string> = {
  critical: "#EF4444",
  high: "#F97316",
  medium: "#3B82F6",
  low: "#9CA3AF",
};

const priorityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-gray-100 text-gray-600",
};

function formatDueDate(dueDate: string | null, now: Date): { text: string; isOverdue: boolean } {
  if (!dueDate) return { text: "No due date", isOverdue: false };
  const date = new Date(dueDate);
  const isOverdue = date < now;
  const formatted = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return { text: formatted, isOverdue };
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [taskStats, setTaskStats] = useState<TaskStat[]>([]);
  const [allTasks, setAllTasks] = useState<FullTask[]>([]);
  const [whatsNext, setWhatsNext] = useState<WhatsNextTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [projRes, statsRes, tasksRes, whatsNextRes] = await Promise.all([
          api.getProjects(),
          api.getTaskStats(),
          api.getTasks({ limit: 500 }),
          api.getWhatsNext().catch(() => ({ data: [] as WhatsNextTask[] })),
        ]);
        setProjects(projRes.data);
        setTaskStats(statsRes.data);
        setAllTasks(tasksRes.data as unknown as FullTask[]);
        setWhatsNext(whatsNextRes.data);
      } catch {
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalTasks = taskStats.reduce((sum, s) => sum + s.count, 0);
  const completedTasks = taskStats.find((s) => s.status === "completed")?.count ?? 0;
  const inProgressTasks = taskStats.find((s) => s.status === "in_progress")?.count ?? 0;
  const now = new Date();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-white rounded-lg border animate-pulse" />
          ))}
        </div>
        <div className="h-48 bg-white rounded-lg border animate-pulse" />
        <div className="h-32 bg-white rounded-lg border animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs text-gray-500">Total Tasks</div>
          <div className="text-2xl font-bold mt-1">{totalTasks}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs text-gray-500">In Progress</div>
          <div className="text-2xl font-bold mt-1 text-ai">{inProgressTasks}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs text-gray-500">Completed</div>
          <div className="text-2xl font-bold mt-1 text-confidence-high">{completedTasks}</div>
        </div>
      </div>

      {/* Charts */}
      {totalTasks > 0 && (() => {
        const pieData = taskStats.map((s) => ({
          name: s.status.replace("_", " "),
          value: s.count,
          color: STATUS_CHART_COLORS[s.status] ?? "#9CA3AF",
        }));

        const priorityCounts = allTasks.reduce<Record<string, number>>((acc, t) => {
          acc[t.priority] = (acc[t.priority] ?? 0) + 1;
          return acc;
        }, {});
        const priorityPieData = Object.entries(priorityCounts).map(([priority, count]) => ({
          name: priority,
          value: count,
          color: PRIORITY_CHART_COLORS[priority] ?? "#9CA3AF",
        }));

        // Bar chart: tasks created per day over the last 7 days
        const dayMs = 86400000;
        const days = 7;
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const lineData: Array<{ date: string; created: number; completed: number }> = [];
        for (let i = days - 1; i >= 0; i--) {
          const dayStart = todayStart - i * dayMs;
          const dayEnd = dayStart + dayMs;
          const label = new Date(dayStart).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          const created = allTasks.filter((t) => {
            const d = new Date(t.createdAt).getTime();
            return d >= dayStart && d < dayEnd;
          }).length;
          const completed = allTasks.filter((t) => {
            if (!t.completedAt) return false;
            const d = new Date(t.completedAt).getTime();
            return d >= dayStart && d < dayEnd;
          }).length;
          lineData.push({ date: label, created, completed });
        }

        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Status pie chart */}
            <div className="bg-white rounded-lg border p-4">
              <h3 className="text-xs font-semibold text-gray-500 mb-2">Tasks by Status</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: "12px", borderRadius: "8px" }}
                    formatter={(value: number) => [value, "Tasks"]}
                  />
                  <Legend
                    iconSize={8}
                    wrapperStyle={{ fontSize: "10px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Priority pie chart */}
            <div className="bg-white rounded-lg border p-4">
              <h3 className="text-xs font-semibold text-gray-500 mb-2">Tasks by Priority</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={priorityPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {priorityPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: "12px", borderRadius: "8px" }}
                    formatter={(value: number) => [value, "Tasks"]}
                  />
                  <Legend
                    iconSize={8}
                    wrapperStyle={{ fontSize: "10px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Activity bar chart */}
            <div className="bg-white rounded-lg border p-4">
              <h3 className="text-xs font-semibold text-gray-500 mb-2">Activity (Last 7 Days)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    allowDecimals={false}
                    width={30}
                  />
                  <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
                  <Bar dataKey="created" fill="#6366F1" radius={[3, 3, 0, 0]} name="Created" />
                  <Bar dataKey="completed" fill="#22C55E" radius={[3, 3, 0, 0]} name="Completed" />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: "10px" }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })()}

      {/* What's Next section */}
      <div>
        <h2 className="text-lg font-semibold mb-3">What&apos;s Next</h2>
        {whatsNext.length === 0 ? (
          <div className="text-sm text-gray-500 bg-white rounded-lg border p-6 text-center">
            No prioritized tasks right now. You&apos;re all caught up!
          </div>
        ) : (
          <div className="bg-white rounded-lg border divide-y">
            {whatsNext.map((task) => {
              const { text: dueDateText, isOverdue } = formatDueDate(task.dueDate, now);
              return (
                <div key={task.id} className="p-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/tasks/${task.id}`}
                        className="text-sm font-medium text-gray-900 hover:text-ai transition-colors"
                      >
                        {task.title}
                      </Link>
                      <p className="text-xs text-gray-400 mt-0.5">{task.reason}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColors[task.priority] ?? "bg-gray-100 text-gray-600"}`}>
                        {task.priority}
                      </span>
                      <span className={`text-xs ${isOverdue ? "text-red-600 font-medium" : "text-gray-500"}`}>
                        {dueDateText}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Projects list */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Projects</h2>
        {projects.length === 0 ? (
          <div className="text-sm text-gray-500 bg-white rounded-lg border p-6 text-center">
            No projects yet. Create one to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block bg-white rounded-lg border p-4 hover:border-ai/50 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-medium text-gray-900">{project.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    project.status === "active"
                      ? "bg-green-100 text-green-700"
                      : project.status === "on_hold"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {project.status}
                  </span>
                </div>
                {project.description && (
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2">{project.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
