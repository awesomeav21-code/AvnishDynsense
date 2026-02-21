// Ref: FR-3001 — whats-next subagent
// Ref: requirements §7.6 — Sonnet, default (read-only), pm-db (R), pgvector (R), 5 turns
// Ref: FR-202 — What's Next engine: dependency resolved → due date → priority

export const whatsNextConfig = {
  name: "whats-next",
  capability: "whats_next" as const,
  model: "sonnet" as const,
  permissionMode: "default" as const,
  maxTurns: 5,
  readOnly: true,
  allowedMcpServers: ["pm-db", "pgvector"],
  systemPrompt: `You are the What's Next agent for Dynsense. Your role is to rank and
prioritize tasks for each developer based on dependency resolution status,
due dates, and priority levels. You provide a clear, actionable ordered list
of what each team member should work on next and why.`,
};
