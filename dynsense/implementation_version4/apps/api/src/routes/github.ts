// Ref: FR-420 — GitHub App installation OAuth flow
// Ref: FR-424 — Branch name suggestion from task title
// Ref: FR-425 — Pipeline/CI status display on task detail
// Ref: FR-422 — Webhook: commit-to-task linking, PR lifecycle events
import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { integrations, integrationEvents, tasks } from "@dynsense/db";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";

// Pattern to match task references like [TASK-abc123] or TASK-abc123 in commit messages / branch names
const TASK_REF_PATTERN = /\[?TASK-([a-f0-9-]+)\]?/gi;

export async function githubRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

  // ── FR-422: GitHub Webhook (unauthenticated, signature-verified) ──
  // Registered BEFORE the auth hook scope so it does not require JWT auth.

  app.post("/webhook", {
    config: { rawBody: true },
  }, async (request, reply) => {
    const signature = request.headers["x-hub-signature-256"] as string | undefined;
    const event = request.headers["x-github-event"] as string | undefined;
    const deliveryId = request.headers["x-github-delivery"] as string | undefined;

    if (!event) {
      throw AppError.badRequest("Missing X-GitHub-Event header");
    }

    // ── Signature verification ──
    const secret = env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      request.log.error("GITHUB_WEBHOOK_SECRET not configured — rejecting webhook");
      return reply.status(500).send({ error: "Webhook secret not configured" });
    }

    if (!signature) {
      throw AppError.unauthorized("Missing X-Hub-Signature-256 header");
    }

    // Compute expected HMAC-SHA256 signature over the raw body
    const rawBody = typeof request.body === "string"
      ? request.body
      : JSON.stringify(request.body);
    const expectedSig =
      "sha256=" +
      crypto.createHmac("sha256", secret).update(rawBody, "utf-8").digest("hex");

    // Constant-time comparison to prevent timing attacks
    if (
      signature.length !== expectedSig.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))
    ) {
      throw AppError.unauthorized("Invalid webhook signature");
    }

    const payload = (typeof request.body === "string" ? JSON.parse(request.body) : request.body) as Record<string, unknown>;

    // ── Resolve tenant from repository ──
    const repoFullName = (payload.repository as Record<string, unknown>)?.full_name as string | undefined;
    if (!repoFullName) {
      return reply.status(200).send({ message: "No repository context, skipping" });
    }

    const allIntegrations = await db
      .select()
      .from(integrations)
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
      return reply.status(200).send({ message: "No matching integration for repository" });
    }

    // ── Handle push events ──
    if (event === "push") {
      const commits = (payload.commits as Array<Record<string, unknown>>) ?? [];
      const ref = payload.ref as string | undefined; // e.g. "refs/heads/feature/TASK-abc123-fix-bug"

      for (const commit of commits) {
        const message = (commit.message as string) ?? "";
        const sha = (commit.id as string) ?? "";
        const author = (commit.author as Record<string, unknown>)?.name as string ?? "unknown";
        const url = (commit.url as string) ?? "";

        // Find all TASK-xxx references in the commit message
        const taskRefs = [...message.matchAll(TASK_REF_PATTERN)].map((m) => m[1]!);

        // Also check the branch name for a task reference
        if (ref) {
          const branchTaskRefs = [...ref.matchAll(TASK_REF_PATTERN)].map((m) => m[1]!);
          for (const tid of branchTaskRefs) {
            if (!taskRefs.includes(tid)) taskRefs.push(tid);
          }
        }

        if (taskRefs.length === 0) {
          // Log the push event without a task link
          await db.insert(integrationEvents).values({
            tenantId: matchedTenantId,
            provider: "github",
            eventType: "push",
            externalId: sha,
            payload: { commit: { sha, message, author, url }, ref },
            processedAt: new Date(),
          });
        } else {
          // Log one event per referenced task
          for (const taskIdRef of taskRefs) {
            // Verify the task exists in this tenant
            const task = await db.query.tasks.findFirst({
              where: and(eq(tasks.id, taskIdRef), eq(tasks.tenantId, matchedTenantId)),
            });

            await db.insert(integrationEvents).values({
              tenantId: matchedTenantId,
              provider: "github",
              eventType: "push",
              externalId: sha,
              taskId: task ? taskIdRef : undefined,
              payload: {
                commit: { sha, message, author, url },
                ref,
                linkedTaskId: taskIdRef,
                taskFound: !!task,
              },
              processedAt: new Date(),
            });
          }
        }
      }

      request.log.info({ event, commits: commits.length, deliveryId }, "Processed push webhook");
      return { received: true, event: "push", commits: commits.length };
    }

    // ── Handle pull_request events ──
    if (event === "pull_request") {
      const action = payload.action as string;
      const pr = payload.pull_request as Record<string, unknown>;
      const prNumber = pr?.number as number;
      const prTitle = (pr?.title as string) ?? "";
      const prUrl = (pr?.html_url as string) ?? "";
      const prBranch = (pr?.head as Record<string, unknown>)?.ref as string ?? "";
      const merged = (pr?.merged as boolean) ?? false;

      // Try to find a task reference from branch name or PR title
      const branchRefs = [...prBranch.matchAll(TASK_REF_PATTERN)].map((m) => m[1]!);
      const titleRefs = [...prTitle.matchAll(TASK_REF_PATTERN)].map((m) => m[1]!);
      const allRefs = [...new Set([...branchRefs, ...titleRefs])];

      // Resolve the first valid task ID in this tenant
      let linkedTaskId: string | undefined;
      for (const ref of allRefs) {
        const task = await db.query.tasks.findFirst({
          where: and(eq(tasks.id, ref), eq(tasks.tenantId, matchedTenantId)),
        });
        if (task) {
          linkedTaskId = task.id;
          break;
        }
      }

      if (action === "opened" || action === "reopened") {
        // Log PR creation
        await db.insert(integrationEvents).values({
          tenantId: matchedTenantId,
          provider: "github",
          eventType: `pull_request.${action}`,
          externalId: String(prNumber),
          taskId: linkedTaskId,
          payload: {
            action,
            prNumber,
            prTitle,
            prUrl,
            prBranch,
            linkedTaskId: linkedTaskId ?? null,
          },
          processedAt: new Date(),
        });

        request.log.info({ action, prNumber, linkedTaskId, deliveryId }, "PR opened/reopened");
        return { received: true, event: "pull_request", action, prNumber, linkedTaskId: linkedTaskId ?? null };
      }

      if (action === "closed") {
        if (merged) {
          // PR was merged — log event and auto-transition linked task to "completed"
          await db.insert(integrationEvents).values({
            tenantId: matchedTenantId,
            provider: "github",
            eventType: "pull_request.merged",
            externalId: String(prNumber),
            taskId: linkedTaskId,
            payload: {
              action: "merged",
              prNumber,
              prTitle,
              prUrl,
              prBranch,
              linkedTaskId: linkedTaskId ?? null,
            },
            processedAt: new Date(),
          });

          // Auto-transition the linked task to "completed"
          if (linkedTaskId) {
            await db
              .update(tasks)
              .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
              .where(and(eq(tasks.id, linkedTaskId), eq(tasks.tenantId, matchedTenantId)));
            request.log.info({ prNumber, linkedTaskId }, "Task auto-completed via PR merge");
          }

          request.log.info({ prNumber, merged: true, linkedTaskId, deliveryId }, "PR merged");
          return { received: true, event: "pull_request", action: "merged", prNumber, linkedTaskId: linkedTaskId ?? null };
        } else {
          // PR was closed without merge
          await db.insert(integrationEvents).values({
            tenantId: matchedTenantId,
            provider: "github",
            eventType: "pull_request.closed",
            externalId: String(prNumber),
            taskId: linkedTaskId,
            payload: {
              action: "closed",
              prNumber,
              prTitle,
              prUrl,
              prBranch,
              merged: false,
              linkedTaskId: linkedTaskId ?? null,
            },
            processedAt: new Date(),
          });

          request.log.info({ prNumber, merged: false, deliveryId }, "PR closed without merge");
          return { received: true, event: "pull_request", action: "closed", prNumber };
        }
      }

      // Other PR actions (edited, review_requested, etc.) — log generically
      await db.insert(integrationEvents).values({
        tenantId: matchedTenantId,
        provider: "github",
        eventType: `pull_request.${action}`,
        externalId: String(prNumber),
        taskId: linkedTaskId,
        payload: { action, prNumber, prTitle, prUrl, prBranch },
        processedAt: new Date(),
      });

      return { received: true, event: "pull_request", action };
    }

    // ── Unhandled event types — log generically ──
    await db.insert(integrationEvents).values({
      tenantId: matchedTenantId,
      provider: "github",
      eventType: event,
      externalId: deliveryId ?? event,
      payload,
      processedAt: new Date(),
    });

    return { received: true, event };
  });

  // ── Authenticated routes (JWT required) ──
  // Encapsulated in a child scope so the addHook does NOT affect the webhook above.
  app.register(async (authedApp) => {
    authedApp.addHook("preHandler", authenticate);

    // ── FR-420: GitHub App OAuth Installation Flow ──

    // GET /install — redirect to GitHub App install page
    authedApp.get("/install", {
      preHandler: [requirePermission("config:manage")],
    }, async (request) => {
      const { tenantId } = request.jwtPayload;

      // In production, redirect to GitHub App install URL
      // https://github.com/apps/<app-name>/installations/new
      const installUrl = "https://github.com/apps/dynsense-pm/installations/new";
      const state = tenantId;

      return {
        redirectUrl: `${installUrl}?state=${state}`,
        message: "Redirect user to install the Dynsense GitHub App",
      };
    });

    // GET /callback — handle GitHub App installation callback
    authedApp.get("/callback", async (request) => {
      const { installation_id, setup_action, state } = request.query as {
        installation_id?: string;
        setup_action?: string;
        state?: string;
      };

      if (!installation_id || !state) {
        throw AppError.badRequest("Missing installation_id or state");
      }

      const tenantId = state;

      // In production: exchange installation_id for installation access token
      // POST https://api.github.com/app/installations/{installation_id}/access_tokens
      const githubConfig = {
        installationId: installation_id,
        setupAction: setup_action ?? "install",
        installedAt: new Date().toISOString(),
        repositories: [] as string[],
      };

      // Upsert the GitHub integration
      const existing = await db.query.integrations.findFirst({
        where: and(eq(integrations.tenantId, tenantId), eq(integrations.provider, "github")),
      });

      if (existing) {
        await db.update(integrations)
          .set({ config: githubConfig, enabled: true, updatedAt: new Date() })
          .where(eq(integrations.id, existing.id));
      } else {
        await db.insert(integrations).values({
          tenantId,
          provider: "github",
          enabled: true,
          config: githubConfig,
          channelMapping: {},
        });
      }

      return { message: "GitHub App installed", installationId: installation_id };
    });

    // ── FR-424: Branch Name Suggestion from Task Title ──

    authedApp.get("/branch-name/:taskId", async (request) => {
      const { tenantId } = request.jwtPayload;
      const { taskId } = request.params as { taskId: string };

      const task = await db.query.tasks.findFirst({
        where: and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)),
      });

      if (!task) throw AppError.notFound("Task not found");

      // Generate branch name from task title
      const slug = task.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 60);

      const shortId = taskId.slice(0, 8);
      const branchName = `feature/TASK-${shortId}-${slug}`;

      return {
        data: {
          taskId,
          taskTitle: task.title,
          branchName,
          gitCommand: `git checkout -b ${branchName}`,
        },
      };
    });

    // ── FR-425: Pipeline / CI Status Display ──

    authedApp.get("/pipeline-status/:taskId", async (request) => {
      const { tenantId } = request.jwtPayload;
      const { taskId } = request.params as { taskId: string };

      const task = await db.query.tasks.findFirst({
        where: and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)),
      });

      if (!task) throw AppError.notFound("Task not found");

      // In production: query GitHub API for check runs associated with this task's branch
      // GET /repos/{owner}/{repo}/commits/{ref}/check-runs

      const now = Date.now();
      const branch = `feature/TASK-${taskId.slice(0, 8)}`;

      // R1 stub: return realistic mock pipeline data with detailed check information
      return {
        data: {
          taskId,
          branch,
          headSha: "a1b2c3d4e5f6789012345678abcdef0123456789",
          pipelines: [
            {
              id: 1001,
              name: "CI / Build",
              status: "completed",
              conclusion: "success",
              startedAt: new Date(now - 360_000).toISOString(),
              completedAt: new Date(now - 180_000).toISOString(),
              durationMs: 180_000,
              runUrl: `https://github.com/org/repo/actions/runs/1001`,
            },
            {
              id: 1002,
              name: "CI / Unit Tests",
              status: "completed",
              conclusion: "success",
              startedAt: new Date(now - 350_000).toISOString(),
              completedAt: new Date(now - 140_000).toISOString(),
              durationMs: 210_000,
              runUrl: `https://github.com/org/repo/actions/runs/1002`,
            },
            {
              id: 1003,
              name: "CI / Lint & Typecheck",
              status: "completed",
              conclusion: "success",
              startedAt: new Date(now - 340_000).toISOString(),
              completedAt: new Date(now - 260_000).toISOString(),
              durationMs: 80_000,
              runUrl: `https://github.com/org/repo/actions/runs/1003`,
            },
            {
              id: 1004,
              name: "CI / Integration Tests",
              status: "completed",
              conclusion: "failure",
              startedAt: new Date(now - 330_000).toISOString(),
              completedAt: new Date(now - 90_000).toISOString(),
              durationMs: 240_000,
              runUrl: `https://github.com/org/repo/actions/runs/1004`,
              failureSummary: "2 integration tests failed in api/auth module",
            },
            {
              id: 1005,
              name: "CI / Security Scan (CodeQL)",
              status: "in_progress",
              conclusion: null,
              startedAt: new Date(now - 60_000).toISOString(),
              completedAt: null,
              durationMs: null,
              runUrl: `https://github.com/org/repo/actions/runs/1005`,
            },
            {
              id: 1006,
              name: "CI / Deploy Preview",
              status: "queued",
              conclusion: null,
              startedAt: null,
              completedAt: null,
              durationMs: null,
              runUrl: `https://github.com/org/repo/actions/runs/1006`,
            },
          ],
          summary: {
            total: 6,
            completed: 4,
            inProgress: 1,
            queued: 1,
            succeeded: 3,
            failed: 1,
          },
          pullRequest: {
            number: 42,
            title: `[TASK-${taskId.slice(0, 8)}] ${task.title}`,
            url: `https://github.com/org/repo/pull/42`,
            state: "open",
            draft: false,
            reviewStatus: "changes_requested",
            mergeable: false,
            checksBlocking: true,
          },
          lastUpdated: new Date(now).toISOString(),
        },
      };
    });

    // GET /repos — list repositories available to the GitHub App installation
    authedApp.get("/repos", {
      preHandler: [requirePermission("config:manage")],
    }, async (request) => {
      const { tenantId } = request.jwtPayload;

      const integration = await db.query.integrations.findFirst({
        where: and(eq(integrations.tenantId, tenantId), eq(integrations.provider, "github")),
      });

      if (!integration || !integration.enabled) {
        throw AppError.badRequest("GitHub not configured or disabled");
      }

      // In production: list repos from GitHub API using installation token
      // GET /installation/repositories
      const config = integration.config as { repositories?: string[] } | null;

      return {
        data: {
          repositories: config?.repositories ?? [],
          message: "In production, this returns actual repos from GitHub API.",
        },
      };
    });
  }); // end authedApp register
}
