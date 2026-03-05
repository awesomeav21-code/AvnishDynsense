// Ref: ARCHITECTURE 1.md §4.1 — priorities lookup table (R0 core)
// Replaces hardcoded priority strings with tenant-configurable priority levels
import { pgTable, uuid, varchar, integer, timestamp, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";

export const priorities = pgTable("priorities", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 50 }).notNull(),
  position: integer("position").notNull().default(0),
  color: varchar("color", { length: 20 }).notNull().default("#6B7280"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("priorities_tenant_idx").on(table.tenantId),
  index("priorities_tenant_position_idx").on(table.tenantId, table.position),
]);
