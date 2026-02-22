// Ref: FR-3000 — Multi-Agent Orchestrator: central entry point for all AI operations
// Ref: FR-200 — 7-stage orchestration pipeline
// Ref: design-doc §4.1 — Trigger → Autonomy → Context → Confidence → LLM → PostProcess → Disposition
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { eq, and } from "drizzle-orm";
import type { Database } from "@dynsense/db";
import { tenantConfigs } from "@dynsense/db";
import type { AiCapability, AiDisposition } from "@dynsense/shared";
import { ALL_SUBAGENTS, AI_CONFIDENCE_THRESHOLD } from "@dynsense/shared";

import { wbsGeneratorConfig } from "./agents/wbs-generator.js";
import { whatsNextConfig } from "./agents/whats-next.js";
import { nlQueryConfig } from "./agents/nl-query.js";
import { summaryWriterConfig } from "./agents/summary-writer.js";
import { riskPredictorConfig } from "./agents/risk-predictor.js";
import { aiPmAgentConfig } from "./agents/ai-pm-agent.js";
import { scopeDetectorConfig } from "./agents/scope-detector.js";

import { tenantIsolator } from "./hooks/tenant-isolator.js";
import type { HookContext, HookResult } from "./hooks/tenant-isolator.js";
import { autonomyEnforcer } from "./hooks/autonomy-enforcer.js";
import { rateLimiter } from "./hooks/rate-limiter.js";
import { costTracker } from "./hooks/cost-tracker.js";
import type { CostTrackingData } from "./hooks/cost-tracker.js";
import { auditWriter } from "./hooks/audit-writer.js";
import { traceability } from "./hooks/traceability.js";
import { notificationHook } from "./hooks/notification-hook.js";
import { sessionManager } from "./hooks/session-manager.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrchestratorInput {
  tenantId: string;
  userId: string;
  capability: AiCapability;
  input: Record<string, unknown>;
  sessionId?: string;
}

export interface OrchestratorResult {
  aiActionId: string;
  capability: AiCapability;
  disposition: AiDisposition;
  status: string;
  output: Record<string, unknown> | null;
  confidence: number | null;
}

interface AgentConfig {
  name: string;
  capability: string;
  model: "opus" | "sonnet";
  permissionMode: string;
  maxTurns: number;
  readOnly: boolean;
  allowedMcpServers: string[];
  systemPrompt: string;
}

// ---------------------------------------------------------------------------
// Capability → Agent config mapping
// ---------------------------------------------------------------------------

const CAPABILITY_CONFIGS: Record<string, AgentConfig> = {
  wbs_generator: wbsGeneratorConfig,
  whats_next: whatsNextConfig,
  nl_query: nlQueryConfig,
  summary_writer: summaryWriterConfig,
  risk_predictor: riskPredictorConfig,
  ai_pm_agent: aiPmAgentConfig,
  scope_detector: scopeDetectorConfig,
};

// Model name mapping: our internal model names → Anthropic model IDs
const MODEL_MAP: Record<string, string> = {
  sonnet: "claude-sonnet-4-20250514",
  opus: "claude-opus-4-20250514",
};

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export class AIOrchestrator {
  private readonly db: Database;
  private readonly client: Anthropic | null;

  constructor(opts: { db: Database; anthropicApiKey?: string }) {
    this.db = opts.db;
    this.client = opts.anthropicApiKey
      ? new Anthropic({ apiKey: opts.anthropicApiKey })
      : null;
  }

  async execute(input: OrchestratorInput): Promise<OrchestratorResult> {
    const aiActionId = randomUUID();
    let turnCount = 0;

    // -----------------------------------------------------------------------
    // Stage 1: TRIGGER — Validate capability against ALL_SUBAGENTS, create session context
    // -----------------------------------------------------------------------
    const subagentSpec = ALL_SUBAGENTS.find(
      (s) => s.capability === input.capability,
    );
    if (!subagentSpec) {
      return {
        aiActionId,
        capability: input.capability,
        disposition: "propose",
        status: "failed",
        output: { error: `Capability '${input.capability}' is not a registered subagent` },
        confidence: null,
      };
    }

    const agentConfig = CAPABILITY_CONFIGS[input.capability];
    if (!agentConfig) {
      return {
        aiActionId,
        capability: input.capability,
        disposition: "propose",
        status: "failed",
        output: { error: `No agent config found for '${input.capability}'` },
        confidence: null,
      };
    }

    // -----------------------------------------------------------------------
    // Stage 2: AUTONOMY CHECK — Check tenant config for shadow/propose/execute mode
    // -----------------------------------------------------------------------
    const disposition = await this.checkAutonomy(
      input.tenantId,
      input.capability,
    );

    // -----------------------------------------------------------------------
    // Run PreToolUse hooks sequentially (tenant-isolator → autonomy-enforcer → rate-limiter)
    // -----------------------------------------------------------------------
    const hookCtx: HookContext = {
      tenantId: input.tenantId,
      userId: input.userId,
      aiActionId,
      toolName: input.capability,
      toolInput: input.input,
    };

    const preHooks: Array<{
      name: string;
      fn: (ctx: HookContext) => Promise<HookResult>;
    }> = [
      { name: "tenant-isolator", fn: (ctx) => tenantIsolator(ctx) },
      { name: "autonomy-enforcer", fn: (ctx) => autonomyEnforcer(ctx) },
      { name: "rate-limiter", fn: (ctx) => rateLimiter(ctx, this.db) },
    ];

    for (const hook of preHooks) {
      const result = await hook.fn(hookCtx);

      // Log each pre-hook decision
      await auditWriter(hookCtx, hook.name, "PreToolUse", result, this.db).catch(
        () => {
          /* non-blocking audit write */
        },
      );

      if (!result.allowed) {
        return {
          aiActionId,
          capability: input.capability,
          disposition,
          status: "failed",
          output: {
            error: `Pre-hook '${hook.name}' denied: ${result.reason ?? "no reason"}`,
          },
          confidence: null,
        };
      }

      // Merge modified inputs from hooks
      if (result.modifiedInput) {
        Object.assign(hookCtx.toolInput, result.modifiedInput);
      }
    }

    // -----------------------------------------------------------------------
    // Stage 3: CONTEXT ASSEMBLY — Build prompt from input + agent systemPrompt
    // (RAG stub is acceptable for R0)
    // -----------------------------------------------------------------------
    const userMessage = this.buildUserMessage(input.capability, hookCtx.toolInput);

    // -----------------------------------------------------------------------
    // Stage 4 & 5: LLM CALL — Call Claude API via Anthropic SDK
    // Falls back to stub if ANTHROPIC_API_KEY is not configured
    // -----------------------------------------------------------------------
    let llmOutput: Record<string, unknown> | null = null;
    let confidence = 0.0;
    let costData: CostTrackingData | null = null;
    let status = "proposed";

    if (this.client) {
      try {
        const modelId = MODEL_MAP[agentConfig.model] ?? MODEL_MAP["sonnet"]!;

        const response = await this.client.messages.create({
          model: modelId,
          max_tokens: 4096,
          system: agentConfig.systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        });

        // Extract text content from response
        const textBlocks = response.content.filter(
          (block) => block.type === "text",
        );
        const rawText = textBlocks.map((b) => {
          if (b.type === "text") return b.text;
          return "";
        }).join("\n");

        // Stage 6: POST-PROCESSING — Parse structured output
        const parseResult = this.parseOutput(input.capability, rawText);
        llmOutput = parseResult.output;
        confidence = parseResult.confidence;

        // Track token usage for cost tracking
        costData = {
          model: modelId,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          costUsd: this.estimateCost(
            modelId,
            response.usage.input_tokens,
            response.usage.output_tokens,
          ),
        };

        turnCount = 1;
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown LLM error";
        llmOutput = { error: errorMessage, fallback: true };
        confidence = 0.0;
        status = "failed";
      }
    } else {
      // No API key configured — return stub output
      llmOutput = this.generateStubOutput(input.capability, input.input);
      confidence = 0.75;
      status = "proposed";
    }

    // -----------------------------------------------------------------------
    // Stage 4 (post-LLM): CONFIDENCE CHECK — Compare against threshold
    // -----------------------------------------------------------------------
    if (confidence < AI_CONFIDENCE_THRESHOLD && status !== "failed") {
      status = "proposed"; // Low confidence forces proposal for human review
    }

    // -----------------------------------------------------------------------
    // Stage 7: DISPOSITION — Based on autonomy mode, determine action
    // -----------------------------------------------------------------------
    if (status !== "failed") {
      switch (disposition) {
        case "shadow":
          status = "shadow_logged";
          break;
        case "propose":
          status = "proposed";
          break;
        case "execute":
          status = confidence >= AI_CONFIDENCE_THRESHOLD ? "executed" : "proposed";
          break;
      }
    }

    // -----------------------------------------------------------------------
    // Run PostToolUse hooks in parallel (cost-tracker, audit-writer, traceability, notification-hook)
    // -----------------------------------------------------------------------
    const postHookPromises: Promise<void>[] = [];

    if (costData) {
      postHookPromises.push(
        costTracker(hookCtx, costData, this.db).catch(() => {
          /* non-blocking */
        }),
      );
    }

    postHookPromises.push(
      auditWriter(
        hookCtx,
        "orchestrator",
        "PostToolUse",
        { allowed: true, reason: `status=${status}, confidence=${confidence}` },
        this.db,
      ).catch(() => {
        /* non-blocking */
      }),
    );

    postHookPromises.push(
      traceability(hookCtx, llmOutput, this.db).catch(() => {
        /* non-blocking */
      }),
    );

    postHookPromises.push(
      notificationHook(hookCtx, disposition).catch(() => {
        /* non-blocking */
      }),
    );

    await Promise.all(postHookPromises);

    // -----------------------------------------------------------------------
    // Run Stop hook: session-manager — persist session state
    // -----------------------------------------------------------------------
    await sessionManager(
      {
        sessionId: input.sessionId ?? aiActionId,
        tenantId: input.tenantId,
        userId: input.userId,
        capability: input.capability,
        turnCount,
        state: { lastOutput: llmOutput },
      },
      this.db,
    ).catch(() => {
      /* non-blocking */
    });

    return {
      aiActionId,
      capability: input.capability,
      disposition,
      status,
      output: llmOutput,
      confidence,
    };
  }

  // -------------------------------------------------------------------------
  // Stage 2: Check tenant autonomy configuration
  // -------------------------------------------------------------------------
  private async checkAutonomy(
    tenantId: string,
    capability: AiCapability,
  ): Promise<AiDisposition> {
    try {
      // Look for tenant-specific autonomy configuration
      const configRow = await this.db
        .select()
        .from(tenantConfigs)
        .where(
          and(
            eq(tenantConfigs.tenantId, tenantId),
            eq(tenantConfigs.key, `ai.autonomy.${capability}`),
          ),
        )
        .limit(1);

      if (configRow[0]) {
        const value = configRow[0].value as { mode?: string } | null;
        if (
          value &&
          typeof value === "object" &&
          "mode" in value &&
          (value.mode === "shadow" ||
            value.mode === "propose" ||
            value.mode === "execute")
        ) {
          return value.mode;
        }
      }

      // Fall back to global tenant autonomy setting
      const globalConfig = await this.db
        .select()
        .from(tenantConfigs)
        .where(
          and(
            eq(tenantConfigs.tenantId, tenantId),
            eq(tenantConfigs.key, "ai.autonomy.default"),
          ),
        )
        .limit(1);

      if (globalConfig[0]) {
        const value = globalConfig[0].value as { mode?: string } | null;
        if (
          value &&
          typeof value === "object" &&
          "mode" in value &&
          (value.mode === "shadow" ||
            value.mode === "propose" ||
            value.mode === "execute")
        ) {
          return value.mode;
        }
      }
    } catch {
      // If DB query fails, default to safest mode
    }

    // Default: propose mode (FR-300)
    return "propose";
  }

  // -------------------------------------------------------------------------
  // Build user message from capability-specific input
  // -------------------------------------------------------------------------
  private buildUserMessage(
    capability: AiCapability,
    input: Record<string, unknown>,
  ): string {
    switch (capability) {
      case "wbs_generator":
        return [
          "Generate a Work Breakdown Structure for the following project:",
          "",
          `Project Description: ${String(input["description"] ?? input["query"] ?? "No description provided")}`,
          input["constraints"]
            ? `Constraints: ${String(input["constraints"])}`
            : "",
          "",
          "Return the WBS as a structured JSON object with phases, tasks, and sub-tasks.",
          "Include effort estimates, priorities, and dependency relationships.",
          "Format: { phases: [{ name: string, tasks: [{ name: string, effort: string, priority: string, dependencies?: string[] }] }] }",
        ]
          .filter(Boolean)
          .join("\n");

      case "whats_next":
        return [
          "Analyze the following project context and provide prioritized task recommendations:",
          "",
          `Context: ${JSON.stringify(input)}`,
          "",
          "Return as JSON: { items: [{ priority: 'high'|'medium'|'low', task: string, reason: string }] }",
        ].join("\n");

      case "nl_query":
        return [
          "Answer the following question about the project:",
          "",
          `Question: ${String(input["query"] ?? "No query provided")}`,
          "",
          `Project context: ${JSON.stringify(input["context"] ?? {})}`,
          "",
          "Return as JSON: { answer: string, sources: string[], confidence: number }",
        ].join("\n");

      case "summary_writer":
        return [
          "Generate a project status summary based on the following data:",
          "",
          `Project data: ${JSON.stringify(input)}`,
          "",
          "Return as JSON: { title: string, text: string, highlights: string[], blockers: string[], nextSteps: string[] }",
        ].join("\n");

      case "risk_predictor":
        return [
          "Analyze the following project data and identify risks:",
          "",
          `Project ID: ${String(input["projectId"] ?? "unknown")}`,
          `Project data: ${JSON.stringify(input)}`,
          "",
          "Identify: delayed tasks (overdue or stalled >48h), dependency chain bottlenecks, scope creep indicators, resource overallocation.",
          "",
          'Return as JSON: { risks: [{ type: string, severity: "critical"|"high"|"medium"|"low", title: string, description: string, affectedTasks: string[], recommendation: string }], overallRiskScore: number (0-1) }',
        ].join("\n");

      case "ai_pm_agent":
        return [
          "Run periodic checks on the following project and identify actionable nudges:",
          "",
          `Project data: ${JSON.stringify(input)}`,
          "",
          "Identify: overdue tasks (due_date < now), stalled tasks (no update >48h and not blocked), tasks needing escalation.",
          "",
          'Return as JSON: { nudges: [{ taskId: string, type: "overdue"|"stalled"|"escalation", message: string, assigneeId: string }], summary: string }',
        ].join("\n");

      case "scope_detector":
        return [
          "Compare the current project task tree against the WBS baseline:",
          "",
          `Project data: ${JSON.stringify(input)}`,
          "",
          "Identify: unplanned additions, removed items, and scope variance percentage.",
          "",
          "Return as JSON: { baselineTaskCount: number, currentTaskCount: number, addedTasks: string[], removedTasks: string[], scopeVariancePercent: number, assessment: string }",
        ].join("\n");

      default:
        return `Process the following input for capability '${capability}':\n\n${JSON.stringify(input)}`;
    }
  }

  // -------------------------------------------------------------------------
  // Parse structured output from LLM response
  // -------------------------------------------------------------------------
  private parseOutput(
    capability: AiCapability,
    rawText: string,
  ): { output: Record<string, unknown>; confidence: number } {
    // Try to extract JSON from the response
    try {
      // Look for JSON block in markdown code fences
      const jsonMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      const jsonStr = jsonMatch ? jsonMatch[1]! : rawText;

      const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
      return {
        output: { type: capability, ...parsed },
        confidence: 1.0, // Clean parse = high confidence
      };
    } catch {
      // JSON parse failed — wrap raw text as partial output
      return {
        output: {
          type: capability,
          rawText,
          parseWarning: "Output was not valid JSON; returning raw text",
        },
        confidence: 0.7, // Partial parse = medium confidence
      };
    }
  }

  // -------------------------------------------------------------------------
  // Estimate USD cost from token counts
  // -------------------------------------------------------------------------
  private estimateCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): number {
    // Pricing as of 2025 (per million tokens)
    const pricing: Record<string, { input: number; output: number }> = {
      "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
      "claude-opus-4-20250514": { input: 15.0, output: 75.0 },
    };

    const rate = pricing[model] ?? { input: 3.0, output: 15.0 };
    return (
      (inputTokens / 1_000_000) * rate.input +
      (outputTokens / 1_000_000) * rate.output
    );
  }

  // -------------------------------------------------------------------------
  // Stub output for when ANTHROPIC_API_KEY is not configured
  // -------------------------------------------------------------------------
  private generateStubOutput(
    capability: string,
    input: Record<string, unknown>,
  ): Record<string, unknown> {
    switch (capability) {
      case "wbs_generator":
        return {
          type: "wbs",
          phases: [
            {
              name: "Phase 1: Discovery",
              tasks: [
                "Stakeholder interviews",
                "Requirements gathering",
                "Gap analysis",
              ],
            },
            {
              name: "Phase 2: Design",
              tasks: [
                "Solution architecture",
                "UI/UX wireframes",
                "Data model design",
              ],
            },
            {
              name: "Phase 3: Build",
              tasks: [
                "Core implementation",
                "Integration development",
                "Testing",
              ],
            },
            {
              name: "Phase 4: Deploy",
              tasks: ["Staging deployment", "UAT", "Production cutover"],
            },
          ],
          note: "Stub output — set ANTHROPIC_API_KEY for real AI-generated WBS.",
        };
      case "whats_next":
        return {
          type: "recommendations",
          items: [
            {
              priority: "high",
              suggestion: "Complete overdue tasks before starting new work",
            },
            {
              priority: "medium",
              suggestion: "Review pending AI proposals in the queue",
            },
            {
              priority: "low",
              suggestion: "Update project status and timeline estimates",
            },
          ],
        };
      case "nl_query":
        return {
          type: "query_result",
          query: input["query"] ?? "No query provided",
          answer:
            "Stub response — set ANTHROPIC_API_KEY to enable natural language queries.",
          sources: [],
        };
      case "summary_writer":
        return {
          type: "summary",
          text: "Stub summary — set ANTHROPIC_API_KEY for real AI-generated summaries.",
        };
      case "risk_predictor":
        return {
          type: "risk_analysis",
          risks: [
            {
              type: "schedule_delay",
              severity: "high",
              title: "Overdue tasks detected",
              description: "3 tasks are past their due date with no recent updates.",
              affectedTasks: ["task-1", "task-2", "task-3"],
              recommendation: "Review and re-prioritize overdue tasks or adjust timelines.",
            },
            {
              type: "dependency_bottleneck",
              severity: "medium",
              title: "Dependency chain bottleneck",
              description: "Task 'API Integration' blocks 5 downstream tasks.",
              affectedTasks: ["task-4"],
              recommendation: "Prioritize the blocking task to unblock dependent work.",
            },
          ],
          overallRiskScore: 0.65,
          note: "Stub output — set ANTHROPIC_API_KEY for real AI-driven risk analysis.",
        };
      case "ai_pm_agent":
        return {
          type: "pm_nudges",
          nudges: [
            {
              taskId: "task-1",
              type: "overdue",
              message: "This task is 3 days past its due date.",
              assigneeId: "user-1",
            },
            {
              taskId: "task-2",
              type: "stalled",
              message: "No updates in the last 72 hours. Is this still in progress?",
              assigneeId: "user-2",
            },
          ],
          summary: "2 tasks need attention: 1 overdue, 1 stalled.",
          note: "Stub output — set ANTHROPIC_API_KEY for real AI PM nudges.",
        };
      case "scope_detector":
        return {
          type: "scope_analysis",
          baselineTaskCount: 24,
          currentTaskCount: 28,
          addedTasks: ["New-task-A", "New-task-B", "New-task-C", "New-task-D"],
          removedTasks: [],
          scopeVariancePercent: 16.7,
          assessment: "Moderate scope creep detected: 4 tasks added beyond baseline WBS.",
          note: "Stub output — set ANTHROPIC_API_KEY for real scope analysis.",
        };
      default:
        return {
          type: capability,
          message: `Stub output for capability '${capability}'. Set ANTHROPIC_API_KEY for real results.`,
        };
    }
  }
}
