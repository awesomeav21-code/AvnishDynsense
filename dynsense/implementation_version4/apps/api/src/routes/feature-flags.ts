// Ref: FR-721 — Feature flags — gate capabilities by plan tier
// Ref: FR-902 — Feature flag infrastructure: tenant-level gating
import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { featureFlags } from "@dynsense/db";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";
import { z } from "zod";

const upsertFlagSchema = z.object({
  key: z.string().min(1).max(100),
  enabled: z.boolean(),
  metadata: z.record(z.unknown()).optional(),
});

export async function featureFlagRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

  app.addHook("preHandler", authenticate);

  // GET / — list all feature flags for tenant
  app.get("/", async (request) => {
    const { tenantId } = request.jwtPayload;
    const rows = await db.select().from(featureFlags)
      .where(eq(featureFlags.tenantId, tenantId));

    // Return as key-value map
    const flags: Record<string, { enabled: boolean; metadata: Record<string, unknown> }> = {};
    for (const row of rows) {
      flags[row.key] = { enabled: row.enabled, metadata: (row.metadata ?? {}) as Record<string, unknown> };
    }
    return { data: flags };
  });

  // GET /:key — check a single feature flag
  app.get("/:key", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { key } = request.params as { key: string };

    const flag = await db.query.featureFlags.findFirst({
      where: and(eq(featureFlags.tenantId, tenantId), eq(featureFlags.key, key)),
    });

    return { data: { key, enabled: flag?.enabled ?? false } };
  });

  // PUT / — upsert a feature flag (admin only)
  app.put("/", {
    preHandler: [requirePermission("config:manage")],
  }, async (request) => {
    const { tenantId } = request.jwtPayload;
    const body = upsertFlagSchema.parse(request.body);

    const existing = await db.query.featureFlags.findFirst({
      where: and(eq(featureFlags.tenantId, tenantId), eq(featureFlags.key, body.key)),
    });

    if (existing) {
      const [updated] = await db.update(featureFlags)
        .set({
          enabled: body.enabled,
          metadata: body.metadata ?? existing.metadata,
          updatedAt: new Date(),
        })
        .where(eq(featureFlags.id, existing.id))
        .returning();
      return { data: updated };
    }

    const [created] = await db.insert(featureFlags).values({
      tenantId,
      key: body.key,
      enabled: body.enabled,
      metadata: body.metadata ?? {},
    }).returning();

    return { data: created };
  });

  // DELETE /:key — delete a feature flag (admin only)
  app.delete("/:key", {
    preHandler: [requirePermission("config:manage")],
  }, async (request) => {
    const { tenantId } = request.jwtPayload;
    const { key } = request.params as { key: string };

    const existing = await db.query.featureFlags.findFirst({
      where: and(eq(featureFlags.tenantId, tenantId), eq(featureFlags.key, key)),
    });
    if (!existing) throw AppError.notFound("Feature flag not found");

    await db.delete(featureFlags).where(eq(featureFlags.id, existing.id));
    return { message: "Feature flag deleted" };
  });
}
