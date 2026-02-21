import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { users } from "@dynsense/db";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";
import { z } from "zod";

export async function userRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

  app.addHook("preHandler", authenticate);

  // GET / — list users in tenant
  app.get("/", async (request) => {
    const { tenantId } = request.jwtPayload;
    const rows = await db.query.users.findMany({
      where: eq(users.tenantId, tenantId),
      columns: { id: true, email: true, name: true, role: true, status: true, createdAt: true },
    });
    return { data: rows };
  });

  // GET /:id — get user by id
  app.get("/:id", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { id } = request.params as { id: string };

    const user = await db.query.users.findFirst({
      where: and(eq(users.id, id), eq(users.tenantId, tenantId)),
      columns: { id: true, email: true, name: true, role: true, status: true, createdAt: true },
    });
    if (!user) throw AppError.notFound("User not found");
    return { data: user };
  });

  // PATCH /:id/role — update user role (admin/pm only)
  app.patch("/:id/role", {
    preHandler: [requirePermission("user:manage")],
  }, async (request) => {
    const { tenantId } = request.jwtPayload;
    const { id } = request.params as { id: string };
    const body = z.object({ role: z.enum(["site_admin", "pm", "developer", "client"]) }).parse(request.body);

    const existing = await db.query.users.findFirst({
      where: and(eq(users.id, id), eq(users.tenantId, tenantId)),
    });
    if (!existing) throw AppError.notFound("User not found");

    const [updated] = await db.update(users)
      .set({ role: body.role, updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
      .returning({ id: users.id, email: users.email, name: users.name, role: users.role });

    return { data: updated };
  });
}
