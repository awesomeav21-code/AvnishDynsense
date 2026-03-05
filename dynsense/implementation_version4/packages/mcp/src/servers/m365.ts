// Ref: ARCHITECTURE 1.md §3.3 — m365 (HTTP/SSE), Outlook, Calendar, Teams, OAuth 2.0
import type { McpServer, McpToolCallContext, McpToolCallResult } from "../types.js";

/**
 * List recent emails from Outlook inbox.
 * In production: GET /me/messages via Microsoft Graph API with OAuth 2.0 token.
 */
async function handleListEmails(
  input: Record<string, unknown>,
  _ctx: McpToolCallContext,
): Promise<McpToolCallResult> {
  const limit = (input["limit"] as number) ?? 10;
  const folder = (input["folder"] as string) ?? "inbox";

  return {
    success: true,
    data: {
      folder,
      message: "Stub data — configure M365 integration with OAuth 2.0 for live email data.",
      emails: [],
      limit,
    },
  };
}

/**
 * Search emails by keyword.
 * In production: GET /me/messages?$search="keyword" via Graph API.
 */
async function handleSearchEmails(
  input: Record<string, unknown>,
  _ctx: McpToolCallContext,
): Promise<McpToolCallResult> {
  const query = input["query"] as string | undefined;
  const limit = (input["limit"] as number) ?? 10;

  if (!query) {
    return { success: false, error: "query is required" };
  }

  return {
    success: true,
    data: {
      query,
      message: "Stub data — configure M365 integration for live email search.",
      results: [],
      limit,
    },
  };
}

/**
 * List calendar events within a date range.
 * In production: GET /me/calendarView via Graph API.
 */
async function handleListCalendarEvents(
  input: Record<string, unknown>,
  _ctx: McpToolCallContext,
): Promise<McpToolCallResult> {
  const startDate = input["startDate"] as string | undefined;
  const endDate = input["endDate"] as string | undefined;
  const limit = (input["limit"] as number) ?? 20;

  if (!startDate || !endDate) {
    return { success: false, error: "startDate and endDate are required (ISO 8601 format)" };
  }

  return {
    success: true,
    data: {
      startDate,
      endDate,
      message: "Stub data — configure M365 integration for live calendar data.",
      events: [],
      limit,
    },
  };
}

/**
 * Send an email via Outlook.
 * In production: POST /me/sendMail via Graph API.
 */
async function handleSendEmail(
  input: Record<string, unknown>,
  _ctx: McpToolCallContext,
): Promise<McpToolCallResult> {
  const to = input["to"] as string | undefined;
  const subject = input["subject"] as string | undefined;
  const body = input["body"] as string | undefined;

  if (!to || !subject || !body) {
    return { success: false, error: "to, subject, and body are required" };
  }

  return {
    success: true,
    data: {
      message: "Stub — M365 integration not configured. Email was NOT sent.",
      to,
      subject,
      sent: false,
    },
  };
}

export const m365Server: McpServer = {
  name: "m365",
  transport: "http",
  status: "active",
  tools: [
    {
      name: "list_emails",
      description: "List recent emails from Outlook inbox",
      inputSchema: {
        type: "object",
        properties: {
          folder: { type: "string", default: "inbox", description: "Mail folder (inbox, sent, drafts)" },
          limit: { type: "number", default: 10 },
        },
        required: [],
      },
      handler: handleListEmails,
    },
    {
      name: "search_emails",
      description: "Search emails by keyword via Microsoft Graph",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search keyword or phrase" },
          limit: { type: "number", default: 10 },
        },
        required: ["query"],
      },
      handler: handleSearchEmails,
    },
    {
      name: "list_calendar_events",
      description: "List calendar events within a date range",
      inputSchema: {
        type: "object",
        properties: {
          startDate: { type: "string", description: "Start date (ISO 8601)" },
          endDate: { type: "string", description: "End date (ISO 8601)" },
          limit: { type: "number", default: 20 },
        },
        required: ["startDate", "endDate"],
      },
      handler: handleListCalendarEvents,
    },
    {
      name: "send_email",
      description: "Send an email via Outlook (requires M365 OAuth)",
      inputSchema: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient email address" },
          subject: { type: "string" },
          body: { type: "string", description: "Email body (plain text or HTML)" },
        },
        required: ["to", "subject", "body"],
      },
      handler: handleSendEmail,
    },
  ],
};
