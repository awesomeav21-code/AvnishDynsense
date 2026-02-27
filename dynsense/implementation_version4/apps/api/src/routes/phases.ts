// Ref: FR-111 — Project phases CRUD (Discovery, Build, Deliver, etc.)
// Phases are ordered within a project and used for WBS structure.
import type { FastifyInstance } from "fastify";
import { eq, and, asc } from "drizzle-orm";
import { phases, projects } from "@dynsense/db";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";
import { z } from "zod";

const createPhaseSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(255),
  position: z.number().int().min(0).optional(),
});

const updatePhaseSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  position: z.number().int().min(0).optional(),
});

export async function phaseRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

  app.addHook("preHandler", authenticate);

  // GET /?projectId=xxx — list phases for a project (ordered by position)
  app.get("/", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { projectId } = request.query as { projectId?: string };

    if (!projectId) {
      throw AppError.badRequest("projectId query parameter is required");
    }

    let rows = await db
      .select()
      .from(phases)
      .where(and(eq(phases.tenantId, tenantId), eq(phases.projectId, projectId)))
      .orderBy(asc(phases.position));

    // Auto-create default phases if project has none
    if (rows.length === 0) {
      const defaultPhases = ["Discovery", "Development", "Testing", "Deployment"];
      rows = await db.insert(phases).values(
        defaultPhases.map((name, i) => ({
          tenantId,
          projectId,
          name,
          position: i,
        }))
      ).returning();
    }

    return { data: rows };
  });

  // POST / — create a phase
  app.post("/", async (request, reply) => {
    const { tenantId } = request.jwtPayload;
    const body = createPhaseSchema.parse(request.body);

    // Verify project belongs to tenant
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, body.projectId), eq(projects.tenantId, tenantId)),
    });
    if (!project) throw AppError.notFound("Project not found");

    // Default position: append at end
    let position = body.position;
    if (position === undefined) {
      const existing = await db
        .select()
        .from(phases)
        .where(and(eq(phases.tenantId, tenantId), eq(phases.projectId, body.projectId)))
        .orderBy(asc(phases.position));
      position = existing.length;
    }

    const [created] = await db.insert(phases).values({
      tenantId,
      projectId: body.projectId,
      name: body.name,
      position,
    }).returning();

    reply.status(201).send({ data: created });
  });

  // PATCH /:id — update a phase
  app.patch("/:id", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { id } = request.params as { id: string };
    const body = updatePhaseSchema.parse(request.body);

    const existing = await db.query.phases.findFirst({
      where: and(eq(phases.id, id), eq(phases.tenantId, tenantId)),
    });
    if (!existing) throw AppError.notFound("Phase not found");

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) updateData["name"] = body.name;
    if (body.position !== undefined) updateData["position"] = body.position;

    const [updated] = await db.update(phases)
      .set(updateData)
      .where(and(eq(phases.id, id), eq(phases.tenantId, tenantId)))
      .returning();

    return { data: updated };
  });

  // DELETE /:id — delete a phase
  app.delete("/:id", async (request, reply) => {
    const { tenantId } = request.jwtPayload;
    const { id } = request.params as { id: string };

    const existing = await db.query.phases.findFirst({
      where: and(eq(phases.id, id), eq(phases.tenantId, tenantId)),
    });
    if (!existing) throw AppError.notFound("Phase not found");

    await db.delete(phases).where(and(eq(phases.id, id), eq(phases.tenantId, tenantId)));
    reply.status(204).send();
  });
}
