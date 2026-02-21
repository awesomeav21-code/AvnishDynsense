# Gap Analysis: v1.1 → v2.0 (Agent SDK-Native Architecture)

**Date:** February 12, 2026
**Scope:** Complete comparison of `requirement_and_design_v2/` (v1.1) vs `requirement_and_design_v3/` (v2.0)
**Theme:** Architectural redesign from custom 7-stage AI pipeline to Claude Agent SDK multi-agent orchestration

---

## Executive Summary

v2.0 is a **fundamental architectural redesign** — not an incremental update. The custom monolithic 7-stage AI pipeline from v1.1 is entirely replaced with the Claude Agent SDK's multi-agent orchestrator pattern. This introduces 10 specialized subagents, 6 MCP tool servers, 8 lifecycle hooks, persistent AI sessions, and a 4-step permission evaluation chain.

**All 103 original features are preserved.** 12 new Agent SDK features are added (FR-3000→FR-3011 / F-104→F-115). No features were removed or deferred.

### Impact at a Glance

| Metric | v1.1 | v2.0 | Delta |
|--------|------|------|-------|
| Total lines (all docs) | 12,411 | 14,026 | +1,615 (+13%) |
| Documents | 7 | 8 | +1 |
| Functional requirements | 103 | 115 | +12 |
| Non-functional requirements | 12 | 14 | +2 |
| Database tables | 30 | 34 | +4 |
| NATS streams | 12 | 14 | +2 |
| NATS consumers | 11 | 13 | +2 |
| API endpoints | ~85 | ~95 | +10 |
| ADRs | 12 | 16 | +4 |
| Application modules | 14 | 15 | +1 |
| UI wireframes | 21 | 25 | +4 |
| Mermaid diagrams (arch) | 18 | 14 | Restructured |
| Custom AI pipeline stages | 7 | 0 | Replaced by SDK |
| AI subagents | 0 | 10 | +10 |
| MCP tool servers | 0 | 6 | +6 |
| AI lifecycle hooks | 0 | 8 | +8 |
| Estimated custom AI LOC | ~2,500 | ~800 | -60% |

---

## 1. Architecture: The Core Transformation

### 1.1 What Was Replaced

**v1.1 — Tier 4: AI Engine (Custom 7-Stage Pipeline)**

```
TRIGGER → AUTONOMY CHECK → CONTEXT ASSEMBLY → ENRICHMENT → LLM CALL → DECISION → EXECUTION
```

- Monolithic orchestrator processing all 10 AI capabilities through one pipeline
- Safety checks embedded inline at Stage 2 (autonomy) and Stage 7 (execution)
- ~2,500 lines of custom orchestration code
- Stateless per-request model (full context reconstruction each time)
- Direct service injection for tool access (no standardized protocol)
- No session persistence (multi-turn queries rebuilt context from scratch)

**v2.0 — Tier 4: AI Engine (Claude Agent SDK Multi-Agent)**

```
TRIGGER → ORCHESTRATOR AGENT → SUBAGENT (with MCP tools + hooks) → RESULT
```

- Orchestrator delegates to specialized subagents with isolated contexts
- Safety via 8 declarative hooks (PreToolUse, PostToolUse, Stop)
- ~800 lines of custom code (SDK handles orchestration loop)
- Persistent sessions with resume/fork (30-day retention)
- MCP tool servers with standardized schemas
- 4-step permission evaluation chain

### 1.2 New ADRs (4)

| ADR | Decision | Over | Rationale | Revisit When |
|-----|----------|------|-----------|--------------|
| **ADR-013** | Claude Agent SDK for orchestration | Custom 7-stage pipeline | Reduces custom code ~60%; adding a capability = new `AgentDefinition` only | SDK breaks backward compat or >50ms overhead |
| **ADR-014** | MCP tool servers for all integrations | Direct service injection | Standardized schemas, tool discovery, permission enforcement at tool boundary | MCP protocol changes or >50ms overhead |
| **ADR-015** | Hook-based safety over inline checks | Inline Stage 2/7 safety | Declarative, composable, deterministic order; auditable via `ai_hook_log` | Hook latency exceeds 20ms aggregate |
| **ADR-016** | Persistent sessions in PostgreSQL | Stateless per-request | ~40% reduction in context assembly on follow-up turns; natural conversations | Session storage >10GB/tenant or replay >2s |

### 1.3 Tier-by-Tier Changes

| Tier | v1.1 | v2.0 | Change Type |
|------|------|------|-------------|
| 1 Client Layer | Views + Slack Bot | + Agent Sessions UI, Agent Config UI | Extended |
| 2 Gateway & Auth | ALB + WAF + JWT + RBAC | Unchanged | Preserved |
| 3 Application Services | 14 modules | 15 modules (+Agent Management) | Extended |
| **4 AI Engine** | **Custom 7-stage pipeline** | **Claude Agent SDK multi-agent** | **Redesigned** |
| 5 Event Bus | 12 streams, 11 consumers | 14 streams, 13 consumers | Extended |
| 6 Database | 30 tables | 34 tables | Extended |
| **7 Integration Gateway** | **Fastify plugins** | **MCP servers** | **Redesigned** |
| 8 Security | 3-layer isolation | 4-layer isolation (+hooks) | Enhanced |
| 9 Deployment | ECS Fargate + CDK | + MCP pool service | Extended |
| 10 Monitoring | CloudWatch + X-Ray + Sentry | + per-subagent metrics, hook dashboard | Extended |

### 1.4 Tenant Isolation Enhancement

| Layer | v1.1 | v2.0 |
|-------|------|------|
| 1. JWT Claims | tenant_id extracted per request | Same |
| 2. Application Middleware | `SET LOCAL app.current_tenant_id` | Same |
| 3. PostgreSQL RLS | All 30 tables | All 34 tables |
| **4. Hook-Based AI Safety** | N/A | **tenant-isolator hook on every MCP tool call** |

---

## 2. Requirements: +12 FRs, +2 NFRs

### 2.1 New Functional Requirements (FR-3000 Series)

| FR | Title | F-xxx | Release | Priority | Description |
|----|-------|-------|---------|----------|-------------|
| FR-3000 | Multi-Agent Orchestrator | F-104 | R0 | Cannot Cut | Single entry point delegates to specialized subagents |
| FR-3001 | Subagent Definitions | F-105 | R0 | Cannot Cut | 10 agents with defined models, tools, permissions |
| FR-3002 | MCP Integration Layer | F-106 | R0 | Cannot Cut | 6 tool servers (3 in-process, 3 external) |
| FR-3003 | AI Session Persistence | F-107 | R0 | Cannot Cut | Resume, fork, expire sessions; 30-day retention |
| FR-3004 | Hooks Safety Layer | F-108 | R0 | Cannot Cut | 8 hooks: PreToolUse/PostToolUse/Stop |
| FR-3005 | Permission Evaluation Chain | F-109 | R0 | Cannot Cut | 4-step: hooks → rules → mode → fallback |
| FR-3006 | Tool Restrictions per Agent | F-110 | R0 | Cannot Cut | Least privilege: read-only agents can't mutate |
| FR-3007 | Custom Tool Extension API | F-111 | R1 | Could Defer | Add MCP tools without core code changes |
| FR-3008 | Agent Session Dashboard | F-112 | R1 | Cannot Cut | UI for session history, costs, tool traces |
| FR-3009 | Subagent Parallelization | F-113 | R1 | Could Defer | Concurrent subagents for single request |
| FR-3010 | Dynamic Agent Configuration | F-114 | R2 | Could Defer | Runtime config per tenant (model, turns, budget) |
| FR-3011 | Conversational NL Query | F-115 | R0 | Cannot Cut | Multi-turn with session context preserved |

### 2.2 New Non-Functional Requirements

| NFR | Title | Key Targets |
|-----|-------|-------------|
| **NFR-013** | Agent Session Performance | < 100ms session resume; < 500ms session create; 30-day retention; < 10GB/tenant |
| **NFR-014** | MCP Tool Discovery | < 500ms for all registered servers; < 10ms per cached tool schema |

### 2.3 Release Distribution Change

| Release | v1.1 FRs | v2.0 FRs | Delta | New in v2.0 |
|---------|----------|----------|-------|-------------|
| R0 | 28 | 36 | +8 | FR-3000→FR-3006, FR-3011 |
| R1 | 36 | 39 | +3 | FR-3007, FR-3008, FR-3009 |
| R2 | 27 | 28 | +1 | FR-3010 |
| R3 | 12 | 12 | 0 | — |
| **Total** | **103** | **115** | **+12** | |

---

## 3. Design: +4 Tables, +2 Streams, +10 Endpoints

### 3.1 New Database Tables (4)

| Table | Columns | Purpose | Indexes |
|-------|---------|---------|---------|
| `ai_sessions` | id, tenant_id, user_id, capability, parent_session_id, status, context_snapshot (JSONB), transcript_path, created_at, updated_at, expires_at | Persistent AI session tracking with fork support | tenant_id+status, user_id, capability, expires_at |
| `ai_agent_configs` | id, tenant_id, capability, model, allowed_tools (JSONB), system_prompt_override, max_turns, permission_mode, hooks_config (JSONB), created_at, updated_at | Per-tenant, per-capability agent configuration | UNIQUE(tenant_id, capability) |
| `ai_hook_log` | id, tenant_id, session_id, hook_event, tool_name, decision, reason, latency_ms, created_at | Hook execution audit trail | tenant_id+session_id, hook_event, created_at |
| `ai_mcp_servers` | id, tenant_id, name, transport, config (JSONB), tools_manifest (JSONB), status, created_at, updated_at | MCP server registry (system-wide or per-tenant) | tenant_id+name, status |

### 3.2 New NATS Streams (2)

| Stream | Subjects | Producers | Consumers | Release |
|--------|----------|-----------|-----------|---------|
| `pm.ai.sessions` | `.created`, `.resumed`, `.paused`, `.completed`, `.expired`, `.forked` | Session Manager Hook, Session Service | Audit Writer, Session Metrics | R0 |
| `pm.ai.hooks` | `.evaluated`, `.denied`, `.error` | All Hooks (via ai_hook_log) | Audit Writer, Hook Metrics | R0 |

### 3.3 New NATS Consumers (2)

| Consumer | Subscribes To | Purpose |
|----------|--------------|---------|
| `agent-session-tracker` | `pm.ai.sessions.*` | Session lifecycle metrics, CloudWatch |
| `hook-metrics` | `pm.ai.hooks.*` | Hook evaluation metrics, denial rates |

### 3.4 New API Endpoints (~10)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/api/v1/agent/sessions` | Start new AI session | JWT |
| `GET` | `/api/v1/agent/sessions` | List sessions (user or all for admin) | JWT |
| `GET` | `/api/v1/agent/sessions/:id` | Session detail + transcript | JWT |
| `POST` | `/api/v1/agent/sessions/:id/message` | Send message to session | JWT |
| `POST` | `/api/v1/agent/sessions/:id/pause` | Pause session | JWT |
| `POST` | `/api/v1/agent/sessions/:id/resume` | Resume paused session | JWT |
| `POST` | `/api/v1/agent/sessions/:id/fork` | Fork session (branch) | JWT |
| `GET` | `/api/v1/agent/configs` | List agent configs for tenant | JWT (admin) |
| `PUT` | `/api/v1/agent/configs/:capability` | Update agent config | JWT (admin) |
| `GET` | `/api/v1/agent/hooks/log` | Query hook audit log | JWT (admin) |

### 3.5 New Application Module

| Module | Location | Endpoints | Purpose |
|--------|----------|-----------|---------|
| **Agent Management** | `apps/api/src/modules/agent/` | 10 | Agent config CRUD, session API, hook log queries |

### 3.6 Monorepo Structure Changes

**New in v2.0:**

```
packages/
  └── agents/              # NEW — Agent SDK types/schemas/hooks
      ├── definitions/     # AgentDefinition type, configs, model routing
      ├── mcp-schemas/     # Zod schemas for MCP tool parameters
      ├── hooks/           # Hook type definitions, registration utility
      └── sessions/        # Session lifecycle types, transcript formats

apps/api/src/
  ├── modules/
  │   └── agent/           # NEW — Agent Management module
  └── ai/                  # RESTRUCTURED
      ├── orchestrator/    # Agent SDK orchestrator (was 7-stage pipeline)
      ├── agents/          # 10 AgentDefinition files (NEW)
      ├── mcp/             # 6 MCP server implementations (NEW)
      ├── hooks/           # 8 hook implementations (NEW)
      ├── sessions/        # Session service (NEW)
      ├── context/         # Context assembly + RAG (preserved)
      └── evaluation/      # Eval harness (preserved)
```

---

## 4. Agent SDK Architecture (Entirely New Document)

`agent-sdk-architecture.md` (2,672 lines) is the centerpiece addition — no equivalent in v1.1.

### 4.1 Ten Subagents

| Agent | Model | MCP Tools | Permission | Max Turns | Release |
|-------|-------|-----------|------------|-----------|---------|
| `wbs-generator` | Opus 4.6 | pm-db:query, pm-db:mutate, pgvector:search | acceptEdits | 15 | R0 |
| `whats-next` | Sonnet 4.5 | pm-db:query, pgvector:search | default (R/O) | 5 | R0 |
| `nl-query` | Sonnet 4.5 | pm-db:query, pgvector:search | default (R/O) | 10 | R0 |
| `summary-writer` | Sonnet 4.5 | pm-db:query | default (R/O) | 5 | R0 |
| `risk-predictor` | Opus 4.6 | pm-db:query, pgvector:search | default (R/O) | 10 | R1 |
| `ai-pm-agent` | Sonnet 4.5 | pm-db:query, pm-db:mutate, pm-nats:publish, slack:send_message | acceptEdits | 25 | R1 |
| `scope-detector` | Sonnet 4.5 | pm-db:query, pgvector:search | default (R/O) | 10 | R1 |
| `writing-assistant` | Sonnet 4.5 | pm-db:query | default (R/O) | 10 | R2 |
| `sow-generator` | Opus 4.6 | pm-db:query, pgvector:search | default (R/O) | 15 | R3 |
| `learning-agent` | Sonnet 4.5 | pm-db:query, pgvector:search | default (R/O) | 15 | R3 |

**v1.1 equivalent:** All 10 capabilities existed conceptually but were processed through a single pipeline. v2.0 gives each its own isolated context, tool set, and permission boundary.

### 4.2 Six MCP Tool Servers

| Server | Transport | Tools | Scope |
|--------|-----------|-------|-------|
| `pm-db` | SDK (in-process) | query (SELECT), mutate (INSERT/UPDATE/DELETE + NATS emit) | System |
| `pm-nats` | SDK (in-process) | publish (to pm.* subjects), query (read recent events) | System |
| `pgvector` | SDK (in-process) | search (cosine similarity, 1536 dims, tenant-filtered) | System |
| `slack` | stdio | send_message, list_channels, get_user | Per-tenant |
| `github` | stdio | list_issues, get_pr, list_commits, search_code | Per-tenant |
| `calendar` | HTTP/SSE | list_events, create_event, update_event | Per-tenant |

**v1.1 equivalent:** Direct service injection — Git, Slack, Calendar were Fastify plugins with custom adapter code. v2.0 standardizes all tool access through MCP protocol.

### 4.3 Eight Lifecycle Hooks

**Evaluation order: sequential PreToolUse → tool executes → parallel PostToolUse → Stop**

| # | Hook | Event | Purpose |
|---|------|-------|---------|
| 1 | `tenant-isolator` | PreToolUse | Inject tenant_id into all DB/vector queries; deny if missing |
| 2 | `autonomy-enforcer` | PreToolUse | Check shadow/propose/execute policy; enforce quiet hours |
| 3 | `rate-limiter` | PreToolUse | Per-tenant rate limit (default: 100 tool calls/hour) |
| 4 | `cost-tracker` | PostToolUse | Log token usage + USD cost; check monthly budget |
| 5 | `audit-writer` | PostToolUse | Write every tool call to ai_hook_log |
| 6 | `traceability` | PostToolUse | Update ai_actions with proposed/executed actions |
| 7 | `notification-hook` | PostToolUse | Emit NATS events for user-facing AI mutations |
| 8 | `session-manager` | Stop | Persist session state and transcript |

**v1.1 equivalent:** Autonomy check (Stage 2) and traceability (Stage 7) were inline pipeline stages. Cost tracking was a NATS consumer. Tenant isolation was middleware + RLS only. v2.0 makes all safety declarative and composable.

### 4.4 Session Management

| Aspect | v1.1 | v2.0 |
|--------|------|------|
| Model | Stateless per-request | Persistent, resumable, forkable |
| Storage | Redis only (ephemeral) | Redis (hot) + PostgreSQL (warm) + S3 (cold transcripts) |
| Multi-turn | Full context rebuilt each time | Session preserves conversation context |
| Forking | Not supported | Create branch for scenario planning |
| Retention | Request-scoped | 30-day TTL, configurable per tenant |
| Resume latency | N/A (no resume) | < 100ms (NFR-013) |

### 4.5 Permission Evaluation Chain

**v1.1:** Binary autonomy policy (propose vs execute) checked once in Stage 2.

**v2.0:** 4-step evaluation on every tool call:

| Step | What | Action |
|------|------|--------|
| 1 | PreToolUse hooks | tenant-isolator → autonomy-enforcer → rate-limiter (any deny = abort) |
| 2 | Agent config rules | Per-tenant per-capability allow/deny/ask rules |
| 3 | Permission mode | default (R/O), acceptEdits (R/W), bypassPermissions (system) |
| 4 | Fallback | Reads = allow, Mutations = deny |

---

## 5. Architecture Document: 12 → 16 ADRs

### 5.1 Preserved ADRs (12)

ADR-001 through ADR-012 are carried forward unchanged:
- ADR-001: Hosted Claude API
- ADR-002: RAG with pgvector
- ADR-003: NATS JetStream
- ADR-004: Shared schema + RLS
- ADR-005: Hybrid pricing
- ADR-006: PostgreSQL 16 + pgvector
- ADR-007: Fastify (Node.js + TypeScript)
- ADR-008: ECS Fargate
- ADR-009: AWS CDK (TypeScript)
- ADR-010: Modular monolith → extract AI worker
- ADR-011: Next.js 15 single app
- ADR-012: CloudWatch + X-Ray + Sentry

### 5.2 New Architecture Principles (3)

v2.0 adds 3 principles to the original 7:

| # | Principle | Description |
|---|-----------|-------------|
| 8 | Multi-agent isolation | Each subagent has isolated context, restricted tools, own permission mode |
| 9 | MCP standardization | All tool access through MCP protocol — uniform schemas, auditable |
| 10 | Hooks-first safety | Safety is declarative hooks, not inline code — composable, deterministic |

---

## 6. UI/UX Design: +4 Wireframes, Agent SDK Components

### 6.1 New Wireframes

| ID | Title | FR Reference | Release |
|----|-------|-------------|---------|
| W-09a | NL Query Panel (Multi-Turn) | FR-3011 / F-115 | R0 |
| W-22 | Agent Session Dashboard | FR-3008 / F-112 | R1 |
| W-23 | Agent Decision Log | FR-3008 / F-112 | R1 |
| W-24 | Agent Config Panel (Admin) | FR-3010 / F-114 | R1 |

### 6.2 New React Components

| Component | Type | Purpose |
|-----------|------|---------|
| `useAISession` | Hook | Create, resume, fork, end AI sessions |
| `AIConversation` | Component | Multi-turn message display with streaming |
| `AgentStatusBadge` | Component | Session status indicator (active/paused/completed/expired) |
| `AgentSessionList` | Component | Session table with filters (capability, status, date) |
| `AgentDecisionLog` | Component | Expandable tool call traces with hook decisions |
| `AgentConfigForm` | Component | Admin capability configuration (model, tools, permissions) |

### 6.3 Updated NL Query Panel (W-09 → W-09a)

| Aspect | v1.1 (W-09) | v2.0 (W-09a) |
|--------|-------------|--------------|
| Interaction | Single question/answer | Multi-turn conversation |
| Session | None | Session indicator, resume/fork buttons |
| Context | Rebuilt per query | Preserved across turns |
| UI | Simple input/output | Conversation thread with streaming |

### 6.4 Design Token Changes

| Aspect | v1.1 | v2.0 |
|--------|------|------|
| Color notation | Hex (`#1a1a2e`) | HSL (`hsl(222 47% 31%)`) |
| Font weights | Implicit | Explicit values (400/500/600/700) |
| Motion tokens | Generic (fast/normal/slow) | Component-specific timings |
| Bundle budget | 200KB initial JS | 180KB initial JS (tightened) |
| Performance KPIs | 4 (FCP, TTI, CLS, FID) | 6 (+ LCP, INP) |
| Dark mode | Not specified | Full section with implementation strategy |

### 6.5 New Accessibility Patterns

| Pattern | Description |
|---------|-------------|
| Agent status badge | `role="status"`, `aria-label="Session {status}"` |
| Decision log row | `role="row"`, `aria-expanded` for expandable traces |
| AI streaming | `aria-live="polite"`, `aria-busy` during generation |

---

## 7. Roadmap: 103 → 115 Features

### 7.1 New Features (F-104 → F-115)

| ID | Feature | Release | Status |
|----|---------|---------|--------|
| F-104 | Multi-Agent Orchestrator | R0 | Cannot Cut |
| F-105 | Subagent Definitions | R0 | Cannot Cut |
| F-106 | MCP Integration Layer | R0 | Cannot Cut |
| F-107 | AI Session Persistence | R0 | Cannot Cut |
| F-108 | Hooks Safety Layer | R0 | Cannot Cut |
| F-109 | Permission Evaluation Chain | R0 | Cannot Cut |
| F-110 | Tool Restrictions per Agent | R0 | Cannot Cut |
| F-111 | Custom Tool Extension API | R1 | Could Defer |
| F-112 | Agent Session Dashboard | R1 | Cannot Cut |
| F-113 | Subagent Parallelization | R1 | Could Defer |
| F-114 | Dynamic Agent Configuration | R2 | Could Defer |
| F-115 | Conversational NL Query | R0 | Cannot Cut |

### 7.2 Post-12-Month Renumbering

v1.1 post-12-month features F-104→F-112 renumbered to F-116→F-124 (to avoid collision with Agent SDK features).

### 7.3 Cut Line Updates

v2.0 promotes F-104 through F-110 and F-115 to "Cannot Cut" in R0 — Agent SDK infrastructure is now on the critical path alongside core PM features.

---

## 8. Implementation Plan: Sprint-by-Sprint Changes

### 8.1 Critical Path Shift

**v1.1:** R0-4 (NL-to-WBS pipeline) was the highest-risk sprint.
**v2.0:** R0-3 (Agent SDK Foundation) is now the highest-risk sprint.

### 8.2 Sprint Comparison (R0-3 through R1-2)

#### Sprint R0-3 (Weeks 5-6) — Most Changed

| Aspect | v1.1 | v2.0 |
|--------|------|------|
| **Title** | "Audit + AI Foundation" | "Agent SDK Foundation — CRITICAL PATH" |
| **Features** | 3 (FR-108, FR-300, FR-400) | 8 (FR-3000→FR-3006, FR-300) |
| **AI approach** | Custom 7-stage pipeline skeleton | Agent SDK orchestrator + 4 subagent skeletons |
| **Tool access** | Direct service injection | 3 MCP servers (pm-db, pgvector, pm-nats) |
| **Safety** | Autonomy policy engine (single check) | 8 hooks (tenant-isolator, autonomy-enforcer, rate-limiter, etc.) |
| **Sessions** | None | Session create/resume/fork/expire |
| **Exit criteria** | Pipeline processes test request | Orchestrator spawns subagent; hooks fire; sessions persist |

#### Sprint R0-4 (Weeks 7-8)

| Aspect | v1.1 | v2.0 |
|--------|------|------|
| **Title** | "NL to WBS + What's Next" | "Core AI Capabilities" |
| **Features** | 3 (FR-200, FR-201, FR-302) | 7 (FR-200, FR-201, FR-202, FR-203, FR-301, FR-303, FR-3011) |
| **WBS** | 5-stage sub-pipeline | wbs-generator subagent (Opus, 15 turns) |
| **NL Query** | Deferred to R0-6 | nl-query subagent (Sonnet, 10 turns) — **moved earlier** |
| **Summary** | Deferred to R0-6 | summary-writer subagent (Sonnet, 5 turns) — **moved earlier** |
| **Sessions** | N/A | Multi-turn NL query with session support |

#### Sprint R0-5 (Weeks 9-10)

| Aspect | v1.1 | v2.0 |
|--------|------|------|
| **Title** | "UI + AI Safety" | "Frontend Foundation" |
| **AI safety work** | AI review UI, confidence thresholds, rollback | None — safety is in Agent SDK hooks (R0-3) |
| **Session UI** | None | NL query multi-turn with session indicator |

#### Sprint R0-6 (Weeks 11-12)

| Aspect | v1.1 | v2.0 |
|--------|------|------|
| **Title** | "NL Query + Summary + Polish" | "Polish + Internal Launch" |
| **NL Query** | Implemented here | Already done in R0-4 |
| **Summary** | Implemented here | Already done in R0-4 |
| **Focus** | 13 tasks across AI + UI + polish | Shadow mode, evaluation harness, traceability, load testing |

#### Sprint R1-1 (Weeks 13-14)

| Aspect | v1.1 | v2.0 |
|--------|------|------|
| **Title** | "Git + Slack Integration" | "Intelligence Layer" |
| **Slack** | Fastify plugin with OAuth adapter | **MCP server** (stdio transport) |
| **Git** | Fastify plugin with webhook adapter | **Deferred to R1-2** as MCP server |
| **AI subagents** | None | **+3 new subagents**: AI PM Agent, Risk Predictor, Scope Detector |
| **Parallelization** | N/A | Subagent parallelization (FR-3009) |

#### Sprint R1-2 (Weeks 15-16)

| Aspect | v1.1 | v2.0 |
|--------|------|------|
| **Title** | "AI PM Agent + Adaptive Engine" | "Intelligence Layer (cont.)" |
| **AI PM Agent** | Implemented here | **Moved to R1-1** as subagent |
| **Git** | Already done in R1-1 | **Implemented here** as MCP server |
| **New work** | — | Cross-project mapping, resource optimization |

### 8.3 Agent SDK Integration Timeline (New in v2.0)

| Sprint | Milestone |
|--------|-----------|
| R0-3 | Orchestrator + 4 subagent skeletons + 3 MCP servers + 8 hooks + sessions |
| R0-4 | 4 subagents fully operational |
| R1-1 | +3 subagents + Slack MCP + parallelization |
| R1-2 | Git MCP server |
| R1-5 | Agent Session Dashboard UI |
| R1-6 | Calendar MCP + Custom Tool Extension API |
| R2-3 | Dynamic agent configuration |
| R2-5 | Writing assistant subagent |
| R3-1 | Learning agent + per-tenant tuning |
| R3-2 | SOW generator subagent |

### 8.4 Risk Register Changes

| Risk | v1.1 | v2.0 |
|------|------|------|
| **Highest risk** | R0-4 (NL-to-WBS pipeline) | **R0-3 (Agent SDK complexity)** |
| **New risk** | — | Agent SDK API breaking changes (High/Medium) |
| **New risk** | — | MCP server performance (Medium/Low) |
| **Updated risk** | AI context isolation (3-layer) | AI context isolation (**4-layer with hooks**) |
| **Mitigation** | Spike PoCs first | **AI/ML lead prototypes in R0-2; pin SDK version** |

---

## 9. What Was NOT Changed

### 9.1 Preserved from v1.1

- All 103 original functional requirements (FR-100 → FR-2014)
- All 12 original NFRs (NFR-001 → NFR-012)
- 5 user personas (Site Admin, Developer, PM, Client, AI PM Agent)
- All 12 original ADRs (ADR-001 → ADR-012)
- All 30 original database tables
- All 12 original NATS streams
- All 11 original NATS consumers
- All ~85 original API endpoints
- Core AI capabilities: WBS, What's Next, NL Query, Summary, Risk, PM Agent, Scope, SOW, Writing, Learning
- Technology stack: Next.js 15, Fastify 5, PostgreSQL 16, pgvector, NATS, Redis, AWS ECS Fargate
- 4-release structure: R0 (foundation) → R1 (intelligence) → R2 (scale) → R3 (enterprise)
- Monorepo structure (Turborepo + pnpm)
- Deployment architecture (ECS Fargate, CDK, GitHub Actions)

### 9.2 No Features Removed or Deferred

Every feature from v1.1 remains in v2.0 at the same release level. The only change is the 9 post-12-month features were renumbered from F-104→F-112 to F-116→F-124 to accommodate the new Agent SDK feature IDs.

---

## 10. Quantitative Summary

### 10.1 Document Line Counts

| Document | v1.1 Lines | v2.0 Lines | Delta |
|----------|-----------|-----------|-------|
| agent-sdk-architecture.md | — | 2,672 | +2,672 (new) |
| architecture (v3.1→v4) | 1,363 | 1,800 | +437 |
| design.md | 3,753 | 4,771 | +1,018 |
| requirements.md | 2,368 | 1,404 | -964 (condensed) |
| ui-ux-design.md | 2,040 | 2,043 | +3 |
| implementation-plan.md | 2,126 | 599 | -1,527 (condensed) |
| roadmap-v2.md | 461 | 492 | +31 |
| GAP_ANALYSIS.md | ~300 | — | Replaced by this doc |
| CHANGELOG.md | — | 245 | +245 (new) |
| **Total** | **12,411** | **14,026** | **+1,615 (+13%)** |

**Note:** requirements.md and implementation-plan.md appear shorter in v2.0 because original FRs (FR-100→FR-2014) are presented in summary table format (not repeated in full detail) while Agent SDK FRs (FR-3000→FR-3011) have full specifications. The actual content coverage is equivalent or greater.

### 10.2 Cross-Reference Completeness

Every new element in v2.0 is fully cross-referenced:

| Element | requirements.md | architecture-v4.md | design.md | agent-sdk-arch.md | ui-ux-design.md | implementation-plan.md | roadmap-v2.md |
|---------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| FR-3000→FR-3011 | Y | Y | Y | Y | Y (W-09a,W-22-24) | Y (sprint mapping) | Y (F-104→F-115) |
| NFR-013, NFR-014 | Y | Y | — | Y | — | — | — |
| ADR-013→ADR-016 | Y | Y | Y | Y | — | Y | — |
| 4 new DDL tables | — | Y | Y | Y | — | Y (R0-3) | — |
| 2 new NATS streams | — | Y | Y | Y | — | Y (R0-3) | — |
| 10 new endpoints | — | Y | Y | Y | Y (W-22-24) | Y (R0-3) | — |
| 4 new wireframes | Y | — | — | — | Y | — | — |

---

## 11. Strategic Implications

### 11.1 Why This Matters

1. **Extensibility:** Adding a new AI capability = creating one `AgentDefinition` file + one MCP server (if new tools needed). No orchestrator changes, no safety code changes, no pipeline modifications.

2. **Safety at Scale:** 8 hooks fire deterministically on every tool call across all 10 subagents. Adding a new safety concern = adding one hook. No existing code changes.

3. **Multi-Tenant Customization:** `ai_agent_configs` table enables per-tenant model selection, tool restrictions, and hook configuration without code deployment.

4. **Natural Conversations:** Persistent sessions enable multi-turn NL queries, writing assistance, and scenario planning — reducing context assembly cost by ~40%.

5. **Reduced Maintenance:** ~60% reduction in custom AI orchestration code (2,500 → 800 LOC) means less surface area for bugs and faster iteration.

### 11.2 Risks to Monitor

| Risk | Impact | Mitigation |
|------|--------|------------|
| Claude Agent SDK breaking changes | High | Pin version; abstract behind interface; quarterly updates |
| R0-3 sprint overruns | High | AI/ML lead prototypes in R0-2; pair programming |
| MCP server performance | Medium | In-process SDK transport for critical servers |
| Session storage growth | Medium | 30-day TTL; S3 cold storage; per-tenant quotas |
| Hook evaluation latency | Low | Target < 20ms aggregate; parallel PostToolUse hooks |

### 11.3 Competitive Advantage

> "Claude Agent SDK multi-agent architecture gives us modular, extensible AI capabilities that can be added, configured, and restricted per-tenant without modifying core orchestration code. Competitors with monolithic AI bolted on cannot match this flexibility at scale."

---

## Appendix A: File Inventory

### v1.1 (`requirement_and_design_v2/`)
| File | Lines |
|------|-------|
| architecture-v3.1.md | 1,363 |
| design.md | 3,753 |
| requirements.md | 2,368 |
| implementation-plan.md | 2,126 |
| ui-ux-design.md | 2,040 |
| roadmap-v2.md | 461 |
| GAP_ANALYSIS.md | ~300 |
| **Total** | **12,411** |

### v2.0 (`requirement_and_design_v3/`)
| File | Lines |
|------|-------|
| agent-sdk-architecture.md | 2,672 |
| architecture-v4.md | 1,800 |
| design.md | 4,771 |
| requirements.md | 1,404 |
| ui-ux-design.md | 2,043 |
| implementation-plan.md | 599 |
| roadmap-v2.md | 492 |
| CHANGELOG.md | 245 |
| **Total** | **14,026** |

---

## Appendix B: Cross-Reference Quick Lookup

| v2.0 Addition | FR | F-xxx | ADR | DDL | NATS | API | Wireframe | Sprint |
|---------------|-----|-------|-----|-----|------|-----|-----------|--------|
| Multi-Agent Orchestrator | FR-3000 | F-104 | ADR-013 | — | — | — | — | R0-3 |
| Subagent Definitions | FR-3001 | F-105 | ADR-013 | ai_agent_configs | — | GET/PUT /agent/configs | W-24 | R0-3 |
| MCP Integration Layer | FR-3002 | F-106 | ADR-014 | ai_mcp_servers | — | GET/POST /ai/mcp-servers | — | R0-3 |
| AI Session Persistence | FR-3003 | F-107 | ADR-016 | ai_sessions | pm.ai.sessions | POST/GET /agent/sessions | W-22 | R0-3 |
| Hooks Safety Layer | FR-3004 | F-108 | ADR-015 | ai_hook_log | pm.ai.hooks | GET /agent/hooks/log | W-23 | R0-3 |
| Permission Chain | FR-3005 | F-109 | ADR-015 | — | — | — | — | R0-3 |
| Tool Restrictions | FR-3006 | F-110 | ADR-013 | — | — | — | — | R0-3 |
| Custom Tool API | FR-3007 | F-111 | ADR-014 | — | — | — | — | R1-6 |
| Session Dashboard | FR-3008 | F-112 | ADR-016 | — | — | — | W-22, W-23 | R1-5 |
| Parallelization | FR-3009 | F-113 | — | — | — | — | — | R1-1 |
| Dynamic Config | FR-3010 | F-114 | ADR-013 | — | — | — | W-24 | R2-3 |
| Conversational NL | FR-3011 | F-115 | ADR-016 | — | — | — | W-09a | R0-4 |
