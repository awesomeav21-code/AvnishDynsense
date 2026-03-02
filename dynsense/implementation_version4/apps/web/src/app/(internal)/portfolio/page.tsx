"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

// FR-161: Portfolio dashboard — cross-project overview
interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  description: string | null;
  taskCount: number;
  completedCount: number;
  overdueCount: number;
}

const PROJECT_STATUS_COLORS: Record<string, string> = {
  active: "#22C55E",
  on_hold: "#EAB308",
  completed: "#3B82F6",
  archived: "#9CA3AF",
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  on_hold: "bg-yellow-100 text-yellow-700",
  completed: "bg-blue-100 text-blue-700",
  archived: "bg-gray-100 text-gray-600",
};

function progressColor(pct: number): string {
  if (pct > 66) return "bg-green-500";
  if (pct > 33) return "bg-yellow-500";
  return "bg-red-500";
}

interface TaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  projectId: string;
}

const taskStatusColors: Record<string, string> = {
  created: "bg-gray-100 text-gray-600",
  ready: "bg-blue-100 text-blue-700",
  in_progress: "bg-purple-100 text-purple-700",
  review: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  blocked: "bg-red-100 text-red-700",
  cancelled: "bg-gray-200 text-gray-500",
};

export default function PortfolioPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [allTasks, setAllTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<{ type: string; value: string } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getProjects();
        const summaries: ProjectSummary[] = [];
        const collectedTasks: TaskItem[] = [];

        for (const project of res.data) {
          try {
            const taskRes = await api.getTasks({ projectId: project.id });
            const projectTasks = taskRes.data as TaskItem[];
            collectedTasks.push(...projectTasks.map((t) => ({ ...t, projectId: project.id })));
            const now = new Date();

            summaries.push({
              id: project.id,
              name: project.name,
              status: project.status,
              description: project.description ?? null,
              taskCount: projectTasks.length,
              completedCount: projectTasks.filter(
                (t) => t.status === "completed"
              ).length,
              overdueCount: projectTasks.filter(
                (t) =>
                  t.dueDate && new Date(t.dueDate) < now && t.status !== "completed"
              ).length,
            });
          } catch {
            summaries.push({
              id: project.id,
              name: project.name,
              status: project.status,
              description: project.description ?? null,
              taskCount: 0,
              completedCount: 0,
              overdueCount: 0,
            });
          }
        }

        setProjects(summaries);
        setAllTasks(collectedTasks);
      } catch {
        setError("Failed to load portfolio data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-white rounded-lg border animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-56 bg-white rounded-lg border animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 bg-white rounded-lg border animate-pulse" />
          ))}
        </div>
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

  // When a chart is clicked, show a full-page task list view
  if (selectedFilter) {
    const now = new Date();
    let filtered: TaskItem[] = [];
    let label = "";

    if (selectedFilter.type === "completion" && selectedFilter.value === "completed") {
      filtered = allTasks.filter((t) => t.status === "completed");
      label = "Completed Tasks";
    } else if (selectedFilter.type === "completion" && selectedFilter.value === "remaining") {
      filtered = allTasks.filter((t) => t.status !== "completed");
      label = "Remaining Tasks";
    } else if (selectedFilter.type === "projectStatus") {
      const projectIds = projects.filter((p) => p.status === selectedFilter.value).map((p) => p.id);
      filtered = allTasks.filter((t) => projectIds.includes(t.projectId));
      label = `Tasks in "${selectedFilter.value.replace("_", " ")}" projects`;
    } else if (selectedFilter.type === "overdue") {
      filtered = allTasks.filter(
        (t) => t.projectId === selectedFilter.value && t.dueDate && new Date(t.dueDate) < now && t.status !== "completed"
      );
      const projName = projects.find((p) => p.id === selectedFilter.value)?.name ?? "";
      label = `Overdue Tasks — ${projName}`;
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedFilter(null)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Portfolio
          </button>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{label}</h1>
          <span className="text-sm text-gray-500">{filtered.length} task{filtered.length !== 1 ? "s" : ""}</span>
        </div>
        {filtered.length === 0 ? (
          <div className="text-sm text-gray-500 bg-white rounded-lg border p-6 text-center">
            No tasks match this filter.
          </div>
        ) : (
          <div className="bg-white rounded-lg border divide-y">
            {filtered.map((t) => {
              const now2 = new Date();
              const projName = projects.find((p) => p.id === t.projectId)?.name ?? "";
              return (
                <Link
                  key={t.id}
                  href={`/tasks/${t.id}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{t.title}</div>
                    {projName && <div className="text-[10px] text-gray-400 mt-0.5">{projName}</div>}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap capitalize ${taskStatusColors[t.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {t.status.replace("_", " ")}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap capitalize ${
                    t.priority === "critical" ? "bg-red-100 text-red-700" :
                    t.priority === "high" ? "bg-orange-100 text-orange-700" :
                    t.priority === "medium" ? "bg-blue-100 text-blue-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {t.priority}
                  </span>
                  {t.dueDate && (
                    <span className={`text-xs whitespace-nowrap ${new Date(t.dueDate) < now2 ? "text-red-500 font-medium" : "text-gray-400"}`}>
                      {new Date(t.dueDate).toLocaleDateString()}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const totalTasks = projects.reduce((s, p) => s + p.taskCount, 0);
  const totalCompleted = projects.reduce((s, p) => s + p.completedCount, 0);
  const totalOverdue = projects.reduce((s, p) => s + p.overdueCount, 0);
  const overallPct = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

  // Chart data: overall completion donut
  const completionData = [
    { name: "Completed", value: totalCompleted, color: "#22C55E" },
    { name: "Remaining", value: Math.max(totalTasks - totalCompleted, 0), color: "#E5E7EB" },
  ];

  // Chart data: projects by status donut
  const statusCounts = projects.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});
  const statusData = Object.entries(statusCounts).map(([status, count]) => ({
    name: status.replace("_", " "),
    value: count,
    color: PROJECT_STATUS_COLORS[status] ?? "#9CA3AF",
  }));

  // Chart data: overdue by project (only projects with overdue > 0)
  const overdueData = projects
    .filter((p) => p.overdueCount > 0)
    .map((p) => ({ name: p.name, overdue: p.overdueCount }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Portfolio Dashboard</h1>
        <p className="text-xs text-gray-500 mt-1">Cross-project overview and health metrics</p>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs text-gray-500">Projects</div>
          <div className="text-2xl font-bold mt-1 text-ai">{projects.length}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs text-gray-500">Total Tasks</div>
          <div className="text-2xl font-bold mt-1">{totalTasks}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs text-gray-500">Completed</div>
          <div className="text-2xl font-bold mt-1 text-confidence-high">{totalCompleted}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs text-gray-500">Overdue</div>
          <div className="text-2xl font-bold mt-1 text-red-600">{totalOverdue}</div>
        </div>
      </div>

      {/* Charts row */}
      {totalTasks > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Overall Completion donut */}
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-xs font-semibold text-gray-500 mb-2">Overall Completion</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={completionData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={2}
                  startAngle={90}
                  endAngle={-270}
                  cursor="pointer"
                  onClick={(_: unknown, index: number) => {
                    const label = completionData[index]?.name;
                    if (label === "Completed") setSelectedFilter({ type: "completion", value: "completed" });
                    else setSelectedFilter({ type: "completion", value: "remaining" });
                  }}
                >
                  {completionData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: "12px", borderRadius: "8px" }}
                  formatter={(value: number | undefined) => [value ?? 0, "Tasks"]}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: "10px" }} />
                {/* Center label */}
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-gray-900"
                  style={{ fontSize: "20px", fontWeight: 700 }}
                >
                  {overallPct}%
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Projects by Status donut */}
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-xs font-semibold text-gray-500 mb-2">Projects by Status</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={2}
                  cursor="pointer"
                  onClick={(_: unknown, index: number) => {
                    const status = Object.keys(statusCounts)[index];
                    if (status) setSelectedFilter({ type: "projectStatus", value: status });
                  }}
                >
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: "12px", borderRadius: "8px" }}
                  formatter={(value: number | undefined) => [value ?? 0, "Projects"]}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: "10px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Overdue by Project bar chart */}
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-xs font-semibold text-gray-500 mb-2">Overdue by Project</h3>
            {overdueData.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-xs text-gray-400">
                No overdue tasks
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={overdueData} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: "12px", borderRadius: "8px" }}
                    formatter={(value: number | undefined) => [value ?? 0, "Overdue"]}
                  />
                  <Bar
                    dataKey="overdue"
                    fill="#EF4444"
                    radius={[0, 4, 4, 0]}
                    barSize={18}
                    cursor="pointer"
                    onClick={(data) => {
                      const project = projects.find((p) => p.name === data.name);
                      if (project) setSelectedFilter({ type: "overdue", value: project.id });
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Project cards */}
      {projects.length === 0 ? (
        <div className="text-sm text-gray-500 bg-white rounded-lg border p-6 text-center">
          No projects yet. Create one to get started.
        </div>
      ) : (
        <div>
          <h2 className="text-lg font-semibold mb-3">Projects</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => {
              const progress = project.taskCount > 0
                ? Math.round((project.completedCount / project.taskCount) * 100)
                : 0;

              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="block bg-white rounded-lg border p-4 space-y-3 hover:border-ai/50 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium text-gray-900 truncate">{project.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_BADGE_CLASSES[project.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {project.status.replace("_", " ")}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{progress}% complete</span>
                      <span>{project.completedCount}/{project.taskCount} tasks</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`${progressColor(progress)} h-2 rounded-full transition-all`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Overdue + description */}
                  <div className="flex items-center justify-between gap-2">
                    {project.description ? (
                      <p className="text-xs text-gray-400 line-clamp-1 min-w-0">{project.description}</p>
                    ) : (
                      <span />
                    )}
                    {project.overdueCount > 0 && (
                      <span className="text-xs text-red-600 font-medium shrink-0">
                        {project.overdueCount} overdue
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
