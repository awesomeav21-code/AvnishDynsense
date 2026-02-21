// Ref: FR-602 — projects table (tenant-scoped)
// Ref: FR-110 — CRUD projects with name, description, status, dates
// Ref: FR-112 — WBS baseline storage (JSONB)
// Ref: FR-113 — Soft delete with recovery window
import { pgTable, uuid, varchar, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  wbsBaseline: jsonb("wbs_baseline"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("projects_tenant_idx").on(table.tenantId),
  index("projects_tenant_status_idx").on(table.tenantId, table.status),
]);
