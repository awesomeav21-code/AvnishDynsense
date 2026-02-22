"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

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

interface AiAction {
  id: string;
  capability: string;
  status: string;
  disposition: string;
  output: unknown;
  confidence: string | null;
  input: unknown;
  createdAt: string;
  updatedAt: string;
}

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
  const [whatsNext, setWhatsNext] = useState<WhatsNextTask[]>([]);
  const [aiSummary, setAiSummary] = useState<AiAction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [projRes, statsRes, whatsNextRes, aiRes] = await Promise.all([
          api.getProjects(),
          api.getTaskStats(),
          api.getWhatsNext().catch(() => ({ data: [] as WhatsNextTask[] })),
          api.getAiActions({ capability: "summary_writer", limit: 1 }).catch(() => ({ data: [] as AiAction[] })),
        ]);
        setProjects(projRes.data);
        setTaskStats(statsRes.data);
        setWhatsNext(whatsNextRes.data);
        if (aiRes.data.length > 0) {
          setAiSummary(aiRes.data[0]!);
        }
      } catch {
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleGenerateSummary = useCallback(async () => {
    setGeneratingSummary(true);
    setSummaryError("");
    try {
      const result = await api.executeAi("summary_writer", {});
      setAiSummary({
        ...result.data,
        input: {},
        updatedAt: result.data.createdAt,
      });
    } catch {
      setSummaryError("Failed to generate summary");
    } finally {
      setGeneratingSummary(false);
    }
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

  const summaryText = aiSummary?.output
    ? typeof aiSummary.output === "string"
      ? aiSummary.output
      : typeof aiSummary.output === "object" && aiSummary.output !== null && "summary" in (aiSummary.output as Record<string, unknown>)
        ? String((aiSummary.output as Record<string, unknown>).summary)
        : JSON.stringify(aiSummary.output)
    : null;

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

      {/* AI Summary card */}
      <div>
        <h2 className="text-lg font-semibold mb-3">AI Summary</h2>
        <div className="bg-white rounded-lg border p-4">
          {summaryText ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{summaryText}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  Generated {aiSummary ? new Date(aiSummary.createdAt).toLocaleString() : ""}
                </span>
                <button
                  onClick={handleGenerateSummary}
                  disabled={generatingSummary}
                  className="text-xs px-3 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingSummary ? "Generating..." : "Regenerate Summary"}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-3 py-2">
              <p className="text-sm text-gray-500">No AI summary available yet.</p>
              <button
                onClick={handleGenerateSummary}
                disabled={generatingSummary}
                className="text-xs px-4 py-2 rounded bg-ai text-white hover:bg-ai/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingSummary ? "Generating..." : "Generate Summary"}
              </button>
            </div>
          )}
          {summaryError && (
            <p className="text-xs text-red-600 mt-2">{summaryError}</p>
          )}
        </div>
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
