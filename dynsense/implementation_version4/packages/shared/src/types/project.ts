// Ref: FR-110 — CRUD projects with name, description, status, dates
export type ProjectStatus = "active" | "on_hold" | "completed" | "archived";

export interface ProjectSummary {
  id: string;
  name: string;
  status: ProjectStatus;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  tenantId: string;
}
