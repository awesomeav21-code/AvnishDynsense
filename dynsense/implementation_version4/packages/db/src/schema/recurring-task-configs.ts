import { pgTable, uuid, varchar, jsonb, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { projects } from "./projects.js";

export const recurringTaskConfigs = pgTable("recurring_task_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 500 }).notNull(),
  description: varchar("description", { length: 2000 }),
  priority: varchar("priority", { length: 50 }).notNull().default("medium"),
  schedule: varchar("schedule", { length: 100 }).notNull(), // daily, weekly, monthly, or cron expression
  cronExpression: varchar("cron_expression", { length: 100 }),
  templateData: jsonb("template_data").$type<Record<string, unknown>>().default({}),
  enabled: boolean("enabled").notNull().default(true),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("recurring_tasks_tenant_idx").on(table.tenantId),
  index("recurring_tasks_project_idx").on(table.projectId),
  index("recurring_tasks_next_run_idx").on(table.nextRunAt),
]);
