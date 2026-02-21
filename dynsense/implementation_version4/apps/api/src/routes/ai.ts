import type { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { aiActions, aiSessions } from "@dynsense/db";
import { aiExecuteSchema, aiReviewActionSchema } from "@dynsense/shared";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";

export async function aiRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

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

    // Simulate orchestrator pipeline (stub — will connect to real orchestrator when Claude API key is configured)
    // For R0, return a "proposed" result with placeholder output
    const output = generateStubOutput(body.capability, body.input);
    const confidence = 0.75;

    const [updated] = await db.update(aiActions)
      .set({
        status: "proposed",
        output,
        confidence: confidence.toString(),
        updatedAt: new Date(),
      })
      .where(eq(aiActions.id, action!.id))
      .returning();

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

  // GET /sessions — list AI sessions for user
  app.get("/sessions", async (request) => {
    const { tenantId, sub: userId } = request.jwtPayload;

    const rows = await db.select().from(aiSessions)
      .where(and(eq(aiSessions.tenantId, tenantId), eq(aiSessions.userId, userId)))
      .orderBy(desc(aiSessions.createdAt))
      .limit(20);

    return { data: rows };
  });
}

// Stub output generator for R0 demo purposes
function generateStubOutput(capability: string, input: Record<string, unknown>): Record<string, unknown> {
  switch (capability) {
    case "wbs_generator":
      return {
        type: "wbs",
        phases: [
          { name: "Phase 1: Discovery", tasks: ["Stakeholder interviews", "Requirements gathering", "Gap analysis"] },
          { name: "Phase 2: Design", tasks: ["Solution architecture", "UI/UX wireframes", "Data model design"] },
          { name: "Phase 3: Build", tasks: ["Core implementation", "Integration development", "Testing"] },
          { name: "Phase 4: Deploy", tasks: ["Staging deployment", "UAT", "Production cutover"] },
        ],
        note: "AI-generated WBS based on project context. Review and adjust as needed.",
      };
    case "whats_next":
      return {
        type: "recommendations",
        items: [
          { priority: "high", suggestion: "Complete overdue tasks before starting new work" },
          { priority: "medium", suggestion: "Review pending AI proposals in the queue" },
          { priority: "low", suggestion: "Update project status and timeline estimates" },
        ],
      };
    case "nl_query":
      return {
        type: "query_result",
        query: input["query"] ?? "No query provided",
        answer: "This is a placeholder response. Connect the Claude API to enable natural language queries against your project data.",
        sources: [],
      };
    case "summary_writer":
      return {
        type: "summary",
        text: "Project is progressing with 3 tasks in progress and 2 pending review. No blockers identified. Next milestone is due in 5 business days.",
      };
    default:
      return {
        type: capability,
        message: `Stub output for capability '${capability}'. Connect Claude API for real results.`,
      };
  }
}
