// Ref: design-doc §4.2 — Ten AI Capabilities
export type AiCapability =
  | "wbs_generator"
  | "whats_next"
  | "nl_query"
  | "summary_writer"
  | "risk_predictor"
  | "ai_pm_agent"
  | "scope_detector"
  | "writing_assistant"
  | "sow_generator"
  | "learning_agent";

// Ref: FR-300 — Three autonomy modes: shadow, propose, execute
export type AiDisposition = "shadow" | "propose" | "execute";

// Ref: design-doc §4.1 — Stage 7 DISPOSITION outputs
export type AiActionStatus =
  | "pending"
  | "running"
  | "proposed"
  | "approved"
  | "rejected"
  | "executed"
  | "failed"
  | "rolled_back";

// Ref: design-doc §4.2 — Opus for generation/risk, Sonnet for queries/summaries
export type AiModel = "opus" | "sonnet";

// Ref: FR-3005 — Permission evaluation chain
export type PermissionMode = "default" | "acceptEdits" | "bypassPermissions";

export interface AiActionSummary {
  id: string;
  tenantId: string;
  capability: AiCapability;
  status: AiActionStatus;
  disposition: AiDisposition;
  confidence: number | null;
  createdAt: string;
}
