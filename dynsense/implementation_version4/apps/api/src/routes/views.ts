import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { savedViews } from "@dynsense/db";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";
import { z } from "zod";

const createViewSchema = z.object({
  name: z.string().min(1).max(255),
  viewType: z.string().min(1).max(50).default("list"),
  filters: z.unknown().optional(),
  sort: z.unknown().optional(),
  columns: z.unknown().optional(),
});

const updateViewSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  viewType: z.string().min(1).max(50).optional(),
  filters: z.unknown().optional(),
  sort: z.unknown().optional(),
  columns: z.unknown().optional(),
});

export async function viewRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

  app.addHook("preHandler", authenticate);

  // GET / — list saved views for current user
  app.get("/", async (request) => {
    const { tenantId, sub: userId } = request.jwtPayload;

    const rows = await db.select().from(savedViews)
      .where(and(
        eq(savedViews.tenantId, tenantId),
        eq(savedViews.userId, userId),
      ))
      .orderBy(savedViews.createdAt);

    return { data: rows };
  });

  // POST / — create saved view
  app.post("/", async (request, reply) => {
    const { tenantId, sub: userId } = request.jwtPayload;
    const body = createViewSchema.parse(request.body);

    const [view] = await db.insert(savedViews).values({
      tenantId,
      userId,
      name: body.name,
      viewType: body.viewType,
      filters: body.filters ?? null,
      sort: body.sort ?? null,
      columns: body.columns ?? null,
    }).returning();

    reply.status(201).send({ data: view });
  });

  // GET /:id — get saved view
  app.get("/:id", async (request) => {
    const { tenantId, sub: userId } = request.jwtPayload;
    const { id } = request.params as { id: string };

    const view = await db.query.savedViews.findFirst({
      where: and(
        eq(savedViews.id, id),
        eq(savedViews.tenantId, tenantId),
        eq(savedViews.userId, userId),
      ),
    });

    if (!view) throw AppError.notFound("Saved view not found");
    return { data: view };
  });

  // PATCH /:id — update saved view
  app.patch("/:id", async (request) => {
    const { tenantId, sub: userId } = request.jwtPayload;
    const { id } = request.params as { id: string };
    const body = updateViewSchema.parse(request.body);

    const existing = await db.query.savedViews.findFirst({
      where: and(
        eq(savedViews.id, id),
        eq(savedViews.tenantId, tenantId),
        eq(savedViews.userId, userId),
      ),
    });
    if (!existing) throw AppError.notFound("Saved view not found");

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) updateData["name"] = body.name;
    if (body.viewType !== undefined) updateData["viewType"] = body.viewType;
    if (body.filters !== undefined) updateData["filters"] = body.filters;
    if (body.sort !== undefined) updateData["sort"] = body.sort;
    if (body.columns !== undefined) updateData["columns"] = body.columns;

    const [updated] = await db.update(savedViews)
      .set(updateData)
      .where(and(eq(savedViews.id, id), eq(savedViews.userId, userId)))
      .returning();

    return { data: updated };
  });

  // DELETE /:id — delete saved view
  app.delete("/:id", async (request, reply) => {
    const { tenantId, sub: userId } = request.jwtPayload;
    const { id } = request.params as { id: string };

    const existing = await db.query.savedViews.findFirst({
      where: and(
        eq(savedViews.id, id),
        eq(savedViews.tenantId, tenantId),
        eq(savedViews.userId, userId),
      ),
    });
    if (!existing) throw AppError.notFound("Saved view not found");

    await db.delete(savedViews)
      .where(and(eq(savedViews.id, id), eq(savedViews.userId, userId)));

    reply.status(204).send();
  });
}
