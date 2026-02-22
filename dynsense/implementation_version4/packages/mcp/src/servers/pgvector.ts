// Ref: FR-321 — pgvector server: cosine similarity search, metadata text search (1536-dim)
// Ref: FR-350 — Actual implementation of vector similarity queries
// Ref: design-doc §4.5 — pgvector: Read-only
import type { McpServer, McpToolCallContext, McpToolCallResult } from "../types.js";

async function handleSearch(
  input: Record<string, unknown>,
  ctx: McpToolCallContext,
): Promise<McpToolCallResult> {
  const db = ctx.db as { execute: (query: unknown) => Promise<{ rows: unknown[] }> };
  const queryEmbedding = input["query_embedding"] as number[];
  const topK = (input["top_k"] as number) ?? 10;
  const entityType = input["entity_type"] as string | undefined;

  if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
    return { success: false, error: "query_embedding is required and must be an array" };
  }

  try {
    const vector = `[${queryEmbedding.join(",")}]`;
    const entityFilter = entityType
      ? `AND entity_type = '${entityType.replace(/'/g, "''")}'`
      : "";

    // Cosine similarity search with pgvector <=> operator (cosine distance)
    const result = await db.execute({
      sql: `
        SELECT id, entity_id, entity_type, content, metadata,
               1 - (embedding <=> $1::vector) AS similarity
        FROM embeddings
        WHERE tenant_id = $2 ${entityFilter}
        ORDER BY embedding <=> $1::vector
        LIMIT $3
      `,
      params: [vector, ctx.tenantId, topK],
    });

    return { success: true, data: result.rows };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "pgvector search failed";
    return { success: false, error: message };
  }
}

async function handleSearchByText(
  input: Record<string, unknown>,
  ctx: McpToolCallContext,
): Promise<McpToolCallResult> {
  const db = ctx.db as { execute: (query: unknown) => Promise<{ rows: unknown[] }> };
  const text = input["text"] as string;
  const entityType = input["entity_type"] as string | undefined;
  const limit = (input["limit"] as number) ?? 10;

  if (!text) {
    return { success: false, error: "text is required" };
  }

  try {
    const entityFilter = entityType
      ? `AND entity_type = '${entityType.replace(/'/g, "''")}'`
      : "";

    // pg_trgm similarity search on content column
    const result = await db.execute({
      sql: `
        SELECT id, entity_id, entity_type, content, metadata,
               similarity(content, $1) AS relevance
        FROM embeddings
        WHERE tenant_id = $2
          AND content % $1
          ${entityFilter}
        ORDER BY similarity(content, $1) DESC
        LIMIT $3
      `,
      params: [text, ctx.tenantId, limit],
    });

    return { success: true, data: result.rows };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "text search failed";
    return { success: false, error: message };
  }
}

export const pgvectorServer: McpServer = {
  name: "pgvector",
  transport: "stdio",
  status: "active",
  tools: [
    {
      name: "search",
      description: "Cosine similarity search against embeddings table (1536-dim, top-k)",
      inputSchema: {
        type: "object",
        properties: {
          query_embedding: { type: "array", items: { type: "number" }, description: "1536-dim vector" },
          top_k: { type: "number", default: 10 },
          entity_type: { type: "string", description: "Filter by entity type" },
        },
        required: ["query_embedding"],
      },
      handler: handleSearch,
    },
    {
      name: "search_by_text",
      description: "Search embeddings by metadata text content (pg_trgm)",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string" },
          entity_type: { type: "string" },
          limit: { type: "number", default: 10 },
        },
        required: ["text"],
      },
      handler: handleSearchByText,
    },
  ],
};
