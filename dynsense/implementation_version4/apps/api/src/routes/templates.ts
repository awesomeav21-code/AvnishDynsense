// Ref: FR-114 — Project templates: clone from existing project
import type { FastifyInstance } from "fastify";
import { eq, and, isNull } from "drizzle-orm";
import { projects, phases, tasks } from "@dynsense/db";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";
import { z } from "zod";

const cloneProjectSchema = z.object({
  sourceProjectId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  includePhases: z.boolean().optional().default(true),
  includeTasks: z.boolean().optional().default(true),
});

export async function templateRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

  app.addHook("preHandler", authenticate);

  // POST /clone — clone a project as a template
  app.post("/clone", async (request, reply) => {
    const { tenantId } = request.jwtPayload;
    const body = cloneProjectSchema.parse(request.body);

    // Verify source project exists
    const source = await db.query.projects.findFirst({
      where: and(eq(projects.id, body.sourceProjectId), eq(projects.tenantId, tenantId), isNull(projects.deletedAt)),
    });
    if (!source) throw AppError.notFound("Source project not found");

    // Create new project
    const [newProject] = await db.insert(projects).values({
      tenantId,
      name: body.name,
      description: body.description ?? source.description,
      status: "active",
      wbsBaseline: source.wbsBaseline,
    }).returning();

    let phasesCloned = 0;
    let tasksCloned = 0;

    // Clone phases
    if (body.includePhases) {
      const sourcePhases = await db.select().from(phases)
        .where(and(eq(phases.tenantId, tenantId), eq(phases.projectId, body.sourceProjectId)));

      const phaseIdMap = new Map<string, string>();

      for (const phase of sourcePhases) {
        const [newPhase] = await db.insert(phases).values({
          tenantId,
          projectId: newProject!.id,
          name: phase.name,
          position: phase.position,
        }).returning();
        phaseIdMap.set(phase.id, newPhase!.id);
        phasesCloned++;
      }

      // Clone tasks (top-level only, without assignees or dates)
      if (body.includeTasks) {
        const sourceTasks = await db.select().from(tasks)
          .where(and(
            eq(tasks.tenantId, tenantId),
            eq(tasks.projectId, body.sourceProjectId),
            isNull(tasks.deletedAt),
            isNull(tasks.parentTaskId),
          ));

        for (const task of sourceTasks) {
          await db.insert(tasks).values({
            tenantId,
            projectId: newProject!.id,
            phaseId: task.phaseId ? phaseIdMap.get(task.phaseId) ?? null : null,
            title: task.title,
            description: task.description,
            status: "created",
            priority: task.priority,
            position: task.position,
            estimatedEffort: task.estimatedEffort,
          });
          tasksCloned++;
        }
      }
    }

    reply.status(201).send({
      data: {
        project: newProject,
        clonedFrom: body.sourceProjectId,
        phasesCloned,
        tasksCloned,
      },
    });
  });

  // GET /list — list projects that can be used as templates (active, non-deleted)
  app.get("/list", async (request) => {
    const { tenantId } = request.jwtPayload;

    const rows = await db.query.projects.findMany({
      where: and(eq(projects.tenantId, tenantId), isNull(projects.deletedAt)),
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    });

    return {
      data: rows.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        status: p.status,
        hasWbsBaseline: !!p.wbsBaseline,
      })),
    };
  });
}
