// Ref: FR-605 — task_dependencies table (tenant-scoped)
// Ref: FR-124 — Task dependencies (DAG model) with circular detection via BFS
// Ref: requirements §8.4 — unique constraint (blocker_task_id, blocked_task_id)
import { pgTable, uuid, varchar, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { tasks } from "./tasks.js";

export const taskDependencies = pgTable("task_dependencies", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  blockerTaskId: uuid("blocker_task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  blockedTaskId: uuid("blocked_task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull().default("blocks"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("task_deps_blocker_blocked_idx").on(table.blockerTaskId, table.blockedTaskId),
  index("task_deps_tenant_idx").on(table.tenantId),
]);
