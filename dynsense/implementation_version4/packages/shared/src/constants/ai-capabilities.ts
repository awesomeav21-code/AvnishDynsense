// Ref: design-doc §4.2 — Ten AI Capabilities with model routing
// Ref: FR-3001 — Subagent definitions with tool restrictions
// Ref: FR-303 — Confidence threshold default 0.6
// Ref: FR-306 — Nudge limits max 2/task/day
// Ref: FR-3003 — Session retention 30 days
import type { AiCapability, AiModel, PermissionMode } from "../types/ai.js";

export interface SubagentConfig {
  capability: AiCapability;
  model: AiModel;
  permissionMode: PermissionMode;
  maxTurns: number;
  readOnly: boolean;
}

// Ref: requirements §7.6 — R0 subagent specifications table
export const R0_SUBAGENTS: readonly SubagentConfig[] = [
  {
    capability: "wbs_generator",
    model: "opus",
    permissionMode: "acceptEdits",
    maxTurns: 15,
    readOnly: false,
  },
  {
    capability: "whats_next",
    model: "sonnet",
    permissionMode: "default",
    maxTurns: 5,
    readOnly: true,
  },
  {
    capability: "nl_query",
    model: "sonnet",
    permissionMode: "default",
    maxTurns: 10,
    readOnly: true,
  },
  {
    capability: "summary_writer",
    model: "sonnet",
    permissionMode: "default",
    maxTurns: 5,
    readOnly: true,
  },
];

// Ref: R1-1 — R1 subagent specifications: risk predictor, AI PM, scope detector
export const R1_SUBAGENTS: readonly SubagentConfig[] = [
  {
    capability: "risk_predictor",
    model: "opus",
    permissionMode: "default",
    maxTurns: 10,
    readOnly: true,
  },
  {
    capability: "ai_pm_agent",
    model: "sonnet",
    permissionMode: "default",
    maxTurns: 5,
    readOnly: true,
  },
  {
    capability: "scope_detector",
    model: "sonnet",
    permissionMode: "default",
    maxTurns: 5,
    readOnly: true,
  },
];

// Combined R0 + R1 subagents for orchestrator validation
export const ALL_SUBAGENTS: readonly SubagentConfig[] = [
  ...R0_SUBAGENTS,
  ...R1_SUBAGENTS,
];

export const AI_CONFIDENCE_THRESHOLD = 0.6;
export const AI_MAX_NUDGES_PER_TASK_PER_DAY = 2;
export const AI_SESSION_RETENTION_DAYS = 30;
export const AI_CIRCUIT_BREAKER_THRESHOLD = 5;
export const AI_CIRCUIT_BREAKER_RESET_MS = 60_000;
