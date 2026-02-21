// Ref: FR-641 — embeddings table for pgvector RAG context
// Ref: requirements §13.1 — 1536-dim, IVFFlat index (R0), HNSW (R3)
// Ref: design-doc §5.3 — IVFFlat for pgvector (R0-R2)
import { pgTable, uuid, varchar, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";

// Note: vector column requires custom SQL migration since Drizzle doesn't natively support pgvector.
// The vector(1536) column will be added via a custom migration.
export const embeddings = pgTable("embeddings", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  entityType: varchar("entity_type", { length: 100 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata").default({}),
  // embedding vector(1536) — added via custom migration
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("embeddings_tenant_entity_idx").on(table.tenantId, table.entityType, table.entityId),
]);
