// Ref: FR-130 — Custom fields CRUD (definitions + values per task)
import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { customFieldDefinitions, customFieldValues, projects, tasks } from "@dynsense/db";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";
import { z } from "zod";

const createFieldSchema = z.object({
  projectId: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  fieldType: z.enum(["text", "number", "date", "select", "multiselect", "checkbox", "url"]),
  config: z.record(z.unknown()).optional(), // e.g., { options: ["a","b"] } for select
});

const updateFieldValueSchema = z.object({
  taskId: z.string().uuid(),
  fieldId: z.string().uuid(),
  value: z.unknown(),
});

export async function customFieldRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

  app.addHook("preHandler", authenticate);

  // GET /definitions — list custom field definitions for tenant/project
  app.get("/definitions", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { projectId } = request.query as { projectId?: string };

    const conditions = [eq(customFieldDefinitions.tenantId, tenantId)];
    if (projectId) {
      conditions.push(eq(customFieldDefinitions.projectId, projectId));
    }

    const rows = await db.select().from(customFieldDefinitions)
      .where(and(...conditions))
      .orderBy(customFieldDefinitions.createdAt);

    return { data: rows };
  });

  // POST /definitions — create a custom field definition
  app.post("/definitions", async (request, reply) => {
    const { tenantId } = request.jwtPayload;
    const body = createFieldSchema.parse(request.body);

    if (body.projectId) {
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, body.projectId), eq(projects.tenantId, tenantId)),
      });
      if (!project) throw AppError.notFound("Project not found");
    }

    const [created] = await db.insert(customFieldDefinitions).values({
      tenantId,
      projectId: body.projectId ?? null,
      name: body.name,
      fieldType: body.fieldType,
      config: body.config ?? null,
    }).returning();

    reply.status(201).send({ data: created });
  });

  // DELETE /definitions/:id — delete a custom field definition
  app.delete("/definitions/:id", async (request, reply) => {
    const { tenantId } = request.jwtPayload;
    const { id } = request.params as { id: string };

    const existing = await db.query.customFieldDefinitions.findFirst({
      where: and(eq(customFieldDefinitions.id, id), eq(customFieldDefinitions.tenantId, tenantId)),
    });
    if (!existing) throw AppError.notFound("Custom field definition not found");

    await db.delete(customFieldDefinitions)
      .where(and(eq(customFieldDefinitions.id, id), eq(customFieldDefinitions.tenantId, tenantId)));

    reply.status(204).send();
  });

  // GET /values/:taskId — get all custom field values for a task
  app.get("/values/:taskId", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { taskId } = request.params as { taskId: string };

    // Verify task belongs to tenant
    const task = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)),
    });
    if (!task) throw AppError.notFound("Task not found");

    const rows = await db.select().from(customFieldValues)
      .where(eq(customFieldValues.taskId, taskId));

    return { data: rows };
  });

  // PUT /values — upsert a custom field value for a task
  app.put("/values", async (request) => {
    const { tenantId } = request.jwtPayload;
    const body = updateFieldValueSchema.parse(request.body);

    // Verify task belongs to tenant
    const task = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, body.taskId), eq(tasks.tenantId, tenantId)),
    });
    if (!task) throw AppError.notFound("Task not found");

    // Verify field definition exists
    const field = await db.query.customFieldDefinitions.findFirst({
      where: and(eq(customFieldDefinitions.id, body.fieldId), eq(customFieldDefinitions.tenantId, tenantId)),
    });
    if (!field) throw AppError.notFound("Custom field definition not found");

    // Upsert the value
    const existing = await db.query.customFieldValues.findFirst({
      where: and(
        eq(customFieldValues.taskId, body.taskId),
        eq(customFieldValues.fieldId, body.fieldId),
      ),
    });

    if (existing) {
      const [updated] = await db.update(customFieldValues)
        .set({ value: body.value, updatedAt: new Date() })
        .where(eq(customFieldValues.id, existing.id))
        .returning();
      return { data: updated };
    }

    const [created] = await db.insert(customFieldValues).values({
      taskId: body.taskId,
      fieldId: body.fieldId,
      value: body.value,
    }).returning();

    return { data: created };
  });
}
