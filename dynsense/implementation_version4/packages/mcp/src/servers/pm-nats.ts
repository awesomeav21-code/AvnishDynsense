// Ref: FR-322 — pm-nats server: JetStream publish with auto tenant_id injection, request-reply
// Ref: design-doc §4.5 — pm-nats: Event emission
import type { McpServer } from "../types.js";

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
    },
  ],
};
