// Ref: ARCHITECTURE 1.md §4.1 — ai_session_events table (R0 AI)
// Tracks session lifecycle events: created, resumed, forked, terminated, expired
import { pgTable, uuid, varchar, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { aiSessions } from "./ai-sessions.js";

export const aiSessionEvents = pgTable("ai_session_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  sessionId: uuid("session_id").notNull().references(() => aiSessions.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("ai_session_events_session_idx").on(table.sessionId),
  index("ai_session_events_tenant_idx").on(table.tenantId),
]);
