// Ref: FR-624 — ai_hook_log table (tenant-scoped)
// Ref: FR-346 — audit-writer hook logs all hook decisions
// Ref: requirements §8.5 — 90-day retention
import { pgTable, uuid, varchar, timestamp, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";

export const aiHookLog = pgTable("ai_hook_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  hookName: varchar("hook_name", { length: 100 }).notNull(),
  phase: varchar("phase", { length: 50 }).notNull(),
  decision: varchar("decision", { length: 50 }).notNull(),
  reason: varchar("reason", { length: 1000 }),
  aiActionId: uuid("ai_action_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("ai_hook_log_tenant_idx").on(table.tenantId),
  index("ai_hook_log_tenant_action_idx").on(table.tenantId, table.aiActionId),
]);
