import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { tenantConfigs } from "@dynsense/db";
import { upsertConfigSchema } from "@dynsense/shared";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";

export async function configRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

  app.addHook("preHandler", authenticate);

  // GET / — list all config keys for tenant
  app.get("/", async (request) => {
    const { tenantId } = request.jwtPayload;

    const rows = await db.query.tenantConfigs.findMany({
      where: eq(tenantConfigs.tenantId, tenantId),
    });

    // Return as key-value object
    const config: Record<string, unknown> = {};
    for (const row of rows) {
      config[row.key] = row.value;
    }
    return { data: config };
  });

  // PUT / — upsert config key (admin/pm only)
  app.put("/", {
    preHandler: [requirePermission("config:manage")],
  }, async (request) => {
    const { tenantId } = request.jwtPayload;
    const body = upsertConfigSchema.parse(request.body);

    const existing = await db.query.tenantConfigs.findFirst({
      where: and(eq(tenantConfigs.tenantId, tenantId), eq(tenantConfigs.key, body.key)),
    });

    if (existing) {
      const [updated] = await db.update(tenantConfigs)
        .set({ value: body.value, updatedAt: new Date() })
        .where(eq(tenantConfigs.id, existing.id))
        .returning();
      return { data: updated };
    }

    const [created] = await db.insert(tenantConfigs).values({
      tenantId,
      key: body.key,
      value: body.value,
    }).returning();

    return { data: created };
  });
}
