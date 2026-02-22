// Ref: FR-322 — pm-nats server: JetStream publish with auto tenant_id injection, request-reply
// Ref: FR-351 — Event bus implementation with in-memory pub/sub (R0) → NATS/KV in R1
// Ref: design-doc §4.5 — pm-nats: Event emission
import type { McpServer, McpToolCallContext, McpToolCallResult } from "../types.js";

// ---------------------------------------------------------------------------
// In-memory event bus for R0 (replaced by NATS JetStream or @vercel/kv in R1)
// ---------------------------------------------------------------------------

type EventHandler = (event: EventEnvelope) => void;

interface EventEnvelope {
  tenantId: string;
  subject: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

const subscriptions = new Map<string, Set<EventHandler>>();
const eventLog: EventEnvelope[] = [];
const MAX_EVENT_LOG = 10_000;

/** Subscribe to events matching a subject pattern (exact or prefix with *) */
export function subscribe(subject: string, handler: EventHandler): () => void {
  if (!subscriptions.has(subject)) {
    subscriptions.set(subject, new Set());
  }
  subscriptions.get(subject)!.add(handler);

  // Return unsubscribe function
  return () => {
    subscriptions.get(subject)?.delete(handler);
  };
}

/** Get recent events for a tenant (for debugging/monitoring) */
export function getRecentEvents(tenantId: string, limit = 50): EventEnvelope[] {
  return eventLog
    .filter((e) => e.tenantId === tenantId)
    .slice(-limit);
}

function dispatchEvent(envelope: EventEnvelope): void {
  // Store in event log
  eventLog.push(envelope);
  if (eventLog.length > MAX_EVENT_LOG) {
    eventLog.splice(0, eventLog.length - MAX_EVENT_LOG);
  }

  // Dispatch to exact match subscribers
  const exactHandlers = subscriptions.get(envelope.subject);
  if (exactHandlers) {
    for (const handler of exactHandlers) {
      try {
        handler(envelope);
      } catch {
        // Non-blocking — handler errors don't break the bus
      }
    }
  }

  // Dispatch to wildcard prefix subscribers (e.g., "pm.tasks.*")
  for (const [pattern, handlers] of subscriptions) {
    if (pattern.endsWith(".*")) {
      const prefix = pattern.slice(0, -2);
      if (envelope.subject.startsWith(prefix) && pattern !== envelope.subject) {
        for (const handler of handlers) {
          try {
            handler(envelope);
          } catch {
            // Non-blocking
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// MCP Tool handlers
// ---------------------------------------------------------------------------

async function handlePublish(
  input: Record<string, unknown>,
  ctx: McpToolCallContext,
): Promise<McpToolCallResult> {
  const subject = input["subject"] as string;
  const payload = input["payload"] as Record<string, unknown>;

  if (!subject) {
    return { success: false, error: "subject is required" };
  }
  if (!payload || typeof payload !== "object") {
    return { success: false, error: "payload is required and must be an object" };
  }

  // Auto-inject tenant_id into every event
  const envelope: EventEnvelope = {
    tenantId: ctx.tenantId,
    subject,
    payload: { ...payload, tenantId: ctx.tenantId },
    timestamp: Date.now(),
  };

  dispatchEvent(envelope);

  return {
    success: true,
    data: { subject, tenantId: ctx.tenantId, timestamp: envelope.timestamp },
  };
}

async function handleRequest(
  input: Record<string, unknown>,
  ctx: McpToolCallContext,
): Promise<McpToolCallResult> {
  const subject = input["subject"] as string;
  const payload = input["payload"] as Record<string, unknown>;
  // timeout_ms will be used in R1 with real NATS async reply

  if (!subject || !payload) {
    return { success: false, error: "subject and payload are required" };
  }

  const replySubject = `${subject}.reply.${Date.now()}`;

  // Publish the request with reply subject
  dispatchEvent({
    tenantId: ctx.tenantId,
    subject,
    payload: { ...payload, tenantId: ctx.tenantId, _replyTo: replySubject },
    timestamp: Date.now(),
  });

  // R0: In-memory bus — check for synchronous reply in event log
  // In R1 with real NATS, this becomes an async await on the reply subject
  const reply = eventLog.find(
    (e) => e.subject === replySubject && e.tenantId === ctx.tenantId,
  );

  if (reply) {
    return { success: true, data: reply.payload };
  }

  return {
    success: true,
    data: {
      message: "Request published. Reply will be delivered asynchronously.",
      replySubject,
    },
  };
}

export const pmNatsServer: McpServer = {
  name: "pm-nats",
  transport: "stdio",
  status: "active",
  tools: [
    {
      name: "publish",
      description: "Publish an event to a NATS JetStream subject with auto tenant_id injection",
      inputSchema: {
        type: "object",
        properties: {
          subject: { type: "string", description: "NATS subject (e.g., pm.tasks.status_changed)" },
          payload: { type: "object", description: "Event payload" },
        },
        required: ["subject", "payload"],
      },
      handler: handlePublish,
    },
    {
      name: "request",
      description: "Send a request-reply message via NATS",
      inputSchema: {
        type: "object",
        properties: {
          subject: { type: "string" },
          payload: { type: "object" },
          timeout_ms: { type: "number", default: 5000 },
        },
        required: ["subject", "payload"],
      },
      handler: handleRequest,
    },
  ],
};
