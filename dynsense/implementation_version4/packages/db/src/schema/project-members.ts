// Ref: FR-1202 — Tie clients to specific projects
import { pgTable, uuid, varchar, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { projects } from "./projects.js";
import { users } from "./users.js";

export const projectMembers = pgTable("project_members", {
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 50 }).notNull().default("client"),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.projectId, table.userId] }),
]);
