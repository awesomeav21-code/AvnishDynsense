import type { FastifyInstance } from "fastify";
import { eq, and, isNull, sql } from "drizzle-orm";
import { tasks, projects } from "@dynsense/db";
import {
  createTaskSchema, updateTaskSchema,
  taskStatusTransitionSchema, taskFilterSchema,
} from "@dynsense/shared";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";

export async function taskRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

  // All task routes require auth
  app.addHook("preHandler", authenticate);

  // GET / — list tasks for tenant with filters
  app.get("/", async (request) => {
    const { tenantId } = request.jwtPayload;
    const filters = taskFilterSchema.parse(request.query);

    const conditions = [eq(tasks.tenantId, tenantId), isNull(tasks.deletedAt)];

    if (filters.projectId) conditions.push(eq(tasks.projectId, filters.projectId));
    if (filters.status) conditions.push(eq(tasks.status, filters.status));
    if (filters.priority) conditions.push(eq(tasks.priority, filters.priority));
    if (filters.assigneeId) conditions.push(eq(tasks.assigneeId, filters.assigneeId));

    const rows = await db.select().from(tasks)
      .where(and(...conditions))
      .orderBy(tasks.position)
      .limit(filters.limit)
      .offset(filters.offset);

    return { data: rows };
  });

  // POST / — create task
  app.post("/", async (request, reply) => {
    const { tenantId } = request.jwtPayload;
    const body = createTaskSchema.parse(request.body);

    // Verify project belongs to tenant
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, body.projectId), eq(projects.tenantId, tenantId)),
    });
    if (!project) throw AppError.badRequest("Project not found in your tenant");

    const [task] = await db.insert(tasks).values({
      tenantId,
      projectId: body.projectId,
      phaseId: body.phaseId,
      parentTaskId: body.parentTaskId,
      title: body.title,
      description: body.description,
      priority: body.priority,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      estimatedEffort: body.estimatedEffort?.toString(),
    }).returning();

    reply.status(201).send({ data: task });
  });

  // GET /:id — get task by id
  app.get("/:id", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { id } = request.params as { id: string };

    const task = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, id), eq(tasks.tenantId, tenantId), isNull(tasks.deletedAt)),
    });

    if (!task) throw AppError.notFound("Task not found");
    return { data: task };
  });

  // PATCH /:id — update task
  app.patch("/:id", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { id } = request.params as { id: string };
    const body = updateTaskSchema.parse(request.body);

    const existing = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, id), eq(tasks.tenantId, tenantId), isNull(tasks.deletedAt)),
    });
    if (!existing) throw AppError.notFound("Task not found");

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined) updateData["title"] = body.title;
    if (body.description !== undefined) updateData["description"] = body.description;
    if (body.priority !== undefined) updateData["priority"] = body.priority;
    if (body.phaseId !== undefined) updateData["phaseId"] = body.phaseId;
    if (body.dueDate !== undefined) updateData["dueDate"] = body.dueDate ? new Date(body.dueDate) : null;
    if (body.estimatedEffort !== undefined) updateData["estimatedEffort"] = body.estimatedEffort?.toString() ?? null;

    const [updated] = await db.update(tasks)
      .set(updateData)
      .where(and(eq(tasks.id, id), eq(tasks.tenantId, tenantId)))
      .returning();

    return { data: updated };
  });

  // POST /:id/status — transition task status
  app.post("/:id/status", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { id } = request.params as { id: string };
    const { status } = taskStatusTransitionSchema.parse(request.body);

    const existing = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, id), eq(tasks.tenantId, tenantId), isNull(tasks.deletedAt)),
    });
    if (!existing) throw AppError.notFound("Task not found");

    const updateData: Record<string, unknown> = { status, updatedAt: new Date() };
    if (status === "completed") updateData["completedAt"] = new Date();

    const [updated] = await db.update(tasks)
      .set(updateData)
      .where(and(eq(tasks.id, id), eq(tasks.tenantId, tenantId)))
      .returning();

    return { data: updated };
  });

  // GET /stats — task counts grouped by status for a project
  app.get("/stats", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { projectId } = request.query as { projectId?: string };

    const conditions = [eq(tasks.tenantId, tenantId), isNull(tasks.deletedAt)];
    if (projectId) conditions.push(eq(tasks.projectId, projectId));

    const rows = await db.select({
      status: tasks.status,
      count: sql<number>`count(*)::int`,
    })
      .from(tasks)
      .where(and(...conditions))
      .groupBy(tasks.status);

    return { data: rows };
  });
}
