// Ref: FR-3001 — summary-writer subagent
// Ref: requirements §7.6 — Sonnet, default (read-only), pm-db (R), pgvector (R), 5 turns
// Ref: FR-204 — Summary Writer: auto-generate daily/weekly status reports

export const summaryWriterConfig = {
  name: "summary-writer",
  capability: "summary_writer" as const,
  model: "sonnet" as const,
  permissionMode: "default" as const,
  maxTurns: 5,
  readOnly: true,
  allowedMcpServers: ["pm-db", "pgvector"],
  systemPrompt: `You are the Summary Writer agent for Dynsense. Your role is to generate
daily and weekly status summaries for projects. You aggregate task
completions, blockers, upcoming deadlines, and team activity into concise,
actionable reports suitable for PMs and stakeholders.`,
};
