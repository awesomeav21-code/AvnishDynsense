// Ref: FR-132 — Recurring tasks (daily, weekly, sprint-aligned)
// Ref: FR-2001 — Recurring tasks: daily/weekly/monthly/cron schedule, auto-clone
import type { FastifyInstance } from "fastify";
import { eq, and, desc, lte } from "drizzle-orm";
import { recurringTaskConfigs, tasks } from "@dynsense/db";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";
import { z } from "zod";

const createRecurringSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  schedule: z.enum(["daily", "weekly", "monthly", "custom"]),
  cronExpression: z.string().max(100).optional(),
  templateData: z.record(z.unknown()).optional(),
  enabled: z.boolean().default(true),
});

const updateRecurringSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  schedule: z.enum(["daily", "weekly", "monthly", "custom"]).optional(),
  cronExpression: z.string().max(100).optional(),
  enabled: z.boolean().optional(),
});

function computeNextRun(schedule: string): Date {
  const now = new Date();
  switch (schedule) {
    case "daily":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case "weekly":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case "monthly":
      return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

export async function recurringTaskRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

  app.addHook("preHandler", authenticate);

  // GET / — list recurring task configs for tenant
  app.get("/", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { projectId } = request.query as { projectId?: string };

    const conditions = [eq(recurringTaskConfigs.tenantId, tenantId)];
    if (projectId) conditions.push(eq(recurringTaskConfigs.projectId, projectId));

    const rows = await db.select().from(recurringTaskConfigs)
      .where(and(...conditions))
      .orderBy(desc(recurringTaskConfigs.createdAt));

    return { data: rows };
  });

  // POST / — create a recurring task config
  app.post("/", {
    preHandler: [requirePermission("task:create")],
  }, async (request, reply) => {
    const { tenantId, sub: userId } = request.jwtPayload;
    const body = createRecurringSchema.parse(request.body);

    const [created] = await db.insert(recurringTaskConfigs).values({
      tenantId,
      projectId: body.projectId,
      title: body.title,
      description: body.description,
      priority: body.priority,
      schedule: body.schedule,
      cronExpression: body.cronExpression,
      templateData: body.templateData ?? {},
      enabled: body.enabled,
      nextRunAt: computeNextRun(body.schedule),
      createdBy: userId,
    }).returning();

    reply.status(201).send({ data: created });
  });

  // PATCH /:id — update a recurring task config
  app.patch("/:id", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { id } = request.params as { id: string };
    const body = updateRecurringSchema.parse(request.body);

    const existing = await db.query.recurringTaskConfigs.findFirst({
      where: and(eq(recurringTaskConfigs.id, id), eq(recurringTaskConfigs.tenantId, tenantId)),
    });
    if (!existing) throw AppError.notFound("Recurring task config not found");

    const updateData: Record<string, unknown> = { ...body, updatedAt: new Date() };
    if (body.schedule) {
      updateData.nextRunAt = computeNextRun(body.schedule);
    }

    const [updated] = await db.update(recurringTaskConfigs)
      .set(updateData)
      .where(eq(recurringTaskConfigs.id, id))
      .returning();

    return { data: updated };
  });

  // DELETE /:id — delete a recurring task config
  app.delete("/:id", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { id } = request.params as { id: string };

    const existing = await db.query.recurringTaskConfigs.findFirst({
      where: and(eq(recurringTaskConfigs.id, id), eq(recurringTaskConfigs.tenantId, tenantId)),
    });
    if (!existing) throw AppError.notFound("Recurring task config not found");

    await db.delete(recurringTaskConfigs).where(eq(recurringTaskConfigs.id, id));
    return { message: "Recurring task config deleted" };
  });

  // POST /run — manually trigger recurring task generation (creates tasks that are due)
  app.post("/run", async (request, reply) => {
    const { tenantId, sub: userId } = request.jwtPayload;
    const now = new Date();

    // Find all recurring configs that are due
    const dueConfigs = await db.select().from(recurringTaskConfigs)
      .where(and(
        eq(recurringTaskConfigs.tenantId, tenantId),
        eq(recurringTaskConfigs.enabled, true),
        lte(recurringTaskConfigs.nextRunAt, now),
      ));

    const createdTasks: Array<{ id: string; title: string }> = [];

    for (const config of dueConfigs) {
      // Create a task from the template
      const [task] = await db.insert(tasks).values({
        tenantId,
        projectId: config.projectId,
        title: config.title,
        description: config.description,
        priority: config.priority,
        status: "created",
      }).returning();

      createdTasks.push({ id: task!.id, title: task!.title });

      // Update the config with last/next run times
      await db.update(recurringTaskConfigs)
        .set({
          lastRunAt: now,
          nextRunAt: computeNextRun(config.schedule),
          updatedAt: now,
        })
        .where(eq(recurringTaskConfigs.id, config.id));
    }

    reply.status(201).send({
      data: createdTasks,
      message: `Created ${createdTasks.length} task(s) from ${dueConfigs.length} recurring config(s)`,
    });
  });
}
