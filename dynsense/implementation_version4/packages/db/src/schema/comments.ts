// Ref: FR-606 — comments table (tenant-scoped)
// Ref: FR-128 — Comments with @mention parsing
// Ref: FR-129 — Client-visible comment filtering (R2)
import { pgTable, uuid, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { tasks } from "./tasks.js";
import { users } from "./users.js";

export const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  body: text("body").notNull(),
  clientVisible: boolean("client_visible").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("comments_tenant_task_idx").on(table.tenantId, table.taskId),
]);
