// Ref: ARCHITECTURE 1.md §1.1 — ElastiCache Redis Serverless for session cache, rate limiting
import type { FastifyInstance } from "fastify";
import Redis from "ioredis";
import type { Env } from "../config/env.js";

let redisClient: Redis | null = null;

export async function redisPlugin(app: FastifyInstance): Promise<void> {
  const env = app.env as Env;

  try {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 5000,
    });

    await redisClient.connect();
    app.log.info(`Redis connected: ${env.REDIS_URL.replace(/\/\/.*@/, "//***@")}`);
  } catch (err) {
    app.log.warn("Redis not available — falling back to in-memory. Rate limiting will not persist across restarts.");
    redisClient = null;
  }

  app.addHook("onClose", async () => {
    if (redisClient) {
      await redisClient.quit().catch(() => {});
      redisClient = null;
    }
  });
}

export function getRedis(): Redis | null {
  return redisClient;
}

// ---------------------------------------------------------------------------
// Rate limit helpers (used by the rate-limiter hook)
// ---------------------------------------------------------------------------

const WINDOW_SEC = 60;

/**
 * Increment a rate-limit counter for the given key.
 * Returns the current count within the sliding window.
 * Falls back to -1 if Redis is unavailable (caller should use in-memory).
 */
export async function redisRateIncrement(tenantId: string): Promise<number> {
  if (!redisClient) return -1;

  const key = `rl:${tenantId}`;
  const count = await redisClient.incr(key);
  if (count === 1) {
    await redisClient.expire(key, WINDOW_SEC);
  }
  return count;
}

// ---------------------------------------------------------------------------
// Refresh token cache helpers
// ---------------------------------------------------------------------------

const REFRESH_TOKEN_TTL_SEC = 30 * 24 * 60 * 60; // 30 days

/**
 * Cache a refresh token in Redis (mirrors DB storage for fast lookup).
 */
export async function cacheRefreshToken(userId: string, token: string): Promise<void> {
  if (!redisClient) return;
  await redisClient.set(`rt:${userId}`, token, "EX", REFRESH_TOKEN_TTL_SEC);
}

/**
 * Get a cached refresh token. Returns null if Redis is unavailable or key is missing.
 */
export async function getCachedRefreshToken(userId: string): Promise<string | null> {
  if (!redisClient) return null;
  return redisClient.get(`rt:${userId}`);
}

/**
 * Delete a cached refresh token (on logout).
 */
export async function deleteCachedRefreshToken(userId: string): Promise<void> {
  if (!redisClient) return;
  await redisClient.del(`rt:${userId}`);
}
