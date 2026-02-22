import type { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { auditLog } from "@dynsense/db";
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

    return { data: rows };
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
