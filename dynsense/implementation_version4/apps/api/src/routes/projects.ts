import type { FastifyInstance } from "fastify";
import { eq, and, isNull } from "drizzle-orm";
import { projects } from "@dynsense/db";
import { createProjectSchema, updateProjectSchema, projectIdParamSchema } from "@dynsense/shared";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";

export async function projectRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

  // All project routes require auth
  app.addHook("preHandler", authenticate);

  // GET / — list projects for tenant
  app.get("/", async (request) => {
    const { tenantId } = request.jwtPayload;

    const rows = await db.query.projects.findMany({
      where: and(eq(projects.tenantId, tenantId), isNull(projects.deletedAt)),
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    });

    return { data: rows };
  });

  // POST / — create project
  app.post("/", async (request, reply) => {
    const { tenantId } = request.jwtPayload;
    const body = createProjectSchema.parse(request.body);

    const [project] = await db.insert(projects).values({
      tenantId,
      name: body.name,
      description: body.description,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
    }).returning();

    reply.status(201).send({ data: project });
  });

  // GET /:id — get project by id
  app.get("/:id", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { id } = projectIdParamSchema.parse(request.params);

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.tenantId, tenantId), isNull(projects.deletedAt)),
    });

    if (!project) throw AppError.notFound("Project not found");
    return { data: project };
  });

  // PATCH /:id — update project
  app.patch("/:id", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { id } = projectIdParamSchema.parse(request.params);
    const body = updateProjectSchema.parse(request.body);

    const existing = await db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.tenantId, tenantId), isNull(projects.deletedAt)),
    });
    if (!existing) throw AppError.notFound("Project not found");

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) updateData["name"] = body.name;
    if (body.description !== undefined) updateData["description"] = body.description;
    if (body.status !== undefined) updateData["status"] = body.status;
    if (body.startDate !== undefined) updateData["startDate"] = new Date(body.startDate);
    if (body.endDate !== undefined) updateData["endDate"] = new Date(body.endDate);

    const [updated] = await db.update(projects)
      .set(updateData)
      .where(and(eq(projects.id, id), eq(projects.tenantId, tenantId)))
      .returning();

    return { data: updated };
  });
}
