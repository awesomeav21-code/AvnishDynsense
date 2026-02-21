// Ref: FR-621 — ai_cost_log table (tenant-scoped)
// Ref: FR-363 — Per-tenant cost tracking with daily/monthly rollups
import { pgTable, uuid, varchar, integer, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { aiActions } from "./ai-actions.js";

export const aiCostLog = pgTable("ai_cost_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  aiActionId: uuid("ai_action_id").notNull().references(() => aiActions.id, { onDelete: "cascade" }),
  model: varchar("model", { length: 50 }).notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  costUsd: numeric("cost_usd", { precision: 10, scale: 6 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("ai_cost_log_tenant_idx").on(table.tenantId),
  index("ai_cost_log_tenant_created_idx").on(table.tenantId, table.createdAt),
]);
