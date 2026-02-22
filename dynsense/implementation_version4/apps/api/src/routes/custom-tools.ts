// Ref: FR-3007 — Custom tool extension API: register, list, invoke custom MCP tools
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { aiMcpServers } from "@dynsense/db";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";
import { z } from "zod";

const registerToolSchema = z.object({
  name: z.string().min(1).max(100),
  transport: z.enum(["stdio", "http", "sse"]).optional().default("http"),
  config: z.record(z.unknown()).optional(),
  tools: z.array(z.record(z.unknown())).optional(),
});

export async function customToolRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

  app.addHook("preHandler", authenticate);

  // GET / — list all registered MCP tool servers
  app.get("/", async () => {
    const rows = await db.select().from(aiMcpServers)
      .orderBy(aiMcpServers.createdAt);

    return { data: rows };
  });

  // POST / — register a custom MCP tool server
  app.post("/", {
    preHandler: [requirePermission("config:manage")],
  }, async (request, reply) => {
    const body = registerToolSchema.parse(request.body);

    const [created] = await db.insert(aiMcpServers).values({
      name: body.name,
      transport: body.transport,
      config: body.config ?? {},
      tools: body.tools ?? [],
    }).returning();

    reply.status(201).send({ data: created });
  });

  // DELETE /:id — remove a custom tool server
  app.delete("/:id", {
    preHandler: [requirePermission("config:manage")],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await db.query.aiMcpServers.findFirst({
      where: eq(aiMcpServers.id, id),
    });
    if (!existing) throw AppError.notFound("Custom tool server not found");

    await db.delete(aiMcpServers).where(eq(aiMcpServers.id, id));
    reply.status(204).send();
  });

  // POST /:id/invoke — invoke a tool on a custom MCP server (test endpoint)
  app.post("/:id/invoke", async (request) => {
    const { id } = request.params as { id: string };
    const input = request.body as Record<string, unknown>;

    const tool = await db.query.aiMcpServers.findFirst({
      where: eq(aiMcpServers.id, id),
    });
    if (!tool) throw AppError.notFound("Custom tool server not found");

    // R1: In production, forward request to the MCP server transport
    return {
      data: {
        toolId: id,
        toolName: tool.name,
        input,
        output: { message: "Tool invocation stub. In production, this calls the MCP server." },
        status: "success",
      },
    };
  });
}
