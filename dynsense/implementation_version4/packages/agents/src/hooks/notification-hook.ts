// Ref: FR-348 — notification-hook: notify users on AI-initiated mutations
// Ref: FR-306 — Nudge limits: max 2 per task per day
// Ref: design-doc §4.4 — Phase: PostToolUse (parallel)
// R0: Write to notifications table. R1 adds NATS pub/sub delivery.
import { eq, and, gte, count } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { Database } from "@dynsense/db";
import { notifications, tasks } from "@dynsense/db";
import { AI_MAX_NUDGES_PER_TASK_PER_DAY } from "@dynsense/shared";
import type { HookContext } from "./tenant-isolator.js";

export interface NotificationOptions {
  notificationType?: "nudge" | "proposal" | "execution";
}

export async function notificationHook(
  ctx: HookContext,
  disposition: string,
  db?: Database,
  options?: NotificationOptions,
): Promise<void> {
  // Always log for observability
  console.log(
    `[notification-hook] tenant=${ctx.tenantId} action=${ctx.aiActionId} ` +
      `tool=${ctx.toolName} disposition=${disposition}`,
  );

  // If DB provided and disposition warrants notification, create in-app notification
  if (db && (disposition === "propose" || disposition === "execute")) {
    try {
      // Try to find the assignee of the related task if taskId is in the input
      const taskId = ctx.toolInput["taskId"] as string | undefined;
      let targetUserId = ctx.userId;

      if (taskId) {
        const taskRow = await db
          .select({ assigneeId: tasks.assigneeId })
          .from(tasks)
          .where(
            and(eq(tasks.id, taskId), eq(tasks.tenantId, ctx.tenantId)),
          )
          .limit(1);

        if (taskRow[0]?.assigneeId) {
          targetUserId = taskRow[0].assigneeId;
        }
      }

      // FR-306: Enforce nudge rate limit (max 2 per task per day)
      if (options?.notificationType === "nudge" && taskId) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const nudgeCountResult = await db
          .select({ cnt: count() })
          .from(notifications)
          .where(
            and(
              eq(notifications.tenantId, ctx.tenantId),
              eq(notifications.type, "ai_nudge"),
              gte(notifications.createdAt, startOfDay),
              sql`${notifications.data}->>'taskId' = ${taskId}`,
            ),
          );

        const todayCount = Number(nudgeCountResult[0]?.cnt ?? 0);
        if (todayCount >= AI_MAX_NUDGES_PER_TASK_PER_DAY) {
          console.log(
            `[notification-hook] Nudge limit reached for task ${taskId}: ${todayCount}/${AI_MAX_NUDGES_PER_TASK_PER_DAY}`,
          );
          return; // Skip — don't create notification
        }
      }

      const notificationType = options?.notificationType === "nudge"
        ? "ai_nudge"
        : disposition === "execute"
          ? "ai_action_executed"
          : "ai_action_proposed";

      await db.insert(notifications).values({
        tenantId: ctx.tenantId,
        userId: targetUserId,
        type: notificationType,
        title: options?.notificationType === "nudge"
          ? `AI nudge: ${ctx.toolName}`
          : disposition === "execute"
            ? `AI executed: ${ctx.toolName}`
            : `AI proposal: ${ctx.toolName}`,
        body: options?.notificationType === "nudge"
          ? `AI PM detected an issue with "${ctx.toolName}". Please review.`
          : disposition === "execute"
            ? `AI autonomously executed "${ctx.toolName}". Review in AI Review.`
            : `AI proposed an action for "${ctx.toolName}". Please review and approve.`,
        data: { aiActionId: ctx.aiActionId, capability: ctx.toolName, disposition, taskId },
      });
    } catch {
      // Non-blocking — notification delivery failure should not break the pipeline
    }
  }
}
