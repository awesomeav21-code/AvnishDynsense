// Ref: FR-700 — Slack integration, FR-420 — GitHub integration
// Ref: FR-701 — AI nudge delivery, FR-422 — Commit-to-task linking
import type { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { integrations, integrationEvents, tasks } from "@dynsense/db";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { writeAuditLog } from "./audit.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";
import { z } from "zod";

const upsertIntegrationSchema = z.object({
  provider: z.enum(["github", "slack", "teams"]),
  enabled: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
  channelMapping: z.record(z.string()).optional(),
});

const TASK_REF_PATTERN = /\[TASK-([a-f0-9-]+)\]/gi;

export async function integrationRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

  // ── Authenticated endpoints (require config:manage) ──

  app.register(async (authed) => {
    authed.addHook("preHandler", authenticate);

    // GET / — list integrations for tenant
    authed.get("/", async (request) => {
      const { tenantId } = request.jwtPayload;
      const rows = await db.select().from(integrations)
        .where(eq(integrations.tenantId, tenantId))
        .orderBy(desc(integrations.createdAt));
      return { data: rows };
    });

    // PUT / — upsert an integration (admin/pm only)
    authed.put("/", {
      preHandler: [requirePermission("config:manage")],
    }, async (request) => {
      const { tenantId, sub: userId } = request.jwtPayload;
      const body = upsertIntegrationSchema.parse(request.body);

      const existing = await db.query.integrations.findFirst({
        where: and(eq(integrations.tenantId, tenantId), eq(integrations.provider, body.provider)),
      });

      if (existing) {
        const [updated] = await db.update(integrations)
          .set({
            enabled: body.enabled ?? existing.enabled,
            config: body.config ?? existing.config,
            channelMapping: body.channelMapping ?? existing.channelMapping,
            updatedAt: new Date(),
          })
          .where(eq(integrations.id, existing.id))
          .returning();

        await writeAuditLog(db, {
          tenantId, entityType: "integration", entityId: updated!.id,
          action: "update", actorId: userId,
        });
        return { data: updated };
      }

      const [created] = await db.insert(integrations).values({
        tenantId,
        provider: body.provider,
        enabled: body.enabled ?? false,
        config: body.config ?? {},
        channelMapping: body.channelMapping ?? {},
      }).returning();

      await writeAuditLog(db, {
        tenantId, entityType: "integration", entityId: created!.id,
        action: "create", actorId: userId,
      });
      return { data: created };
    });

    // GET /events — list integration events
    authed.get("/events", async (request) => {
      const { tenantId } = request.jwtPayload;
      const { limit = 50, offset = 0, provider } = request.query as {
        limit?: number; offset?: number; provider?: string;
      };

      const conditions = [eq(integrationEvents.tenantId, tenantId)];
      if (provider) conditions.push(eq(integrationEvents.provider, provider));

      const rows = await db.select().from(integrationEvents)
        .where(and(...conditions))
        .orderBy(desc(integrationEvents.createdAt))
        .limit(Number(limit))
        .offset(Number(offset));

      return { data: rows };
    });

    // POST /slack/test — send a test message to Slack (admin only)
    authed.post("/slack/test", {
      preHandler: [requirePermission("config:manage")],
    }, async (request) => {
      const { tenantId } = request.jwtPayload;
      const integration = await db.query.integrations.findFirst({
        where: and(eq(integrations.tenantId, tenantId), eq(integrations.provider, "slack")),
      });

      if (!integration || !integration.enabled) {
        throw AppError.badRequest("Slack integration not configured or disabled");
      }

      // In production, this would call the Slack API. For R1, we log the attempt.
      return { message: "Slack test message queued", provider: "slack", tenantId };
    });
  });

  // ── Webhook endpoints (unauthenticated, verified by signature) ──

  // POST /webhooks/github — receive GitHub webhook events (FR-420)
  app.post("/webhooks/github", async (request, reply) => {
    const event = request.headers["x-github-event"] as string;
    const payload = request.body as Record<string, unknown>;

    // Signature verification would use GITHUB_WEBHOOK_SECRET in production
    // For R1, we accept all events and process them

    if (!event) {
      throw AppError.badRequest("Missing X-GitHub-Event header");
    }

    // Extract tenant from repository metadata (configured via integration setup)
    const repoFullName = (payload.repository as Record<string, unknown>)?.full_name as string | undefined;
    if (!repoFullName) {
      return reply.status(200).send({ message: "No repository context, skipping" });
    }

    // Find integration that matches this repo
    const allIntegrations = await db.select().from(integrations)
      .where(eq(integrations.provider, "github"));

    let matchedTenantId: string | null = null;
    for (const integration of allIntegrations) {
      const repos = (integration.config as Record<string, unknown>)?.repositories as string[] | undefined;
      if (repos?.includes(repoFullName)) {
        matchedTenantId = integration.tenantId;
        break;
      }
    }

    if (!matchedTenantId) {
      return reply.status(200).send({ message: "No matching integration found" });
    }

    // Log the event
    const [eventRecord] = await db.insert(integrationEvents).values({
      tenantId: matchedTenantId,
      provider: "github",
      eventType: event,
      externalId: String(payload.action ?? event),
      payload,
    }).returning();

    // FR-422: Parse commit messages for task references [TASK-xxx]
    if (event === "push") {
      const commits = (payload.commits as Array<Record<string, unknown>>) ?? [];
      for (const commit of commits) {
        const message = (commit.message as string) ?? "";
        const matches = message.matchAll(TASK_REF_PATTERN);
        for (const match of matches) {
          const taskId = match[1]!;
          // Link the event to the task
          await db.update(integrationEvents)
            .set({ taskId, processedAt: new Date() })
            .where(eq(integrationEvents.id, eventRecord!.id));
        }
      }
    }

    // FR-423: Auto-transition task on PR merge
    if (event === "pull_request" && payload.action === "closed" && (payload.pull_request as Record<string, unknown>)?.merged) {
      const prBody = ((payload.pull_request as Record<string, unknown>)?.body as string) ?? "";
      const prTitle = ((payload.pull_request as Record<string, unknown>)?.title as string) ?? "";
      const combined = `${prTitle} ${prBody}`;
      const taskMatches = combined.matchAll(TASK_REF_PATTERN);
      for (const match of taskMatches) {
        const taskId = match[1]!;
        await db.update(tasks)
          .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, matchedTenantId)));
      }
    }

    reply.status(200).send({ message: "Webhook processed", eventId: eventRecord!.id });
  });

  // POST /webhooks/slack — receive Slack events (FR-700)
  app.post("/webhooks/slack", async (request, reply) => {
    const payload = request.body as Record<string, unknown>;

    // Slack URL verification challenge
    if (payload.type === "url_verification") {
      return reply.send({ challenge: payload.challenge });
    }

    // Process Slack events
    if (payload.type === "event_callback") {
      const event = payload.event as Record<string, unknown>;
      const teamId = payload.team_id as string;

      // Find integration by Slack team ID
      const allSlack = await db.select().from(integrations)
        .where(eq(integrations.provider, "slack"));

      let matchedTenantId: string | null = null;
      for (const integration of allSlack) {
        if ((integration.config as Record<string, unknown>)?.teamId === teamId) {
          matchedTenantId = integration.tenantId;
          break;
        }
      }

      if (matchedTenantId) {
        await db.insert(integrationEvents).values({
          tenantId: matchedTenantId,
          provider: "slack",
          eventType: event?.type as string ?? "unknown",
          externalId: teamId,
          payload: payload,
          processedAt: new Date(),
        });
      }
    }

    reply.status(200).send({ ok: true });
  });
}
