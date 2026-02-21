import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { taskAssignments, tasks, users } from "@dynsense/db";
import { assignTaskSchema } from "@dynsense/shared";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";

export async function assignmentRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

  app.addHook("preHandler", authenticate);

  // GET /task/:taskId — list assignments for a task
  app.get("/task/:taskId", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { taskId } = request.params as { taskId: string };

    const task = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)),
    });
    if (!task) throw AppError.notFound("Task not found");

    const rows = await db.select()
      .from(taskAssignments)
      .innerJoin(users, eq(taskAssignments.userId, users.id))
      .where(eq(taskAssignments.taskId, taskId));

    return {
      data: rows.map((r) => ({
        userId: r.users.id,
        name: r.users.name,
        email: r.users.email,
        role: r.users.role,
        assignedAt: r.task_assignments.assignedAt,
      })),
    };
  });

  // POST /task/:taskId — assign user to task
  app.post("/task/:taskId", {
    preHandler: [requirePermission("task:assign")],
  }, async (request, reply) => {
    const { tenantId } = request.jwtPayload;
    const { taskId } = request.params as { taskId: string };
    const body = assignTaskSchema.parse(request.body);

    const [task, user] = await Promise.all([
      db.query.tasks.findFirst({ where: and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)) }),
      db.query.users.findFirst({ where: and(eq(users.id, body.userId), eq(users.tenantId, tenantId)) }),
    ]);
    if (!task) throw AppError.notFound("Task not found");
    if (!user) throw AppError.badRequest("User not found in your tenant");

    await db.insert(taskAssignments).values({
      taskId,
      userId: body.userId,
    }).onConflictDoNothing();

    reply.status(201).send({ data: { taskId, userId: body.userId } });
  });

  // DELETE /task/:taskId/:userId — remove assignment
  app.delete("/task/:taskId/:userId", {
    preHandler: [requirePermission("task:assign")],
  }, async (request, reply) => {
    const { tenantId } = request.jwtPayload;
    const { taskId, userId } = request.params as { taskId: string; userId: string };

    const task = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)),
    });
    if (!task) throw AppError.notFound("Task not found");

    await db.delete(taskAssignments)
      .where(and(eq(taskAssignments.taskId, taskId), eq(taskAssignments.userId, userId)));

    reply.status(204).send();
  });
}
