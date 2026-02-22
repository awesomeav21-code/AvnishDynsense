// Ref: FR-3002 — MCP Integration Layer
// Ref: design-doc §4.5 — MCP Tool System

export interface McpToolCallContext {
  tenantId: string;
  db: unknown; // Database instance — typed as unknown to avoid circular deps
}

export type McpToolHandler = (
  input: Record<string, unknown>,
  ctx: McpToolCallContext,
) => Promise<McpToolCallResult>;

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler?: McpToolHandler;
}

export interface McpServer {
  name: string;
  transport: "stdio" | "http";
  tools: McpTool[];
  status: "active" | "inactive" | "error";
}

export interface McpToolCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
}
