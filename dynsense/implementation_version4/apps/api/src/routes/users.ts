import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { eq, and, or, ilike } from "drizzle-orm";
import { users, accounts } from "@dynsense/db";
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

  // GET /search — search users by name/email (for combobox dropdowns)
  app.get("/search", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { q, limit: rawLimit } = request.query as { q?: string; limit?: string };
    const limit = Math.min(Number(rawLimit) || 20, 50);

    const conditions = [eq(users.tenantId, tenantId)];
    if (q && q.trim().length > 0) {
      const pattern = `%${q.trim()}%`;
      conditions.push(or(ilike(users.name, pattern), ilike(users.email, pattern))!);
    }

    const rows = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      status: users.status,
    }).from(users)
      .where(and(...conditions))
      .limit(limit);
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

  // POST /invite — invite a new user to the tenant
  app.post("/invite", {
    preHandler: [requirePermission("user:manage")],
  }, async (request) => {
    const { tenantId } = request.jwtPayload;
    const body = z.object({
      email: z.string().email(),
      name: z.string().min(1),
      role: z.enum(["site_admin", "pm", "developer", "client"]).default("developer"),
    }).parse(request.body);

    // Check for existing membership in this tenant
    const existing = await db.query.users.findFirst({
      where: and(eq(users.email, body.email), eq(users.tenantId, tenantId)),
    });
    if (existing) throw AppError.conflict("A user with this email already exists in the tenant");

    // Check for existing global account
    let account = await db.query.accounts.findFirst({
      where: eq(accounts.email, body.email),
    });

    if (!account) {
      // Create stub account for invited user
      const tempHash = crypto.randomBytes(32).toString("hex");
      const uid = "DS-" + crypto.randomBytes(3).toString("hex").toUpperCase();
      const [created] = await db.insert(accounts).values({
        uid,
        email: body.email,
        passwordHash: tempHash,
        name: body.name,
      }).returning();
      account = created!;
    }

    // Create membership linked to account
    const [created] = await db.insert(users).values({
      tenantId,
      accountId: account.id,
      email: account.email,
      name: body.name,
      role: body.role,
      status: "invited",
      passwordHash: account.passwordHash,
    }).returning({ id: users.id, email: users.email, name: users.name, role: users.role, status: users.status });

    return { data: created };
  });

  // DELETE /:id — remove a user from the tenant
  app.delete("/:id", {
    preHandler: [requirePermission("user:manage")],
  }, async (request) => {
    const { tenantId, sub: currentUserId } = request.jwtPayload;
    const { id } = request.params as { id: string };

    if (id === currentUserId) {
      throw AppError.badRequest("Cannot remove yourself");
    }

    const existing = await db.query.users.findFirst({
      where: and(eq(users.id, id), eq(users.tenantId, tenantId)),
    });
    if (!existing) throw AppError.notFound("User not found");

    await db.update(users)
      .set({ status: "deactivated", updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)));

    return { data: { id, status: "deactivated" } };
  });
}
