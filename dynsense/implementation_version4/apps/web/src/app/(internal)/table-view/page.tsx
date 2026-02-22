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

interface User {
  id: string;
  name: string;
  email: string;
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

type SortField = "title" | "status" | "priority" | "dueDate" | "assignee";
type SortDir = "asc" | "desc";

const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const statusOrder: Record<string, number> = {
  blocked: 0, in_progress: 1, review: 2, ready: 3, created: 4, completed: 5, cancelled: 6,
};

export default function TableViewPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    Promise.all([
      api.getTasks({ limit: 500 }),
      api.getUsers(),
    ])
      .then(([tasksRes, usersRes]) => {
        setTasks(tasksRes.data);
        setUsers(usersRes.data);
      })
      .catch(() => setError("Failed to load data"))
      .finally(() => setLoading(false));
  }, []);

  const userMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const u of users) m[u.id] = u.name;
    return m;
  }, [users]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    const arr = [...tasks];
    const dir = sortDir === "asc" ? 1 : -1;

    arr.sort((a, b) => {
      switch (sortField) {
        case "title":
          return dir * a.title.localeCompare(b.title);
        case "status":
          return dir * ((statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));
        case "priority":
          return dir * ((priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9));
        case "dueDate": {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return dir;
          if (!b.dueDate) return -dir;
          return dir * (new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        }
        case "assignee": {
          const aName = a.assigneeId ? (userMap[a.assigneeId] ?? "") : "";
          const bName = b.assigneeId ? (userMap[b.assigneeId] ?? "") : "";
          return dir * aName.localeCompare(bName);
        }
        default:
          return 0;
      }
    });
    return arr;
  }, [tasks, sortField, sortDir, userMap]);

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) {
      return <span className="text-gray-300 ml-1">&udarr;</span>;
    }
    return <span className="text-ai ml-1">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="bg-white rounded-lg border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 border-b animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Table View</h1>
        <span className="text-xs text-gray-400">{tasks.length} tasks</span>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</div>
      )}

      {tasks.length === 0 ? (
        <div className="text-sm text-gray-500 bg-white rounded-lg border p-6 text-center">
          No tasks found. Create tasks in a project to see them here.
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th
                  className="text-left px-4 py-2.5 font-semibold text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                  onClick={() => handleSort("title")}
                >
                  Title <SortIcon field="title" />
                </th>
                <th
                  className="text-left px-4 py-2.5 font-semibold text-gray-600 cursor-pointer hover:text-gray-900 select-none w-28"
                  onClick={() => handleSort("status")}
                >
                  Status <SortIcon field="status" />
                </th>
                <th
                  className="text-left px-4 py-2.5 font-semibold text-gray-600 cursor-pointer hover:text-gray-900 select-none w-24"
                  onClick={() => handleSort("priority")}
                >
                  Priority <SortIcon field="priority" />
                </th>
                <th
                  className="text-left px-4 py-2.5 font-semibold text-gray-600 cursor-pointer hover:text-gray-900 select-none w-28"
                  onClick={() => handleSort("dueDate")}
                >
                  Due Date <SortIcon field="dueDate" />
                </th>
                <th
                  className="text-left px-4 py-2.5 font-semibold text-gray-600 cursor-pointer hover:text-gray-900 select-none w-36"
                  onClick={() => handleSort("assignee")}
                >
                  Assignee <SortIcon field="assignee" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sorted.map((task) => (
                <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5">
                    <Link href={`/tasks/${task.id}`} className="text-gray-900 font-medium hover:text-ai transition-colors">
                      {task.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${statusColors[task.status] ?? ""}`}>
                      {task.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap capitalize ${priorityColors[task.priority] ?? ""}`}>
                      {task.priority}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {task.dueDate ? (
                      <span className={
                        new Date(task.dueDate) < new Date() && task.status !== "completed" && task.status !== "cancelled"
                          ? "text-red-500 font-medium"
                          : "text-gray-500"
                      }>
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-gray-300">&mdash;</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {task.assigneeId ? (
                      <span className="text-gray-700">{userMap[task.assigneeId] ?? "Unknown"}</span>
                    ) : (
                      <span className="text-gray-300">Unassigned</span>
                    )}
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
