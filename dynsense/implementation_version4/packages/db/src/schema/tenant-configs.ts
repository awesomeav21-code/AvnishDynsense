// Ref: design-doc §5.1 — tenant_configs (admin-configurable key-value per tenant)
import { pgTable, uuid, varchar, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";

export const tenantConfigs = pgTable("tenant_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  key: varchar("key", { length: 255 }).notNull(),
  value: jsonb("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("tenant_configs_tenant_key_idx").on(table.tenantId, table.key),
]);
