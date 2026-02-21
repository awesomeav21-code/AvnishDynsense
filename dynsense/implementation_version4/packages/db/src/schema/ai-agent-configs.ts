// Ref: FR-622 — ai_agent_configs table (tenant-scoped)
// Ref: FR-3001 — Subagent definitions with model, max turns, permission mode
import { pgTable, uuid, varchar, integer, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";

export const aiAgentConfigs = pgTable("ai_agent_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  capability: varchar("capability", { length: 50 }).notNull(),
  modelOverride: varchar("model_override", { length: 50 }),
  maxTurns: integer("max_turns"),
  permissionMode: varchar("permission_mode", { length: 50 }),
  systemPromptExtension: varchar("system_prompt_extension", { length: 5000 }),
  toolRestrictions: jsonb("tool_restrictions"),
  enabled: varchar("enabled", { length: 10 }).notNull().default("true"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("ai_agent_configs_tenant_capability_idx").on(table.tenantId, table.capability),
]);
