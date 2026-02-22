import type { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { aiActions, aiSessions, aiHookLog, projects } from "@dynsense/db";
import { aiExecuteSchema, aiReviewActionSchema } from "@dynsense/shared";
import { AIOrchestrator } from "@dynsense/agents";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { writeAuditLog } from "./audit.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";

export async function aiRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

  // Create orchestrator instance — falls back to stub output if no API key
  const orchestrator = new AIOrchestrator({
    db,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
  });

  app.addHook("preHandler", authenticate);

  // POST /execute — trigger AI capability
  app.post("/execute", async (request, reply) => {
    const { tenantId, sub: userId } = request.jwtPayload;
    const body = aiExecuteSchema.parse(request.body);

    // Create ai_action record
    const [action] = await db.insert(aiActions).values({
      tenantId,
      capability: body.capability,
      status: "running",
      disposition: "propose",
      input: body.input,
      triggeredBy: userId,
      sessionId: body.sessionId,
    }).returning();

    // Execute through orchestrator pipeline
    const result = await orchestrator.execute({
      tenantId,
      userId,
      capability: body.capability,
      input: body.input,
      sessionId: body.sessionId,
    });

    // Capture pre-action state as rollback data (FR-304)
    const rollbackSnapshot = {
      status: action!.status,
      disposition: action!.disposition,
      output: action!.output,
      confidence: action!.confidence,
      capturedAt: new Date().toISOString(),
    };

    // Update ai_action record with result + rollback data
    const [updated] = await db.update(aiActions)
      .set({
        status: result.status,
        disposition: result.disposition,
        output: result.output,
        confidence: result.confidence?.toString() ?? null,
        rollbackData: rollbackSnapshot,
        updatedAt: new Date(),
      })
      .where(eq(aiActions.id, action!.id))
      .returning();

    // FR-112: Persist WBS baseline to project when WBS is generated
    if (
      body.capability === "wbs_generator" &&
      result.output &&
      result.status !== "failed"
    ) {
      const projectId = body.input["projectId"] as string | undefined;
      if (projectId) {
        await db
          .update(projects)
          .set({ wbsBaseline: result.output, updatedAt: new Date() })
          .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)))
          .catch(() => { /* non-blocking — WBS storage is best-effort */ });
      }
    }

    reply.status(201).send({ data: updated });
  });

  // GET /actions — list AI actions for tenant
  app.get("/actions", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { limit = 50, offset = 0, status, capability } = request.query as {
      limit?: number; offset?: number; status?: string; capability?: string;
    };

    const conditions = [eq(aiActions.tenantId, tenantId)];
    if (status) conditions.push(eq(aiActions.status, status));
    if (capability) conditions.push(eq(aiActions.capability, capability));

    const rows = await db.select().from(aiActions)
      .where(and(...conditions))
      .orderBy(desc(aiActions.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    return { data: rows };
  });

  // GET /actions/shadow — list shadow-mode AI actions (FR-302, admin/pm only)
  // NOTE: Must be registered BEFORE /actions/:id to avoid "shadow" matching as :id
  app.get("/actions/shadow", {
    preHandler: [requirePermission("ai:review")],
  }, async (request) => {
    const { tenantId } = request.jwtPayload;
    const { limit = 50, offset = 0 } = request.query as {
      limit?: number; offset?: number;
    };

    const rows = await db.select().from(aiActions)
      .where(and(
        eq(aiActions.tenantId, tenantId),
        eq(aiActions.disposition, "shadow"),
      ))
      .orderBy(desc(aiActions.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    return { data: rows };
  });

  // GET /actions/:id — get single action detail
  app.get("/actions/:id", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { id } = request.params as { id: string };

    const action = await db.query.aiActions.findFirst({
      where: and(eq(aiActions.id, id), eq(aiActions.tenantId, tenantId)),
    });

    if (!action) throw AppError.notFound("AI action not found");
    return { data: action };
  });

  // POST /actions/:id/review — approve, reject, or edit an AI action
  app.post("/actions/:id/review", async (request) => {
    const { tenantId, sub: userId } = request.jwtPayload;
    const { id } = request.params as { id: string };
    const body = aiReviewActionSchema.parse(request.body);

    const action = await db.query.aiActions.findFirst({
      where: and(eq(aiActions.id, id), eq(aiActions.tenantId, tenantId)),
    });

    if (!action) throw AppError.notFound("AI action not found");
    if (action.status !== "proposed") {
      throw AppError.badRequest(`Cannot review action with status '${action.status}'`);
    }

    let newStatus: string;
    let newOutput = action.output;

    switch (body.action) {
      case "approve":
        newStatus = "approved";
        break;
      case "reject":
        newStatus = "rejected";
        break;
      case "edit":
        newStatus = "approved";
        newOutput = body.editedOutput ?? action.output;
        break;
      default:
        throw AppError.badRequest("Invalid review action");
    }

    const [updated] = await db.update(aiActions)
      .set({
        status: newStatus,
        output: newOutput,
        reviewedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(aiActions.id, id))
      .returning();

    return { data: updated };
  });

  // POST /actions/:id/rollback — rollback an AI action (FR-308)
  app.post("/actions/:id/rollback", async (request) => {
    const { tenantId, sub: userId } = request.jwtPayload;
    const { id } = request.params as { id: string };

    const action = await db.query.aiActions.findFirst({
      where: and(eq(aiActions.id, id), eq(aiActions.tenantId, tenantId)),
    });

    if (!action) throw AppError.notFound("AI action not found");

    // Only allow rollback for approved or executed actions
    if (action.status !== "approved" && action.status !== "executed") {
      throw AppError.badRequest(
        `Cannot rollback action with status '${action.status}'. Only 'approved' or 'executed' actions can be rolled back.`,
      );
    }

    // Verify rollback data exists
    if (!action.rollbackData) {
      throw AppError.badRequest(
        "No rollback data available for this action. The orchestrator did not store a pre-action snapshot.",
      );
    }

    // Set the action status to rolled_back
    const [updated] = await db.update(aiActions)
      .set({
        status: "rolled_back",
        updatedAt: new Date(),
      })
      .where(eq(aiActions.id, id))
      .returning();

    // Log in audit trail
    await writeAuditLog(db, {
      tenantId,
      entityType: "ai_action",
      entityId: id,
      action: "rollback",
      actorId: userId,
      aiActionId: id,
      diff: {
        status: { old: action.status, new: "rolled_back" },
        rollbackData: action.rollbackData,
      },
    });

    return { data: updated };
  });

  // GET /decisions — AI decision log aggregated from ai_hook_log + ai_actions (R1-1)
  app.get("/decisions", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { limit = 50, offset = 0 } = request.query as {
      limit?: number; offset?: number;
    };

    // Query ai_hook_log joined with ai_actions for the tenant
    const rows = await db
      .select({
        aiActionId: aiHookLog.aiActionId,
        capability: aiActions.capability,
        hookName: aiHookLog.hookName,
        phase: aiHookLog.phase,
        decision: aiHookLog.decision,
        reason: aiHookLog.reason,
        createdAt: aiHookLog.createdAt,
      })
      .from(aiHookLog)
      .leftJoin(aiActions, eq(aiHookLog.aiActionId, aiActions.id))
      .where(eq(aiHookLog.tenantId, tenantId))
      .orderBy(desc(aiHookLog.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    return { data: rows };
  });

  // POST /risk-analysis — convenience endpoint to trigger risk prediction for a project (R1-1)
  app.post("/risk-analysis", async (request, reply) => {
    const { tenantId, sub: userId } = request.jwtPayload;
    const { projectId } = request.body as { projectId?: string };

    if (!projectId) {
      throw AppError.badRequest("projectId is required in the request body");
    }

    // Create ai_action record for the risk analysis
    const [action] = await db.insert(aiActions).values({
      tenantId,
      capability: "risk_predictor",
      status: "running",
      disposition: "propose",
      input: { projectId },
      triggeredBy: userId,
    }).returning();

    // Execute risk prediction through orchestrator pipeline
    const result = await orchestrator.execute({
      tenantId,
      userId,
      capability: "risk_predictor",
      input: { projectId },
    });

    // Capture pre-action state as rollback data
    const rollbackSnapshot = {
      status: action!.status,
      disposition: action!.disposition,
      output: action!.output,
      confidence: action!.confidence,
      capturedAt: new Date().toISOString(),
    };

    // Update ai_action record with result
    const [updated] = await db.update(aiActions)
      .set({
        status: result.status,
        disposition: result.disposition,
        output: result.output,
        confidence: result.confidence?.toString() ?? null,
        rollbackData: rollbackSnapshot,
        updatedAt: new Date(),
      })
      .where(eq(aiActions.id, action!.id))
      .returning();

    reply.status(201).send({ data: updated });
  });

  // GET /sessions — list AI sessions for user
  app.get("/sessions", async (request) => {
    const { tenantId, sub: userId } = request.jwtPayload;

    const rows = await db.select().from(aiSessions)
      .where(and(eq(aiSessions.tenantId, tenantId), eq(aiSessions.userId, userId)))
      .orderBy(desc(aiSessions.createdAt))
      .limit(20);

    return { data: rows };
  });

  // GET /sessions/:id — session detail with actions and hook log
  app.get("/sessions/:id", async (request) => {
    const { tenantId, sub: userId } = request.jwtPayload;
    const { id } = request.params as { id: string };

    const session = await db.query.aiSessions.findFirst({
      where: and(eq(aiSessions.id, id), eq(aiSessions.tenantId, tenantId), eq(aiSessions.userId, userId)),
    });

    if (!session) throw AppError.notFound("Session not found");

    // Fetch all actions in this session
    const actions = await db.select().from(aiActions)
      .where(and(eq(aiActions.sessionId, id), eq(aiActions.tenantId, tenantId)))
      .orderBy(desc(aiActions.createdAt));

    // Fetch hook logs for those actions
    const actionIds = actions.map((a) => a.id);
    let hooks: typeof aiHookLog.$inferSelect[] = [];
    if (actionIds.length > 0) {
      const allHooks = await db.select().from(aiHookLog)
        .where(eq(aiHookLog.tenantId, tenantId))
        .orderBy(desc(aiHookLog.createdAt));
      hooks = allHooks.filter((h) => h.aiActionId !== null && actionIds.includes(h.aiActionId));
    }

    return {
      data: {
        session,
        actions: actions.map((a) => ({
          ...a,
          hooks: hooks.filter((h) => h.aiActionId === a.id),
        })),
      },
    };
  });

  // POST /sessions/:id/terminate — terminate an active session
  app.post("/sessions/:id/terminate", async (request) => {
    const { tenantId, sub: userId } = request.jwtPayload;
    const { id } = request.params as { id: string };

    const session = await db.query.aiSessions.findFirst({
      where: and(eq(aiSessions.id, id), eq(aiSessions.tenantId, tenantId), eq(aiSessions.userId, userId)),
    });

    if (!session) throw AppError.notFound("Session not found");

    await db.update(aiSessions)
      .set({ status: "terminated", updatedAt: new Date() })
      .where(eq(aiSessions.id, id));

    return { data: { id, status: "terminated" } };
  });
}
