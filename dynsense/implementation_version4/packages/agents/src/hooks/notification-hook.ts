// Ref: FR-348 — notification-hook: notify users on AI-initiated mutations
// Ref: design-doc §4.4 — Phase: PostToolUse (parallel)
// R0: Console logging only — real NATS integration comes in R1
import type { HookContext } from "./tenant-isolator.js";

export async function notificationHook(
  ctx: HookContext,
  disposition: string,
): Promise<void> {
  // R0 implementation: log to console for observability.
  // In R1, this publishes to NATS pm.notifications stream targeting
  // relevant users (assignees, project PMs).
  console.log(
    `[notification-hook] tenant=${ctx.tenantId} action=${ctx.aiActionId} ` +
      `tool=${ctx.toolName} disposition=${disposition}`,
  );
}
