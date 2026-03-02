import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { projectMembers, projects, users } from "@dynsense/db";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";
import { z } from "zod";

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["client", "developer", "pm"]).default("client"),
});

export async function projectMemberRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

  app.addHook("preHandler", authenticate);

  // GET /project/:projectId — list members for a project
  app.get("/project/:projectId", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { projectId } = request.params as { projectId: string };

    const rows = await db.select({
      userId: projectMembers.userId,
      role: projectMembers.role,
      assignedAt: projectMembers.assignedAt,
      userName: users.name,
      userEmail: users.email,
    })
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.tenantId, tenantId)));

    return { data: rows };
  });

  // POST /project/:projectId — add a member to a project (PM/admin only)
  app.post("/project/:projectId", { preHandler: [requirePermission("user:manage")] }, async (request, reply) => {
    const { tenantId } = request.jwtPayload;
    const { projectId } = request.params as { projectId: string };
    const body = addMemberSchema.parse(request.body);

    // Verify project belongs to tenant
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)),
    });
    if (!project) throw AppError.notFound("Project not found");

    // Verify user belongs to tenant
    const user = await db.query.users.findFirst({
      where: and(eq(users.id, body.userId), eq(users.tenantId, tenantId)),
    });
    if (!user) throw AppError.notFound("User not found in tenant");

    // Check if already a member
    const existing = await db.query.projectMembers.findFirst({
      where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, body.userId)),
    });
    if (existing) throw AppError.badRequest("User is already a member of this project");

    const [member] = await db.insert(projectMembers).values({
      tenantId,
      projectId,
      userId: body.userId,
      role: body.role,
    }).returning();

    reply.status(201).send({ data: member });
  });

  // DELETE /project/:projectId/:userId — remove a member from a project (PM/admin only)
  app.delete("/project/:projectId/:userId", { preHandler: [requirePermission("user:manage")] }, async (request, reply) => {
    const { tenantId } = request.jwtPayload;
    const { projectId, userId } = request.params as { projectId: string; userId: string };

    const existing = await db.query.projectMembers.findFirst({
      where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId), eq(projectMembers.tenantId, tenantId)),
    });
    if (!existing) throw AppError.notFound("Membership not found");

    await db.delete(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));

    reply.status(204).send();
  });
}
