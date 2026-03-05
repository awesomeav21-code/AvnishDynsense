// Ref: FR-324 — MCP registry: tool dispatch, server lifecycle management
// Ref: FR-323 — Tool allowlist enforcement
import type { McpServer, McpTool, McpToolCallResult, McpToolCallContext } from "./types.js";
import { pmDbServer } from "./servers/pm-db.js";
import { pgvectorServer } from "./servers/pgvector.js";
import { githubServer } from "./servers/github.js";
import { m365Server } from "./servers/m365.js";
import { firefliesServer } from "./servers/fireflies.js";

const serverRegistry = new Map<string, McpServer>();

export function initializeRegistry(): void {
  serverRegistry.set(pmDbServer.name, pmDbServer);
  serverRegistry.set(pgvectorServer.name, pgvectorServer);
  serverRegistry.set(githubServer.name, githubServer);
  serverRegistry.set(m365Server.name, m365Server);
  serverRegistry.set(firefliesServer.name, firefliesServer);
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

/**
 * FR-324: Dispatch a tool call to the appropriate MCP server handler.
 * Format: "server.tool" (e.g., "pgvector.search", "pm-db.query")
 */
export async function callTool(
  qualifiedName: string,
  input: Record<string, unknown>,
  ctx: McpToolCallContext,
): Promise<McpToolCallResult> {
  const dotIdx = qualifiedName.indexOf(".");
  if (dotIdx === -1) {
    return { success: false, error: `Invalid tool name format: '${qualifiedName}'. Expected 'server.tool'.` };
  }

  const serverName = qualifiedName.slice(0, dotIdx);
  const toolName = qualifiedName.slice(dotIdx + 1);

  const server = serverRegistry.get(serverName);
  if (!server) {
    return { success: false, error: `MCP server '${serverName}' not found` };
  }
  if (server.status !== "active") {
    return { success: false, error: `MCP server '${serverName}' is not active (status: ${server.status})` };
  }

  const tool = server.tools.find((t) => t.name === toolName);
  if (!tool) {
    return { success: false, error: `Tool '${toolName}' not found on server '${serverName}'` };
  }

  if (!tool.handler) {
    return { success: false, error: `Tool '${qualifiedName}' has no handler implementation` };
  }

  return tool.handler(input, ctx);
}
