import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { JwtPayload } from "@dynsense/shared";

/**
 * Connected SSE client descriptor.
 * Each entry holds the raw Node response so we can write SSE frames directly.
 */
interface SseClient {
  id: string;
  tenantId: string;
  reply: FastifyReply;
}

/**
 * Map of tenantId -> Set of connected SSE clients.
 * Shared across the process so other route modules can import
 * `broadcastToTenant` and push events to the right connections.
 */
const clientsByTenant = new Map<string, Set<SseClient>>();

/**
 * Broadcast an SSE event to every connected client in a given tenant.
 *
 * @param tenantId - The tenant to target.
 * @param event    - The SSE event name (appears in the `event:` field).
 * @param data     - Arbitrary JSON-serialisable payload.
 */
export function broadcastToTenant(
  tenantId: string,
  event: string,
  data: Record<string, unknown>,
): void {
  const clients = clientsByTenant.get(tenantId);
  if (!clients || clients.size === 0) return;

  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  for (const client of clients) {
    try {
      client.reply.raw.write(frame);
    } catch {
      // Connection may already be closed; clean-up will happen via the
      // "close" listener registered in the route handler.
    }
  }
}

export async function sseRoutes(app: FastifyInstance) {
  // GET /stream — SSE endpoint
  // Auth is handled manually via query-param `token` because the browser
  // EventSource API does not support custom request headers.
  app.get("/stream", async (request: FastifyRequest, reply: FastifyReply) => {
    const { token } = request.query as { token?: string };

    if (!token) {
      return reply.status(401).send({
        error: "UNAUTHORIZED",
        message: "Missing token query parameter",
      });
    }

    // Verify the JWT manually — same logic used in middleware/auth.ts but
    // applied to a query param instead of the Authorization header.
    let decoded: JwtPayload;
    try {
      decoded = app.jwt.verify<JwtPayload>(token);
    } catch {
      return reply.status(401).send({
        error: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }

    const { tenantId } = decoded;

    // --- Set SSE headers ---
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });

    // Send an initial comment so the client knows the connection is alive.
    reply.raw.write(":ok\n\n");

    // --- Register client ---
    const clientId = `${decoded.sub}-${Date.now()}`;
    const client: SseClient = { id: clientId, tenantId, reply };

    if (!clientsByTenant.has(tenantId)) {
      clientsByTenant.set(tenantId, new Set());
    }
    clientsByTenant.get(tenantId)!.add(client);

    // --- Keep-alive: send a comment every 30 s to prevent proxies /
    //     load-balancers from closing idle connections. ---
    const keepAlive = setInterval(() => {
      try {
        reply.raw.write(":keepalive\n\n");
      } catch {
        // Connection already gone — the close handler will tidy up.
      }
    }, 30_000);

    // --- Clean up when the client disconnects ---
    request.raw.on("close", () => {
      clearInterval(keepAlive);
      const tenantClients = clientsByTenant.get(tenantId);
      if (tenantClients) {
        tenantClients.delete(client);
        if (tenantClients.size === 0) {
          clientsByTenant.delete(tenantId);
        }
      }
    });

    // We have already written to the raw socket — tell Fastify not to
    // send its own response by returning the reply (already hijacked).
    // Using `reply.hijack()` prevents Fastify from calling `reply.send()`.
    reply.hijack();
  });
}
