import type { FastifyInstance } from "fastify";
import { eq, and, isNull, sql, ne, inArray, asc, lt } from "drizzle-orm";
import { tasks, projects, taskDependencies, users } from "@dynsense/db";
import {
  createTaskSchema, updateTaskSchema,
  taskStatusTransitionSchema, taskFilterSchema,
} from "@dynsense/shared";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { getDb } from "../db.js";
import { writeAuditLog, computeDiff } from "./audit.js";
import { broadcastToTenant } from "./sse.js";
import type { Env } from "../config/env.js";
import { z } from "zod";

const VALID_STATUSES = ["created", "ready", "in_progress", "review", "completed", "blocked", "cancelled"];

function normalizeStatus<T extends { status: string }>(row: T): T {
  if (!VALID_STATUSES.includes(row.status)) {
    return { ...row, status: "created" };
  }
  return row;
}

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

    return { data: rows.map(normalizeStatus) };
  });

  // GET /whats-next — personalized prioritized task list (FR-202)
  app.get("/whats-next", async (request) => {
    const { tenantId, sub: userId } = request.jwtPayload;
    const now = new Date();

    // 1. Get tasks assigned to current user OR unassigned, that are not completed/cancelled/deleted
    const assignedTasks = await db.select().from(tasks)
      .where(and(
        eq(tasks.tenantId, tenantId),
        eq(tasks.assigneeId, userId),
        isNull(tasks.deletedAt),
        ne(tasks.status, "completed"),
        ne(tasks.status, "cancelled"),
      ));
    const unassignedTasks = await db.select().from(tasks)
      .where(and(
        eq(tasks.tenantId, tenantId),
        isNull(tasks.assigneeId),
        isNull(tasks.deletedAt),
        ne(tasks.status, "completed"),
        ne(tasks.status, "cancelled"),
      ));
    const seenIds = new Set(assignedTasks.map((t) => t.id));
    const userTasks = [...assignedTasks, ...unassignedTasks.filter((t) => !seenIds.has(t.id))];

    if (userTasks.length === 0) {
      return { data: [] };
    }

    // 2. For each task, check if it's blocked (has unresolved dependencies where blocker is not completed)
    const taskIds = userTasks.map((t) => t.id);
    const deps = await db.select().from(taskDependencies)
      .where(and(
        eq(taskDependencies.tenantId, tenantId),
        inArray(taskDependencies.blockedTaskId, taskIds),
      ));

    // Get all blocker task IDs and fetch their statuses
    const blockerIds = [...new Set(deps.map((d) => d.blockerTaskId))];
    let blockerStatuses: Map<string, string> = new Map();

    if (blockerIds.length > 0) {
      const blockerTasks = await db.select({ id: tasks.id, status: tasks.status })
        .from(tasks)
        .where(and(
          eq(tasks.tenantId, tenantId),
          inArray(tasks.id, blockerIds),
          isNull(tasks.deletedAt),
        ));
      blockerStatuses = new Map(blockerTasks.map((t) => [t.id, t.status]));
    }

    // Determine which tasks are blocked
    const blockedTaskIds = new Set<string>();
    for (const dep of deps) {
      const blockerStatus = blockerStatuses.get(dep.blockerTaskId);
      if (blockerStatus !== "completed") {
        blockedTaskIds.add(dep.blockedTaskId);
      }
    }

    // 3. Filter to unblocked tasks only
    const unblockedTasks = userTasks.filter((t) => !blockedTaskIds.has(t.id));

    // 4. Sort: overdue first (dueDate < now), then by dueDate ascending (nulls last), then by priority
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

    const sorted = unblockedTasks.sort((a, b) => {
      const aOverdue = a.dueDate && new Date(a.dueDate) < now;
      const bOverdue = b.dueDate && new Date(b.dueDate) < now;

      // Overdue tasks first
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      // Then by dueDate ascending (nulls last)
      if (a.dueDate && b.dueDate) {
        const diff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        if (diff !== 0) return diff;
      }
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;

      // Then by priority (critical > high > medium > low)
      const aPri = priorityOrder[a.priority] ?? 2;
      const bPri = priorityOrder[b.priority] ?? 2;
      return aPri - bPri;
    });

    // 5. Return top 10 with reason field
    const top10 = sorted.slice(0, 10).map((task, index) => {
      let reason = "";
      const isOverdue = task.dueDate && new Date(task.dueDate) < now;

      if (isOverdue) {
        const daysOverdue = Math.ceil((now.getTime() - new Date(task.dueDate!).getTime()) / (1000 * 60 * 60 * 24));
        reason = `Overdue by ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""}`;
      } else if (task.dueDate) {
        const daysUntil = Math.ceil((new Date(task.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        reason = `Due in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}`;
      } else if (task.priority === "critical" || task.priority === "high") {
        reason = `${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} priority task`;
      } else if (!task.assigneeId) {
        reason = "Unassigned — available to pick up";
      } else {
        reason = "Assigned to you";
      }

      return {
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
        projectId: task.projectId,
        reason,
      };
    });

    return { data: top10.map(normalizeStatus) };
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
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      estimatedEffort: body.estimatedEffort?.toString(),
      sprint: body.sprint,
      reportedBy: body.reportedBy ?? request.jwtPayload.sub,
    }).returning();

    await writeAuditLog(db, {
      tenantId,
      entityType: "task",
      entityId: task!.id,
      action: "created",
      actorId: request.jwtPayload.sub,
      diff: { title: { old: null, new: task!.title }, status: { old: null, new: task!.status } },
    });

    reply.status(201).send({ data: task });
  });

  // GET /:id — get task by id with reporter name
  app.get("/:id", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { id } = request.params as { id: string };

    const task = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, id), eq(tasks.tenantId, tenantId), isNull(tasks.deletedAt)),
    });

    if (!task) throw AppError.notFound("Task not found");

    let reporterName: string | null = null;
    if (task.reportedBy) {
      const reporter = await db.query.users.findFirst({
        where: eq(users.id, task.reportedBy),
        columns: { name: true },
      });
      reporterName = reporter?.name ?? null;
    }

    return { data: normalizeStatus({ ...task, reporterName }) };
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
    if (body.startDate !== undefined) updateData["startDate"] = body.startDate ? new Date(body.startDate) : null;
    if (body.dueDate !== undefined) updateData["dueDate"] = body.dueDate ? new Date(body.dueDate) : null;
    if (body.estimatedEffort !== undefined) updateData["estimatedEffort"] = body.estimatedEffort?.toString() ?? null;
    if (body.sprint !== undefined) updateData["sprint"] = body.sprint;

    const [updated] = await db.update(tasks)
      .set(updateData)
      .where(and(eq(tasks.id, id), eq(tasks.tenantId, tenantId)))
      .returning();

    const diff = computeDiff(
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
    );
    if (diff) {
      await writeAuditLog(db, {
        tenantId,
        entityType: "task",
        entityId: id,
        action: "updated",
        actorId: request.jwtPayload.sub,
        diff,
      });
    }

    return { data: updated };
  });

  // POST /:id/status — transition task status
  app.post("/:id/status", { preHandler: [requirePermission("task:transition")] }, async (request) => {
    const { tenantId, sub } = request.jwtPayload;
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

    // Audit log for status transition (FR-140)
    await writeAuditLog(db, {
      tenantId,
      entityType: "task",
      entityId: id,
      action: "status_changed",
      actorId: sub,
      diff: { status: { old: existing.status, new: status } },
    });

    // Broadcast real-time task status change to all connected clients in the tenant
    broadcastToTenant(tenantId, "task_status_changed", {
      taskId: id,
      oldStatus: existing.status,
      newStatus: status,
      updatedBy: sub,
    });

    // Auto-unblock dependents on task completion (FR-125)
    if (status === "completed") {
      // Find all tasks blocked by this task
      const deps = await db.select()
        .from(taskDependencies)
        .where(and(
          eq(taskDependencies.blockerTaskId, id),
          eq(taskDependencies.tenantId, tenantId),
        ));

      for (const dep of deps) {
        // Find all blockers for the blocked task
        const allBlockers = await db.select()
          .from(taskDependencies)
          .where(and(
            eq(taskDependencies.blockedTaskId, dep.blockedTaskId),
            eq(taskDependencies.tenantId, tenantId),
          ));

        // Check if ALL blockers are now completed
        const blockerIds = allBlockers.map((b) => b.blockerTaskId);
        const blockerTasks = await db.select()
          .from(tasks)
          .where(and(
            eq(tasks.tenantId, tenantId),
            isNull(tasks.deletedAt),
          ));

        const allBlockersCompleted = blockerIds.every((blockerId) => {
          const blockerTask = blockerTasks.find((t) => t.id === blockerId);
          return blockerTask?.status === "completed";
        });

        if (allBlockersCompleted) {
          // Only transition if the blocked task is currently "blocked"
          const blockedTask = await db.query.tasks.findFirst({
            where: and(
              eq(tasks.id, dep.blockedTaskId),
              eq(tasks.tenantId, tenantId),
              eq(tasks.status, "blocked"),
              isNull(tasks.deletedAt),
            ),
          });

          if (blockedTask) {
            await db.update(tasks)
              .set({ status: "ready", updatedAt: new Date() })
              .where(and(eq(tasks.id, dep.blockedTaskId), eq(tasks.tenantId, tenantId)));

            // Audit log for auto-unblock
            await writeAuditLog(db, {
              tenantId,
              entityType: "task",
              entityId: dep.blockedTaskId,
              action: "auto_unblocked",
              actorId: sub,
              diff: { status: { old: "blocked", new: "ready" } },
            });
          }
        }
      }
    }

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

  // DELETE /:id — soft delete task
  app.delete("/:id", async (request, reply) => {
    const { tenantId, sub } = request.jwtPayload;
    const { id } = request.params as { id: string };

    const existing = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, id), eq(tasks.tenantId, tenantId), isNull(tasks.deletedAt)),
    });
    if (!existing) throw AppError.notFound("Task not found");

    await db.update(tasks)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.tenantId, tenantId)));

    await writeAuditLog(db, {
      tenantId,
      entityType: "task",
      entityId: id,
      action: "deleted",
      actorId: sub,
      diff: { deletedAt: { old: null, new: new Date().toISOString() } },
    });

    reply.status(204).send();
  });

  // --- Sub-task endpoints (FR-123) ---

  // GET /:id/subtasks — list child tasks
  app.get("/:id/subtasks", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { id } = request.params as { id: string };

    // Verify parent task exists
    const parent = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, id), eq(tasks.tenantId, tenantId), isNull(tasks.deletedAt)),
    });
    if (!parent) throw AppError.notFound("Task not found");

    const subtasks = await db.select().from(tasks)
      .where(and(
        eq(tasks.parentTaskId, id),
        eq(tasks.tenantId, tenantId),
        isNull(tasks.deletedAt),
      ))
      .orderBy(tasks.position);

    return { data: subtasks.map(normalizeStatus) };
  });

  // POST /:id/promote — move sub-task up to parent's level
  app.post("/:id/promote", async (request) => {
    const { tenantId, sub } = request.jwtPayload;
    const { id } = request.params as { id: string };

    const task = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, id), eq(tasks.tenantId, tenantId), isNull(tasks.deletedAt)),
    });
    if (!task) throw AppError.notFound("Task not found");
    if (!task.parentTaskId) throw AppError.badRequest("Task has no parent — cannot promote");

    // Get the parent to find its parentTaskId (the new level)
    const parent = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, task.parentTaskId), eq(tasks.tenantId, tenantId)),
    });

    const newParentId = parent?.parentTaskId ?? null;

    const [updated] = await db.update(tasks)
      .set({ parentTaskId: newParentId, updatedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.tenantId, tenantId)))
      .returning();

    await writeAuditLog(db, {
      tenantId,
      entityType: "task",
      entityId: id,
      action: "promoted",
      actorId: sub,
      diff: { parentTaskId: { old: task.parentTaskId, new: newParentId } },
    });

    return { data: updated };
  });

  // POST /:id/demote — make task a child of another task
  const demoteBodySchema = z.object({ parentTaskId: z.string().uuid() });

  app.post("/:id/demote", async (request) => {
    const { tenantId, sub } = request.jwtPayload;
    const { id } = request.params as { id: string };
    const { parentTaskId } = demoteBodySchema.parse(request.body);

    const task = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, id), eq(tasks.tenantId, tenantId), isNull(tasks.deletedAt)),
    });
    if (!task) throw AppError.notFound("Task not found");

    // Verify the new parent exists and is in the same project
    const newParent = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, parentTaskId), eq(tasks.tenantId, tenantId), isNull(tasks.deletedAt)),
    });
    if (!newParent) throw AppError.notFound("Parent task not found");
    if (newParent.projectId !== task.projectId) {
      throw AppError.badRequest("Parent task must be in the same project");
    }
    if (parentTaskId === id) {
      throw AppError.badRequest("A task cannot be its own parent");
    }

    const oldParentId = task.parentTaskId;

    const [updated] = await db.update(tasks)
      .set({ parentTaskId, updatedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.tenantId, tenantId)))
      .returning();

    await writeAuditLog(db, {
      tenantId,
      entityType: "task",
      entityId: id,
      action: "demoted",
      actorId: sub,
      diff: { parentTaskId: { old: oldParentId ?? null, new: parentTaskId } },
    });

    return { data: updated };
  });
}
