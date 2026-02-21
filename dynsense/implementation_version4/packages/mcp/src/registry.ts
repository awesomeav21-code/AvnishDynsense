// Ref: FR-324 — MCP registry: tool dispatch, server lifecycle management
// Ref: FR-323 — Tool allowlist enforcement
import type { McpServer, McpTool } from "./types.js";
import { pmDbServer } from "./servers/pm-db.js";
import { pgvectorServer } from "./servers/pgvector.js";
import { pmNatsServer } from "./servers/pm-nats.js";

const serverRegistry = new Map<string, McpServer>();

export function initializeRegistry(): void {
  serverRegistry.set(pmDbServer.name, pmDbServer);
  serverRegistry.set(pgvectorServer.name, pgvectorServer);
  serverRegistry.set(pmNatsServer.name, pmNatsServer);
}

export function getServer(name: string): McpServer | undefined {
  return serverRegistry.get(name);
}

export function getAllServers(): McpServer[] {
  return Array.from(serverRegistry.values());
}

export function getToolsForAgent(allowedServers: string[], readOnly: boolean): McpTool[] {
  const tools: McpTool[] = [];
  for (const serverName of allowedServers) {
    const server = serverRegistry.get(serverName);
    if (!server || server.status !== "active") continue;

    for (const tool of server.tools) {
      // If read-only agent, skip mutate tools
      if (readOnly && tool.name === "mutate") continue;
      tools.push(tool);
    }
  }
  return tools;
}
