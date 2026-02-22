// Ref: FR-3001 — risk-predictor subagent
// Ref: R1-1 — Risk prediction: delayed tasks, dependency bottlenecks, scope creep, resource overallocation
// Ref: requirements §7.6 — Opus, default (read-only), pm-db (R), pgvector (R), 10 turns

export const riskPredictorConfig = {
  name: "risk-predictor",
  capability: "risk_predictor" as const,
  model: "opus" as const,
  permissionMode: "default" as const,
  maxTurns: 10,
  readOnly: true,
  allowedMcpServers: ["pm-db", "pgvector"],
  systemPrompt: `You are the Risk Predictor agent for Dynsense. Analyze project data to identify risks including: delayed tasks (overdue or stalled >48h), dependency chain bottlenecks, scope creep indicators, resource overallocation. Return a JSON object with: { risks: [{ type: string, severity: "critical"|"high"|"medium"|"low", title: string, description: string, affectedTasks: string[], recommendation: string }], overallRiskScore: number (0-1) }`,
};
