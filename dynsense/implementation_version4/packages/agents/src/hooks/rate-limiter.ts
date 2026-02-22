// Ref: FR-343 — rate-limiter hook: in-memory sliding window for R0 (Redis in R1)
// Ref: FR-307 — Daily AI cost cap per tenant
// Ref: design-doc §4.4 — Phase: PreToolUse (sequential)
import { eq, and, gte, sql } from "drizzle-orm";
import type { Database } from "@dynsense/db";
import { aiCostLog, tenantConfigs } from "@dynsense/db";
import type { HookContext, HookResult } from "./tenant-isolator.js";

// ---------------------------------------------------------------------------
// In-memory rate limit store (R0 — replaced by Redis in R1)
// ---------------------------------------------------------------------------

interface RateEntry {
  count: number;
  windowStart: number;
}

const WINDOW_MS = 60_000; // 1-minute sliding window
const MAX_CALLS_PER_MINUTE = 100;
const DEFAULT_DAILY_COST_CAP_USD = 50.0; // FR-307: default $50/day

// Per-tenant rate counters
const tenantCounters = new Map<string, RateEntry>();

// ---------------------------------------------------------------------------
// Rate limiter hook
// ---------------------------------------------------------------------------

export async function rateLimiter(
  ctx: HookContext,
  db: Database,
): Promise<HookResult & { remainingBudgetUsd?: number }> {
  const now = Date.now();
  const entry = tenantCounters.get(ctx.tenantId);

  // ── Per-minute rate limit ──
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    tenantCounters.set(ctx.tenantId, { count: 1, windowStart: now });
  } else {
    entry.count += 1;
    if (entry.count > MAX_CALLS_PER_MINUTE) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${entry.count}/${MAX_CALLS_PER_MINUTE} calls in current window for tenant ${ctx.tenantId}`,
      };
    }
  }

  // ── FR-307: Daily AI cost cap ──
  try {
    // Read tenant-specific daily cost cap from config
    let dailyCap = DEFAULT_DAILY_COST_CAP_USD;
    const capRow = await db
      .select()
      .from(tenantConfigs)
      .where(
        and(
          eq(tenantConfigs.tenantId, ctx.tenantId),
          eq(tenantConfigs.key, "ai.daily_cost_cap_usd"),
        ),
      )
      .limit(1);

    if (capRow[0]) {
      const value = capRow[0].value as { cap?: number } | null;
      if (value?.cap && typeof value.cap === "number") {
        dailyCap = value.cap;
      }
    }

    // Sum today's cost from ai_cost_log
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const costResult = await db
      .select({
        totalCost: sql<string>`COALESCE(SUM(${aiCostLog.costUsd}), 0)`,
      })
      .from(aiCostLog)
      .where(
        and(
          eq(aiCostLog.tenantId, ctx.tenantId),
          gte(aiCostLog.createdAt, startOfDay),
        ),
      );

    const todayCost = parseFloat(costResult[0]?.totalCost ?? "0");

    if (todayCost >= dailyCap) {
      return {
        allowed: false,
        reason: `Daily AI cost cap exceeded: $${todayCost.toFixed(2)} / $${dailyCap.toFixed(2)} for tenant ${ctx.tenantId}`,
      };
    }

    // Return remaining budget so orchestrator can do pre-flight cost check
    return { allowed: true, remainingBudgetUsd: dailyCap - todayCost };
  } catch {
    // Cost cap check is non-blocking — allow on DB error
  }

  return { allowed: true };
}
