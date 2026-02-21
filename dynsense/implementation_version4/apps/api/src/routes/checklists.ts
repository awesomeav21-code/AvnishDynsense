import type { FastifyInstance } from "fastify";
import { eq, and, sql } from "drizzle-orm";
import { taskChecklists, checklistItems, tasks } from "@dynsense/db";
import { createChecklistSchema, createChecklistItemSchema, updateChecklistItemSchema } from "@dynsense/shared";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";

export async function checklistRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

  app.addHook("preHandler", authenticate);

  // GET /task/:taskId — get checklists for a task
  app.get("/task/:taskId", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { taskId } = request.params as { taskId: string };

    const checklists = await db.query.taskChecklists.findMany({
      where: and(eq(taskChecklists.tenantId, tenantId), eq(taskChecklists.taskId, taskId)),
      orderBy: (c, { asc }) => [asc(c.position)],
    });

    // Fetch items for each checklist
    const result = await Promise.all(checklists.map(async (cl) => {
      const items = await db.query.checklistItems.findMany({
        where: eq(checklistItems.checklistId, cl.id),
        orderBy: (i, { asc }) => [asc(i.position)],
      });
      const total = items.length;
      const completed = items.filter((i) => i.completed).length;
      return { ...cl, items, completionPercent: total > 0 ? Math.round((completed / total) * 100) : 0 };
    }));

    return { data: result };
  });

  // POST / — create checklist
  app.post("/", async (request, reply) => {
    const { tenantId } = request.jwtPayload;
    const body = createChecklistSchema.parse(request.body);

    const task = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, body.taskId), eq(tasks.tenantId, tenantId)),
    });
    if (!task) throw AppError.badRequest("Task not found in your tenant");

    const [checklist] = await db.insert(taskChecklists).values({
      tenantId,
      taskId: body.taskId,
      title: body.title,
      position: body.position,
    }).returning();

    reply.status(201).send({ data: checklist });
  });

  // POST /:checklistId/items — add item to checklist
  app.post("/:checklistId/items", async (request, reply) => {
    const { tenantId } = request.jwtPayload;
    const { checklistId } = request.params as { checklistId: string };
    const body = createChecklistItemSchema.parse(request.body);

    const checklist = await db.query.taskChecklists.findFirst({
      where: and(eq(taskChecklists.id, checklistId), eq(taskChecklists.tenantId, tenantId)),
    });
    if (!checklist) throw AppError.notFound("Checklist not found");

    const [item] = await db.insert(checklistItems).values({
      checklistId,
      label: body.label,
      position: body.position,
    }).returning();

    reply.status(201).send({ data: item });
  });

  // PATCH /items/:itemId — update checklist item
  app.patch("/items/:itemId", async (request) => {
    const { itemId } = request.params as { itemId: string };
    const body = updateChecklistItemSchema.parse(request.body);

    const existing = await db.query.checklistItems.findFirst({
      where: eq(checklistItems.id, itemId),
    });
    if (!existing) throw AppError.notFound("Checklist item not found");

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (body.label !== undefined) updateData["label"] = body.label;
    if (body.completed !== undefined) updateData["completed"] = body.completed;
    if (body.position !== undefined) updateData["position"] = body.position;

    const [updated] = await db.update(checklistItems)
      .set(updateData)
      .where(eq(checklistItems.id, itemId))
      .returning();

    return { data: updated };
  });

  // DELETE /items/:itemId — delete checklist item
  app.delete("/items/:itemId", async (request, reply) => {
    const { itemId } = request.params as { itemId: string };

    const existing = await db.query.checklistItems.findFirst({
      where: eq(checklistItems.id, itemId),
    });
    if (!existing) throw AppError.notFound("Checklist item not found");

    await db.delete(checklistItems).where(eq(checklistItems.id, itemId));
    reply.status(204).send();
  });
}
