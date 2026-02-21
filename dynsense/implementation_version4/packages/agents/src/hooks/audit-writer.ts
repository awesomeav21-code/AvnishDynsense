// Ref: FR-346 — audit-writer hook: log all hook decisions to ai_hook_log
// Ref: design-doc §4.4 — Phase: PostToolUse (parallel)
import type { HookContext, HookResult } from "./tenant-isolator.js";

export async function auditWriter(
  _ctx: HookContext,
  _hookName: string,
  _phase: string,
  _result: HookResult
): Promise<void> {
  // Stub: In full implementation, inserts into ai_hook_log table:
  // { tenant_id, hook_name, phase, decision, reason, ai_action_id }
}
