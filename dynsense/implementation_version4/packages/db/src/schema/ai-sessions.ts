// Ref: FR-623 — ai_sessions table (tenant-scoped)
// Ref: FR-3003 — Resumable, forkable sessions with 30-day retention and parent_session_id
import { pgTable, uuid, varchar, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { users } from "./users.js";

export const aiSessions = pgTable("ai_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  capability: varchar("capability", { length: 50 }).notNull(),
  parentSessionId: uuid("parent_session_id"),
  turnCount: integer("turn_count").notNull().default(0),
  state: jsonb("state"),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("ai_sessions_tenant_user_idx").on(table.tenantId, table.userId),
  index("ai_sessions_tenant_capability_idx").on(table.tenantId, table.capability),
]);
