// Ref: FR-121 — Status transitions: created → ready → in_progress → review → completed/blocked/cancelled
export type TaskStatus =
  | "created"
  | "ready"
  | "in_progress"
  | "review"
  | "completed"
  | "blocked"
  | "cancelled";

export type TaskPriority = "critical" | "high" | "medium" | "low";

// Ref: FR-124 — Task dependencies (DAG model)
export type DependencyType = "blocks" | "is_blocked_by";

export interface TaskSummary {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  dueDate: string | null;
  projectId: string;
}
