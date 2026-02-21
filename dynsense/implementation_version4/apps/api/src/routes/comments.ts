import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { comments, mentions, tasks } from "@dynsense/db";
import { createCommentSchema, updateCommentSchema } from "@dynsense/shared";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";

// Extract @mention UUIDs from comment body
function extractMentions(body: string): string[] {
  const regex = /@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
  const ids: string[] = [];
  let match;
  while ((match = regex.exec(body)) !== null) {
    ids.push(match[1]!);
  }
  return [...new Set(ids)];
}

export async function commentRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

  app.addHook("preHandler", authenticate);

  // GET /task/:taskId — list comments for a task
  app.get("/task/:taskId", async (request) => {
    const { tenantId } = request.jwtPayload;
    const { taskId } = request.params as { taskId: string };

    const rows = await db.query.comments.findMany({
      where: and(eq(comments.tenantId, tenantId), eq(comments.taskId, taskId)),
      orderBy: (c, { asc }) => [asc(c.createdAt)],
    });
    return { data: rows };
  });

  // POST / — create comment
  app.post("/", async (request, reply) => {
    const { tenantId, sub } = request.jwtPayload;
    const body = createCommentSchema.parse(request.body);

    // Verify task belongs to tenant
    const task = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, body.taskId), eq(tasks.tenantId, tenantId)),
    });
    if (!task) throw AppError.badRequest("Task not found in your tenant");

    const [comment] = await db.insert(comments).values({
      tenantId,
      taskId: body.taskId,
      authorId: sub,
      body: body.body,
      clientVisible: body.clientVisible,
    }).returning();

    // Extract and insert mentions
    const mentionIds = extractMentions(body.body);
    if (mentionIds.length > 0) {
      await db.insert(mentions).values(
        mentionIds.map((userId) => ({ commentId: comment!.id, userId }))
      ).onConflictDoNothing();
    }

    reply.status(201).send({ data: comment });
  });

  // PATCH /:id — update comment
  app.patch("/:id", async (request) => {
    const { tenantId, sub } = request.jwtPayload;
    const { id } = request.params as { id: string };
    const body = updateCommentSchema.parse(request.body);

    const existing = await db.query.comments.findFirst({
      where: and(eq(comments.id, id), eq(comments.tenantId, tenantId)),
    });
    if (!existing) throw AppError.notFound("Comment not found");
    if (existing.authorId !== sub) throw AppError.forbidden("Can only edit your own comments");

    const [updated] = await db.update(comments)
      .set({ body: body.body, updatedAt: new Date() })
      .where(eq(comments.id, id))
      .returning();

    return { data: updated };
  });

  // GET /mentions/me — get mentions for current user
  app.get("/mentions/me", async (request) => {
    const { sub } = request.jwtPayload;

    const rows = await db.select()
      .from(mentions)
      .innerJoin(comments, eq(mentions.commentId, comments.id))
      .where(eq(mentions.userId, sub))
      .orderBy(comments.createdAt);

    return { data: rows.map((r) => r.comments) };
  });
}
