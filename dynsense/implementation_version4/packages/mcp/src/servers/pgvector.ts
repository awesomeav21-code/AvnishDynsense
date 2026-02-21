// Ref: FR-321 — pgvector server: cosine similarity search, metadata text search (1536-dim)
// Ref: design-doc §4.5 — pgvector: Read-only
import type { McpServer } from "../types.js";

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
    },
  ],
};
