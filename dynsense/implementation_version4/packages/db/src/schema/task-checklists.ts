// Ref: FR-608 — task_checklists table (tenant-scoped)
// Ref: FR-127 — Task checklists with groups, items, completion percentage
import { pgTable, uuid, varchar, integer, timestamp, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { tasks } from "./tasks.js";

export const taskChecklists = pgTable("task_checklists", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("checklists_tenant_task_idx").on(table.tenantId, table.taskId),
]);
