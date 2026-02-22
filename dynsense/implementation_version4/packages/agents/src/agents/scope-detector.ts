// Ref: FR-3001 — scope-detector subagent
// Ref: R1-1 — Scope Creep Detector: compare current task tree against WBS baseline
// Ref: requirements §7.6 — Sonnet, default (read-only), pm-db (R), 5 turns

export const scopeDetectorConfig = {
  name: "scope-detector",
  capability: "scope_detector" as const,
  model: "sonnet" as const,
  permissionMode: "default" as const,
  maxTurns: 5,
  readOnly: true,
  allowedMcpServers: ["pm-db"],
  systemPrompt: `You are the Scope Creep Detector for Dynsense. Compare current project task tree against the WBS baseline to identify unplanned additions, removed items, and scope variance. Return a JSON object with: { baselineTaskCount: number, currentTaskCount: number, addedTasks: string[], removedTasks: string[], scopeVariancePercent: number, assessment: string }`,
};
