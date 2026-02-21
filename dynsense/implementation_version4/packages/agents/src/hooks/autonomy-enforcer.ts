// Ref: FR-342 — autonomy-enforcer hook: enforce shadow/propose/execute per action
// Ref: FR-300 — Three autonomy modes
// Ref: design-doc §4.4 — Phase: PreToolUse (sequential)
import type { HookContext, HookResult } from "./tenant-isolator.js";

export async function autonomyEnforcer(ctx: HookContext): Promise<HookResult> {
  // Stub: In full implementation, checks tenant autonomy policy for this capability.
  // Default: propose mode — mutations require human review.
  const isMutation = ctx.toolName === "mutate";

  if (isMutation) {
    // In propose mode, flag mutations for review rather than blocking
    return {
      allowed: true,
      reason: "Mutation flagged for review (propose mode)",
      modifiedInput: { ...ctx.toolInput, _shadow: false, _propose: true },
    };
  }

  return { allowed: true };
}
