// Ref: FR-604 — task_assignments table (tenant-scoped)
// Ref: FR-122 — Task assignment to one or more users
import { pgTable, uuid, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { tasks } from "./tasks.js";
import { users } from "./users.js";

export const taskAssignments = pgTable("task_assignments", {
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.taskId, table.userId] }),
]);
