// Ref: FR-134 — Full-text search across tasks, projects, and comments
// Ref: FR-1002 — Full-text search (GIN index)
import type { FastifyInstance } from "fastify";
import { eq, and, or, ilike, desc, isNull } from "drizzle-orm";
import { tasks, projects, comments } from "@dynsense/db";
import { authenticate } from "../middleware/auth.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";
import { z } from "zod";

const searchSchema = z.object({
  q: z.string().min(1).max(500),
  type: z.enum(["all", "tasks", "projects", "comments"]).default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function searchRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

  app.addHook("preHandler", authenticate);

  // GET / — full-text search across entities
  app.get("/", async (request) => {
    const { tenantId } = request.jwtPayload;
    const params = searchSchema.parse(request.query);
    const pattern = `%${params.q}%`;

    const results: Array<{ type: string; id: string; title: string; description: string | null; createdAt: Date }> = [];

    // Search tasks
    if (params.type === "all" || params.type === "tasks") {
      const taskRows = await db.select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        createdAt: tasks.createdAt,
      })
        .from(tasks)
        .where(and(
          eq(tasks.tenantId, tenantId),
          isNull(tasks.deletedAt),
          or(ilike(tasks.title, pattern), ilike(tasks.description, pattern)),
        ))
        .orderBy(desc(tasks.updatedAt))
        .limit(params.limit);

      for (const row of taskRows) {
        results.push({ type: "task", id: row.id, title: row.title, description: row.description, createdAt: row.createdAt });
      }
    }

    // Search projects
    if (params.type === "all" || params.type === "projects") {
      const projectRows = await db.select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        createdAt: projects.createdAt,
      })
        .from(projects)
        .where(and(
          eq(projects.tenantId, tenantId),
          or(ilike(projects.name, pattern), ilike(projects.description, pattern)),
        ))
        .orderBy(desc(projects.updatedAt))
        .limit(params.limit);

      for (const row of projectRows) {
        results.push({ type: "project", id: row.id, title: row.name, description: row.description, createdAt: row.createdAt });
      }
    }

    // Search comments
    if (params.type === "all" || params.type === "comments") {
      const commentRows = await db.select({
        id: comments.id,
        body: comments.body,
        createdAt: comments.createdAt,
      })
        .from(comments)
        .where(and(
          eq(comments.tenantId, tenantId),
          ilike(comments.body, pattern),
        ))
        .orderBy(desc(comments.createdAt))
        .limit(params.limit);

      for (const row of commentRows) {
        results.push({ type: "comment", id: row.id, title: row.body.slice(0, 100), description: row.body, createdAt: row.createdAt });
      }
    }

    // Sort combined results by createdAt descending
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      data: results.slice(params.offset, params.offset + params.limit),
      total: results.length,
      query: params.q,
    };
  });
}
