// Ref: FR-320 — pm-db server: query, mutate, get_by_id tools with Drizzle ORM
// Ref: design-doc §4.5 — pm-db: Read + Write (per agent permission)
import type { McpServer } from "../types.js";

export const pmDbServer: McpServer = {
  name: "pm-db",
  transport: "stdio",
  status: "active",
  tools: [
    {
      name: "query",
      description: "Execute a read-only query against the PM database with tenant scoping",
      inputSchema: {
        type: "object",
        properties: {
          table: { type: "string", description: "Table name to query" },
          filters: { type: "object", description: "Filter conditions" },
          limit: { type: "number", description: "Max rows to return" },
        },
        required: ["table"],
      },
    },
    {
      name: "mutate",
      description: "Execute a write operation (insert/update/delete) against the PM database",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: ["insert", "update", "delete"] },
          table: { type: "string" },
          data: { type: "object" },
          where: { type: "object" },
        },
        required: ["operation", "table"],
      },
    },
    {
      name: "get_by_id",
      description: "Get a single record by ID from any table",
      inputSchema: {
        type: "object",
        properties: {
          table: { type: "string" },
          id: { type: "string", format: "uuid" },
        },
        required: ["table", "id"],
      },
    },
  ],
};
