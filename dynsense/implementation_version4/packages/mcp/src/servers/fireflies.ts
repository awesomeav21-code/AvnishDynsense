// Ref: ARCHITECTURE 1.md §3.3 — fireflies (HTTP) + otter (HTTP), meeting transcriptions
// Combined server: handles both Fireflies.ai and Otter.ai transcription sources
import type { McpServer, McpToolCallContext, McpToolCallResult } from "../types.js";

/**
 * List recent meeting transcripts.
 * In production: Fireflies GraphQL API (https://api.fireflies.ai/graphql)
 *                or Otter.ai API depending on configured provider.
 */
async function handleListTranscripts(
  input: Record<string, unknown>,
  _ctx: McpToolCallContext,
): Promise<McpToolCallResult> {
  const limit = (input["limit"] as number) ?? 10;
  const provider = (input["provider"] as string) ?? "fireflies";

  return {
    success: true,
    data: {
      provider,
      message: `Stub data — configure ${provider} integration with API key for live transcripts.`,
      transcripts: [],
      limit,
    },
  };
}

/**
 * Search transcripts by keyword or participant.
 * In production: Fireflies search query or Otter keyword search.
 */
async function handleSearchTranscripts(
  input: Record<string, unknown>,
  _ctx: McpToolCallContext,
): Promise<McpToolCallResult> {
  const query = input["query"] as string | undefined;
  const provider = (input["provider"] as string) ?? "fireflies";
  const limit = (input["limit"] as number) ?? 10;

  if (!query) {
    return { success: false, error: "query is required" };
  }

  return {
    success: true,
    data: {
      query,
      provider,
      message: `Stub data — configure ${provider} integration for live transcript search.`,
      results: [],
      limit,
    },
  };
}

/**
 * Get a single transcript by ID with full text and action items.
 * In production: Fireflies transcript query by ID or Otter transcript fetch.
 */
async function handleGetTranscript(
  input: Record<string, unknown>,
  _ctx: McpToolCallContext,
): Promise<McpToolCallResult> {
  const transcriptId = input["transcriptId"] as string | undefined;
  const provider = (input["provider"] as string) ?? "fireflies";

  if (!transcriptId) {
    return { success: false, error: "transcriptId is required" };
  }

  return {
    success: true,
    data: {
      transcriptId,
      provider,
      message: `Stub data — configure ${provider} integration for full transcript retrieval.`,
      transcript: null,
    },
  };
}

/**
 * Extract action items from a meeting transcript.
 * In production: Fireflies action_items field or AI-extracted from Otter transcript.
 */
async function handleGetActionItems(
  input: Record<string, unknown>,
  _ctx: McpToolCallContext,
): Promise<McpToolCallResult> {
  const transcriptId = input["transcriptId"] as string | undefined;
  const provider = (input["provider"] as string) ?? "fireflies";

  if (!transcriptId) {
    return { success: false, error: "transcriptId is required" };
  }

  return {
    success: true,
    data: {
      transcriptId,
      provider,
      message: `Stub data — configure ${provider} integration for action item extraction.`,
      actionItems: [],
    },
  };
}

export const firefliesServer: McpServer = {
  name: "fireflies",
  transport: "http",
  status: "active",
  tools: [
    {
      name: "list_transcripts",
      description: "List recent meeting transcripts from Fireflies.ai or Otter.ai",
      inputSchema: {
        type: "object",
        properties: {
          provider: { type: "string", enum: ["fireflies", "otter"], default: "fireflies" },
          limit: { type: "number", default: 10 },
        },
        required: [],
      },
      handler: handleListTranscripts,
    },
    {
      name: "search_transcripts",
      description: "Search meeting transcripts by keyword or participant name",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search keyword, phrase, or participant name" },
          provider: { type: "string", enum: ["fireflies", "otter"], default: "fireflies" },
          limit: { type: "number", default: 10 },
        },
        required: ["query"],
      },
      handler: handleSearchTranscripts,
    },
    {
      name: "get_transcript",
      description: "Get full transcript text and metadata for a meeting",
      inputSchema: {
        type: "object",
        properties: {
          transcriptId: { type: "string", description: "Transcript ID from Fireflies or Otter" },
          provider: { type: "string", enum: ["fireflies", "otter"], default: "fireflies" },
        },
        required: ["transcriptId"],
      },
      handler: handleGetTranscript,
    },
    {
      name: "get_action_items",
      description: "Extract action items from a meeting transcript",
      inputSchema: {
        type: "object",
        properties: {
          transcriptId: { type: "string", description: "Transcript ID" },
          provider: { type: "string", enum: ["fireflies", "otter"], default: "fireflies" },
        },
        required: ["transcriptId"],
      },
      handler: handleGetActionItems,
    },
  ],
};
