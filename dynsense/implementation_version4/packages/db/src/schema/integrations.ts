import { pgTable, uuid, varchar, jsonb, timestamp, index, boolean } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";

export const integrations = pgTable("integrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  provider: varchar("provider", { length: 50 }).notNull(), // github, slack, teams
  enabled: boolean("enabled").notNull().default(false),
  config: jsonb("config").$type<Record<string, unknown>>().default({}),
  credentials: jsonb("credentials").$type<Record<string, unknown>>().default({}),
  channelMapping: jsonb("channel_mapping").$type<Record<string, string>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("integrations_tenant_provider_idx").on(table.tenantId, table.provider),
]);
