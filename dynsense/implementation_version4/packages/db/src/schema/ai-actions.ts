// Ref: FR-620 — ai_actions table (tenant-scoped)
// Ref: FR-200 — 7-stage orchestration pipeline result storage
// Ref: FR-304 — Rollback data stored as pre-action snapshot
import { pgTable, uuid, varchar, jsonb, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { users } from "./users.js";

export const aiActions = pgTable("ai_actions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  capability: varchar("capability", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  disposition: varchar("disposition", { length: 50 }).notNull().default("propose"),
  input: jsonb("input"),
  output: jsonb("output"),
  confidence: numeric("confidence"),
  triggeredBy: uuid("triggered_by").references(() => users.id, { onDelete: "set null" }),
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  rollbackData: jsonb("rollback_data"),
  sessionId: uuid("session_id"),
  errorMessage: varchar("error_message", { length: 2000 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("ai_actions_tenant_capability_idx").on(table.tenantId, table.capability),
  index("ai_actions_tenant_status_idx").on(table.tenantId, table.status),
]);
