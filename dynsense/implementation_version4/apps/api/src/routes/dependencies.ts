import type { FastifyInstance } from "fastify";
import { eq, and, or } from "drizzle-orm";
import { taskDependencies, tasks } from "@dynsense/db";
import { addDependencySchema } from "@dynsense/shared";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";

export async function dependencyRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

  app.addHook("preHandler", authenticate);

  // GET /task/:taskId — list dependencies for a task
  app.get("/task/:taskId", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { taskId } = request.params as { taskId: string };

    const rows = await db.query.taskDependencies.findMany({
      where: and(
        eq(taskDependencies.tenantId, tenantId),
        or(eq(taskDependencies.blockerTaskId, taskId), eq(taskDependencies.blockedTaskId, taskId))
      ),
    });
    return { data: rows };
  });

  // POST / — add dependency with BFS circular detection
  app.post("/", async (request, reply) => {
    const { tenantId } = request.jwtPayload;
    const body = addDependencySchema.parse(request.body);

    // Verify both tasks exist in tenant
    const [blocker, blocked] = await Promise.all([
      db.query.tasks.findFirst({ where: and(eq(tasks.id, body.blockerTaskId), eq(tasks.tenantId, tenantId)) }),
      db.query.tasks.findFirst({ where: and(eq(tasks.id, body.blockedTaskId), eq(tasks.tenantId, tenantId)) }),
    ]);
    if (!blocker || !blocked) throw AppError.badRequest("One or both tasks not found in your tenant");
    if (body.blockerTaskId === body.blockedTaskId) throw AppError.badRequest("A task cannot depend on itself");

    // BFS circular dependency detection
    const hasCycle = await detectCycle(db, tenantId, body.blockerTaskId, body.blockedTaskId);
    if (hasCycle) throw AppError.badRequest("Adding this dependency would create a circular reference");

    const [dep] = await db.insert(taskDependencies).values({
      tenantId,
      blockerTaskId: body.blockerTaskId,
      blockedTaskId: body.blockedTaskId,
      type: body.type,
    }).returning();

    reply.status(201).send({ data: dep });
  });

  // DELETE /:id — remove dependency
  app.delete("/:id", async (request, reply) => {
    const { tenantId } = request.jwtPayload;
    const { id } = request.params as { id: string };

    const existing = await db.query.taskDependencies.findFirst({
      where: and(eq(taskDependencies.id, id), eq(taskDependencies.tenantId, tenantId)),
    });
    if (!existing) throw AppError.notFound("Dependency not found");

    await db.delete(taskDependencies).where(eq(taskDependencies.id, id));
    reply.status(204).send();
  });
}

// BFS: check if adding blockerTaskId -> blockedTaskId creates a cycle
// A cycle exists if blockedTaskId can already reach blockerTaskId via existing deps
async function detectCycle(db: ReturnType<typeof getDb>, tenantId: string, blockerTaskId: string, blockedTaskId: string): Promise<boolean> {
  const visited = new Set<string>();
  const queue = [blockedTaskId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === blockerTaskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    // Find all tasks that `current` blocks
    const deps = await db.query.taskDependencies.findMany({
      where: and(eq(taskDependencies.tenantId, tenantId), eq(taskDependencies.blockerTaskId, current)),
    });
    for (const dep of deps) {
      if (!visited.has(dep.blockedTaskId)) {
        queue.push(dep.blockedTaskId);
      }
    }
  }
  return false;
}
