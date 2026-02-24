import type { FastifyInstance } from "fastify";
import { eq, and, isNull, desc } from "drizzle-orm";
import { notifications, users } from "@dynsense/db";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";
import { z } from "zod";

const notificationFilterSchema = z.object({
  type: z.string().optional(),
  unread: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const sendNotificationSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1).max(500),
  body: z.string().max(2000).optional(),
  taskId: z.string().uuid().optional(),
});

export async function notificationRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

  app.addHook("preHandler", authenticate);

  // GET / — list notifications for current user (paginated, filterable by type, unread)
  app.get("/", async (request) => {
    const { tenantId, sub: userId } = request.jwtPayload;
    const filters = notificationFilterSchema.parse(request.query);

    const conditions = [
      eq(notifications.tenantId, tenantId),
      eq(notifications.userId, userId),
    ];

    if (filters.type) {
      conditions.push(eq(notifications.type, filters.type));
    }

    if (filters.unread === "true") {
      conditions.push(isNull(notifications.readAt));
    }

    const rows = await db.select().from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(filters.limit)
      .offset(filters.offset);

    return { data: rows };
  });

  // POST / — send a notification to a team member
  app.post("/", async (request, reply) => {
    const { tenantId, sub: senderId } = request.jwtPayload;
    const body = sendNotificationSchema.parse(request.body);

    // Verify target user belongs to same tenant
    const targetUser = await db.query.users.findFirst({
      where: and(eq(users.id, body.userId), eq(users.tenantId, tenantId)),
    });
    if (!targetUser) throw AppError.notFound("User not found in this workspace");

    // Resolve sender name
    const sender = await db.query.users.findFirst({ where: eq(users.id, senderId) });

    const [created] = await db.insert(notifications).values({
      tenantId,
      userId: body.userId,
      type: "mention",
      title: body.title,
      body: body.body ?? null,
      data: { senderId, senderName: sender?.name ?? "Unknown", taskId: body.taskId ?? null },
    }).returning();

    reply.status(201).send({ data: created });
  });

  // POST /:id/read — mark a single notification as read
  app.post("/:id/read", async (request) => {
    const { tenantId, sub: userId } = request.jwtPayload;
    const { id } = request.params as { id: string };

    const existing = await db.query.notifications.findFirst({
      where: and(
        eq(notifications.id, id),
        eq(notifications.tenantId, tenantId),
        eq(notifications.userId, userId),
      ),
    });

    if (!existing) throw AppError.notFound("Notification not found");

    const [updated] = await db.update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();

    return { data: updated };
  });

  // POST /read-all — mark all notifications as read for current user
  app.post("/read-all", async (request) => {
    const { tenantId, sub: userId } = request.jwtPayload;

    await db.update(notifications)
      .set({ readAt: new Date() })
      .where(and(
        eq(notifications.tenantId, tenantId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      ));

    return { message: "All notifications marked as read" };
  });
}
