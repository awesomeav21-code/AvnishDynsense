// Ref: FR-137 — Task reminders — configurable per-task reminder notifications
// Ref: FR-2014 — Task reminders: personal per-user, scheduled delivery
import type { FastifyInstance } from "fastify";
import { eq, and, desc, lte, isNull } from "drizzle-orm";
import { taskReminders, tasks, notifications } from "@dynsense/db";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";
import { z } from "zod";

const createReminderSchema = z.object({
  taskId: z.string().uuid(),
  remindAt: z.string().datetime(),
  channel: z.enum(["in_app", "email", "slack"]).default("in_app"),
});

export async function reminderRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

  app.addHook("preHandler", authenticate);

  // GET / — list reminders for current user
  app.get("/", async (request) => {
    const { tenantId, sub: userId } = request.jwtPayload;

    const rows = await db.select().from(taskReminders)
      .where(and(
        eq(taskReminders.tenantId, tenantId),
        eq(taskReminders.userId, userId),
      ))
      .orderBy(desc(taskReminders.remindAt));

    return { data: rows };
  });

  // GET /task/:taskId — list reminders for a specific task
  app.get("/task/:taskId", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { taskId } = request.params as { taskId: string };

    // Verify task exists and belongs to tenant
    const task = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)),
    });
    if (!task) throw AppError.notFound("Task not found");

    const rows = await db.select().from(taskReminders)
      .where(and(
        eq(taskReminders.tenantId, tenantId),
        eq(taskReminders.taskId, taskId),
      ))
      .orderBy(desc(taskReminders.remindAt));

    return { data: rows };
  });

  // POST / — create a reminder
  app.post("/", async (request, reply) => {
    const { tenantId, sub: userId } = request.jwtPayload;
    const body = createReminderSchema.parse(request.body);

    // Verify task exists and belongs to tenant
    const task = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, body.taskId), eq(tasks.tenantId, tenantId)),
    });
    if (!task) throw AppError.notFound("Task not found");

    const [created] = await db.insert(taskReminders).values({
      tenantId,
      taskId: body.taskId,
      userId,
      remindAt: new Date(body.remindAt),
      channel: body.channel,
    }).returning();

    reply.status(201).send({ data: created });
  });

  // DELETE /:id — delete a reminder
  app.delete("/:id", async (request) => {
    const { tenantId, sub: userId } = request.jwtPayload;
    const { id } = request.params as { id: string };

    const existing = await db.query.taskReminders.findFirst({
      where: and(
        eq(taskReminders.id, id),
        eq(taskReminders.tenantId, tenantId),
        eq(taskReminders.userId, userId),
      ),
    });
    if (!existing) throw AppError.notFound("Reminder not found");

    await db.delete(taskReminders).where(eq(taskReminders.id, id));
    return { message: "Reminder deleted" };
  });

  // POST /process — process due reminders (creates in-app notifications)
  // Called by cron or AI PM Agent
  app.post("/process", async (request, reply) => {
    const { tenantId } = request.jwtPayload;
    const now = new Date();

    // Find due, unsent reminders for this tenant
    const dueReminders = await db.select({
      id: taskReminders.id,
      taskId: taskReminders.taskId,
      userId: taskReminders.userId,
      channel: taskReminders.channel,
      taskTitle: tasks.title,
    })
      .from(taskReminders)
      .innerJoin(tasks, eq(taskReminders.taskId, tasks.id))
      .where(and(
        eq(taskReminders.tenantId, tenantId),
        lte(taskReminders.remindAt, now),
        isNull(taskReminders.sentAt),
      ));

    let processed = 0;
    for (const reminder of dueReminders) {
      // Create in-app notification
      if (reminder.channel === "in_app") {
        await db.insert(notifications).values({
          tenantId,
          userId: reminder.userId,
          type: "reminder",
          title: `Reminder: ${reminder.taskTitle}`,
          body: `You have a reminder for task "${reminder.taskTitle}"`,
          data: { taskId: reminder.taskId },
        });
      }

      // Mark reminder as sent
      await db.update(taskReminders)
        .set({ sentAt: now })
        .where(eq(taskReminders.id, reminder.id));

      processed++;
    }

    reply.send({ message: `Processed ${processed} reminder(s)` });
  });
}
