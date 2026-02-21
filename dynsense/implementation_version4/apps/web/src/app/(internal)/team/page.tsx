"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

const roleColors: Record<string, string> = {
  site_admin: "bg-purple-100 text-purple-700",
  pm: "bg-blue-100 text-blue-700",
  developer: "bg-green-100 text-green-700",
  client: "bg-gray-100 text-gray-600",
};

export default function TeamPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getUsers()
      .then((res) => setUsers(res.data))
      .catch(() => setError("Failed to load team members"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-white rounded border animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Team</h1>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Object.entries(
          users.reduce<Record<string, number>>((acc, u) => {
            acc[u.role] = (acc[u.role] ?? 0) + 1;
            return acc;
          }, {})
        ).map(([role, count]) => (
          <div key={role} className="bg-white rounded-lg border p-4">
            <div className="text-xs text-gray-500 capitalize">{role.replace("_", " ")}s</div>
            <div className="text-xl font-bold mt-1">{count}</div>
          </div>
        ))}
      </div>

      {/* User list */}
      {users.length === 0 ? (
        <div className="text-sm text-gray-500 bg-white rounded-lg border p-6 text-center">
          No team members found.
        </div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {users.map((user) => (
            <div key={user.id} className="flex items-center gap-4 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-ai/10 flex items-center justify-center text-xs font-medium text-ai">
                {user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">{user.name}</div>
                <div className="text-xs text-gray-500">{user.email}</div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${roleColors[user.role] ?? "bg-gray-100 text-gray-600"}`}>
                {user.role.replace("_", " ")}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                user.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}>
                {user.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
