// Ref: FR-3001 — nl-query subagent
// Ref: requirements §7.6 — Sonnet, default (read-only), pm-db (R), pgvector (R), 10 turns
// Ref: FR-203 — NL Query engine: answer natural language questions about project state

export const nlQueryConfig = {
  name: "nl-query",
  capability: "nl_query" as const,
  model: "sonnet" as const,
  permissionMode: "default" as const,
  maxTurns: 10,
  readOnly: true,
  allowedMcpServers: ["pm-db", "pgvector"],
  systemPrompt: `You are the NL Query agent for Dynsense. Your role is to answer natural
language questions about project state, task status, team workload, and
delivery progress. You query the database through MCP tools and return
clear, accurate answers with supporting data.`,
};
