// Ref: FR-343 — rate-limiter hook: in-memory sliding window for R0 (Redis in R1)
// Ref: FR-307 — Daily AI cost cap per tenant with Redis tracking
// Ref: design-doc §4.4 — Phase: PreToolUse (sequential)
import type { Database } from "@dynsense/db";
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

// Per-tenant rate counters
const tenantCounters = new Map<string, RateEntry>();

// ---------------------------------------------------------------------------
// Rate limiter hook
// ---------------------------------------------------------------------------

export async function rateLimiter(
  ctx: HookContext,
  _db: Database,
): Promise<HookResult> {
  const now = Date.now();
  const entry = tenantCounters.get(ctx.tenantId);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    // Start a new window
    tenantCounters.set(ctx.tenantId, { count: 1, windowStart: now });
    return { allowed: true };
  }

  // Within current window
  entry.count += 1;

  if (entry.count > MAX_CALLS_PER_MINUTE) {
    return {
      allowed: false,
      reason: `Rate limit exceeded: ${entry.count}/${MAX_CALLS_PER_MINUTE} calls in current window for tenant ${ctx.tenantId}`,
    };
  }

  return { allowed: true };
}
