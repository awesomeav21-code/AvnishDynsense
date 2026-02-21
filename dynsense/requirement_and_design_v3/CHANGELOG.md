# CHANGELOG — AI-Native PM Tool Design Documents

All notable changes to the design document ecosystem are documented in this file.

**Document Ecosystem Location:** `requirement_and_design_v3/`
**Previous Versions:** `requirement_and_design/` (v1.0), `requirement_and_design_v2/` (v1.1)

---

## [v2.0] — 2026-02-10 — Agent SDK-Native Architecture

### Theme
Complete architectural redesign to make the Claude Agent SDK the foundation of the AI engine.
Replaces the monolithic 7-stage AI pipeline with a multi-agent orchestrator pattern using
specialized subagents, MCP tool servers, lifecycle hooks, and persistent AI sessions.

### New Document
- **`agent-sdk-architecture.md`** (~2,600 lines) — Core Agent SDK design document
  - Multi-agent orchestrator architecture
  - 10 subagent definitions (model, tools, permissions, system prompts, TypeScript examples)
  - 6 MCP tool server specifications with Zod schemas
  - 8 lifecycle hooks with evaluation order and TypeScript implementations
  - Session management (create, resume, fork, expire)
  - 4-step permission evaluation chain
  - 7 Mermaid diagrams (orchestrator flow, MCP layer, hooks chain, session FSM, etc.)

### Architecture (`architecture-v4.md`)
#### Added
- **ADR-013:** Claude Agent SDK for AI orchestration (not custom pipeline)
- **ADR-014:** MCP for AI-to-integration communication (not direct API calls)
- **ADR-015:** Multi-agent with subagent isolation (not single pipeline)
- **ADR-016:** Session persistence in PostgreSQL (not Redis-only)
- Tier 4 (AI Engine) redesigned: orchestrator → subagent → MCP tools → hooks
- 4 new Mermaid diagrams (orchestrator sequence, MCP components, hooks flow, session FSM)

#### Changed
- Tier 4 container diagram updated from monolithic pipeline to multi-agent
- ADR count: 12 → 16
- Total Mermaid diagrams: 12 → 14+
- Table count: 30 → 34
- NATS stream count: 12 → 14

### Requirements (`requirements.md`)
#### Added
- **12 new Functional Requirements** (FR-3000 → FR-3011):
  - FR-3000: Multi-Agent Orchestrator
  - FR-3001: Subagent Definitions (10 agents)
  - FR-3002: MCP Integration Layer (6 servers)
  - FR-3003: AI Session Persistence (resume, fork, expire)
  - FR-3004: Hooks Safety Layer (PreToolUse/PostToolUse)
  - FR-3005: Permission Evaluation Chain (4-step)
  - FR-3006: Tool Restrictions per Agent (least privilege)
  - FR-3007: Custom Tool Extension API (MCP-based)
  - FR-3008: Agent Session Dashboard (UI)
  - FR-3009: Subagent Parallelization
  - FR-3010: Dynamic Agent Configuration (factory pattern)
  - FR-3011: Conversational NL Query (multi-turn sessions)
- **2 new Non-Functional Requirements:**
  - NFR-013: Agent Session Performance (< 100ms resume, 30-day retention)
  - NFR-014: MCP Tool Discovery (< 500ms for all registered servers)
- Agent SDK glossary terms (Orchestrator, Subagent, MCP, Hook, Session, Permission Mode)

#### Changed
- Total FRs: 103 → 115
- Total NFRs: 12 → 14
- Traceability matrix updated to 115 rows with Agent SDK cross-references
- Feature IDs F-104 → F-115 mapped to new FRs

### Design (`design.md`)
#### Added
- **4 new database tables:**
  - `ai_sessions` — Agent session tracking (status, context snapshot, transcript path)
  - `ai_agent_configs` — Per-tenant, per-capability agent configuration
  - `ai_hook_log` — Hook execution audit log
  - `ai_mcp_servers` — MCP server registry
- **2 new NATS streams:**
  - `pm.ai.sessions` — Session lifecycle events
  - `pm.ai.hooks` — Hook execution events
- **~10 new API endpoints:**
  - `GET/POST/DELETE /ai/sessions` — Session CRUD
  - `POST /ai/sessions/:id/resume` — Resume paused session
  - `POST /ai/sessions/:id/fork` — Fork session
  - `GET/PUT /ai/agents` — Agent configuration
  - `GET/POST /ai/mcp-servers` — MCP server registry
  - `GET /ai/hooks/log` — Hook audit log

#### Changed
- Total DDL tables: 30 → 34
- Total NATS streams: 12 → 14
- Total API endpoints: ~85 → ~95
- Monorepo structure updated with `packages/agent-sdk/` module
- ADR section expanded to 16 records

### UI/UX Design (`ui-ux-design.md`)
#### Added
- **4 new wireframes:**
  - W-09a: NL Query Panel (multi-turn) — conversation history, session indicator, fork button
  - W-22: Agent Session Dashboard — active/past sessions, capability filter, cost summary
  - W-23: Agent Decision Log — per-session tool call trace, hook decisions, confidence scores
  - W-24: Agent Config Panel — per-capability model/tool/permission config (admin only)
- New components:
  - `useAISession` hook (create, resume, fork)
  - `AIConversation` component (multi-turn with streaming)
  - `AgentStatusBadge` component (active/paused/completed)

#### Changed
- Total wireframes: 21 → 25
- NL Query Panel (W-09) updated to session-aware multi-turn version
- Component architecture section expanded with Agent SDK UI patterns

### Roadmap (`roadmap-v2.md`)
#### Added
- Features F-104 → F-115 for Agent SDK capabilities
- "Agent SDK" column in feature table

#### Changed
- Total features: 103 → 115
- F-011 (WBS), F-014 (NL Query), F-028 (AI PM Agent) descriptions updated for Agent SDK
- Version bumped to v2.3

### Implementation Plan (`implementation-plan.md`)
#### Changed
- **Sprint R0-3 (Weeks 5-6):** Redesigned as "Agent SDK Foundation"
  - Week 5: SDK install, orchestrator agent, 4 subagent skeletons, MCP servers (pm-db, pgvector)
  - Week 6: 8 hooks, 4 new DDL tables, session management, integration tests
- **Sprint R0-4 (Weeks 7-8):** WBS Generator and What's Next as Agent SDK subagents
- **Sprint R0-5 (Weeks 9-10):** Multi-turn NL query panel, agent session indicators
- **Sprint R1-1 (Weeks 13-14):** Slack + Git integrations as MCP servers
- **Sprint R1-2 (Weeks 15-16):** AI PM Agent as full Agent SDK subagent
- Feature-to-sprint mapping expanded to 115 features
- Dependency graph updated with Agent SDK critical path
- Risk register: 8 risks including Agent SDK maturity and MCP performance

---

## [v1.1] — 2026-02-10 — ClickUp Gap Analysis

### Theme
Competitive analysis against ClickUp to identify and fill feature gaps.
Added 15 new features, promoted 3 features to earlier releases, deferred 2 features.

### Added
- **15 new features** (FR-2000 → FR-2014 / F-089 → F-103):
  - Kanban board views (promoted to R1)
  - Gantt chart views (promoted to R2)
  - Task templates (promoted to R1)
  - Custom fields, task relationships, time tracking
  - Recurring tasks, task checklists, favorites
  - Document collaboration, guest access
  - Workspace-level dashboards, goals/OKRs
  - Automation rules engine, form builder
- **14 new DDL tables** for gap features
- **14 new NATS events** across existing + new streams
- **3 new NATS consumers**
- **~50 new API endpoints**
- `GAP_ANALYSIS.md` — Comprehensive analysis document
- `ui-ux-design.md` — 21 wireframes, 6 Mermaid diagrams (entirely new document)

### Changed
- NATS streams: 6 → 12
- NATS consumers: 8 → 11
- Modules: 10 → 14
- Promoted: Kanban (R2→R1), Gantt (R3→R2), Templates basic (R2→R1)
- Deferred: Bulk Import (R1→R2), Calendar Integration (R1→R2)
- Post-12-month features renumbered F-104 → F-112
- Architecture version: v3.0 → v3.1

### Skipped (from ClickUp)
- Mind Maps, Map View, Box View, Whiteboards, Email, Screen Recording, Proofing

### Document Changes
| Document | v1.0 Lines | v1.1 Lines | Delta |
|----------|-----------|-----------|-------|
| architecture (v3→v3.1) | 527 | 1,363 | +836 |
| design.md | ~1,800 | 3,753 | +1,953 |
| requirements.md | ~1,500 | 2,368 | +868 |
| implementation-plan.md | ~1,600 | 2,126 | +526 |
| roadmap-v2.md | ~350 | 461 | +111 |
| ui-ux-design.md | — | 2,040 | +2,040 (new) |
| GAP_ANALYSIS.md | — | ~300 | +300 (new) |
| **Total** | **~5,777** | **12,411** | **+6,634 (+115%)** |

---

## [v1.0] — 2026-02-09 — Initial Design

### Theme
Initial comprehensive design for AI-Native PM Tool targeting consultancy firms.
"AI runs the project, human supervises" — autonomous AI with configurable guardrails.

### Documents Created
| Document | Lines | Content |
|----------|-------|---------|
| `requirements.md` | ~1,500 | 88→103 features (FR-100→FR-1700), 12 NFRs, 5 personas |
| `design.md` | ~1,800 | 10-tier architecture, 12 ADRs, ~16 DDL tables, 6 NATS streams |
| `implementation-plan.md` | ~1,600 | 24 sprints across 4 releases (R0→R3) |
| `roadmap-v2.md` | ~350 | Feature roadmap v2.1 with daily use loop |
| `FINAL_...v3_Definitive.md` | 527 | Architecture overview v3.0 (superseded by v3.1) |

### Key Decisions (ADR-001 → ADR-012)
| ADR | Decision |
|-----|----------|
| ADR-001 | Next.js 15 App Router for frontend |
| ADR-002 | Fastify 5 for backend API |
| ADR-003 | PostgreSQL 16 + pgvector for DB + vector store |
| ADR-004 | NATS JetStream for event bus (not Kafka) |
| ADR-005 | Claude API hosted (not self-hosted LLM) |
| ADR-006 | Shared schema + RLS for multi-tenancy |
| ADR-007 | AWS single-cloud, ECS Fargate (not K8s) |
| ADR-008 | Modular monolith (extract AI worker in R1) |
| ADR-009 | Drizzle ORM for type-safe DB access |
| ADR-010 | Zod for runtime validation |
| ADR-011 | TanStack Query for client-side data fetching |
| ADR-012 | Turborepo + pnpm monorepo |

### Release Structure
| Release | Weeks | Focus |
|---------|-------|-------|
| R0 | 1-12 | Foundation + Core AI (WBS, What's Next, NL Query) |
| R1 | 13-24 | Integrations + Advanced AI (Slack, Git, AI PM Agent) |
| R2 | 25-36 | Scale + Analytics (Gantt, Dashboards, SOW Generator) |
| R3 | 37-48 | Enterprise (SSO, Audit, Learning Engine, White-label) |

---

## Version Summary

| Version | Date | Documents | Total Lines | Features | Tables | Streams | ADRs |
|---------|------|-----------|-------------|----------|--------|---------|------|
| v1.0 | 2026-02-09 | 5 | ~5,777 | 103 | ~16 | 6 | 12 |
| v1.1 | 2026-02-10 | 7 | 12,411 | 103 | 30 | 12 | 12 |
| v2.0 | 2026-02-10 | 8 | ~16,000 | 115 | 34 | 14 | 16 |

---

## Cross-Reference Guide

| ID Pattern | Source | Example |
|------------|--------|---------|
| FR-xxx | requirements.md | FR-3000 (Multi-Agent Orchestrator) |
| NFR-xxx | requirements.md | NFR-013 (Agent Session Performance) |
| F-xxx | roadmap-v2.md | F-104 (Multi-Agent Orchestrator) |
| ADR-xxx | design.md / architecture-v4.md | ADR-013 (Claude Agent SDK) |
| W-xx | ui-ux-design.md | W-22 (Agent Session Dashboard) |
| Sprint Rn-m | implementation-plan.md | R0-3 (Agent SDK Foundation) |
