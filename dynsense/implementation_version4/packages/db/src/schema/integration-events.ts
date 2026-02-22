import { pgTable, uuid, varchar, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { tasks } from "./tasks.js";

export const integrationEvents = pgTable("integration_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  provider: varchar("provider", { length: 50 }).notNull(),
  eventType: varchar("event_type", { length: 100 }).notNull(), // push, pull_request, merge, etc.
  externalId: varchar("external_id", { length: 255 }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("integration_events_tenant_idx").on(table.tenantId),
  index("integration_events_task_idx").on(table.taskId),
  index("integration_events_provider_idx").on(table.provider, table.eventType),
]);
