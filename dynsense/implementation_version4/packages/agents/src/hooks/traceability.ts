// Ref: FR-347 — traceability hook: link mutations to ai_action records
// Ref: FR-143 — AI action traceability
// Ref: design-doc §4.4 — Phase: PostToolUse (parallel)
import { eq, and, isNull } from "drizzle-orm";
import type { Database } from "@dynsense/db";
import { auditLog } from "@dynsense/db";
import type { HookContext } from "./tenant-isolator.js";

export async function traceability(
  ctx: HookContext,
  _mutationResult: unknown,
  db: Database,
): Promise<void> {
  // Link any audit_log entries for this tenant that were created during this
  // AI action but do not yet have an ai_action_id set. This stamps AI
  // provenance on mutations made by the orchestrator pipeline.
  await db
    .update(auditLog)
    .set({ aiActionId: ctx.aiActionId })
    .where(
      and(
        eq(auditLog.tenantId, ctx.tenantId),
        eq(auditLog.actorType, "ai"),
        isNull(auditLog.aiActionId),
      ),
    );
}
