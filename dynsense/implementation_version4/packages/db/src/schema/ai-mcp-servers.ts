// Ref: FR-625 — ai_mcp_servers table (NOT tenant-scoped — global registry)
// Ref: FR-324 — MCP registry for tool dispatch and server lifecycle
import { pgTable, uuid, varchar, jsonb, timestamp } from "drizzle-orm/pg-core";

export const aiMcpServers = pgTable("ai_mcp_servers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  transport: varchar("transport", { length: 50 }).notNull().default("stdio"),
  tools: jsonb("tools").default([]),
  config: jsonb("config").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
