// Ref: FR-131 — Tags and labels with color coding
// Ref: FR-1000 — Tags: default + custom per project
import type { FastifyInstance } from "fastify";
import { eq, and, desc, sql } from "drizzle-orm";
import { tags, taskTags, tasks } from "@dynsense/db";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";
import { z } from "zod";

const createTagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#6B7280"),
});

const updateTagSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const tagTaskSchema = z.object({
  taskId: z.string().uuid(),
  tagId: z.string().uuid(),
});

export async function tagRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

  app.addHook("preHandler", authenticate);

  // GET / — list all tags for tenant
  app.get("/", async (request) => {
    const { tenantId } = request.jwtPayload;
    const rows = await db.select().from(tags)
      .where(eq(tags.tenantId, tenantId))
      .orderBy(desc(tags.createdAt));
    return { data: rows };
  });

  // POST / — create a tag
  app.post("/", async (request, reply) => {
    const { tenantId } = request.jwtPayload;
    const body = createTagSchema.parse(request.body);

    const [created] = await db.insert(tags).values({
      tenantId,
      name: body.name,
      color: body.color,
    }).returning();

    reply.status(201).send({ data: created });
  });

  // PATCH /:id — update a tag
  app.patch("/:id", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { id } = request.params as { id: string };
    const body = updateTagSchema.parse(request.body);

    const existing = await db.query.tags.findFirst({
      where: and(eq(tags.id, id), eq(tags.tenantId, tenantId)),
    });
    if (!existing) throw AppError.notFound("Tag not found");

    const [updated] = await db.update(tags)
      .set({ ...body })
      .where(eq(tags.id, id))
      .returning();

    return { data: updated };
  });

  // DELETE /:id — delete a tag (cascades to task_tags)
  app.delete("/:id", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { id } = request.params as { id: string };

    const existing = await db.query.tags.findFirst({
      where: and(eq(tags.id, id), eq(tags.tenantId, tenantId)),
    });
    if (!existing) throw AppError.notFound("Tag not found");

    await db.delete(tags).where(eq(tags.id, id));
    return { message: "Tag deleted" };
  });

  // POST /task — add a tag to a task
  app.post("/task", async (request, reply) => {
    const { tenantId } = request.jwtPayload;
    const body = tagTaskSchema.parse(request.body);

    // Verify task belongs to tenant
    const task = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, body.taskId), eq(tasks.tenantId, tenantId)),
    });
    if (!task) throw AppError.notFound("Task not found");

    // Verify tag belongs to tenant
    const tag = await db.query.tags.findFirst({
      where: and(eq(tags.id, body.tagId), eq(tags.tenantId, tenantId)),
    });
    if (!tag) throw AppError.notFound("Tag not found");

    await db.insert(taskTags).values({
      taskId: body.taskId,
      tagId: body.tagId,
    }).onConflictDoNothing();

    reply.status(201).send({ message: "Tag added to task" });
  });

  // DELETE /task/:taskId/:tagId — remove a tag from a task
  app.delete("/task/:taskId/:tagId", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { taskId, tagId } = request.params as { taskId: string; tagId: string };

    // Verify task belongs to tenant
    const task = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)),
    });
    if (!task) throw AppError.notFound("Task not found");

    await db.delete(taskTags).where(
      and(eq(taskTags.taskId, taskId), eq(taskTags.tagId, tagId)),
    );
    return { message: "Tag removed from task" };
  });

  // GET /task/:taskId — get tags for a task
  app.get("/task/:taskId", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { taskId } = request.params as { taskId: string };

    const task = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)),
    });
    if (!task) throw AppError.notFound("Task not found");

    const rows = await db.select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
    })
      .from(taskTags)
      .innerJoin(tags, eq(taskTags.tagId, tags.id))
      .where(eq(taskTags.taskId, taskId));

    return { data: rows };
  });
}
