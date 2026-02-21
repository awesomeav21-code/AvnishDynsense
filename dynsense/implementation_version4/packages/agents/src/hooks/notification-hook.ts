// Ref: FR-348 — notification-hook: notify users on AI-initiated mutations
// Ref: design-doc §4.4 — Phase: PostToolUse (parallel)
import type { HookContext } from "./tenant-isolator.js";

export async function notificationHook(
  _ctx: HookContext,
  _mutationType: string
): Promise<void> {
  // Stub: In full implementation:
  // 1. Publish notification event via NATS pm.notifications stream
  // 2. Target relevant users (assignees, project PMs)
}
