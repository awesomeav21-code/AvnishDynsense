// Ref: FR-604 — task_assignments table (tenant-scoped)
// Ref: FR-122 — Task assignment to one or more users
import { pgTable, uuid, timestamp } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { tasks } from "./tasks.js";
import { users } from "./users.js";

export const taskAssignments = pgTable("task_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
});
