const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

class ApiClient {
  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("accessToken");
  }

  private getRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("refreshToken");
  }

  setTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
  }

  clearTokens() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) ?? {}),
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (res.status === 401 && this.getRefreshToken()) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        headers["Authorization"] = `Bearer ${this.getToken()}`;
        const retry = await fetch(`${API_BASE}${path}`, { ...options, headers });
        if (!retry.ok) {
          const err = await retry.json().catch(() => ({}));
          throw new ApiError(retry.status, err.message ?? "Request failed", err.error);
        }
        return retry.json() as Promise<T>;
      }
      this.clearTokens();
      window.location.href = "/login";
      throw new ApiError(401, "Session expired");
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(res.status, err.message ?? "Request failed", err.error);
    }

    return res.json() as Promise<T>;
  }

  private async tryRefresh(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      this.setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    }
  }

  // Auth
  login(email: string, password: string) {
    return this.request<{
      accessToken: string;
      refreshToken: string;
      user: { id: string; email: string; name: string; role: string; tenantId: string };
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  register(data: { email: string; password: string; name: string; tenantId?: string }) {
    return this.request<{
      accessToken: string;
      refreshToken: string;
      user: { id: string; email: string; name: string; role: string; tenantId: string };
    }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  getMe() {
    return this.request<{ id: string; email: string; name: string; role: string; tenantId: string }>("/auth/me");
  }

  // Projects
  getProjects() {
    return this.request<{ data: Array<{ id: string; name: string; status: string; description: string | null; createdAt: string }> }>("/projects");
  }

  getProject(id: string) {
    return this.request<{ data: { id: string; name: string; status: string; description: string | null; startDate: string | null; endDate: string | null } }>(`/projects/${id}`);
  }

  createProject(data: { name: string; description?: string }) {
    return this.request<{ data: { id: string; name: string } }>("/projects", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Tasks
  getTasks(params?: { projectId?: string; status?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params?.projectId) query.set("projectId", params.projectId);
    if (params?.status) query.set("status", params.status);
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));
    const qs = query.toString();
    return this.request<{ data: Array<{ id: string; title: string; status: string; priority: string; assigneeId: string | null; dueDate: string | null; projectId: string }> }>(`/tasks${qs ? `?${qs}` : ""}`);
  }

  getTaskStats(projectId?: string) {
    const qs = projectId ? `?projectId=${projectId}` : "";
    return this.request<{ data: Array<{ status: string; count: number }> }>(`/tasks/stats${qs}`);
  }

  getTask(id: string) {
    return this.request<{ data: { id: string; title: string; description: string | null; status: string; priority: string; assigneeId: string | null; dueDate: string | null; projectId: string; estimatedEffort: string | null; createdAt: string; updatedAt: string } }>(`/tasks/${id}`);
  }

  createTask(data: { projectId: string; title: string; description?: string; priority?: string; dueDate?: string; estimatedEffort?: number }) {
    return this.request<{ data: { id: string; title: string } }>("/tasks", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  updateTask(id: string, data: { title?: string; description?: string; priority?: string; dueDate?: string; estimatedEffort?: number }) {
    return this.request(`/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  updateTaskStatus(id: string, status: string) {
    return this.request(`/tasks/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
  }

  deleteTask(id: string) {
    return this.request(`/tasks/${id}`, { method: "DELETE" });
  }

  getWhatsNext() {
    return this.request<{ data: Array<{ id: string; title: string; status: string; priority: string; dueDate: string | null; projectId: string; reason: string }> }>("/tasks/whats-next");
  }

  // Comments
  getComments(taskId: string) {
    return this.request<{ data: Array<{ id: string; body: string; authorId: string; createdAt: string }> }>(`/comments/task/${taskId}`);
  }

  addComment(taskId: string, body: string) {
    return this.request<{ data: { id: string; body: string; authorId: string; createdAt: string } }>("/comments", {
      method: "POST",
      body: JSON.stringify({ taskId, body }),
    });
  }

  // Checklists
  getChecklists(taskId: string) {
    return this.request<{ data: Array<{ id: string; title: string; items: Array<{ id: string; label: string; completed: boolean }>; completionPercent: number }> }>(`/checklists/task/${taskId}`);
  }

  createChecklist(taskId: string, title: string) {
    return this.request<{ data: { id: string; title: string } }>("/checklists", {
      method: "POST",
      body: JSON.stringify({ taskId, title }),
    });
  }

  addChecklistItem(checklistId: string, label: string) {
    return this.request<{ data: { id: string; label: string; completed: boolean } }>(`/checklists/${checklistId}/items`, {
      method: "POST",
      body: JSON.stringify({ label }),
    });
  }

  toggleChecklistItem(itemId: string, completed: boolean) {
    return this.request(`/checklists/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify({ completed }),
    });
  }

  // Assignments
  getAssignments(taskId: string) {
    return this.request<{ data: Array<{ userId: string; userName: string; userEmail: string; role: string; assignedAt: string }> }>(`/assignments/task/${taskId}`);
  }

  assignTask(taskId: string, userId: string) {
    return this.request(`/assignments/task/${taskId}`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  }

  // Dependencies
  getDependencies(taskId: string) {
    return this.request<{ data: Array<{ id: string; blockerTaskId: string; blockedTaskId: string; type: string }> }>(`/dependencies/task/${taskId}`);
  }

  addDependency(blockerTaskId: string, blockedTaskId: string) {
    return this.request("/dependencies", {
      method: "POST",
      body: JSON.stringify({ blockerTaskId, blockedTaskId }),
    });
  }

  // Users
  getUsers() {
    return this.request<{ data: Array<{ id: string; name: string; email: string; role: string; status: string }> }>("/users");
  }

  // Audit
  getAuditLog(params?: { entityType?: string; entityId?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params?.entityType) query.set("entityType", params.entityType);
    if (params?.entityId) query.set("entityId", params.entityId);
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));
    const qs = query.toString();
    return this.request<{ data: Array<{ id: string; action: string; entityType: string; entityId: string; userId: string; createdAt: string }> }>(`/audit${qs ? `?${qs}` : ""}`);
  }

  // AI
  executeAi(capability: string, input: Record<string, unknown>, sessionId?: string) {
    return this.request<{ data: { id: string; capability: string; status: string; disposition: string; output: unknown; confidence: string | null; createdAt: string } }>("/ai/execute", {
      method: "POST",
      body: JSON.stringify({ capability, input, sessionId }),
    });
  }

  getAiActions(params?: { status?: string; capability?: string; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.capability) query.set("capability", params.capability);
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return this.request<{ data: Array<{ id: string; capability: string; status: string; disposition: string; output: unknown; confidence: string | null; input: unknown; createdAt: string; updatedAt: string }> }>(`/ai/actions${qs ? `?${qs}` : ""}`);
  }

  getAiAction(id: string) {
    return this.request<{ data: { id: string; capability: string; status: string; disposition: string; output: unknown; confidence: string | null; input: unknown; createdAt: string; updatedAt: string; reviewedBy: string | null } }>(`/ai/actions/${id}`);
  }

  reviewAiAction(id: string, action: "approve" | "reject" | "edit", editedOutput?: Record<string, unknown>) {
    return this.request<{ data: { id: string; status: string } }>(`/ai/actions/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ action, editedOutput }),
    });
  }

  rollbackAiAction(id: string) {
    return this.request<{ data: { id: string; status: string } }>(`/ai/actions/${id}/rollback`, {
      method: "POST",
    });
  }

  getShadowActions(params?: { limit?: number }) {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    query.set("disposition", "shadow");
    const qs = query.toString();
    return this.request<{ data: Array<{ id: string; capability: string; status: string; disposition: string; output: unknown; confidence: string | null; input: unknown; createdAt: string; updatedAt: string }> }>(`/ai/actions/shadow?${qs}`);
  }

  // Notifications
  getNotifications(params?: { type?: string; unread?: boolean; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.type) query.set("type", params.type);
    if (params?.unread !== undefined) query.set("unread", String(params.unread));
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return this.request<{ data: Array<{ id: string; type: string; title: string; body: string | null; data: unknown; readAt: string | null; createdAt: string }> }>(`/notifications${qs ? `?${qs}` : ""}`);
  }

  markNotificationRead(id: string) {
    return this.request<{ data: { id: string; readAt: string } }>(`/notifications/${id}/read`, {
      method: "POST",
    });
  }

  markAllNotificationsRead() {
    return this.request<{ message: string }>("/notifications/read-all", {
      method: "POST",
    });
  }

  // Saved Views
  getSavedViews() {
    return this.request<{ data: Array<{ id: string; name: string; viewType: string; filters: unknown; sort: unknown; columns: unknown; createdAt: string; updatedAt: string }> }>("/views");
  }

  createSavedView(data: { name: string; viewType: string; filters?: unknown; sort?: unknown; columns?: unknown }) {
    return this.request<{ data: { id: string; name: string; viewType: string } }>("/views", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  deleteSavedView(id: string) {
    return this.request(`/views/${id}`, { method: "DELETE" });
  }

  // Integrations (R1-2)
  getIntegrations() {
    return this.request<{ data: Array<{ id: string; provider: string; enabled: boolean; config: unknown; channelMapping: unknown; createdAt: string }> }>("/integrations");
  }

  upsertIntegration(data: { provider: string; enabled?: boolean; config?: Record<string, unknown>; channelMapping?: Record<string, string> }) {
    return this.request<{ data: { id: string; provider: string; enabled: boolean } }>("/integrations", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  getIntegrationEvents(params?: { provider?: string; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.provider) query.set("provider", params.provider);
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return this.request<{ data: Array<{ id: string; provider: string; eventType: string; taskId: string | null; createdAt: string }> }>(`/integrations/events${qs ? `?${qs}` : ""}`);
  }

  // Tags (R1-6)
  getTags() {
    return this.request<{ data: Array<{ id: string; name: string; color: string; createdAt: string }> }>("/tags");
  }

  createTag(data: { name: string; color?: string }) {
    return this.request<{ data: { id: string; name: string; color: string } }>("/tags", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  deleteTag(id: string) {
    return this.request(`/tags/${id}`, { method: "DELETE" });
  }

  getTaskTags(taskId: string) {
    return this.request<{ data: Array<{ id: string; name: string; color: string }> }>(`/tags/task/${taskId}`);
  }

  addTagToTask(taskId: string, tagId: string) {
    return this.request("/tags/task", {
      method: "POST",
      body: JSON.stringify({ taskId, tagId }),
    });
  }

  removeTagFromTask(taskId: string, tagId: string) {
    return this.request(`/tags/task/${taskId}/${tagId}`, { method: "DELETE" });
  }

  // Search (R1-6)
  search(q: string, type?: "all" | "tasks" | "projects" | "comments") {
    const query = new URLSearchParams({ q });
    if (type) query.set("type", type);
    return this.request<{ data: Array<{ type: string; id: string; title: string; description: string | null }>; total: number }>(`/search?${query}`);
  }

  // Feature Flags (R1-5)
  getFeatureFlags() {
    return this.request<{ data: Record<string, { enabled: boolean; metadata: Record<string, unknown> }> }>("/feature-flags");
  }

  checkFeatureFlag(key: string) {
    return this.request<{ data: { key: string; enabled: boolean } }>(`/feature-flags/${key}`);
  }

  upsertFeatureFlag(data: { key: string; enabled: boolean; metadata?: Record<string, unknown> }) {
    return this.request<{ data: { id: string; key: string; enabled: boolean } }>("/feature-flags", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // Recurring Tasks (R1-6)
  getRecurringTasks(projectId?: string) {
    const qs = projectId ? `?projectId=${projectId}` : "";
    return this.request<{ data: Array<{ id: string; title: string; schedule: string; enabled: boolean; nextRunAt: string | null; lastRunAt: string | null }> }>(`/recurring-tasks${qs}`);
  }

  createRecurringTask(data: { projectId: string; title: string; description?: string; priority?: string; schedule: string; cronExpression?: string }) {
    return this.request<{ data: { id: string; title: string; schedule: string } }>("/recurring-tasks", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  deleteRecurringTask(id: string) {
    return this.request(`/recurring-tasks/${id}`, { method: "DELETE" });
  }

  runRecurringTasks() {
    return this.request<{ data: Array<{ id: string; title: string }>; message: string }>("/recurring-tasks/run", {
      method: "POST",
    });
  }

  // Reminders (R1-6)
  getReminders() {
    return this.request<{ data: Array<{ id: string; taskId: string; remindAt: string; channel: string; sentAt: string | null }> }>("/reminders");
  }

  createReminder(data: { taskId: string; remindAt: string; channel?: string }) {
    return this.request<{ data: { id: string; taskId: string; remindAt: string } }>("/reminders", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  deleteReminder(id: string) {
    return this.request(`/reminders/${id}`, { method: "DELETE" });
  }

  // Cron / AI PM Agent (R1-3)
  runAiPmLoop() {
    return this.request<{ data: { overdueTasks: number; stalledTasks: number; nudgesSent: number; escalationProposals: number } }>("/cron/ai-pm-loop", {
      method: "POST",
    });
  }

  runScopeCheck(projectId: string) {
    return this.request<{ data: { id: string; capability: string; status: string; output: unknown } }>("/cron/scope-check", {
      method: "POST",
      body: JSON.stringify({ projectId }),
    });
  }

  // AI Decisions
  getAiDecisions(params?: { limit?: number }) {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return this.request<{ data: Array<{ aiActionId: string; capability: string; hookName: string; phase: string; decision: string; reason: string | null; createdAt: string }> }>(`/ai/decisions${qs ? `?${qs}` : ""}`);
  }

  // Logout
  logout() {
    return this.request("/auth/logout", { method: "POST" });
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const api = new ApiClient();
