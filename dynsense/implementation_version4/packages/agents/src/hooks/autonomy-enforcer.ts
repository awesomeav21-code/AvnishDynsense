// Ref: FR-342 — autonomy-enforcer hook: enforce shadow/propose/execute per action
// Ref: FR-300 — Three autonomy modes
// Ref: design-doc §4.4 — Phase: PreToolUse (sequential)
import { eq, and } from "drizzle-orm";
import type { Database } from "@dynsense/db";
import { tenantConfigs } from "@dynsense/db";
import type { HookContext, HookResult } from "./tenant-isolator.js";

export async function autonomyEnforcer(
  ctx: HookContext,
  db?: Database,
): Promise<HookResult> {
  let mode: "shadow" | "propose" | "execute" = "propose"; // safe default

  if (db) {
    try {
      // Check capability-specific autonomy config
      const capRow = await db
        .select()
        .from(tenantConfigs)
        .where(
          and(
            eq(tenantConfigs.tenantId, ctx.tenantId),
            eq(tenantConfigs.key, `ai.autonomy.${ctx.toolName}`),
          ),
        )
        .limit(1);

      if (capRow[0]) {
        const value = capRow[0].value as { mode?: string } | null;
        if (value?.mode === "shadow" || value?.mode === "propose" || value?.mode === "execute") {
          mode = value.mode;
        }
      } else {
        // Fall back to global default
        const globalRow = await db
          .select()
          .from(tenantConfigs)
          .where(
            and(
              eq(tenantConfigs.tenantId, ctx.tenantId),
              eq(tenantConfigs.key, "ai.autonomy.default"),
            ),
          )
          .limit(1);

        if (globalRow[0]) {
          const value = globalRow[0].value as { mode?: string } | null;
          if (value?.mode === "shadow" || value?.mode === "propose" || value?.mode === "execute") {
            mode = value.mode;
          }
        }
      }
    } catch {
      // DB query failure — default to propose (safest)
    }
  }

  // Shadow mode: allow but tag output as shadow-only (logged, never acted on)
  if (mode === "shadow") {
    return {
      allowed: true,
      reason: "Shadow mode — action will be logged but not executed",
      modifiedInput: { ...ctx.toolInput, _shadow: true, _propose: false },
    };
  }

  // Propose mode: allow but tag for human review
  if (mode === "propose") {
    return {
      allowed: true,
      reason: "Propose mode — action requires human approval",
      modifiedInput: { ...ctx.toolInput, _shadow: false, _propose: true },
    };
  }

  // Execute mode: allow full autonomous execution
  return {
    allowed: true,
    reason: "Execute mode — autonomous execution permitted",
    modifiedInput: { ...ctx.toolInput, _shadow: false, _propose: false },
  };
}
