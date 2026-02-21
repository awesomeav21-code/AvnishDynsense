// Ref: FR-3005 — Permission Evaluation Chain (4-step)
// Step 1: hook results → Step 2: ai_agent_configs rules →
// Step 3: agent permission mode → Step 4: fallback DENY mutations, ALLOW reads
// Ref: FR-3006 — Tool Restrictions per Agent (principle of least privilege)

export type PermissionDecision = "allow" | "deny";

export interface PermissionEvalInput {
  hookDecision: PermissionDecision;
  agentConfigRules: Record<string, unknown> | null;
  agentPermissionMode: string;
  toolName: string;
  isMutation: boolean;
}

export function evaluatePermission(input: PermissionEvalInput): PermissionDecision {
  // Step 1: If hooks denied, deny
  if (input.hookDecision === "deny") return "deny";

  // Step 2: If agent config has explicit rules, apply them
  if (input.agentConfigRules) {
    // Stub: evaluate config-level rules
  }

  // Step 3: Check agent permission mode
  if (input.agentPermissionMode === "bypassPermissions") return "allow";
  if (input.agentPermissionMode === "acceptEdits" && input.isMutation) return "allow";
  if (input.agentPermissionMode === "default" && input.isMutation) return "deny";

  // Step 4: Fallback — DENY mutations, ALLOW reads
  return input.isMutation ? "deny" : "allow";
}
