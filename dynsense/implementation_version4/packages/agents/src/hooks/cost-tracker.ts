// Ref: FR-345 — cost-tracker hook: token/cost accounting to DB
// Ref: FR-363 — Per-tenant cost tracking
// Ref: design-doc §4.4 — Phase: PostToolUse (parallel)
import type { Database } from "@dynsense/db";
import { aiCostLog } from "@dynsense/db";
import type { HookContext } from "./tenant-isolator.js";

export interface CostTrackingData {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export async function costTracker(
  ctx: HookContext,
  costData: CostTrackingData,
  db: Database,
): Promise<void> {
  await db.insert(aiCostLog).values({
    tenantId: ctx.tenantId,
    aiActionId: ctx.aiActionId,
    model: costData.model,
    inputTokens: costData.inputTokens,
    outputTokens: costData.outputTokens,
    costUsd: costData.costUsd.toFixed(6),
  });
}
