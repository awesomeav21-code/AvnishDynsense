"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

const ROLES = ["site_admin", "pm", "developer", "client"] as const;

const roleColors: Record<string, string> = {
  site_admin: "bg-purple-100 text-purple-700",
  pm: "bg-blue-100 text-blue-700",
  developer: "bg-green-100 text-green-700",
  client: "bg-gray-100 text-gray-600",
};

const ROLE_LABEL: Record<string, string> = {
  site_admin: "Admin",
  pm: "PM",
  developer: "Developer",
  client: "Client",
};

function permissionError(userRole: string, action: string): string {
  const label = ROLE_LABEL[userRole] ?? userRole;
  return `You are logged in as a ${label}. Only Admins and PMs can ${action}.`;
}

export default function TeamPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userRole, setUserRole] = useState<string>("");

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("developer");
  const [inviting, setInviting] = useState(false);

  // Role editing
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getUsers();
        setUsers(res.data);
      } catch {
        setError("Failed to load team members");
      }
      try {
        const meRes = await api.getMe();
        setUserRole(meRes.role);
      } catch {
        /* ignore */
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleInvite() {
    if (!inviteEmail.trim() || !inviteName.trim()) return;
    setInviting(true);
    setError("");
    try {
      const res = await api.inviteUser({ email: inviteEmail.trim(), name: inviteName.trim(), role: inviteRole });
      setUsers((prev) => [...prev, res.data as User]);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("developer");
      setShowInvite(false);
    } catch (err) {
      const msg = err instanceof Error && err.message.includes("Missing permission")
        ? permissionError(userRole, "invite team members")
        : err instanceof Error ? err.message : "Failed to invite user";
      setError(msg);
    } finally {
      setInviting(false);
    }
  }

  const handleRoleChange = useCallback(async (userId: string, newRole: string) => {
    setEditingRoleId(null);
    setSavingIds((prev) => new Set(prev).add(userId));
    const original = users.find((u) => u.id === userId);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u));
    try {
      await api.updateUserRole(userId, newRole);
    } catch (err) {
      if (original) setUsers((prev) => prev.map((u) => u.id === userId ? original : u));
      const msg = err instanceof Error && err.message.includes("Missing permission")
        ? permissionError(userRole, "update roles")
        : "Failed to update role";
      setError(msg);
    } finally {
      setSavingIds((prev) => { const n = new Set(prev); n.delete(userId); return n; });
    }
  }, [users]);

  const handleRemove = useCallback(async (userId: string, userName: string) => {
    if (!confirm(`Remove ${userName} from the team? They will be deactivated.`)) return;
    setSavingIds((prev) => new Set(prev).add(userId));
    try {
      await api.removeUser(userId);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, status: "deactivated" } : u));
    } catch (err) {
      const msg = err instanceof Error && err.message.includes("Missing permission")
        ? permissionError(userRole, "remove team members")
        : "Failed to remove user";
      setError(msg);
    } finally {
      setSavingIds((prev) => { const n = new Set(prev); n.delete(userId); return n; });
    }
  }, []);

  const activeUsers = users.filter((u) => u.status !== "deactivated");
  const deactivatedUsers = users.filter((u) => u.status === "deactivated");

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Team</h1>
        <button
          onClick={() => setShowInvite(true)}
          className="px-3 py-1.5 text-xs font-medium text-white bg-ai rounded-md hover:bg-ai/90"
        >
          + Invite Member
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">
          {error}
          <button onClick={() => setError("")} className="ml-2 text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}

      {/* Invite form */}
      {showInvite && (
        <div className="bg-white rounded-lg border p-4 space-y-3">
          <h3 className="text-xs font-semibold">Invite Team Member</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Full name"
              className="text-xs border rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ai/50"
              autoFocus
            />
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email address"
              className="text-xs border rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ai/50"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="text-xs border rounded px-3 py-1.5"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r.replace("_", " ")}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim() || !inviteName.trim()}
              className="px-3 py-1.5 text-xs font-medium text-white bg-ai rounded-md disabled:opacity-50"
            >
              {inviting ? "Inviting..." : "Send Invite"}
            </button>
            <button
              onClick={() => { setShowInvite(false); setInviteEmail(""); setInviteName(""); }}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 border rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Object.entries(
          activeUsers.reduce<Record<string, number>>((acc, u) => {
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

      {/* Active user list */}
      {activeUsers.length === 0 ? (
        <div className="text-sm text-gray-500 bg-white rounded-lg border p-6 text-center">
          No active team members. Invite someone to get started.
        </div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {activeUsers.map((user) => {
            const isSaving = savingIds.has(user.id);
            return (
              <div key={user.id} className={`flex items-center gap-4 px-4 py-3 ${isSaving ? "opacity-60" : ""}`}>
                <div className="w-8 h-8 rounded-full bg-ai/10 flex items-center justify-center text-xs font-medium text-ai">
                  {user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{user.name}</div>
                  <div className="text-xs text-gray-500">{user.email}</div>
                </div>

                {/* Role — click to edit */}
                {editingRoleId === user.id ? (
                  <select
                    autoFocus
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    onBlur={() => setTimeout(() => setEditingRoleId(null), 150)}
                    className="text-xs px-2 py-0.5 border rounded"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r.replace("_", " ")}</option>
                    ))}
                  </select>
                ) : (
                  <button
                    onClick={() => setEditingRoleId(user.id)}
                    className={`text-xs px-2 py-0.5 rounded-full capitalize cursor-pointer hover:ring-2 hover:ring-ai/30 transition-all ${roleColors[user.role] ?? "bg-gray-100 text-gray-600"}`}
                  >
                    {user.role.replace("_", " ")}
                  </button>
                )}

                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  user.status === "active" ? "bg-green-100 text-green-700" :
                  user.status === "invited" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"
                }`}>
                  {user.status}
                </span>

                <button
                  onClick={() => handleRemove(user.id, user.name)}
                  className="text-xs text-red-500 hover:text-red-700 px-2 py-1 transition-colors"
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Deactivated users */}
      {deactivatedUsers.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 mb-2">Deactivated ({deactivatedUsers.length})</h3>
          <div className="bg-white rounded-lg border divide-y opacity-60">
            {deactivatedUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-4 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-400">
                  {user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-500">{user.name}</div>
                  <div className="text-xs text-gray-400">{user.email}</div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">deactivated</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
