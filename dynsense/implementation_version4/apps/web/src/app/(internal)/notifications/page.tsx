"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}

interface User { id: string; name: string; email: string; role: string }
interface Task { id: string; title: string; projectId: string }

type FilterMode = "all" | "unread";

const typeBadgeStyles: Record<string, string> = {
  ai_nudge: "bg-blue-100 text-blue-700",
  ai_action_proposed: "bg-yellow-100 text-yellow-700",
  ai_action_executed: "bg-purple-100 text-purple-700",
  mention: "bg-green-100 text-green-700",
};

const typeLabels: Record<string, string> = {
  ai_nudge: "AI Nudge",
  ai_action_proposed: "Action Proposed",
  ai_action_executed: "Action Executed",
  mention: "Notification",
};

function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [markingReadIds, setMarkingReadIds] = useState<Set<string>>(new Set());
  const [markingAllRead, setMarkingAllRead] = useState(false);

  // Send notification form state
  const [showSendForm, setShowSendForm] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sendToUserId, setSendToUserId] = useState("");
  const [sendTaskId, setSendTaskId] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      setError("");
      const res = await api.getNotifications({ limit: 100 });
      setNotifications(res.data);
    } catch {
      setError("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Load current user ID
  useEffect(() => {
    api.getMe().then((me) => setCurrentUserId(me.id)).catch(() => {});
  }, []);

  // Load users and tasks when send form opens
  useEffect(() => {
    if (!showSendForm) return;
    Promise.all([api.getUsers(), api.getTasks({ limit: 200 })])
      .then(([usersRes, tasksRes]) => {
        setUsers(usersRes.data.filter((u: User & { status?: string }) => (u as { status?: string }).status !== "deactivated"));
        setTasks(tasksRes.data);
      })
      .catch(() => setError("Failed to load users or tasks"));
  }, [showSendForm]);

  async function handleSend() {
    if (!sendToUserId || !sendTaskId) return;
    setSending(true);
    setSendSuccess("");
    setError("");

    const task = tasks.find((t) => t.id === sendTaskId);
    const title = `Notification regarding "${task?.title ?? "a task"}"`;

    try {
      await api.sendNotification({
        userId: sendToUserId,
        title,
        body: sendMessage.trim() || undefined,
        taskId: sendTaskId,
      });
      const targetUser = users.find((u) => u.id === sendToUserId);
      setSendSuccess(`Notification sent to ${targetUser?.name ?? "user"}`);
      setSendToUserId("");
      setSendTaskId("");
      setSendMessage("");
      setTimeout(() => { setSendSuccess(""); setShowSendForm(false); }, 2000);
    } catch {
      setError("Failed to send notification");
    } finally {
      setSending(false);
    }
  }

  async function handleMarkRead(id: string) {
    setMarkingReadIds((prev) => new Set(prev).add(id));
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, readAt: new Date().toISOString() } : n
        )
      );
    } catch {
      setError("Failed to mark notification as read");
    } finally {
      setMarkingReadIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleMarkAllRead() {
    setMarkingAllRead(true);
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))
      );
    } catch {
      setError("Failed to mark all notifications as read");
    } finally {
      setMarkingAllRead(false);
    }
  }

  const unreadCount = notifications.filter((n) => n.readAt === null).length;
  const filtered =
    filter === "unread"
      ? notifications.filter((n) => n.readAt === null)
      : notifications;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-56 bg-gray-200 rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-7 w-16 bg-gray-200 rounded-full animate-pulse" />
          <div className="h-7 w-24 bg-gray-200 rounded-full animate-pulse" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-white rounded-lg border p-4 space-y-2 animate-pulse">
            <div className="flex items-center gap-2">
              <div className="h-4 w-20 bg-gray-200 rounded-full" />
              <div className="h-4 w-48 bg-gray-200 rounded" />
            </div>
            <div className="h-3 w-72 bg-gray-100 rounded" />
            <div className="h-3 w-24 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Notifications</h1>
          <button
            onClick={() => { setShowSendForm((prev) => !prev); setSendSuccess(""); }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-ai rounded-md hover:bg-ai/90 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Send Notification
          </button>
          {unreadCount > 0 && (
            <span className="text-xs text-blue-600">
              {unreadCount} unread
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAllRead}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            {markingAllRead ? "Marking..." : "Mark all read"}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">
          {error}
          <button onClick={() => setError("")} className="ml-2 text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}

      {/* Send Notification Form */}
      {showSendForm && (
        <div className="bg-white rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Send Notification</h3>
            <button onClick={() => setShowSendForm(false)} className="text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {sendSuccess && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
              {sendSuccess}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-1">To *</label>
              <select
                value={sendToUserId}
                onChange={(e) => setSendToUserId(e.target.value)}
                className="w-full text-xs px-2 py-1.5 border rounded-md"
              >
                <option value="">Select a team member</option>
                {users.filter((u) => u.id !== currentUserId).map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-1">Regarding Task *</label>
              <select
                value={sendTaskId}
                onChange={(e) => setSendTaskId(e.target.value)}
                className="w-full text-xs px-2 py-1.5 border rounded-md"
              >
                <option value="">Select a task</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-1">Message</label>
            <textarea
              value={sendMessage}
              onChange={(e) => setSendMessage(e.target.value)}
              placeholder="Add an optional message..."
              rows={3}
              className="w-full text-xs px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ai/50 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowSendForm(false)}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 border rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !sendToUserId || !sendTaskId}
              className="px-4 py-1.5 text-xs font-medium text-white bg-ai rounded-md hover:bg-ai/90 disabled:opacity-50 transition-colors"
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      )}

      {/* Filter Toggles */}
      <div className="flex gap-2">
        {(["all", "unread"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setFilter(mode)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              filter === mode
                ? "bg-ai text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {mode === "all"
              ? `All (${notifications.length})`
              : `Unread (${unreadCount})`}
          </button>
        ))}
      </div>

      {/* Notification List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border p-10 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">
            {notifications.length === 0
              ? "No notifications yet."
              : "All caught up! No unread notifications."}
          </p>
          {notifications.length === 0 && (
            <p className="text-xs text-gray-400 mt-1">
              Notifications will appear here when there is activity on your projects.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {filtered.map((notification) => {
            const isUnread = notification.readAt === null;
            const isMarking = markingReadIds.has(notification.id);
            const badgeStyle = typeBadgeStyles[notification.type] ?? "bg-gray-100 text-gray-600";
            const badgeLabel = typeLabels[notification.type] ?? notification.type;

            return (
              <div
                key={notification.id}
                className={`flex items-start gap-3 px-4 py-3 transition-colors ${isUnread ? "bg-blue-50/40" : ""}`}
              >
                <div className="flex-shrink-0 pt-1">
                  <div className={`w-2 h-2 rounded-full ${isUnread ? "bg-blue-500" : "bg-transparent"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badgeStyle}`}>
                      {badgeLabel}
                    </span>
                    <span className={`text-xs font-medium ${isUnread ? "text-gray-900" : "text-gray-600"}`}>
                      {notification.title}
                    </span>
                  </div>
                  {notification.body && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notification.body}</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">{formatRelativeTime(notification.createdAt)}</p>
                </div>
                {isUnread && (
                  <button
                    onClick={() => handleMarkRead(notification.id)}
                    disabled={isMarking}
                    className="flex-shrink-0 px-2 py-1 text-[10px] font-medium text-blue-700 bg-blue-100 rounded hover:bg-blue-200 disabled:opacity-50 transition-colors"
                  >
                    {isMarking ? "..." : "Mark read"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
