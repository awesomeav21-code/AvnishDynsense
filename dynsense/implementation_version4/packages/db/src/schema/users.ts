// Ref: FR-601 — users table (tenant-scoped membership)
// Ref: FR-100 — email + password_hash (bcrypt cost 12+)
// Ref: FR-104 — role: site_admin, pm, developer, client
// Ref: requirements §8.4 — unique constraint (tenant_id, account_id)
import { pgTable, uuid, varchar, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { accounts } from "./accounts.js";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull().default("developer"),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  refreshToken: varchar("refresh_token", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("users_tenant_email_idx").on(table.tenantId, table.email),
  uniqueIndex("users_tenant_account_idx").on(table.tenantId, table.accountId),
  index("users_account_idx").on(table.accountId),
]);
