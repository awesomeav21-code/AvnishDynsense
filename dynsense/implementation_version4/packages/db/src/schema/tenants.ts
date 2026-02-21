// Ref: FR-600 — tenants table (root table, not tenant-scoped)
// Ref: design-doc §5.1 — id, name, slug, settings (JSONB), plan_tier
import { pgTable, uuid, varchar, jsonb, timestamp } from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  settings: jsonb("settings").default({}),
  planTier: varchar("plan_tier", { length: 50 }).default("starter").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
