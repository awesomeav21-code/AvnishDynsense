import type { FastifyInstance } from "fastify";
import { eq, and, isNull, gt } from "drizzle-orm";
import { inviteLinks, projects, projectMembers, users } from "@dynsense/db";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";
import { z } from "zod";
import crypto from "node:crypto";

const createInviteSchema = z.object({
  projectId: z.string().uuid(),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

export async function inviteLinkRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

  app.addHook("preHandler", authenticate);

  // POST / — generate an invite link (PM/admin only)
  app.post("/", { preHandler: [requirePermission("user:manage")] }, async (request, reply) => {
    const { tenantId, sub } = request.jwtPayload;
    const body = createInviteSchema.parse(request.body);

    // Verify project belongs to tenant
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, body.projectId), eq(projects.tenantId, tenantId), isNull(projects.deletedAt)),
    });
    if (!project) throw AppError.notFound("Project not found");

    // Only one active (unused + unexpired) invite link per project
    const activeLink = await db.query.inviteLinks.findFirst({
      where: and(
        eq(inviteLinks.projectId, body.projectId),
        eq(inviteLinks.tenantId, tenantId),
        isNull(inviteLinks.usedAt),
        gt(inviteLinks.expiresAt, new Date()),
      ),
    });
    if (activeLink) throw AppError.badRequest("This project already has an active invite link");

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + body.expiresInDays);

    const [link] = await db.insert(inviteLinks).values({
      tenantId,
      projectId: body.projectId,
      token,
      createdBy: sub,
      expiresAt,
    }).returning();

    reply.status(201).send({ data: link });
  });

  // GET /project/:projectId — list invite links for a project (PM/admin only)
  app.get("/project/:projectId", { preHandler: [requirePermission("user:manage")] }, async (request) => {
    const { tenantId } = request.jwtPayload;
    const { projectId } = request.params as { projectId: string };

    const rows = await db.query.inviteLinks.findMany({
      where: and(eq(inviteLinks.projectId, projectId), eq(inviteLinks.tenantId, tenantId)),
      orderBy: (l, { desc }) => [desc(l.createdAt)],
    });

    return { data: rows };
  });

  // POST /join/:token — join a project via invite link (any authenticated user)
  app.post("/join/:token", async (request, reply) => {
    const { tenantId, sub } = request.jwtPayload;
    const { token } = request.params as { token: string };

    const link = await db.query.inviteLinks.findFirst({
      where: and(eq(inviteLinks.token, token), eq(inviteLinks.tenantId, tenantId)),
    });

    if (!link) throw AppError.notFound("Invite link not found");
    if (link.usedAt) throw AppError.badRequest("This invite link has already been used");
    if (new Date() > link.expiresAt) throw AppError.badRequest("This invite link has expired");

    // Check if user is already a member
    const existing = await db.query.projectMembers.findFirst({
      where: and(eq(projectMembers.projectId, link.projectId), eq(projectMembers.userId, sub)),
    });
    if (existing) throw AppError.badRequest("You are already a member of this project");

    // Add user as client member
    await db.insert(projectMembers).values({
      tenantId,
      projectId: link.projectId,
      userId: sub,
      role: "client",
    });

    // Mark invite as used
    await db.update(inviteLinks)
      .set({ usedAt: new Date(), usedBy: sub })
      .where(eq(inviteLinks.id, link.id));

    reply.status(200).send({ data: { projectId: link.projectId, message: "Successfully joined project" } });
  });
}
