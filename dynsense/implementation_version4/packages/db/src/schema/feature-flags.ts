import { pgTable, uuid, varchar, boolean, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";

export const featureFlags = pgTable("feature_flags", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  key: varchar("key", { length: 100 }).notNull(),
  enabled: boolean("enabled").notNull().default(false),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("feature_flags_tenant_key_idx").on(table.tenantId, table.key),
]);
