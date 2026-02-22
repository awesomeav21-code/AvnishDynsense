// Ref: FR-400 — Slack OAuth 2.0 installation flow
// Ref: FR-401 — AI nudge delivery via Slack DM
// Ref: FR-402 — Daily summary push to Slack channel
// Ref: FR-403 — /dynsense slash command handler
// Ref: FR-406 — Per-user Slack notification preferences
import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { eq, and, isNull } from "drizzle-orm";
import { integrations, tenantConfigs, notifications, users, tasks, projects, taskAssignments } from "@dynsense/db";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";
import { z } from "zod";

// ── Slack API Helper ──

interface SlackApiResponse {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

async function callSlackApi(url: string, token: string, body: Record<string, unknown>): Promise<SlackApiResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Slack API HTTP error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as SlackApiResponse;
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error ?? "unknown_error"}`);
  }

  return data;
}

/** Retrieve the bot access token from the integrations table for a given tenant. */
async function getSlackBotToken(
  db: ReturnType<typeof getDb>,
  tenantId: string,
): Promise<{ token: string; integration: typeof integrations.$inferSelect }> {
  const integration = await db.query.integrations.findFirst({
    where: and(eq(integrations.tenantId, tenantId), eq(integrations.provider, "slack"), eq(integrations.enabled, true)),
  });

  if (!integration) {
    throw AppError.badRequest("Slack not configured or disabled");
  }

  const config = integration.config as { accessToken?: string } | null;
  if (!config?.accessToken) {
    throw AppError.badRequest("Slack access token not found");
  }

  return { token: config.accessToken, integration };
}

const slackPrefsSchema = z.object({
  nudgesEnabled: z.boolean().optional(),
  summaryEnabled: z.boolean().optional(),
  channel: z.enum(["dm", "channel"]).optional(),
  quietHoursStart: z.number().int().min(0).max(23).optional(),
  quietHoursEnd: z.number().int().min(0).max(23).optional(),
});

export async function slackRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

  // ── FR-400: Slack OAuth Install Flow ──

  // GET /oauth/start — redirect to Slack OAuth authorize
  app.get("/oauth/start", { preHandler: [authenticate, requirePermission("config:manage")] }, async (request, reply) => {
    const { tenantId } = request.jwtPayload;

    if (!env.SLACK_CLIENT_ID) {
      throw AppError.badRequest("SLACK_CLIENT_ID not configured");
    }

    const scopes = "channels:read,chat:write,commands,users:read,im:write";
    const redirectUri = `${request.protocol}://${request.hostname}/api/v1/slack/oauth/callback`;
    const state = `${tenantId}`;

    const url = `https://slack.com/oauth/v2/authorize?client_id=${env.SLACK_CLIENT_ID}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    return { redirectUrl: url, state };
  });

  // GET /oauth/callback — exchange code for token, store integration
  app.get("/oauth/callback", async (request, reply) => {
    const { code, state } = request.query as { code?: string; state?: string };

    if (!code || !state) {
      throw AppError.badRequest("Missing code or state parameter");
    }

    if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) {
      throw AppError.badRequest("SLACK_CLIENT_ID and SLACK_CLIENT_SECRET must be configured");
    }

    const tenantId = state;
    const redirectUri = `${request.protocol}://${request.hostname}/api/v1/slack/oauth/callback`;

    // Exchange the authorization code for a real access token via Slack API
    let oauthData: SlackApiResponse;
    try {
      const params = new URLSearchParams({
        client_id: env.SLACK_CLIENT_ID,
        client_secret: env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      });

      const oauthResponse = await fetch("https://slack.com/api/oauth.v2.access", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      if (!oauthResponse.ok) {
        request.log.error({ status: oauthResponse.status }, "Slack oauth.v2.access HTTP error");
        throw new Error(`Slack OAuth HTTP error: ${oauthResponse.status}`);
      }

      oauthData = (await oauthResponse.json()) as SlackApiResponse;

      if (!oauthData.ok) {
        request.log.error({ error: oauthData.error }, "Slack oauth.v2.access API error");
        throw AppError.badRequest(`Slack OAuth failed: ${oauthData.error ?? "unknown_error"}`);
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      request.log.error({ err }, "Failed to exchange Slack OAuth code");
      throw AppError.badRequest("Failed to exchange authorization code with Slack");
    }

    // Extract token details from the Slack response
    const accessToken = (oauthData.access_token as string) ?? "";
    const team = oauthData.team as { id?: string; name?: string } | undefined;
    const botUser = oauthData.bot_user_id as string | undefined;

    const slackConfig = {
      accessToken,
      teamId: team?.id ?? "",
      teamName: team?.name ?? "",
      botUserId: botUser ?? "",
      scope: (oauthData.scope as string) ?? "",
      installedAt: new Date().toISOString(),
    };

    // Upsert the Slack integration
    const existing = await db.query.integrations.findFirst({
      where: and(eq(integrations.tenantId, tenantId), eq(integrations.provider, "slack")),
    });

    if (existing) {
      await db.update(integrations)
        .set({ config: slackConfig, enabled: true, updatedAt: new Date() })
        .where(eq(integrations.id, existing.id));
    } else {
      await db.insert(integrations).values({
        tenantId,
        provider: "slack",
        enabled: true,
        config: slackConfig,
        channelMapping: {},
      });
    }

    return { message: "Slack installed successfully", teamId: slackConfig.teamId, teamName: slackConfig.teamName };
  });

  // ── FR-401: Send AI nudge via Slack DM ──

  app.post("/send-nudge", { preHandler: [authenticate, requirePermission("ai:execute")] }, async (request) => {
    const { tenantId } = request.jwtPayload;
    const { userId, message, taskId, taskUrl } = request.body as {
      userId: string;
      message: string;
      taskId?: string;
      taskUrl?: string;
    };

    if (!userId || !message) {
      throw AppError.badRequest("userId and message are required");
    }

    const { token } = await getSlackBotToken(db, tenantId);

    // Look up the target user to find their Slack user ID mapping.
    // The userId passed in could be a Slack user ID directly (starts with "U")
    // or a Dynsense user ID. If it is a Dynsense user ID, look it up to see if
    // there is a slackUserId stored (convention: we DM the userId as the channel
    // if it looks like a Slack ID, otherwise we rely on the user's email for
    // Slack's users.lookupByEmail — but for now we require a Slack user/channel ID).
    const slackChannel = userId;

    // Build Block Kit blocks for rich formatting with optional task link
    const blocks: Record<string, unknown>[] = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:bell: *AI PM Nudge*\n\n${message}`,
        },
      },
    ];

    if (taskId || taskUrl) {
      const linkUrl = taskUrl ?? `#task-${taskId}`;
      blocks.push(
        { type: "divider" },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "View Task", emoji: true },
              url: linkUrl,
              action_id: "view_task",
            },
          ],
        },
      );
    }

    try {
      const slackResponse = await callSlackApi("https://slack.com/api/chat.postMessage", token, {
        channel: slackChannel,
        text: `AI PM Nudge: ${message}`,
        blocks,
      });

      return {
        sent: true,
        provider: "slack",
        targetUserId: userId,
        ts: slackResponse.ts,
        channel: slackResponse.channel,
        message: "Nudge delivered via Slack DM",
      };
    } catch (err) {
      request.log.error({ err, userId }, "Failed to send Slack nudge");
      throw AppError.badRequest(
        `Failed to send Slack nudge: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    }
  });

  // ── FR-402: Push daily summary to Slack channel ──

  app.post("/send-summary", { preHandler: [authenticate, requirePermission("ai:execute")] }, async (request) => {
    const { tenantId } = request.jwtPayload;
    const { channel, summary, projectName, stats } = request.body as {
      channel?: string;
      summary: string;
      projectName?: string;
      stats?: { completed?: number; inProgress?: number; overdue?: number; total?: number };
    };

    const { token, integration } = await getSlackBotToken(db, tenantId);

    const channelMapping = integration.channelMapping as Record<string, string>;
    const targetChannel = channel ?? channelMapping["summary"] ?? "#general";

    // Build Block Kit message with section, divider, and fields
    const headerText = projectName
      ? `:clipboard: *Daily Summary — ${projectName}*`
      : `:clipboard: *Daily Project Summary*`;

    const blocks: Record<string, unknown>[] = [
      {
        type: "header",
        text: { type: "plain_text", text: projectName ? `Daily Summary — ${projectName}` : "Daily Project Summary", emoji: true },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: summary },
      },
    ];

    // Add stats fields if provided
    if (stats) {
      blocks.push(
        { type: "divider" },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Completed:*\n${stats.completed ?? 0}` },
            { type: "mrkdwn", text: `*In Progress:*\n${stats.inProgress ?? 0}` },
            { type: "mrkdwn", text: `*Overdue:*\n${stats.overdue ?? 0}` },
            { type: "mrkdwn", text: `*Total Tasks:*\n${stats.total ?? 0}` },
          ],
        },
      );
    }

    blocks.push(
      { type: "divider" },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: `_Sent by Dynsense AI PM at ${new Date().toISOString()}_` },
        ],
      },
    );

    try {
      const slackResponse = await callSlackApi("https://slack.com/api/chat.postMessage", token, {
        channel: targetChannel,
        text: `Daily Summary: ${summary.slice(0, 200)}`,
        blocks,
      });

      return {
        sent: true,
        channel: slackResponse.channel ?? targetChannel,
        ts: slackResponse.ts,
        message: "Summary posted to Slack channel",
      };
    } catch (err) {
      request.log.error({ err, channel: targetChannel }, "Failed to send Slack summary");
      throw AppError.badRequest(
        `Failed to post Slack summary: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    }
  });

  // ── FR-403: /dynsense slash command handler ──

  // This endpoint receives Slack slash command payloads (unauthenticated, verified by signing secret)
  app.post("/slash-command", async (request, reply) => {
    // ── Step 1: Verify the Slack signing secret ──
    if (env.SLACK_SIGNING_SECRET) {
      const slackSignature = (request.headers["x-slack-signature"] as string) ?? "";
      const slackTimestamp = (request.headers["x-slack-request-timestamp"] as string) ?? "";

      // Reject requests older than 5 minutes to prevent replay attacks
      const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
      if (Number(slackTimestamp) < fiveMinutesAgo) {
        request.log.warn("Slack slash command rejected: request timestamp too old");
        return reply.status(403).send({ error: "Request too old" });
      }

      // Reconstruct the signing base string: "v0:{timestamp}:{rawBody}"
      // Fastify stores the raw body when configured; otherwise we serialize the parsed body.
      const rawBody = (request as unknown as { rawBody?: string }).rawBody
        ?? (typeof request.body === "string" ? request.body : new URLSearchParams(request.body as Record<string, string>).toString());

      const sigBasestring = `v0:${slackTimestamp}:${rawBody}`;
      const expectedSignature = "v0=" + crypto
        .createHmac("sha256", env.SLACK_SIGNING_SECRET)
        .update(sigBasestring, "utf8")
        .digest("hex");

      if (!crypto.timingSafeEqual(Buffer.from(expectedSignature, "utf8"), Buffer.from(slackSignature, "utf8"))) {
        request.log.warn("Slack slash command rejected: invalid signature");
        return reply.status(403).send({ error: "Invalid signature" });
      }
    }

    // ── Step 2: Parse the slash command payload ──
    const payload = request.body as Record<string, unknown>;

    const command = (payload.command as string) ?? "";
    const text = (payload.text as string) ?? "";
    const teamId = (payload.team_id as string) ?? "";
    const userId = (payload.user_id as string) ?? "";
    const responseUrl = (payload.response_url as string) ?? "";

    if (command !== "/dynsense") {
      return reply.send({ text: "Unknown command" });
    }

    // Resolve the tenant for this Slack team by looking up the integration
    const integration = await db.query.integrations.findFirst({
      where: and(eq(integrations.provider, "slack"), eq(integrations.enabled, true)),
    });

    // Parse subcommands
    const parts = text.trim().split(/\s+/);
    const subcommand = parts[0]?.toLowerCase() ?? "help";

    switch (subcommand) {
      case "status": {
        // Query real project data from the database
        if (!integration) {
          return reply.send({ response_type: "ephemeral", text: "Slack integration not configured for this workspace." });
        }

        const tenantId = integration.tenantId;
        const allProjects = await db.query.projects.findMany({
          where: and(eq(projects.tenantId, tenantId), isNull(projects.deletedAt)),
        });

        if (allProjects.length === 0) {
          return reply.send({ response_type: "ephemeral", text: "No projects found." });
        }

        // Gather task counts per status across all active projects
        const allTasks = await db.query.tasks.findMany({
          where: and(eq(tasks.tenantId, tenantId), isNull(tasks.deletedAt)),
        });

        const statusCounts: Record<string, number> = {};
        for (const t of allTasks) {
          statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1;
        }

        const overdueTasks = allTasks.filter(
          (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done" && t.status !== "completed",
        );

        const statusLines = Object.entries(statusCounts)
          .map(([status, count]) => `• *${status}:* ${count}`)
          .join("\n");

        const blocks: Record<string, unknown>[] = [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `:bar_chart: *Project Status Overview*\n\n*${allProjects.length} active project(s)* | *${allTasks.length} total task(s)*`,
            },
          },
          { type: "divider" },
          {
            type: "section",
            text: { type: "mrkdwn", text: `*Task Breakdown:*\n${statusLines}` },
          },
        ];

        if (overdueTasks.length > 0) {
          blocks.push(
            { type: "divider" },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `:warning: *${overdueTasks.length} overdue task(s):*\n${overdueTasks.slice(0, 5).map((t) => `• ${t.title}`).join("\n")}${overdueTasks.length > 5 ? `\n_...and ${overdueTasks.length - 5} more_` : ""}`,
              },
            },
          );
        }

        return reply.send({
          response_type: "ephemeral",
          blocks,
          text: `Project Status: ${allProjects.length} projects, ${allTasks.length} tasks`,
        });
      }

      case "tasks": {
        // Query real tasks assigned to the requesting user
        if (!integration) {
          return reply.send({ response_type: "ephemeral", text: "Slack integration not configured for this workspace." });
        }

        const tenantId = integration.tenantId;

        // Find tasks where assigneeId matches or where the user has a task assignment.
        // Since we have a Slack userId (not a Dynsense userId), we query all non-completed
        // tasks and report them. In a richer implementation we would map Slack user to
        // Dynsense user via email lookup.
        const openTasks = await db.query.tasks.findMany({
          where: and(
            eq(tasks.tenantId, tenantId),
            isNull(tasks.deletedAt),
          ),
        });

        const incompleteTasks = openTasks.filter(
          (t) => t.status !== "done" && t.status !== "completed",
        );

        if (incompleteTasks.length === 0) {
          return reply.send({ response_type: "ephemeral", text: "No open tasks found." });
        }

        const taskLines = incompleteTasks.slice(0, 10).map((t) => {
          const dueStr = t.dueDate ? ` | Due: ${new Date(t.dueDate).toLocaleDateString()}` : "";
          const priorityEmoji = t.priority === "high" ? ":red_circle:" : t.priority === "medium" ? ":large_orange_circle:" : ":white_circle:";
          return `${priorityEmoji} *${t.title}* — _${t.status}_${dueStr}`;
        });

        const blocks: Record<string, unknown>[] = [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `:clipboard: *Open Tasks (${incompleteTasks.length})*\n\n${taskLines.join("\n")}${incompleteTasks.length > 10 ? `\n\n_...and ${incompleteTasks.length - 10} more_` : ""}`,
            },
          },
        ];

        return reply.send({
          response_type: "ephemeral",
          blocks,
          text: `You have ${incompleteTasks.length} open task(s).`,
        });
      }

      case "nudge": {
        // Query overdue and stalled tasks for the tenant
        if (!integration) {
          return reply.send({ response_type: "in_channel", text: "Slack integration not configured for this workspace." });
        }

        const tenantId = integration.tenantId;
        const allTasks = await db.query.tasks.findMany({
          where: and(eq(tasks.tenantId, tenantId), isNull(tasks.deletedAt)),
        });

        const now = new Date();
        const overdueTasks = allTasks.filter(
          (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "done" && t.status !== "completed",
        );
        const stalledTasks = allTasks.filter(
          (t) => t.status === "in_progress" && t.updatedAt && (now.getTime() - new Date(t.updatedAt).getTime()) > 3 * 24 * 60 * 60 * 1000,
        );

        const summaryParts: string[] = [];
        if (overdueTasks.length > 0) {
          summaryParts.push(`:warning: *${overdueTasks.length} overdue task(s)*`);
          overdueTasks.slice(0, 3).forEach((t) => summaryParts.push(`  • ${t.title}`));
        }
        if (stalledTasks.length > 0) {
          summaryParts.push(`:hourglass: *${stalledTasks.length} stalled task(s)* (no update in 3+ days)`);
          stalledTasks.slice(0, 3).forEach((t) => summaryParts.push(`  • ${t.title}`));
        }
        if (summaryParts.length === 0) {
          summaryParts.push(":white_check_mark: No overdue or stalled tasks. Everything looks on track!");
        }

        return reply.send({
          response_type: "in_channel",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `:bell: *AI PM Nudge* triggered by <@${userId}>\n\n${summaryParts.join("\n")}`,
              },
            },
          ],
          text: `AI PM nudge triggered by <@${userId}>`,
        });
      }

      case "help":
      default:
        return reply.send({
          response_type: "ephemeral",
          text: [
            "*Dynsense Slash Commands:*",
            "`/dynsense status` — Get project status summary",
            "`/dynsense tasks` — View your assigned tasks",
            "`/dynsense nudge` — Trigger AI PM nudge check",
            "`/dynsense help` — Show this help message",
          ].join("\n"),
        });
    }
  });

  // ── FR-406: Per-user Slack notification preferences ──

  app.get("/preferences", { preHandler: [authenticate] }, async (request) => {
    const { tenantId, sub: userId } = request.jwtPayload;

    const row = await db.query.tenantConfigs.findFirst({
      where: and(
        eq(tenantConfigs.tenantId, tenantId),
        eq(tenantConfigs.key, `slack.prefs.${userId}`),
      ),
    });

    const defaults = {
      nudgesEnabled: true,
      summaryEnabled: true,
      channel: "dm",
      quietHoursStart: null,
      quietHoursEnd: null,
    };

    return { data: row?.value ?? defaults };
  });

  app.put("/preferences", { preHandler: [authenticate] }, async (request) => {
    const { tenantId, sub: userId } = request.jwtPayload;
    const body = slackPrefsSchema.parse(request.body);
    const configKey = `slack.prefs.${userId}`;

    const existing = await db.query.tenantConfigs.findFirst({
      where: and(eq(tenantConfigs.tenantId, tenantId), eq(tenantConfigs.key, configKey)),
    });

    if (existing) {
      const merged = { ...(existing.value as Record<string, unknown>), ...body };
      const [updated] = await db.update(tenantConfigs)
        .set({ value: merged, updatedAt: new Date() })
        .where(eq(tenantConfigs.id, existing.id))
        .returning();
      return { data: updated };
    }

    const [created] = await db.insert(tenantConfigs).values({
      tenantId,
      key: configKey,
      value: body,
    }).returning();

    return { data: created };
  });
}
