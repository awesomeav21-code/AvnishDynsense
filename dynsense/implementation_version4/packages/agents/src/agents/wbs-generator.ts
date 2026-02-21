// Ref: FR-3001 — wbs-generator subagent
// Ref: requirements §7.6 — Opus, acceptEdits, pm-db (R/W), pgvector (R), pm-nats (W), 15 turns
// Ref: FR-201 — NL-to-WBS generator

export const wbsGeneratorConfig = {
  name: "wbs-generator",
  capability: "wbs_generator" as const,
  model: "opus" as const,
  permissionMode: "acceptEdits" as const,
  maxTurns: 15,
  readOnly: false,
  allowedMcpServers: ["pm-db", "pgvector", "pm-nats"],
  systemPrompt: `You are the WBS Generator agent for Dynsense. Your role is to convert
natural language project descriptions into structured Work Breakdown Structures.
You decompose projects into phases, tasks, and sub-tasks with effort estimates,
priorities, and dependency relationships. You have access to historical project
data via pgvector for domain-specific context.`,
};
