// Ref: FR-610 — audit_log table (tenant-scoped, IMMUTABLE)
// Ref: FR-140 — Field-level audit trail on all mutations
// Ref: FR-141 — Actor type tracking (human vs AI)
// Ref: FR-142 — Immutable (UPDATE/DELETE blocked at DB level via trigger)
// Ref: FR-143 — AI action traceability via ai_action_id
// Ref: requirements §8.5 — 7-year retention, archive to S3 Glacier after 1 year
import { pgTable, uuid, varchar, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  entityType: varchar("entity_type", { length: 100 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  actorId: uuid("actor_id"),
  actorType: varchar("actor_type", { length: 20 }).notNull().default("human"),
  diff: jsonb("diff"),
  aiActionId: uuid("ai_action_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("audit_log_tenant_entity_idx").on(table.tenantId, table.entityType, table.entityId),
  index("audit_log_tenant_created_idx").on(table.tenantId, table.createdAt),
]);
