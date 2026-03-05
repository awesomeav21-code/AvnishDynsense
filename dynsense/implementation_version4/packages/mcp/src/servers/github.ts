// Ref: FR-420 — GitHub MCP server: repos, PRs, commits, branch status
// Ref: ARCHITECTURE 1.md §3.3 — github (stdio), Git repos, PRs, commits
import type { McpServer, McpToolCallContext, McpToolCallResult } from "../types.js";

/**
 * List repositories accessible via the tenant's GitHub App installation.
 * In production: GET /installation/repositories using installation access token.
 */
async function handleListRepos(
  _input: Record<string, unknown>,
  _ctx: McpToolCallContext,
): Promise<McpToolCallResult> {
  // Production: look up GitHub integration config from DB, exchange installation token, call API
  return {
    success: true,
    data: {
      message: "GitHub App not configured — returning stub data. Configure via /api/v1/integrations.",
      repositories: [
        { name: "dynsense", fullName: "dynpro/dynsense", defaultBranch: "main", private: true },
      ],
    },
  };
}

/**
 * List pull requests for a repository, optionally filtered by state.
 * In production: GET /repos/{owner}/{repo}/pulls
 */
async function handleListPrs(
  input: Record<string, unknown>,
  _ctx: McpToolCallContext,
): Promise<McpToolCallResult> {
  const repo = input["repo"] as string | undefined;
  const state = (input["state"] as string) ?? "open";

  if (!repo) {
    return { success: false, error: "repo is required (e.g. 'dynpro/dynsense')" };
  }

  return {
    success: true,
    data: {
      repo,
      state,
      message: "Stub data — configure GitHub integration for live PR data.",
      pullRequests: [],
    },
  };
}

/**
 * List recent commits for a repo/branch.
 * In production: GET /repos/{owner}/{repo}/commits?sha={branch}
 */
async function handleListCommits(
  input: Record<string, unknown>,
  _ctx: McpToolCallContext,
): Promise<McpToolCallResult> {
  const repo = input["repo"] as string | undefined;
  const branch = (input["branch"] as string) ?? "main";
  const limit = (input["limit"] as number) ?? 10;

  if (!repo) {
    return { success: false, error: "repo is required" };
  }

  return {
    success: true,
    data: {
      repo,
      branch,
      message: "Stub data — configure GitHub integration for live commit data.",
      commits: [],
      limit,
    },
  };
}

/**
 * Get CI/check-run status for a branch or PR.
 * In production: GET /repos/{owner}/{repo}/commits/{ref}/check-runs
 */
async function handleGetBranchStatus(
  input: Record<string, unknown>,
  _ctx: McpToolCallContext,
): Promise<McpToolCallResult> {
  const repo = input["repo"] as string | undefined;
  const branch = input["branch"] as string | undefined;

  if (!repo || !branch) {
    return { success: false, error: "repo and branch are required" };
  }

  return {
    success: true,
    data: {
      repo,
      branch,
      message: "Stub data — configure GitHub integration for live CI status.",
      checks: [],
      overallStatus: "unknown",
    },
  };
}

export const githubServer: McpServer = {
  name: "github",
  transport: "stdio",
  status: "active",
  tools: [
    {
      name: "list_repos",
      description: "List repositories accessible via the GitHub App installation",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
      handler: handleListRepos,
    },
    {
      name: "list_prs",
      description: "List pull requests for a repository",
      inputSchema: {
        type: "object",
        properties: {
          repo: { type: "string", description: "Repository full name (e.g. 'org/repo')" },
          state: { type: "string", enum: ["open", "closed", "all"], default: "open" },
        },
        required: ["repo"],
      },
      handler: handleListPrs,
    },
    {
      name: "list_commits",
      description: "List recent commits for a repository branch",
      inputSchema: {
        type: "object",
        properties: {
          repo: { type: "string", description: "Repository full name" },
          branch: { type: "string", default: "main" },
          limit: { type: "number", default: 10 },
        },
        required: ["repo"],
      },
      handler: handleListCommits,
    },
    {
      name: "get_branch_status",
      description: "Get CI/check-run status for a branch",
      inputSchema: {
        type: "object",
        properties: {
          repo: { type: "string", description: "Repository full name" },
          branch: { type: "string", description: "Branch name" },
        },
        required: ["repo", "branch"],
      },
      handler: handleGetBranchStatus,
    },
  ],
};
