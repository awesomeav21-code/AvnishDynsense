// Ref: FR-603 — tasks table (tenant-scoped)
// Ref: FR-120 — CRUD tasks with full field set
// Ref: FR-121 — Status transitions
// Ref: FR-123 — Sub-tasks (single-level nesting) via parent_task_id
// Ref: FR-113 — Soft delete
import { pgTable, uuid, varchar, text, integer, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { projects } from "./projects.js";
import { phases } from "./phases.js";
import { users } from "./users.js";

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  phaseId: uuid("phase_id").references(() => phases.id, { onDelete: "set null" }),
  parentTaskId: uuid("parent_task_id"),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).notNull().default("created"),
  priority: varchar("priority", { length: 50 }).notNull().default("medium"),
  assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
  estimatedEffort: numeric("estimated_effort"),
  actualEffort: numeric("actual_effort"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("tasks_tenant_project_idx").on(table.tenantId, table.projectId),
  index("tasks_tenant_status_idx").on(table.tenantId, table.status),
  index("tasks_tenant_assignee_idx").on(table.tenantId, table.assigneeId),
  index("tasks_tenant_priority_idx").on(table.tenantId, table.priority),
  index("tasks_parent_task_idx").on(table.parentTaskId),
]);
