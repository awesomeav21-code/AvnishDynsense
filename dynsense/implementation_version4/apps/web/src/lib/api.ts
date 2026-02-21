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

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
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

  updateTaskStatus(id: string, status: string) {
    return this.request(`/tasks/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
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
