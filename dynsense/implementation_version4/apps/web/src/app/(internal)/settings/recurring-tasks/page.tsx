"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface RecurringTaskConfig {
  id: string;
  title: string;
  projectId: string;
  schedule: string;
  priority: string;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
}

interface Project {
  id: string;
  name: string;
  status: string;
  description: string | null;
  createdAt: string;
}

const SCHEDULES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RecurringTasksPage() {
  const [configs, setConfigs] = useState<RecurringTaskConfig[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Form state
  const [newTitle, setNewTitle] = useState("");
  const [newProjectId, setNewProjectId] = useState("");
  const [newSchedule, setNewSchedule] = useState("daily");
  const [newPriority, setNewPriority] = useState("medium");

  useEffect(() => {
    Promise.all([
      api.getRecurringTasks(),
      api.getProjects(),
    ])
      .then(([tasksRes, projectsRes]) => {
        setConfigs(tasksRes.data as RecurringTaskConfig[]);
        setProjects(projectsRes.data);
        if (projectsRes.data.length > 0) {
          setNewProjectId(projectsRes.data[0]!.id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!newTitle.trim() || !newProjectId) return;
    setSaving(true);
    try {
      await api.createRecurringTask({
        projectId: newProjectId,
        title: newTitle.trim(),
        priority: newPriority,
        schedule: newSchedule,
      });
      // Refresh the list
      const res = await api.getRecurringTasks();
      setConfigs(res.data as RecurringTaskConfig[]);
      setNewTitle("");
      setNewSchedule("daily");
      setNewPriority("medium");
      setShowAdd(false);
    } catch {
      // handle error
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleEnabled(config: RecurringTaskConfig) {
    setTogglingId(config.id);
    try {
      await api.updateRecurringTask(config.id, { enabled: !config.enabled });
      setConfigs((prev) =>
        prev.map((c) =>
          c.id === config.id ? { ...c, enabled: !c.enabled } : c
        )
      );
    } catch {
      // handle error
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteRecurringTask(id);
      setConfigs((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // handle error
    }
  }

  function getProjectName(projectId: string): string {
    return projects.find((p) => p.id === projectId)?.name ?? "Unknown";
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl">
        <h1 className="text-lg font-bold">Recurring Tasks</h1>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Recurring Tasks</h1>
          <p className="text-xs text-gray-500 mt-1">
            Configure tasks that are automatically created on a schedule
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
        >
          + Add Recurring Task
        </button>
      </div>

      {/* Create form */}
      {showAdd && (
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <h3 className="text-xs font-semibold">New Recurring Task</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 block mb-1">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Task title"
                className="w-full text-xs border rounded px-3 py-1.5"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Project</label>
              <select
                value={newProjectId}
                onChange={(e) => setNewProjectId(e.target.value)}
                className="w-full text-xs border rounded px-3 py-1.5"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Schedule</label>
              <select
                value={newSchedule}
                onChange={(e) => setNewSchedule(e.target.value)}
                className="w-full text-xs border rounded px-3 py-1.5"
              >
                {SCHEDULES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Priority</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value)}
                className="w-full text-xs border rounded px-3 py-1.5"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !newTitle.trim() || !newProjectId}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => {
                setShowAdd(false);
                setNewTitle("");
              }}
              className="text-xs text-gray-500 px-3 py-1.5 rounded hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {configs.length === 0 ? (
        <div className="text-center py-12 bg-white border rounded-lg">
          <p className="text-xs text-gray-500">No recurring tasks configured yet.</p>
          <p className="text-xs text-gray-400 mt-1">
            Click &quot;Add Recurring Task&quot; to set up automatic task creation.
          </p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Title</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Project</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Schedule</th>
                <th className="text-center text-xs font-medium text-gray-500 px-4 py-2">Enabled</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Next Run</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {configs.map((config) => (
                <tr key={config.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium">{config.title}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-600">{getProjectName(config.projectId)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-600 capitalize">{config.schedule}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggleEnabled(config)}
                      disabled={togglingId === config.id}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        config.enabled ? "bg-green-500" : "bg-gray-300"
                      } ${togglingId === config.id ? "opacity-50" : ""}`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          config.enabled ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-500">{formatDate(config.nextRunAt)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(config.id)}
                      className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
