// Ref: ARCHITECTURE 1.md §4.1 — task_statuses lookup table (R0 core)
// Replaces hardcoded status strings with tenant-configurable status values
import { pgTable, uuid, varchar, integer, timestamp, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";

export const taskStatuses = pgTable("task_statuses", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 50 }).notNull(),
  position: integer("position").notNull().default(0),
  color: varchar("color", { length: 20 }).notNull().default("#6B7280"),
  isFinal: varchar("is_final", { length: 5 }).notNull().default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("task_statuses_tenant_idx").on(table.tenantId),
  index("task_statuses_tenant_position_idx").on(table.tenantId, table.position),
]);
