// Ref: FR-346 — audit-writer hook: log all hook decisions to ai_hook_log
// Ref: design-doc §4.4 — Phase: PostToolUse (parallel)
import type { Database } from "@dynsense/db";
import { aiHookLog } from "@dynsense/db";
import type { HookContext, HookResult } from "./tenant-isolator.js";

export async function auditWriter(
  ctx: HookContext,
  hookName: string,
  phase: string,
  result: HookResult,
  db: Database,
): Promise<void> {
  await db.insert(aiHookLog).values({
    tenantId: ctx.tenantId,
    hookName,
    phase,
    decision: result.allowed ? "allow" : "deny",
    reason: result.reason ?? null,
    aiActionId: ctx.aiActionId,
  });
}
