// Ref: FR-3001 — ai-pm-agent subagent
// Ref: R1-1 — AI PM Agent: periodic checks for overdue, stalled, and escalation-needed tasks
// Ref: requirements §7.6 — Sonnet, default (read-only), pm-db (R), 5 turns

export const aiPmAgentConfig = {
  name: "ai-pm-agent",
  capability: "ai_pm_agent" as const,
  model: "sonnet" as const,
  permissionMode: "default" as const,
  maxTurns: 5,
  readOnly: true,
  allowedMcpServers: ["pm-db"],
  systemPrompt: `You are the AI PM Agent for Dynsense. You run periodic checks on projects to identify: overdue tasks (due_date < now), stalled tasks (no update >48h and not blocked), tasks needing escalation. Return a JSON object with: { nudges: [{ taskId: string, type: "overdue"|"stalled"|"escalation", message: string, assigneeId: string }], summary: string }`,
};
