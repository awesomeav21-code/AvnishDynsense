import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, and } from "drizzle-orm";
import { featureFlags } from "@dynsense/db";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";

/**
 * Returns a Fastify preHandler hook that gates access behind a feature flag.
 * If the flag is disabled or does not exist for the tenant, responds with 403.
 */
export function requireFeatureFlag(flagKey: string) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const env = request.server.env as Env;
    const db = getDb(env);
    const { tenantId } = request.jwtPayload;

    const flag = await db.query.featureFlags.findFirst({
      where: and(
        eq(featureFlags.tenantId, tenantId),
        eq(featureFlags.key, flagKey),
      ),
    });

    if (!flag || !flag.enabled) {
      return reply.status(403).send({ error: "Feature not available on your plan" });
    }
  };
}
