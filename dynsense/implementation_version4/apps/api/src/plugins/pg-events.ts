// Ref: ARCHITECTURE 1.md §4.2 — PostgreSQL LISTEN/NOTIFY event bus
// Replaces NATS JetStream in-memory bus with Postgres-native pub/sub
import postgres from "postgres";
import type { FastifyInstance } from "fastify";
import { ALL_PG_CHANNELS, type PgChannel } from "@dynsense/shared";
import { broadcastToTenant } from "../routes/sse.js";

type EventPayload = {
  tenantId: string;
  event: string;
  data: Record<string, unknown>;
};

type EventHandler = (payload: EventPayload) => void;

const handlers = new Map<string, Set<EventHandler>>();
let sql: postgres.Sql | null = null;

/** Register a handler for a specific PG channel */
export function onPgEvent(channel: PgChannel, handler: EventHandler): () => void {
  if (!handlers.has(channel)) {
    handlers.set(channel, new Set());
  }
  handlers.get(channel)!.add(handler);
  return () => { handlers.get(channel)?.delete(handler); };
}

/** Publish an event via PostgreSQL NOTIFY */
export async function pgNotify(
  dbUrl: string,
  channel: PgChannel,
  payload: EventPayload,
): Promise<void> {
  if (!sql) return;
  await sql.notify(channel, JSON.stringify(payload));
}

/** Fastify plugin — sets up a dedicated PG connection for LISTEN/NOTIFY */
export async function pgEventsPlugin(app: FastifyInstance): Promise<void> {
  const dbUrl = app.env.DATABASE_URL;

  // Create a dedicated connection for LISTEN (separate from Drizzle's pool)
  sql = postgres(dbUrl, { max: 1 });

  // Subscribe to all 6 channels
  for (const channel of ALL_PG_CHANNELS) {
    await sql.listen(channel, (payload) => {
      try {
        const parsed = JSON.parse(payload) as EventPayload;

        // Forward to SSE clients
        broadcastToTenant(parsed.tenantId, parsed.event, parsed.data);

        // Forward to registered handlers
        const channelHandlers = handlers.get(channel);
        if (channelHandlers) {
          for (const handler of channelHandlers) {
            try { handler(parsed); } catch { /* non-blocking */ }
          }
        }
      } catch {
        app.log.error(`Failed to parse PG notification on ${channel}`);
      }
    });
  }

  // Clean up on shutdown
  app.addHook("onClose", async () => {
    if (sql) {
      await sql.end().catch(() => {});
      sql = null;
    }
  });

  app.log.info(`PG event bus listening on ${ALL_PG_CHANNELS.length} channels`);
}
