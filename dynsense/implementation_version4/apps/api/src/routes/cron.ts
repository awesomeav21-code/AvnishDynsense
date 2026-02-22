// Ref: FR-206 — AI PM Agent — 15-minute autonomous loops
// Ref: FR-601 — AI PM Agent capability enhancements with nudge logic
// Ref: FR-602 — Status report auto-generation with review workflow
// Ref: FR-604 — Cross-project dependency flagging
// Ref: FR-607 — Scope creep detection against WBS baseline
import type { FastifyInstance } from "fastify";
import { eq, and, lt, desc, isNull, ne, sql, gte, count } from "drizzle-orm";
import { tasks, projects, aiActions, notifications, taskDependencies, tenantConfigs } from "@dynsense/db";
import { AI_MAX_NUDGES_PER_TASK_PER_DAY } from "@dynsense/shared";
import { AIOrchestrator } from "@dynsense/agents";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";

export async function cronRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);
  const orchestrator = new AIOrchestrator({
    db,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
  });

  app.addHook("preHandler", authenticate);

  // POST /ai-pm-loop — AI PM Agent 15-min cron loop (FR-206, FR-601)
  // In production, this would be triggered by Vercel Cron / external scheduler
  app.post("/ai-pm-loop", {
    preHandler: [requirePermission("ai:execute")],
  }, async (request, reply) => {
    const { tenantId, sub: userId } = request.jwtPayload;
    const now = new Date();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    // ── 1. Find overdue tasks (due_date < now, not completed) ──
    const overdueTasks = await db.select({
      id: tasks.id,
      title: tasks.title,
      assigneeId: tasks.assigneeId,
      dueDate: tasks.dueDate,
      projectId: tasks.projectId,
    })
      .from(tasks)
      .where(and(
        eq(tasks.tenantId, tenantId),
        lt(tasks.dueDate, now),
        isNull(tasks.deletedAt),
        ne(tasks.status, "completed"),
        ne(tasks.status, "cancelled"),
      ))
      .limit(50);

    // ── 2. Find stalled tasks (no update >48h, not blocked, not completed) ──
    const stalledTasks = await db.select({
      id: tasks.id,
      title: tasks.title,
      assigneeId: tasks.assigneeId,
      updatedAt: tasks.updatedAt,
      projectId: tasks.projectId,
    })
      .from(tasks)
      .where(and(
        eq(tasks.tenantId, tenantId),
        lt(tasks.updatedAt, fortyEightHoursAgo),
        isNull(tasks.deletedAt),
        ne(tasks.status, "completed"),
        ne(tasks.status, "cancelled"),
        ne(tasks.status, "blocked"),
        ne(tasks.status, "created"),
      ))
      .limit(50);

    // ── FR-305: Quiet hours check ──
    let quietStart = 22; // default 10 PM
    let quietEnd = 7;    // default 7 AM
    try {
      const quietRow = await db.select().from(tenantConfigs)
        .where(and(eq(tenantConfigs.tenantId, tenantId), eq(tenantConfigs.key, "ai.quiet_hours")))
        .limit(1);
      if (quietRow[0]) {
        const val = quietRow[0].value as { start?: number; end?: number } | null;
        if (val?.start !== undefined) quietStart = val.start;
        if (val?.end !== undefined) quietEnd = val.end;
      }
    } catch { /* use defaults */ }

    const currentHour = now.getHours();
    const inQuietHours = quietStart > quietEnd
      ? (currentHour >= quietStart || currentHour < quietEnd)  // e.g., 22-7 wraps midnight
      : (currentHour >= quietStart && currentHour < quietEnd);

    // ── 3. Generate nudge notifications for overdue/stalled tasks ──
    const nudges: Array<{ taskId: string; userId: string; reason: string }> = [];

    if (!inQuietHours) {
      // FR-306: Nudge limit tracking — max per task per day
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);

      for (const task of overdueTasks) {
        if (task.assigneeId) {
          // Check today's nudge count for this task
          const nudgeCountResult = await db
            .select({ cnt: count() })
            .from(notifications)
            .where(and(
              eq(notifications.tenantId, tenantId),
              eq(notifications.type, "ai_nudge"),
              gte(notifications.createdAt, startOfDay),
              sql`${notifications.data}->>'taskId' = ${task.id}`,
            ));
          const todayCount = Number(nudgeCountResult[0]?.cnt ?? 0);
          if (todayCount < AI_MAX_NUDGES_PER_TASK_PER_DAY) {
            nudges.push({
              taskId: task.id,
              userId: task.assigneeId,
              reason: `Task "${task.title}" is overdue (due: ${task.dueDate?.toISOString().split("T")[0]})`,
            });
          }
        }
      }

      for (const task of stalledTasks) {
        if (task.assigneeId) {
          const nudgeCountResult = await db
            .select({ cnt: count() })
            .from(notifications)
            .where(and(
              eq(notifications.tenantId, tenantId),
              eq(notifications.type, "ai_nudge"),
              gte(notifications.createdAt, startOfDay),
              sql`${notifications.data}->>'taskId' = ${task.id}`,
            ));
          const todayCount = Number(nudgeCountResult[0]?.cnt ?? 0);
          if (todayCount < AI_MAX_NUDGES_PER_TASK_PER_DAY) {
            nudges.push({
              taskId: task.id,
              userId: task.assigneeId,
              reason: `Task "${task.title}" has had no activity for >48 hours`,
            });
          }
        }
      }
    }

    // Create notifications for nudges
    for (const nudge of nudges) {
      await db.insert(notifications).values({
        tenantId,
        userId: nudge.userId,
        type: "ai_nudge",
        title: "AI PM Nudge",
        body: nudge.reason,
        data: { taskId: nudge.taskId, source: "ai_pm_agent" },
      });
    }

    // ── 4. Escalation proposals — create for PM when threshold exceeded ──
    const escalations: Array<{ projectId: string; reason: string; taskCount: number }> = [];

    // Group overdue tasks by project
    const overdueByProject = new Map<string, number>();
    for (const task of overdueTasks) {
      overdueByProject.set(task.projectId, (overdueByProject.get(task.projectId) ?? 0) + 1);
    }

    for (const [projectId, count] of overdueByProject) {
      if (count >= 3) {
        escalations.push({
          projectId,
          reason: `${count} tasks are overdue in this project`,
          taskCount: count,
        });
      }
    }

    // Create AI actions for escalation proposals
    for (const escalation of escalations) {
      await db.insert(aiActions).values({
        tenantId,
        capability: "ai_pm_agent",
        status: "proposed",
        disposition: "propose",
        input: { type: "escalation", projectId: escalation.projectId },
        output: {
          type: "escalation_proposal",
          projectId: escalation.projectId,
          reason: escalation.reason,
          taskCount: escalation.taskCount,
          recommendation: "Consider reassigning tasks or adjusting deadlines",
        },
        triggeredBy: userId,
      });
    }

    // ── 5. Cross-project dependency flagging (FR-604) ──
    // Find tasks that depend on tasks in other projects
    const crossProjectDeps = await db
      .select({
        blockerProjectId: sql<string>`blocker.project_id`.as("blocker_project_id"),
        blockedProjectId: sql<string>`blocked.project_id`.as("blocked_project_id"),
        blockerTaskId: taskDependencies.blockerTaskId,
        blockedTaskId: taskDependencies.blockedTaskId,
      })
      .from(taskDependencies)
      .innerJoin(sql`tasks blocker`, sql`blocker.id = ${taskDependencies.blockerTaskId}`)
      .innerJoin(sql`tasks blocked`, sql`blocked.id = ${taskDependencies.blockedTaskId}`)
      .where(sql`blocker.tenant_id = ${tenantId} AND blocker.project_id != blocked.project_id`)
      .limit(20);

    // ── 6. Summary report generation (FR-602) ──
    const activeProjects = await db.select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(and(eq(projects.tenantId, tenantId), eq(projects.status, "active")))
      .limit(10);

    let summaryAction = null;
    if (activeProjects.length > 0) {
      const result = await orchestrator.execute({
        tenantId,
        userId,
        capability: "summary_writer",
        input: {
          type: "weekly_status",
          projects: activeProjects.map(p => p.name),
          overdueCount: overdueTasks.length,
          stalledCount: stalledTasks.length,
          nudgeCount: nudges.length,
        },
      });

      const [action] = await db.insert(aiActions).values({
        tenantId,
        capability: "summary_writer",
        status: result.status,
        disposition: result.disposition,
        input: { type: "weekly_status" },
        output: result.output,
        confidence: result.confidence?.toString() ?? null,
        triggeredBy: userId,
      }).returning();

      summaryAction = action;
    }

    reply.send({
      data: {
        overdueTasks: overdueTasks.length,
        stalledTasks: stalledTasks.length,
        nudgesSent: nudges.length,
        nudgesSkippedQuietHours: inQuietHours,
        escalationProposals: escalations.length,
        crossProjectDeps: crossProjectDeps.length,
        summaryGenerated: !!summaryAction,
      },
    });
  });

  // POST /scope-check — Scope Creep Detector (FR-607)
  app.post("/scope-check", {
    preHandler: [requirePermission("ai:execute")],
  }, async (request, reply) => {
    const { tenantId, sub: userId } = request.jwtPayload;
    const { projectId } = request.body as { projectId?: string };

    if (!projectId) {
      return reply.status(400).send({ error: "projectId is required" });
    }

    // Execute scope detection through orchestrator
    const result = await orchestrator.execute({
      tenantId,
      userId,
      capability: "scope_detector",
      input: { projectId },
    });

    const [action] = await db.insert(aiActions).values({
      tenantId,
      capability: "scope_detector",
      status: result.status,
      disposition: result.disposition,
      input: { projectId },
      output: result.output,
      confidence: result.confidence?.toString() ?? null,
      triggeredBy: userId,
    }).returning();

    reply.status(201).send({ data: action });
  });
}
