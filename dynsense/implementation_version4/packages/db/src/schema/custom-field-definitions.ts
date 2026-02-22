import { pgTable, uuid, varchar, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { projects } from "./projects.js";

export const customFieldDefinitions = pgTable("custom_field_definitions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  fieldType: varchar("field_type", { length: 50 }).notNull(),
  config: jsonb("config"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("custom_fields_tenant_project_idx").on(table.tenantId, table.projectId),
]);
