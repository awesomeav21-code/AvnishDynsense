import type { FastifyInstance } from "fastify";
import { eq, and, desc, inArray } from "drizzle-orm";
import { auditLog, users, tasks, projects } from "@dynsense/db";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";
import { z } from "zod";

const auditQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function auditRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

  app.addHook("preHandler", authenticate);

  // GET / — list audit log entries (admin/pm only)
  app.get("/", {
    preHandler: [requirePermission("audit:read")],
  }, async (request) => {
    const { tenantId } = request.jwtPayload;
    const query = auditQuerySchema.parse(request.query);

    const conditions = [eq(auditLog.tenantId, tenantId)];
    if (query.entityType) conditions.push(eq(auditLog.entityType, query.entityType));
    if (query.entityId) conditions.push(eq(auditLog.entityId, query.entityId));

    const rows = await db.select().from(auditLog)
      .where(and(...conditions))
      .orderBy(desc(auditLog.createdAt))
      .limit(query.limit)
      .offset(query.offset);

    // Resolve actor names and entity names for human-readable display
    const actorIds = [...new Set(rows.map((r) => r.actorId).filter(Boolean))] as string[];
    const entityIdsByType: Record<string, string[]> = {};
    for (const row of rows) {
      if (row.entityId) {
        const t = row.entityType;
        if (!entityIdsByType[t]) entityIdsByType[t] = [];
        if (!entityIdsByType[t]!.includes(row.entityId)) entityIdsByType[t]!.push(row.entityId);
      }
    }

    // Batch-fetch actor names
    const actorMap: Record<string, string> = {};
    if (actorIds.length > 0) {
      const actorRows = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, actorIds));
      for (const a of actorRows) actorMap[a.id] = a.name;
    }

    // Batch-fetch entity names by type
    const entityNameMap: Record<string, string> = {};
    if (entityIdsByType["task"]?.length) {
      const taskRows = await db.select({ id: tasks.id, title: tasks.title }).from(tasks).where(inArray(tasks.id, entityIdsByType["task"]!));
      for (const t of taskRows) entityNameMap[t.id] = t.title;
    }
    if (entityIdsByType["project"]?.length) {
      const projRows = await db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, entityIdsByType["project"]!));
      for (const p of projRows) entityNameMap[p.id] = p.name;
    }
    if (entityIdsByType["user"]?.length) {
      const userRows = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, entityIdsByType["user"]!));
      for (const u of userRows) entityNameMap[u.id] = u.name;
    }

    const enriched = rows.map((row) => ({
      ...row,
      actorName: row.actorId ? (actorMap[row.actorId] ?? null) : null,
      entityName: row.entityId ? (entityNameMap[row.entityId] ?? null) : null,
    }));

    return { data: enriched };
  });
}

// Helper to compute field-level diff between two objects (FR-140)
export function computeDiff(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
): Record<string, { old: unknown; new: unknown }> | null {
  const diff: Record<string, { old: unknown; new: unknown }> = {};

  for (const key of Object.keys(newObj)) {
    const oldVal = oldObj[key];
    const newVal = newObj[key];

    // Compare by JSON string to handle dates, nested objects, etc.
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diff[key] = { old: oldVal ?? null, new: newVal ?? null };
    }
  }

  return Object.keys(diff).length > 0 ? diff : null;
}

// Helper to write audit log entries from other routes
export async function writeAuditLog(
  db: ReturnType<typeof getDb>,
  entry: {
    tenantId: string;
    entityType: string;
    entityId: string;
    action: string;
    actorId: string;
    actorType?: string;
    diff?: unknown;
    aiActionId?: string;
  },
) {
  await db.insert(auditLog).values({
    tenantId: entry.tenantId,
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    actorId: entry.actorId,
    actorType: entry.actorType ?? "human",
    diff: entry.diff ?? null,
    aiActionId: entry.aiActionId,
  });
}
