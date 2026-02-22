// Ref: FR-211 — AI Evaluation Harness: run golden test fixtures against agents
// Ref: FR-212 — AI Monitoring Dashboard: token usage, cost, confidence stats
import type { FastifyInstance } from "fastify";
import { eq, and, desc, gte, sql, count } from "drizzle-orm";
import { aiActions, aiCostLog, aiHookLog } from "@dynsense/db";
import { AIOrchestrator, goldenFixtures } from "@dynsense/agents";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";
import { z } from "zod";

const evalFixtureSchema = z.object({
  capability: z.string(),
  input: z.record(z.unknown()),
  expectedOutputKeys: z.array(z.string()).optional(),
  minConfidence: z.number().min(0).max(1).optional().default(0.6),
});

const evalBatchSchema = z.object({
  fixtures: z.array(evalFixtureSchema).min(1).max(20),
});

interface EvalResult {
  fixtureId: string;
  capability: string;
  passed: boolean;
  confidence: number | null;
  status: string;
  outputKeys: string[];
  missingKeys: string[];
  durationMs: number;
}

// In-memory eval history for acceptance tracking (R0 — moved to DB in R1)
const evalHistory: Array<{
  runId: string;
  runDate: string;
  results: EvalResult[];
  humanReviews: Record<string, "approved" | "needs_revision" | "rejected">;
}> = [];

export async function aiEvalRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);
  const orchestrator = new AIOrchestrator({
    db,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
  });

  app.addHook("preHandler", authenticate);

  // GET /fixtures — list all golden test fixtures
  app.get("/fixtures", async () => {
    return {
      data: goldenFixtures.map((f) => ({
        id: f.id,
        name: f.name,
        capability: f.capability,
        expectedOutputKeys: f.expectedOutputKeys,
        minConfidence: f.minConfidence,
      })),
    };
  });

  // POST /run — FR-211: Run evaluation fixtures against the orchestrator
  app.post("/run", {
    preHandler: [requirePermission("ai:execute")],
  }, async (request, reply) => {
    const { tenantId, sub: userId } = request.jwtPayload;
    const body = evalBatchSchema.parse(request.body);

    const results: EvalResult[] = [];

    for (const fixture of body.fixtures) {
      const start = Date.now();
      const result = await orchestrator.execute({
        tenantId,
        userId,
        capability: fixture.capability as "wbs_generator",
        input: fixture.input,
      });
      const durationMs = Date.now() - start;

      const outputKeys = result.output ? Object.keys(result.output) : [];
      const missingKeys = (fixture.expectedOutputKeys ?? []).filter(
        (k) => !outputKeys.includes(k),
      );
      const confidenceOk = (result.confidence ?? 0) >= fixture.minConfidence;
      const keysOk = missingKeys.length === 0;
      const passed = result.status !== "failed" && confidenceOk && keysOk;

      results.push({
        fixtureId: `custom-${results.length}`,
        capability: fixture.capability,
        passed,
        confidence: result.confidence,
        status: result.status,
        outputKeys,
        missingKeys,
        durationMs,
      });
    }

    const totalPassed = results.filter((r) => r.passed).length;
    const runId = `run-${Date.now()}`;

    // Store in eval history
    evalHistory.push({
      runId,
      runDate: new Date().toISOString(),
      results,
      humanReviews: {},
    });
    // Keep only last 100 runs
    if (evalHistory.length > 100) evalHistory.splice(0, evalHistory.length - 100);

    reply.send({
      data: {
        runId,
        total: results.length,
        passed: totalPassed,
        failed: results.length - totalPassed,
        results,
      },
    });
  });

  // POST /run-golden — Run the built-in golden test fixtures
  app.post("/run-golden", {
    preHandler: [requirePermission("ai:execute")],
  }, async (request, reply) => {
    const { tenantId, sub: userId } = request.jwtPayload;
    const { capabilities } = (request.body as { capabilities?: string[] }) ?? {};

    const fixturesToRun = capabilities
      ? goldenFixtures.filter((f) => capabilities.includes(f.capability))
      : goldenFixtures;

    const results: EvalResult[] = [];

    for (const fixture of fixturesToRun) {
      const start = Date.now();
      const result = await orchestrator.execute({
        tenantId,
        userId,
        capability: fixture.capability as "wbs_generator",
        input: fixture.input,
      });
      const durationMs = Date.now() - start;

      const outputKeys = result.output ? Object.keys(result.output) : [];
      const missingKeys = fixture.expectedOutputKeys.filter(
        (k) => !outputKeys.includes(k),
      );
      const confidenceOk = (result.confidence ?? 0) >= fixture.minConfidence;
      const keysOk = missingKeys.length === 0;
      const passed = result.status !== "failed" && confidenceOk && keysOk;

      results.push({
        fixtureId: fixture.id,
        capability: fixture.capability,
        passed,
        confidence: result.confidence,
        status: result.status,
        outputKeys,
        missingKeys,
        durationMs,
      });
    }

    const totalPassed = results.filter((r) => r.passed).length;
    const runId = `golden-${Date.now()}`;

    evalHistory.push({
      runId,
      runDate: new Date().toISOString(),
      results,
      humanReviews: {},
    });
    if (evalHistory.length > 100) evalHistory.splice(0, evalHistory.length - 100);

    reply.send({
      data: {
        runId,
        total: results.length,
        passed: totalPassed,
        failed: results.length - totalPassed,
        passRate: results.length > 0 ? totalPassed / results.length : 0,
        results,
      },
    });
  });

  // POST /review/:runId — Record human review for eval results
  app.post("/review/:runId", {
    preHandler: [requirePermission("ai:execute")],
  }, async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const { fixtureId, decision } = request.body as {
      fixtureId: string;
      decision: "approved" | "needs_revision" | "rejected";
    };

    const run = evalHistory.find((r) => r.runId === runId);
    if (!run) {
      reply.status(404).send({ error: "Eval run not found" });
      return;
    }

    run.humanReviews[fixtureId] = decision;
    reply.send({ data: { runId, fixtureId, decision } });
  });

  // GET /acceptance-rate — Acceptance rate metrics across eval runs
  app.get("/acceptance-rate", async () => {
    const allResults = evalHistory.flatMap((run) =>
      run.results.map((r) => ({
        ...r,
        humanReview: run.humanReviews[r.fixtureId],
      })),
    );

    const reviewed = allResults.filter((r) => r.humanReview);
    const approved = reviewed.filter((r) => r.humanReview === "approved");

    // Per-capability breakdown
    const byCapability = new Map<string, { total: number; passed: number; approved: number; reviewed: number }>();
    for (const r of allResults) {
      const entry = byCapability.get(r.capability) ?? { total: 0, passed: 0, approved: 0, reviewed: 0 };
      entry.total += 1;
      if (r.passed) entry.passed += 1;
      if (r.humanReview) {
        entry.reviewed += 1;
        if (r.humanReview === "approved") entry.approved += 1;
      }
      byCapability.set(r.capability, entry);
    }

    return {
      data: {
        totalRuns: evalHistory.length,
        totalFixturesEvaluated: allResults.length,
        overallPassRate: allResults.length > 0
          ? allResults.filter((r) => r.passed).length / allResults.length
          : 0,
        humanReviewRate: allResults.length > 0 ? reviewed.length / allResults.length : 0,
        acceptanceRate: reviewed.length > 0 ? approved.length / reviewed.length : 0,
        byCapability: Object.fromEntries(
          Array.from(byCapability.entries()).map(([cap, stats]) => [
            cap,
            {
              ...stats,
              passRate: stats.total > 0 ? stats.passed / stats.total : 0,
              acceptanceRate: stats.reviewed > 0 ? stats.approved / stats.reviewed : 0,
            },
          ]),
        ),
      },
    };
  });

  // GET /history — List recent eval runs
  app.get("/history", async (request) => {
    const { limit = 20 } = request.query as { limit?: number };

    return {
      data: evalHistory.slice(-Number(limit)).reverse().map((run) => ({
        runId: run.runId,
        runDate: run.runDate,
        total: run.results.length,
        passed: run.results.filter((r) => r.passed).length,
        failed: run.results.filter((r) => !r.passed).length,
        reviewCount: Object.keys(run.humanReviews).length,
      })),
    };
  });

  // GET /dashboard — FR-212: AI monitoring dashboard stats
  app.get("/dashboard", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { days = 7 } = request.query as { days?: number };

    const since = new Date();
    since.setDate(since.getDate() - Number(days));

    // Total actions by status
    const actionsByStatus = await db
      .select({
        status: aiActions.status,
        cnt: count(),
      })
      .from(aiActions)
      .where(and(eq(aiActions.tenantId, tenantId), gte(aiActions.createdAt, since)))
      .groupBy(aiActions.status);

    // Total actions by capability
    const actionsByCapability = await db
      .select({
        capability: aiActions.capability,
        cnt: count(),
      })
      .from(aiActions)
      .where(and(eq(aiActions.tenantId, tenantId), gte(aiActions.createdAt, since)))
      .groupBy(aiActions.capability);

    // Cost summary
    const costSummary = await db
      .select({
        totalCost: sql<string>`COALESCE(SUM(${aiCostLog.costUsd}), 0)`,
        totalInputTokens: sql<string>`COALESCE(SUM(${aiCostLog.inputTokens}), 0)`,
        totalOutputTokens: sql<string>`COALESCE(SUM(${aiCostLog.outputTokens}), 0)`,
        actionCount: count(),
      })
      .from(aiCostLog)
      .where(and(eq(aiCostLog.tenantId, tenantId), gte(aiCostLog.createdAt, since)));

    // Cost by model
    const costByModel = await db
      .select({
        model: aiCostLog.model,
        totalCost: sql<string>`COALESCE(SUM(${aiCostLog.costUsd}), 0)`,
        actionCount: count(),
      })
      .from(aiCostLog)
      .where(and(eq(aiCostLog.tenantId, tenantId), gte(aiCostLog.createdAt, since)))
      .groupBy(aiCostLog.model);

    // Average confidence (from ai_actions where confidence is set)
    const avgConfidence = await db
      .select({
        avg: sql<string>`AVG(CAST(${aiActions.confidence} AS NUMERIC))`,
      })
      .from(aiActions)
      .where(
        and(
          eq(aiActions.tenantId, tenantId),
          gte(aiActions.createdAt, since),
          sql`${aiActions.confidence} IS NOT NULL`,
        ),
      );

    // Hook denials
    const hookDenials = await db
      .select({
        hookName: aiHookLog.hookName,
        cnt: count(),
      })
      .from(aiHookLog)
      .where(
        and(
          eq(aiHookLog.tenantId, tenantId),
          gte(aiHookLog.createdAt, since),
          eq(aiHookLog.decision, "denied"),
        ),
      )
      .groupBy(aiHookLog.hookName);

    return {
      data: {
        period: { days: Number(days), since: since.toISOString() },
        actions: {
          byStatus: actionsByStatus.map((r) => ({ status: r.status, count: Number(r.cnt) })),
          byCapability: actionsByCapability.map((r) => ({ capability: r.capability, count: Number(r.cnt) })),
        },
        cost: {
          totalUsd: parseFloat(costSummary[0]?.totalCost ?? "0"),
          totalInputTokens: parseInt(costSummary[0]?.totalInputTokens ?? "0", 10),
          totalOutputTokens: parseInt(costSummary[0]?.totalOutputTokens ?? "0", 10),
          actionCount: Number(costSummary[0]?.actionCount ?? 0),
          byModel: costByModel.map((r) => ({
            model: r.model,
            totalUsd: parseFloat(r.totalCost),
            actionCount: Number(r.actionCount),
          })),
        },
        averageConfidence: parseFloat(avgConfidence[0]?.avg ?? "0"),
        hookDenials: hookDenials.map((r) => ({ hook: r.hookName, count: Number(r.cnt) })),
      },
    };
  });
}
