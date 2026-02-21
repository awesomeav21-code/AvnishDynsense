# AI-Native PM Tool — Software Requirements Specification

> **Version:** 2.0
> **Date:** February 2026
> **Status:** Draft
> **Aligned to:** Architecture v4.0 · Agent SDK Architecture v1.0 · Product Roadmap v2.3 · UI/UX Design v2.0 · Design v2.0

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | February 9, 2026 | Initial SRS — 103 features (FR-100 through FR-2014), 12 NFRs, 5 personas, traceability matrix |
| v1.1 | February 10, 2026 | Architecture alignment with v3.1 (12 streams, 30 tables, 14 modules, ~85 endpoints). Added UI/UX design cross-refs (21 wireframes W-01 through W-21). Enhanced traceability matrix. |
| v2.0 | February 2026 | **Agent SDK-native redesign.** Added 12 new FRs (FR-3000–FR-3011) for multi-agent orchestrator, subagents, MCP tool servers, hooks, sessions, permissions. Added 2 new NFRs (NFR-013, NFR-014). Updated architecture refs to v4.0 (34 tables, 14 NATS streams, ~95 endpoints, 16 ADRs). Added 4 new wireframes (W-09a, W-22–W-24). Total: 115 FRs, 14 NFRs. |

---

## Document Ecosystem

| Document | File | Version | Purpose |
|----------|------|---------|---------|
| **Software Requirements Specification** | `requirements.md` (this document) | v2.0 | 115 functional requirements (FR-100–FR-3011), 14 NFRs, personas, traceability |
| **Agent SDK Architecture** | `agent-sdk-architecture.md` | v1.0 | Multi-agent orchestrator, 10 subagents, 6 MCP servers, 8 hooks, sessions, permissions |
| **System Architecture** | `architecture-v4.md` | v4.0 | 10-tier architecture, 14 Mermaid diagrams, 34 DDL tables, 14 NATS streams, 13 consumers, 15 modules, ~95 endpoints, 16 ADRs |
| **Technical Design** | `design.md` | v2.0 | Implementable specifications for all 10 tiers, 34 database schemas, API contracts, event flows, deployment configs |
| **Product Roadmap** | `roadmap-v2.md` | v2.3 | 115 in-year features (F-001–F-115), post-12-month features, release gates |
| **UI/UX & System Design** | `ui-ux-design.md` | v2.0 | 25 ASCII wireframes (W-01–W-24), design tokens, component architecture, Agent SDK UI |
| **Implementation Plan** | `implementation-plan.md` | v2.0 | 24 sprints across R0–R3, Agent SDK integration in R0-3/R0-4 |
| **Changelog** | `CHANGELOG.md` | — | v1.0 → v1.1 → v2.0 evolution summary |

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) defines the complete functional and non-functional requirements for the AI-Native PM Tool. It translates the 115-feature product roadmap (v2.3) and the system architecture (v4.0) into formal, testable requirements that engineering, QA, and product teams use as the single source of truth for implementation.

### 1.2 Scope

The AI-Native PM Tool is an AI-first project management platform where the AI runs the project and the human supervises. The product targets consultancy firms as the first vertical, delivering AI-generated work breakdown structures, autonomous project monitoring, client-safe reporting, and per-tenant intelligence over a 12-month, four-release roadmap (R0 through R3).

This document covers all 115 in-year features (F-001 through F-115), 14 non-functional requirements, data requirements, integration requirements, and traceability to the roadmap, architecture, and Agent SDK architecture documents.

### 1.3 Glossary of Key Terms

| Term | Definition |
|------|-----------|
| **WBS** | Work Breakdown Structure — hierarchical decomposition of project scope into phases, tasks, and sub-tasks |
| **RLS** | Row-Level Security — PostgreSQL feature enforcing tenant data isolation at the database layer |
| **RAG** | Retrieval-Augmented Generation — enriching LLM prompts with relevant retrieved data |
| **NL** | Natural Language — plain English input from users |
| **RBAC** | Role-Based Access Control — permission system based on user roles |
| **JWT** | JSON Web Token — compact token format carrying authentication claims |
| **NATS** | Messaging system used as the event bus for real-time event streaming |
| **pgvector** | PostgreSQL extension for vector similarity search used in RAG pipelines |
| **Tenant** | An isolated organizational unit (client company) with its own data, users, and AI context |
| **Projection Layer** | Data transformation layer that converts internal project truth into client-safe narratives |
| **Shadow Mode** | AI operating mode where actions are logged but not executed or surfaced to end users |
| **Autonomy Policy** | Configuration defining which AI actions require human approval vs. execute autonomously |
| **Orchestrator Agent** | The main AI agent that receives triggers and delegates to specialized subagents via the Claude Agent SDK |
| **Subagent** | A specialized AI agent with isolated context, restricted tools, and a specific capability (e.g., WBS generation, risk prediction) |
| **MCP** | Model Context Protocol — standardized protocol for connecting AI agents to external tools and data sources |
| **MCP Server** | A service that exposes tools to AI agents via the MCP protocol (stdio, HTTP, or SDK transport) |
| **Hook** | A lifecycle callback (PreToolUse, PostToolUse, Stop) that intercepts agent tool calls for safety, auditing, and tenant isolation |
| **AI Session** | A persistent, resumable, forkable conversation state between a user and an AI subagent |
| **Tool Restriction** | A per-subagent configuration limiting which MCP tools the agent can access (principle of least privilege) |
| **Permission Mode** | A per-agent setting controlling how tool calls are authorized: default, acceptEdits, or bypassPermissions |

### 1.4 Document Conventions

- **FR-xxx**: Functional Requirement (numbered by domain group; FR-3000 series for Agent SDK)
- **NFR-xxx**: Non-Functional Requirement
- **F-xxx**: Roadmap feature identifier (F-001 through F-115)
- **AC-n**: Acceptance Criterion within a requirement
- **Release tags**: R0 (months 1-3), R1 (months 4-6), R2 (months 7-9), R3 (months 10-12)
- **Priority**: Cannot Cut / Could Defer / Optional
- **Design references**: Refer to design.md section numbers and agent-sdk-architecture.md section numbers
- **Wireframe references**: Refer to ui-ux-design.md wireframes (W-xx)
- **Architecture tier**: Refer to the 10-tier architecture (Tier 1–10 from architecture-v4.md)

### 1.5 Cross-Reference Scheme

Every functional requirement maps to exactly one roadmap feature (F-xxx) and references the relevant architecture tier. The enhanced traceability matrix in Section 30 provides the complete mapping.

| Prefix | Source Document | Example |
|--------|----------------|---------|
| **FR-xxx** | requirements.md (this document) | FR-200 (NL to WBS) |
| **NFR-xxx** | requirements.md (this document) | NFR-001 (Performance) |
| **F-xxx** | roadmap-v2.md | F-011 (NL project setup) |
| **ADR-xxx** | architecture-v4.md / design.md | ADR-001 (Hosted Claude API) |
| **W-xxx** | ui-ux-design.md | W-06 (Task Detail wireframe) |
| **Tier N** | architecture-v4.md | Tier 4 (AI Engine) |

---

## 2. Product Vision

### 2.1 Problem Statement

Project managers in consultancy firms spend 60%+ of their time on low-value operational overhead: chasing status updates from team members, manually compiling progress reports for clients, shuffling task priorities when blockers emerge, and reconstructing project context for new team members. This administrative burden means PMs spend more time reporting on work than enabling it.

Existing PM tools (Jira, Asana, Monday.com) digitize the overhead without eliminating it. Their recent AI additions bolt intelligence onto fundamentally manual workflows. The interaction model remains: human operates, tool records.

### 2.2 Vision Statement

**"The AI runs the project. The human supervises."**

The AI-Native PM Tool inverts the traditional PM interaction model. The AI generates project structures from natural language descriptions, tells each developer what to work on and why, autonomously chases stalled work, predicts risks before they materialize, and generates client-ready reports from real delivery data. Humans review, approve, and override — they do not manually operate.

### 2.3 Target Market

**Primary vertical:** Consultancy firms (software delivery, data migration, engineering services).

**Secondary expansion:** Technology companies with PM-heavy workflows, professional services firms, and agencies managing multiple client engagements simultaneously.

### 2.4 Competitive Context

| Competitor | Position | Our Differentiation |
|------------|----------|-------------------|
| **Motion** | $75M raised, $550M valuation, 10K+ B2B customers | We are consultancy-specific: client portals, projection layers, SOW generation, per-tenant learning |
| **Monday.com AI** | AI bolted onto massive existing user base | Fundamentally different interaction model — AI-first, not AI-added |
| **Asana Intelligence** | AI features on enterprise PM platform | Our AI is structural (event-driven, autonomous), not a feature layer |
| **ClickUp Brain** | AI assistant across workspace | Deep vertical intelligence beats broad horizontal features |

### 2.5 Business Objectives

| Objective | Target | Measurement |
|-----------|--------|-------------|
| Internal adoption (R0-R1) | 100% internal team using daily by end of R0 | Daily active usage of NL-to-WBS and "What's Next" |
| Pilot client validation (R1) | 1-2 pilot clients with positive feedback | Client NPS, qualitative feedback |
| Paying tenants (R2) | 3+ paying client tenants | Active subscriptions, revenue |
| Scale (R3) | 10+ paying tenants | Active subscriptions, per-tenant AI improvement |
| AI quality (R1+) | NL-to-WBS acceptance > 60% | Acceptance rate tracking |

---

## 3. User Personas

### 3.1 Site Admin

| Attribute | Description |
|-----------|-------------|
| **Role** | Site Admin |
| **Goals** | Configure tenant settings, manage users/roles, monitor AI behavior, control autonomy policies, manage agent configurations, review AI session logs |
| **Pain Points** | Cannot trust AI without visibility into its decisions; needs to build confidence gradually; must ensure no data leakage across tenants |
| **Key Feature Interactions** | F-010, F-015, F-017, F-020, F-022, F-044, F-046, **F-108 (hooks config)**, **F-112 (agent session dashboard)**, **F-114 (dynamic agent config)** |
| **Release Entry** | R0 |

### 3.2 Developer

| Attribute | Description |
|-----------|-------------|
| **Role** | Developer |
| **Goals** | Know what to work on next; update task status; respond to AI nudges; understand project context quickly; have multi-turn conversations with AI |
| **Pain Points** | Wastes time figuring out priorities; dependency chains are opaque; status meetings interrupt flow |
| **Key Feature Interactions** | F-012, F-014, F-023, F-026, F-028, F-036, **F-107 (AI sessions)**, **F-115 (conversational NL query)** |
| **Release Entry** | R0 |

### 3.3 Project Manager (R3)

| Attribute | Description |
|-----------|-------------|
| **Role** | Project Manager |
| **Goals** | Manage projects, create/assign tasks, review AI suggestions, generate client reports, plan sprints |
| **Pain Points** | Spends 60%+ time on status chasing; client communication requires sanitizing internal details |
| **Key Feature Interactions** | F-011, F-016, F-029, F-030, F-057, F-067, F-081 |
| **Release Entry** | R3 (uses Admin role in R0-R2) |

### 3.4 Client

| Attribute | Description |
|-----------|-------------|
| **Role** | Client (external user) |
| **Goals** | View project progress, ask NL questions about delivery, approve deliverables |
| **Key Feature Interactions** | F-055, F-056, F-057, F-059, F-062 |
| **Release Entry** | R2 |

### 3.5 AI PM Agent (System Actor)

| Attribute | Description |
|-----------|-------------|
| **Role** | AI PM Agent — now implemented as an Agent SDK subagent with the orchestrator |
| **Goals** | Generate WBS, prioritize work, chase stalled tasks, predict risks, generate summaries, maintain project momentum |
| **Key Feature Interactions** | F-011, F-012, F-013, F-028, F-030, F-033, F-034, **F-104 (orchestrator)**, **F-105 (subagents)**, **F-106 (MCP)** |
| **Release Entry** | R0 (rules-based) evolving through R3 (per-tenant learning) |

---

## 4. System Overview

### 4.1 Context Diagram

| External System | Integration Type | Data Flow |
|----------------|-----------------|-----------|
| **Claude AI API (via Agent SDK)** | Agent SDK + REST API | Outbound: agent prompts with context. Inbound: structured AI responses. Orchestrator manages subagent lifecycles. |
| **Git Providers** (GitHub, GitLab) | MCP server (stdio) | Commit activity, PR events linked to tasks |
| **Slack / Microsoft Teams** | MCP server (stdio) | Bidirectional: AI nudges outbound, slash commands inbound |
| **Calendar** (Google, Outlook) | MCP server (HTTP) | Team availability for resource optimization |
| **AWS Services** | Infrastructure | RDS, ElastiCache, S3, ECS Fargate, CloudWatch, Secrets Manager, ALB, WAF, X-Ray |

### 4.2 Core Interaction Loop

```
Describe --> Generate --> Review --> Execute --> Monitor --> Summarize
```

1. **Describe**: User describes project scope in natural language
2. **Generate**: AI orchestrator delegates to WBS Generator subagent which produces WBS via MCP tools
3. **Review**: Human reviews via high-density approval UI; approves, edits, or rejects
4. **Execute**: Approved tasks enter the system; What's Next subagent tells developers what to work on
5. **Monitor**: AI PM Agent subagent autonomously tracks progress, chases updates, predicts risks
6. **Summarize**: Summary Writer subagent generates daily/weekly summaries and client-ready reports

### 4.3 Release Scope Summary

| Release | Timeframe | Features | Key Capability |
|---------|-----------|----------|---------------|
| **R0** | Months 1-3 | 36 features (28 original + 8 Agent SDK) | Foundation + Core AI Loop + Agent SDK |
| **R1** | Months 4-6 | 38 features (36 original + 2 Agent SDK) | Intelligence Layer + SaaS Prep + Views |
| **R2** | Months 7-9 | 28 features (27 original + 1 Agent SDK) | External Launch + Monetization |
| **R3** | Months 10-12 | 13 features | Platform + Per-Tenant Intelligence |

---

## 5. Platform Foundation (FR-100 Series)

### FR-100 — Event-Driven Architecture Spine

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-001 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 5 — Event Bus |
| **Design Ref** | design.md Section 8 |
| **UI/UX Ref** | N/A (infrastructure) |

**Description:** Implement a persistent event bus infrastructure using NATS JetStream that captures all state changes across the system. Every mutation emits an event. All downstream AI capabilities (via Agent SDK hooks), audit logging, embedding pipelines, and notification routing consume from this bus.

**User Story:** As the AI PM Agent, I want to receive real-time events for every state change so that I can react autonomously to project developments.

**Acceptance Criteria:**
- **AC-1:** NATS JetStream cluster (3-node) deployed with persistent storage and 30-day retention.
- **AC-2:** Fourteen streams configured: `pm.tasks`, `pm.projects`, `pm.comments`, `pm.ai`, `pm.integrations`, `pm.system`, `pm.notifications`, `pm.goals`, `pm.automations`, `pm.forms`, `pm.documents`, `pm.reminders`, `pm.ai.sessions`, `pm.ai.hooks`.
- **AC-3:** All consumers are idempotent with DLQ routing after 3 failed retries.
- **AC-4:** Event latency from emission to consumer receipt < 100ms at p95.

**Dependencies:** None (F-001 is the foundation).

---

### FR-101 — Tenant-Aware Data Model

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-002 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 6 — Database |
| **Design Ref** | design.md Section 9 |

**Description:** Implement a multi-tenant data model with `tenant_id` on all tables, Row-Level Security (RLS) policies enforced at the PostgreSQL layer, and per-request tenant context from JWT claims. Application code physically cannot query across tenants. AI agent hooks (tenant-isolator) provide an additional isolation layer.

**Acceptance Criteria:**
- **AC-1:** Every table includes a `tenant_id` UUID column.
- **AC-2:** RLS policies active on all 34 tenant-scoped tables.
- **AC-3:** API middleware sets tenant context from JWT before any query.
- **AC-4:** Agent SDK tenant-isolator hook injects tenant filter into all AI MCP tool calls.
- **AC-5:** Integration tests verify cross-tenant queries return zero rows.

**Dependencies:** None.

---

### FR-102 through FR-109 — Platform Foundation (Summary)

| FR | F-xxx | Title | Release | Priority | Architecture Tier | UI/UX Ref |
|----|-------|-------|---------|----------|------------------|-----------|
| FR-102 | F-003 | Core schema with constraints | R0 | Cannot Cut | Tier 6 — Database | N/A |
| FR-103 | F-004 | Authentication (JWT, bcrypt, sessions) | R0 | Cannot Cut | Tier 2 — Gateway & Auth | W-01 |
| FR-104 | F-005 | RBAC engine (Admin, Developer) | R0 | Cannot Cut | Tier 2 — Gateway & Auth | N/A |
| FR-105 | F-006 | Task data model (full field set) | R0 | Cannot Cut | Tier 3 — App Services | W-05, W-06 |
| FR-106 | F-007 | Task dependencies (DAG, auto-unblock) | R0 | Cannot Cut | Tier 3 — App Services | W-05, W-18 |
| FR-107 | F-008 | Sub-tasks (single-level nesting) | R0 | Cannot Cut | Tier 3 — App Services | W-05 |
| FR-108 | F-009 | Audit trail infrastructure (immutable) | R0 | Cannot Cut | Tier 3 — App Services | W-05 |
| FR-109 | F-010 | Admin-configurable values | R0 | Could Defer | Tier 2 — Config Service | W-10 |

All acceptance criteria unchanged from v1.1. See v1.1 requirements.md for full details.

---

## 6. AI Core Loop (FR-200 Series)

### FR-200 — NL-to-WBS Generator

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-011 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 4 — AI Engine (wbs-generator subagent) |
| **Design Ref** | agent-sdk-architecture.md Section 4.2; design.md Section 7 |
| **UI/UX Ref** | W-06, W-08 |

**Description:** Convert natural language project descriptions into structured WBS. **v2.0 update:** Now implemented as an Agent SDK subagent (`wbs-generator`) using Claude Opus with R/W MCP tools (`mcp__pm-db__query`, `mcp__pm-db__mutate`, `mcp__pgvector__search`). The orchestrator agent delegates WBS generation requests to this subagent, which has an isolated context and max 15 turns. The 5-stage pipeline (domain detection → template selection → RAG enrichment → generation → validation) is preserved within the subagent's system prompt and tool usage pattern.

**User Story:** As a Project Manager, I want to describe a project in plain English and receive a complete WBS so that I review and approve rather than build from scratch.

**Acceptance Criteria:**
- **AC-1:** User submits NL description and receives structured WBS within 30s (p95).
- **AC-2:** WBS includes phases, tasks, sub-tasks, dependencies, and estimates.
- **AC-3:** Generation executed via wbs-generator subagent with tenant-isolator hook enforcing data scope.
- **AC-4:** WBS acceptance rate > 60% after first month.
- **AC-5:** Each generation logged in `ai_actions` with full traceability.
- **AC-6:** Proposals always routed through AI review interface (FR-301); never auto-applied.
- **AC-7:** Domain-specific templates for 3+ project types.

**Dependencies:** FR-100, FR-102, FR-105, FR-106, FR-107, FR-3000 (orchestrator), FR-3001 (subagent).

---

### FR-201 — AI-Curated "What's Next" Per Developer

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-012 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 4 — AI Engine (whats-next subagent) |
| **Design Ref** | agent-sdk-architecture.md Section 4.2; design.md Section 6 |
| **UI/UX Ref** | W-02, W-07 |

**Description:** Surface a prioritized work list per developer. **v2.0 update:** In R0, rules-based (no LLM). In R1, upgraded to `whats-next` Agent SDK subagent (Sonnet, read-only MCP tools, max 5 turns) with NL explanations.

**Acceptance Criteria:**
- **AC-1:** `/users/me/next` returns ordered task list within 500ms (R0 rules-based).
- **AC-2:** R0: unblocked first → due date → priority.
- **AC-3:** Blocked tasks marked with blocking dependency.
- **AC-4:** "What's Next" is default landing for Developer role.
- **AC-5:** R1: whats-next subagent provides NL explanations via read-only MCP tools.

**Dependencies:** FR-105, FR-106, FR-104, FR-3001 (subagent definition).

---

### FR-202 — AI Daily/Weekly Summary

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-013 |
| **Release** | R0 |
| **Priority** | Could Defer |
| **Architecture Tier** | Tier 4 — AI Engine (summary-writer subagent) |

**Description:** Generate concise project summaries from event bus data. **v2.0:** Implemented as `summary-writer` subagent (Sonnet, read-only, max 5 turns).

**Acceptance Criteria:** Unchanged from v1.1.

**Dependencies:** FR-100, FR-108, FR-3001.

---

### FR-203 — AI-Powered NL Querying

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-014 |
| **Release** | R0 |
| **Priority** | Could Defer |
| **Architecture Tier** | Tier 4 — AI Engine (nl-query subagent) |
| **Design Ref** | agent-sdk-architecture.md Section 4.6; design.md Section 7 |
| **UI/UX Ref** | W-09, W-09a |

**Description:** NL questions about project state with direct answers. **v2.0 update:** Now multi-turn via AI sessions (FR-3003). The `nl-query` subagent (Sonnet, read-only, max 10 turns) maintains conversation context across questions within a session. Users can resume or fork sessions.

**Acceptance Criteria:**
- **AC-1:** Users submit NL queries via dedicated panel.
- **AC-2:** Responses within 8s at p95.
- **AC-3:** Responses cite specific tasks, dates, and people.
- **AC-4:** Queries scoped to user's permissions.
- **AC-5:** **NEW:** Multi-turn conversations within an AI session preserve context.
- **AC-6:** **NEW:** Sessions can be resumed (reload prior context) or forked (branch conversation).

**Dependencies:** FR-102, FR-104, FR-3003 (sessions), FR-3011 (conversational NL).

---

## 7. AI Safety and Autonomy (FR-300 Series)

### FR-300 — Autonomy Policy Engine

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-015 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 4 — AI Engine |
| **Design Ref** | agent-sdk-architecture.md Section 4.4 (autonomy-enforcer hook) |
| **UI/UX Ref** | W-10 |

**Description:** Configuration-driven policy engine for AI action modes (shadow/propose/execute). **v2.0 update:** Now enforced via the `autonomy-enforcer` PreToolUse hook in the Agent SDK hooks layer. The hook intercepts every MCP tool call and checks the tenant's autonomy policy before allowing mutations. This replaces the v1.1 7-stage pipeline step 2 with a hooks-based approach.

**Acceptance Criteria:**
- **AC-1:** Three modes per action type: shadow, propose, execute.
- **AC-2:** Default: all actions set to "propose" mode.
- **AC-3:** Quiet hours configurable per tenant.
- **AC-4:** Nudge limits: max 2 per task per day.
- **AC-5:** **NEW:** Autonomy check enforced via PreToolUse hook on every MCP tool call; cannot be bypassed.
- **AC-6:** Policy changes logged in audit trail.

**Dependencies:** FR-100, FR-108, FR-3004 (hooks).

---

### FR-301 through FR-305 — AI Safety (Summary)

| FR | F-xxx | Title | Release | Priority | Architecture Tier |
|----|-------|-------|---------|----------|------------------|
| FR-301 | F-016 | AI review/approve interface | R0 | Cannot Cut | Tier 1 — Client Layer |
| FR-302 | F-017 | AI shadow mode | R0 | Cannot Cut | Tier 4 — AI Engine |
| FR-303 | F-018 | Confidence thresholds | R0 | Cannot Cut | Tier 4 — AI Engine |
| FR-304 | F-019 | Rollback/revert semantics | R0 | Could Defer | Tier 4 — AI Engine |
| FR-305 | F-035 | AI decision log | R1 | Cannot Cut | Tier 4 — AI Engine |

All acceptance criteria unchanged from v1.1.

---

## 8. AI Observability (FR-400 Series) — Summary

| FR | F-xxx | Title | Release | Priority | Architecture Tier |
|----|-------|-------|---------|----------|------------------|
| FR-400 | F-020 | AI traceability pipeline | R0 | Cannot Cut | Tier 4 — AI Engine |
| FR-401 | F-021 | AI evaluation harness | R0 | Could Defer | Tier 4 — AI Engine |
| FR-402 | F-022 | Runtime monitoring dashboard | R0 | Could Defer | Tier 10 — Monitoring |

All acceptance criteria unchanged from v1.1. v2.0 note: Traceability now covers Agent SDK subagent invocations, MCP tool calls, and hook decisions via the `ai_hook_log` table.

---

## 9. Human Surfaces (FR-500 Series) — Summary

| FR | F-xxx | Title | Release | Priority | UI/UX Ref |
|----|-------|-------|---------|----------|-----------|
| FR-500 | F-023 | Task detail view | R0 | Cannot Cut | W-05 |
| FR-501 | F-024 | Project/task list views | R0 | Could Defer | W-03, W-04 |
| FR-502 | F-025 | Role-based sidebar navigation | R0 | Cannot Cut | W-02 |
| FR-503 | F-026 | Comment system | R0 | Could Defer | W-05 |

All acceptance criteria unchanged from v1.1.

---

## 10. R1 AI Intelligence (FR-600 Series) — Summary

| FR | F-xxx | Title | Release | Priority |
|----|-------|-------|---------|----------|
| FR-600 | F-027 | Adaptive task engine | R1 | Cannot Cut |
| FR-601 | F-028 | AI PM Agent (now Agent SDK subagent) | R1 | Cannot Cut |
| FR-602 | F-029 | Auto-generated status reports | R1 | Cannot Cut |
| FR-603 | F-030 | Risk prediction (now risk-predictor subagent) | R1 | Cannot Cut |
| FR-604 | F-031 | Cross-project dependency mapping | R1 | Cannot Cut |
| FR-605 | F-032 | Resource optimization engine | R1 | Cannot Cut |
| FR-606 | F-033 | Auto-escalation workflows | R1 | Cannot Cut |
| FR-607 | F-034 | Scope creep detector (now scope-detector subagent) | R1 | Cannot Cut |

v2.0 note: FR-601 (AI PM Agent), FR-603 (Risk Prediction), and FR-607 (Scope Creep) are now Agent SDK subagents with isolated contexts and restricted MCP tools. All acceptance criteria unchanged otherwise.

---

## 11. R1 Integrations (FR-700 Series) — Summary

| FR | F-xxx | Title | Release | Priority |
|----|-------|-------|---------|----------|
| FR-700 | F-036 | Slack/Teams integration (now MCP server) | R1 | Cannot Cut |
| FR-701 | F-037 | Git integration (now MCP server) | R1 | Cannot Cut |
| FR-702 | F-038 | Calendar integration (now MCP server) | R1 | Could Defer |

v2.0 note: All integrations now implemented as MCP tool servers (stdio or HTTP transport) rather than Fastify plugins. AI subagents access them via MCP tool calls with hook-based tenant isolation.

---

## 12-23. Remaining Original FRs (Summary Tables)

### R1 Security (FR-800 Series)

| FR | F-xxx | Title | Release | Priority |
|----|-------|-------|---------|----------|
| FR-800 | F-039 | SSO integration | R1 | Cannot Cut |
| FR-801 | F-040 | MFA | R1 | Cannot Cut |
| FR-802 | F-041 | Session hardening | R1 | Cannot Cut |

### R1 SaaS Prep (FR-900 Series)

| FR | F-xxx | Title | Release | Priority |
|----|-------|-------|---------|----------|
| FR-900 | F-042 | Client projection data model | R1 | Cannot Cut |
| FR-901 | F-043 | Basic read-only client view | R1 | Cannot Cut |
| FR-902 | F-044 | Tenant plan + feature flags | R1 | Cannot Cut |
| FR-903 | F-045 | SOC 2 prep | R1 | Cannot Cut |
| FR-904 | F-046 | AI cost tracking + rate controls | R1 | Cannot Cut |

### R1 Enhanced Tasks (FR-1000 Series)

| FR | F-xxx | Title | Release | Priority |
|----|-------|-------|---------|----------|
| FR-1000 | F-047 | Default + custom tags | R1 | Could Defer |
| FR-1001 | F-048 | Bulk task import | R2 | Could Defer |
| FR-1002 | F-049 | Full-text search | R1 | Could Defer |
| FR-1003 | F-050 | Advanced filtering + sorting | R1 | Could Defer |

### R1 Visualization (FR-1100 Series)

| FR | F-xxx | Title | Release | Priority |
|----|-------|-------|---------|----------|
| FR-1100 | F-051 | Dependency chain visualization | R1 | Could Defer |
| FR-1101 | F-052 | AI-annotated timeline | R1 | Could Defer |
| FR-1102 | F-053 | Portfolio dashboard | R1 | Could Defer |

### R2 Client Access (FR-1200 Series)

| FR | F-xxx | Title | Release | Priority |
|----|-------|-------|---------|----------|
| FR-1200 | F-054 | Multi-tenancy live | R2 | Cannot Cut |
| FR-1201 | F-055 | Client portal (full) | R2 | Cannot Cut |
| FR-1202 | F-056 | Client role + permissions | R2 | Cannot Cut |
| FR-1203 | F-057 | Automated client reporting | R2 | Cannot Cut |
| FR-1204 | F-058 | Self-service client onboarding | R2 | Cannot Cut |
| FR-1205 | F-059 | Client-facing AI assistant | R2 | Cannot Cut |

### R2 Monetization (FR-1300 Series)

| FR | F-xxx | Title | Release | Priority |
|----|-------|-------|---------|----------|
| FR-1300 | F-060 | Tiered pricing | R2 | Cannot Cut |
| FR-1301 | F-061 | AI cost management (live) | R2 | Cannot Cut |
| FR-1302 | F-062 | Data export | R2 | Could Defer |

### R2 Platform Hardening (FR-1400 Series)

| FR | F-xxx | Title | Release | Priority |
|----|-------|-------|---------|----------|
| FR-1400 | F-063 | API layer | R2 | Could Defer |
| FR-1401 | F-064 | Webhook system | R2 | Could Defer |
| FR-1402 | F-065 | SOC 2 Type I audit | R2 | Cannot Cut |
| FR-1403 | F-066 | AI guardrails multi-tenant | R2 | Cannot Cut |

### R2 Enhanced AI (FR-1500 Series)

| FR | F-xxx | Title | Release | Priority |
|----|-------|-------|---------|----------|
| FR-1500 | F-067 | Predictive delivery dating | R2 | Could Defer |
| FR-1501 | F-068 | AI meeting prep + follow-up | R2 | Could Defer |
| FR-1502 | F-069 | Scenario planning | R2 | Could Defer |
| FR-1503 | F-070 | AI sprint planning | R2 | Could Defer |
| FR-1504 | F-071 | Custom AI rules per project | R2 | Could Defer |
| FR-1505 | F-072 | Smart time tracking | R2 | Optional |
| FR-1506 | F-073 | Additional integrations | R2 | Could Defer |

### R3 Per-Tenant Intelligence (FR-1600 Series)

| FR | F-xxx | Title | Release | Priority |
|----|-------|-------|---------|----------|
| FR-1600 | F-074 | Per-tenant AI learning | R3 | Cannot Cut |
| FR-1601 | F-075 | AI estimation engine | R3 | Cannot Cut |
| FR-1602 | F-076 | Template intelligence | R3 | Could Defer |
| FR-1603 | F-077 | AI coaching layer | R3 | Could Defer |
| FR-1604 | F-078 | AI retrospective facilitator | R3 | Could Defer |

### R3 Productization (FR-1700 Series)

| FR | F-xxx | Title | Release | Priority |
|----|-------|-------|---------|----------|
| FR-1700 | F-079 | Full self-service onboarding | R3 | Cannot Cut |
| FR-1701 | F-080 | Enterprise tier | R3 | Could Defer |
| FR-1702 | F-081 | Project Manager role | R3 | Cannot Cut |
| FR-1703 | F-082 | SOC 2 Type II | R3 | Cannot Cut |

### R3 Consultancy Moat (FR-1800 Series)

| FR | F-xxx | Title | Release | Priority |
|----|-------|-------|---------|----------|
| FR-1800 | F-083 | AI-generated SOWs (now sow-generator subagent) | R3 | Cannot Cut |
| FR-1801 | F-084 | Knowledge capture (now learning-agent subagent) | R3 | Could Defer |
| FR-1802 | F-085 | AI onboarding for new joiners | R3 | Could Defer |
| FR-1803 | F-086 | Embedded analytics + benchmarking | R3 | Optional |

### Promoted Visualization (FR-1900 Series)

| FR | F-xxx | Title | Release | Priority |
|----|-------|-------|---------|----------|
| FR-1900 | F-087 | Read-only Kanban board | R1 | Cannot Cut |
| FR-1901 | F-088 | Gantt chart view | R2 | Could Defer |

### ClickUp Gap Features (FR-2000 Series)

| FR | F-xxx | Title | Release | Priority |
|----|-------|-------|---------|----------|
| FR-2000 | F-089 | Task checklists | R0 | Cannot Cut |
| FR-2001 | F-090 | Recurring tasks | R1 | Could Defer |
| FR-2002 | F-091 | Calendar view | R1 | Cannot Cut |
| FR-2003 | F-092 | Table view | R1 | Cannot Cut |
| FR-2004 | F-093 | @Mentions in comments | R0 | Cannot Cut |
| FR-2005 | F-094 | Custom fields | R1 | Cannot Cut |
| FR-2006 | F-095 | Goals & OKRs | R2 | Could Defer |
| FR-2007 | F-096 | Smart notification system | R1 | Cannot Cut |
| FR-2008 | F-097 | Assigned comments / action items | R1 | Could Defer |
| FR-2009 | F-098 | Custom automations | R2 | Could Defer |
| FR-2010 | F-099 | Form view / task intake | R2 | Could Defer |
| FR-2011 | F-100 | Formula / computed fields | R2 | Could Defer |
| FR-2012 | F-101 | Docs & knowledge base | R2 | Could Defer |
| FR-2013 | F-102 | AI writing assistant (now writing-assistant subagent) | R2 | Could Defer |
| FR-2014 | F-103 | Task reminders | R1 | Could Defer |

All acceptance criteria for sections 12-23 are unchanged from v1.1. See v1.1 requirements.md for full details per FR.

---

## 24. Agent SDK Requirements (FR-3000 Series) — NEW

> These 12 requirements enable the Claude Agent SDK-native architecture that replaces the custom 7-stage AI pipeline from v1.1. They are distributed across R0 (foundation) and R1-R2 (extensions).

### FR-3000 — Multi-Agent Orchestrator

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-104 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 4 — AI Engine (Orchestrator) |
| **Design Ref** | agent-sdk-architecture.md Section 4.1 |
| **UI/UX Ref** | N/A (backend infrastructure) |

**Description:** Implement the main orchestrator agent using the Claude Agent SDK. The orchestrator is the single entry point for all AI operations. It receives triggers (NATS events, API calls, scheduled jobs), loads the tenant's autonomy policy, selects the appropriate AI capability, spawns a specialized subagent, aggregates results, and writes to `ai_actions` and `ai_cost_log`. The orchestrator itself does NOT perform domain-specific work — it delegates to subagents.

**User Story:** As the system, I want a central orchestrator agent so that all AI operations follow a consistent lifecycle (trigger → policy check → delegation → result) with standardized hooks, logging, and tenant isolation.

**Acceptance Criteria:**
- **AC-1:** Orchestrator agent is implemented using `@anthropic-ai/claude-agent-sdk` with a defined system prompt and tool set.
- **AC-2:** Orchestrator receives triggers from 3 sources: NATS events, REST API calls, and cron-scheduled jobs.
- **AC-3:** Orchestrator loads tenant autonomy policy from `tenant_configs` before every AI operation.
- **AC-4:** Orchestrator delegates to the correct subagent based on the requested capability.
- **AC-5:** Every AI operation result is written to `ai_actions` with full traceability chain.
- **AC-6:** Orchestrator respects hook chain: PreToolUse hooks fire before any MCP tool call.

**Dependencies:** FR-100 (event bus), FR-101 (tenant model).

---

### FR-3001 — Subagent Definitions

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-105 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 4 — AI Engine (Subagents) |
| **Design Ref** | agent-sdk-architecture.md Section 4.2 |
| **UI/UX Ref** | N/A (backend) |

**Description:** Define 10 specialized subagents, each with an isolated context, restricted tool set, specific model, and maximum turn count. Each subagent is spawned by the orchestrator for a specific AI capability and cannot access tools or data outside its allowed scope.

| Subagent | Model | Tools | Permission Mode | Max Turns |
|----------|-------|-------|-----------------|-----------|
| wbs-generator | Opus | pm-db (R/W), pgvector | acceptEdits | 15 |
| whats-next | Sonnet | pm-db (R/O), pgvector | default | 5 |
| nl-query | Sonnet | pm-db (R/O), pgvector | default | 10 |
| summary-writer | Sonnet | pm-db (R/O) | default | 5 |
| risk-predictor | Opus | pm-db (R/O), pgvector | default | 10 |
| ai-pm-agent | Sonnet | pm-db (R/W), pm-nats, slack | acceptEdits | 25 |
| scope-detector | Sonnet | pm-db (R/O), pgvector | default | 10 |
| sow-generator | Opus | pm-db (R/O), pgvector | default | 15 |
| writing-assistant | Sonnet | pm-db (R/O) | default | 10 |
| learning-agent | Sonnet | pm-db (R/O), pgvector | default | 15 |

**User Story:** As the orchestrator agent, I want specialized subagents with isolated contexts so that each AI capability has only the tools it needs and cannot interfere with other capabilities.

**Acceptance Criteria:**
- **AC-1:** All 10 subagents are defined with system prompts, model assignments, tool restrictions, and max turns.
- **AC-2:** Each subagent's context is isolated — it cannot see other subagents' conversations or data.
- **AC-3:** Subagent tool access is restricted to only the MCP tools listed in its definition.
- **AC-4:** R0 deploys 4 subagents (wbs-generator, whats-next, nl-query, summary-writer); remaining 6 in R1-R3.
- **AC-5:** Subagent definitions are stored in `ai_agent_configs` table for per-tenant overrides.

**Dependencies:** FR-3000 (orchestrator), FR-3002 (MCP tools).

---

### FR-3002 — MCP Integration Layer

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-106 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 4 — AI Engine (MCP Layer) |
| **Design Ref** | agent-sdk-architecture.md Section 4.3 |
| **UI/UX Ref** | N/A (backend) |

**Description:** Implement 6 MCP tool servers that expose all external integrations to AI subagents via the Model Context Protocol. Internal servers (pm-db, pm-nats, pgvector) use SDK/in-process transport for minimal latency. External servers (slack, github, calendar) use stdio or HTTP transport.

| Server | Transport | Tools | Scope |
|--------|-----------|-------|-------|
| pm-db | SDK (in-process) | query (SELECT), mutate (INSERT/UPDATE + NATS emit) | System |
| pm-nats | SDK (in-process) | publish, query | System |
| pgvector | SDK (in-process) | search (cosine similarity with tenant filter) | System |
| slack | stdio | send_message, list_channels, get_user | Per-tenant |
| github | stdio | list_issues, get_pr, list_commits | Per-tenant |
| calendar | HTTP | list_events, create_event | Per-tenant |

**User Story:** As an AI subagent, I want standardized MCP tools so that I can access databases, event buses, and external services through a consistent protocol without custom integration code.

**Acceptance Criteria:**
- **AC-1:** All 6 MCP servers are registered in the `ai_mcp_servers` table with tool manifests.
- **AC-2:** pm-db MCP server supports both read (SELECT) and write (INSERT/UPDATE) operations with tenant-scoped queries.
- **AC-3:** All MCP tool schemas are defined using Zod (TypeScript) with JSON Schema export.
- **AC-4:** R0 deploys 3 system MCP servers (pm-db, pgvector, pm-nats); R1 adds slack, github; R2 adds calendar.
- **AC-5:** MCP tool discovery completes in < 500ms for all registered servers.

**Dependencies:** FR-100 (NATS), FR-101 (tenant model), FR-102 (schema).

---

### FR-3003 — AI Session Persistence

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-107 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 4 — AI Engine (Session Layer) |
| **Design Ref** | agent-sdk-architecture.md Section 4.6 |
| **UI/UX Ref** | W-09a (NL Query multi-turn) |

**Description:** Implement persistent, resumable, forkable AI sessions stored in the `ai_sessions` PostgreSQL table. Sessions capture the conversation state between a user and an AI subagent, enabling multi-turn interactions. Sessions can be paused, resumed (reloading prior context), or forked (branching for scenario exploration). Sessions expire after 30 days (configurable per tenant).

**User Story:** As a Developer, I want my NL query conversations to persist so that I can resume a previous conversation or branch it to explore a different question without losing context.

**Acceptance Criteria:**
- **AC-1:** AI sessions are stored in the `ai_sessions` table with tenant isolation (RLS).
- **AC-2:** Session resume loads the prior conversation context and continues from where the user left off. Resume latency < 100ms.
- **AC-3:** Session fork creates a new session branched from a specific point in the parent session.
- **AC-4:** Sessions expire after 30 days (configurable per tenant via `tenant_configs`).
- **AC-5:** Session lifecycle events (started, resumed, forked, completed, expired) emit to `pm.ai.sessions` NATS stream.

**Dependencies:** FR-101 (tenant model), FR-100 (event bus).

---

### FR-3004 — Hooks Safety Layer

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-108 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 4 — AI Engine (Hooks Layer) |
| **Design Ref** | agent-sdk-architecture.md Section 4.4 |
| **UI/UX Ref** | N/A (backend) |

**Description:** Implement 8 lifecycle hooks using the Agent SDK's hook system. Hooks intercept every AI tool call for safety, tenant isolation, cost tracking, and audit logging. PreToolUse hooks fire before tool execution; PostToolUse hooks fire after. The hook chain is: `tenant-isolator` → `autonomy-enforcer` → `rate-limiter` → (tool executes) → `cost-tracker` → `audit-writer` → `traceability` → `notification-hook`. A Stop hook (`session-manager`) handles session cleanup.

| Hook | Event | Purpose |
|------|-------|---------|
| tenant-isolator | PreToolUse | Inject `WHERE tenant_id = :id` into all DB queries |
| autonomy-enforcer | PreToolUse | Check autonomy policy before mutations |
| rate-limiter | PreToolUse | Enforce per-tenant, per-capability rate limits (100/hour default) |
| cost-tracker | PostToolUse | Log token usage and cost to ai_cost_log |
| audit-writer | PostToolUse | Write tool call details to ai_hook_log |
| traceability | PostToolUse | Update ai_actions with model output + confidence |
| session-manager | Stop | Persist session state, cleanup |
| notification-hook | PostToolUse | Emit NATS event for user-facing notifications |

**User Story:** As a Site Admin, I want every AI tool call to pass through safety hooks so that tenant isolation, autonomy policies, and rate limits are enforced automatically without relying on application-level trust.

**Acceptance Criteria:**
- **AC-1:** All 8 hooks are implemented and registered in the Agent SDK hook chain.
- **AC-2:** tenant-isolator hook denies any query that doesn't include a tenant_id filter.
- **AC-3:** autonomy-enforcer hook blocks mutations when the capability is in shadow or propose mode.
- **AC-4:** rate-limiter hook enforces sliding-window rate limits per tenant per capability.
- **AC-5:** All hook decisions are logged in the `ai_hook_log` table with latency measurements.
- **AC-6:** Hook events emit to `pm.ai.hooks` NATS stream.

**Dependencies:** FR-100 (event bus), FR-101 (tenant model), FR-108 (audit trail).

---

### FR-3005 — Permission Evaluation Chain

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-109 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 4 — AI Engine (Permission Layer) |
| **Design Ref** | agent-sdk-architecture.md Section 4.7 |
| **UI/UX Ref** | N/A (backend) |

**Description:** Implement a 4-step permission evaluation chain for every AI tool call: (1) Hooks evaluate first (tenant-isolator, autonomy-enforcer, rate-limiter can deny), (2) Permission rules from `ai_agent_configs.hooks_config` are checked, (3) The agent's permission mode (default/acceptEdits/bypassPermissions) is applied, (4) Fallback rule: deny mutations by default, allow reads.

**User Story:** As a Site Admin, I want a layered permission system for AI tool calls so that multiple safety checks must pass before any AI action is executed.

**Acceptance Criteria:**
- **AC-1:** All 4 evaluation steps execute in order for every tool call.
- **AC-2:** Any step can deny the tool call; processing stops at the first denial.
- **AC-3:** Permission mode is configurable per agent per tenant via `ai_agent_configs`.
- **AC-4:** Default fallback: deny mutations, allow reads.
- **AC-5:** Permission evaluation adds < 10ms latency per tool call.

**Dependencies:** FR-3000 (orchestrator), FR-3004 (hooks).

---

### FR-3006 — Tool Restrictions per Agent

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-110 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 4 — AI Engine |
| **Design Ref** | agent-sdk-architecture.md Section 4.2 |
| **UI/UX Ref** | W-24 (Agent Config Panel) |

**Description:** Each subagent has a defined set of allowed MCP tools (principle of least privilege). Read-only subagents (whats-next, nl-query, summary-writer, risk-predictor, scope-detector) cannot access mutation tools. Write-capable subagents (wbs-generator, ai-pm-agent) have mutation tools governed by the autonomy-enforcer hook. Tool restrictions are defined in `ai_agent_configs.allowed_tools` and enforced by the Agent SDK.

**User Story:** As a Site Admin, I want each AI subagent to have only the tools it needs so that a read-only query agent cannot accidentally modify project data.

**Acceptance Criteria:**
- **AC-1:** Each subagent's allowed tools are defined in `ai_agent_configs`.
- **AC-2:** The Agent SDK enforces tool restrictions — subagents cannot invoke tools outside their allowed list.
- **AC-3:** Attempting to call a restricted tool logs a denial in `ai_hook_log`.
- **AC-4:** Tool restrictions are overridable per tenant via the Agent Config Panel (W-24).
- **AC-5:** Default tool restrictions follow the principle of least privilege (read-only unless mutation is required).

**Dependencies:** FR-3001 (subagent definitions), FR-3002 (MCP tools).

---

### FR-3007 — Custom Tool Extension API

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-111 |
| **Release** | R1 |
| **Priority** | Could Defer |
| **Architecture Tier** | Tier 4 — AI Engine (MCP Extension) |
| **Design Ref** | agent-sdk-architecture.md Section 4.3 |
| **UI/UX Ref** | N/A (developer API) |

**Description:** Allow new AI capabilities to be added as MCP tool servers without modifying core application code. A registration API accepts MCP server definitions (name, transport, connection config, tool manifest) and stores them in `ai_mcp_servers`. Registered servers are automatically available to subagents whose allowed_tools list includes them.

**User Story:** As a platform developer, I want to add new AI tools by registering an MCP server so that the AI capabilities can be extended without touching the orchestrator code.

**Acceptance Criteria:**
- **AC-1:** POST `/api/v1/ai/mcp-servers` registers a new MCP server with validation.
- **AC-2:** Registered servers appear in MCP tool discovery within 30 seconds.
- **AC-3:** Subagents can access registered server tools if included in their `allowed_tools`.
- **AC-4:** Registration requires admin role.
- **AC-5:** MCP server health is monitored; unhealthy servers are excluded from tool discovery.

**Dependencies:** FR-3002 (MCP layer), FR-104 (RBAC).

---

### FR-3008 — Agent Session Dashboard

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-112 |
| **Release** | R1 |
| **Priority** | Could Defer |
| **Architecture Tier** | Tier 1 — Client Layer |
| **Design Ref** | ui-ux-design.md W-22 |
| **UI/UX Ref** | W-22 (Agent Session Dashboard) |

**Description:** A UI dashboard showing active and past AI sessions with filtering by capability, status, date range, and user. Displays session ID, capability, status badge, start time, duration, cost, and action count. Click-through to session detail with full tool call trace and conversation transcript.

**User Story:** As a Site Admin, I want a dashboard showing all AI sessions so that I can monitor AI activity, investigate issues, and track costs per capability.

**Acceptance Criteria:**
- **AC-1:** Dashboard displays a paginated, sortable table of AI sessions.
- **AC-2:** Filters: capability (dropdown), status (active/paused/completed/expired), date range, user.
- **AC-3:** Summary cards at top: total sessions, active sessions, total cost, avg duration.
- **AC-4:** Click-through to session detail shows full conversation transcript and tool call trace.
- **AC-5:** Accessible to Admin role only; navigable from sidebar under AI section.

**Dependencies:** FR-3003 (sessions), FR-3004 (hooks for tool call logging).

---

### FR-3009 — Subagent Parallelization

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-113 |
| **Release** | R1 |
| **Priority** | Could Defer |
| **Architecture Tier** | Tier 4 — AI Engine |
| **Design Ref** | agent-sdk-architecture.md Section 4.1 |
| **UI/UX Ref** | N/A (backend optimization) |

**Description:** Enable the orchestrator to run multiple subagents concurrently for a single user request when the capabilities are independent. For example, generating a project summary and checking for risks can run in parallel. The orchestrator aggregates results from parallel subagents before returning to the user.

**User Story:** As a user, I want AI operations to complete faster when multiple independent capabilities are needed so that I don't wait for sequential processing.

**Acceptance Criteria:**
- **AC-1:** Orchestrator can spawn multiple subagents concurrently using Promise.all() or equivalent.
- **AC-2:** Each parallel subagent has its own isolated context and hook chain.
- **AC-3:** Aggregated results are returned only after all parallel subagents complete.
- **AC-4:** If one subagent fails, others continue; partial results are returned with error indication.
- **AC-5:** Concurrent subagent limit configurable per tenant (default: 3).

**Dependencies:** FR-3000 (orchestrator), FR-3001 (subagents).

---

### FR-3010 — Dynamic Agent Configuration

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-114 |
| **Release** | R2 |
| **Priority** | Could Defer |
| **Architecture Tier** | Tier 4 — AI Engine |
| **Design Ref** | agent-sdk-architecture.md Section 4.2; ui-ux-design.md W-24 |
| **UI/UX Ref** | W-24 (Agent Config Panel) |

**Description:** A factory pattern for runtime agent configuration based on tenant, project, or risk level. Admins can override default subagent configurations (model, tools, max turns, hooks, system prompt additions) per tenant or per project. Changes take effect on the next agent invocation without restart.

**User Story:** As a Site Admin, I want to customize AI agent configurations per tenant or project so that high-risk projects use more capable models and stricter hooks.

**Acceptance Criteria:**
- **AC-1:** Agent configurations are stored in `ai_agent_configs` with tenant + capability unique constraint.
- **AC-2:** Admin UI (W-24) allows editing model, tools, max turns, and permission mode per capability.
- **AC-3:** Configuration changes take effect on next agent invocation without service restart.
- **AC-4:** Project-level overrides take precedence over tenant-level defaults.
- **AC-5:** Configuration changes are audit-logged.

**Dependencies:** FR-3001 (subagents), FR-3006 (tool restrictions).

---

### FR-3011 — Conversational NL Query

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-115 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 4 — AI Engine (nl-query subagent + sessions) |
| **Design Ref** | agent-sdk-architecture.md Section 4.6; ui-ux-design.md W-09a |
| **UI/UX Ref** | W-09a (NL Query Panel — multi-turn) |

**Description:** Upgrade NL queries from stateless single-shot interactions to multi-turn conversations with session context preserved. Each NL query interaction creates or continues an AI session. The nl-query subagent receives the full conversation history, enabling follow-up questions ("what about the backend tasks?") without restating context.

**User Story:** As a Developer, I want to have multi-turn conversations with the AI query system so that I can ask follow-up questions without repeating context from previous questions.

**Acceptance Criteria:**
- **AC-1:** NL query panel shows conversation history within the current session.
- **AC-2:** Follow-up questions within a session receive the full conversation context.
- **AC-3:** "New Session" button starts a fresh conversation; "Resume" loads a previous session.
- **AC-4:** Fork button creates a new session branched from the current point.
- **AC-5:** Session indicator shows: session ID, capability, duration, message count.
- **AC-6:** Streaming responses display incrementally as the AI generates output.

**Dependencies:** FR-203 (NL query base), FR-3003 (sessions), FR-3001 (nl-query subagent).

---

## 25. Non-Functional Requirements

### NFR-001 — Performance

**Description:** Responsive performance for standard API operations and AI-powered features. AI operation latency is now measured per-subagent.

**Measurable Targets:**
- Standard API endpoints: p95 < 500ms
- NL Query (AI): p95 < 8 seconds
- NL-to-WBS generation (AI): p95 < 30 seconds (measured from orchestrator trigger to subagent completion)
- "What's Next" endpoint: p95 < 500ms (R0 rules-based), < 3s (R1 AI-ranked)
- AI daily summary: p95 < 15 seconds
- Full-text search: p95 < 500ms
- Web app FCP: < 1.5s; TTI: < 3s
- **NEW:** Agent-to-agent communication latency: < 50ms (orchestrator → subagent spawn)
- **NEW:** Per-subagent latency tracked individually in monitoring dashboards

**Related FRs:** FR-200, FR-201, FR-203, FR-1002, FR-3000, FR-3001.

---

### NFR-002 — Scalability

**Measurable Targets:**
- R0: 1 tenant, 10 users, 1K tasks
- R1: 1 tenant, 20 users, 10K tasks
- R2: 3 tenants, 50 users, 50K tasks
- R3: 10+ tenants, 100+ users, 100K+ tasks
- Event bus: 10K events/day (R0) → 100K events/day (R3)
- AI operations: 500 ops/month per tenant (R2 Starter tier)

---

### NFR-003 — Availability

**Measurable Targets:**
- 99.9% uptime (excludes scheduled maintenance)
- LLM Gateway circuit breaker: 5 consecutive failures → 60s open state
- Database: Multi-AZ with auto-failover

---

### NFR-004 — Security

**Measurable Targets:**
- OWASP Top 10 prevention
- TLS 1.3 on all connections
- AES-256 at rest
- Zero hardcoded secrets
- Penetration testing annually (starting R2)

---

### NFR-005 — Compliance

**Measurable Targets:**
- SOC 2 Type I by R2
- SOC 2 Type II during R3
- GDPR: data subject access within 30 days

---

### NFR-006 — AI Quality

**Measurable Targets:**
- WBS acceptance rate: > 60%
- Hallucination rate: < 5%
- Override rate: < 40%
- Risk prediction accuracy: > 70% (R1+)
- Client portal AI accuracy: > 80%

---

### NFR-007 — Maintainability

**Measurable Targets:**
- Test coverage: 80% minimum
- TypeScript strict mode; zero `any` types
- Modular monolith with clean module boundaries
- Versioned migrations with rollback
- Prompt templates version-controlled

---

### NFR-008 — Usability

**Measurable Targets:**
- New user productive in 15 minutes
- 50 AI proposals reviewable in 30 seconds
- Developer finds next task in 5 seconds
- Client finds status in 10 seconds
- Mobile-responsive: 375px+ viewport

---

### NFR-009 — Data Integrity

**Measurable Targets:**
- FK constraints on all references
- Soft deletes; immutable audit log
- Versioned migrations with rollback
- Circular dependency prevention

---

### NFR-010 — Observability

**Measurable Targets:**
- Structured JSON logging
- Distributed tracing (X-Ray)
- **UPDATED:** Per-subagent dashboards: latency, cost, acceptance rate, confidence distribution, hook decisions
- Alert rules for circuit breaker, AI failure > 10%, budget exceeded, consumer lag
- **NEW:** Agent session monitoring: active sessions, avg duration, resume success rate

---

### NFR-011 — Tenant Isolation

**Measurable Targets:**
- RLS on all 34 tenant-scoped tables
- JWT tenant_id claim with per-request context
- RAG retrieval scoped by tenant_id
- **NEW:** Agent SDK tenant-isolator hook enforces isolation on every AI MCP tool call (4th isolation layer)
- Zero cross-tenant access incidents

---

### NFR-012 — Disaster Recovery

**Measurable Targets:**
- RPO: < 1 hour; RTO: < 4 hours
- Cross-region backups
- Daily automated backups (30-day retention)
- DR plan tested quarterly

---

### NFR-013 — Agent Session Performance (NEW)

| Attribute | Value |
|-----------|-------|
| **Category** | Agent Session Performance |

**Description:** AI sessions must support fast resume and efficient storage for multi-turn conversations. Sessions are the foundation for conversational AI interactions and must not add noticeable latency.

**Measurable Targets:**
- Session resume latency: < 100ms (load prior context from `ai_sessions` table)
- Session creation latency: < 50ms
- Session fork latency: < 200ms (copy parent context + create new session)
- Session storage retention: 30 days (configurable per tenant)
- Maximum conversation depth: 100 turns per session
- Session table supports 100K+ rows per tenant without degradation

**Verification Method:** Load testing with session resume operations; query performance benchmarks on `ai_sessions` table.

**Related FRs:** FR-3003, FR-3011.

---

### NFR-014 — MCP Tool Discovery (NEW)

| Attribute | Value |
|-----------|-------|
| **Category** | MCP Tool Discovery |

**Description:** MCP tool discovery (finding all available tools across registered servers) must be fast enough to not add perceptible latency to AI operations. Tool manifests are cached and refreshed on server registration changes.

**Measurable Targets:**
- Full tool discovery across all registered MCP servers: < 500ms
- Individual tool schema retrieval: < 50ms
- Tool manifest cache TTL: 5 minutes (refreshed on `ai_mcp_servers` changes)
- Support up to 50 registered MCP servers per tenant
- Tool discovery is tenant-scoped (system servers + tenant-specific servers)

**Verification Method:** Benchmark tool discovery with maximum MCP server count; cache hit ratio monitoring.

**Related FRs:** FR-3002, FR-3007.

---

## 26. Data Requirements

### 26.1 Core Entities (34 tables)

All 30 original entities from v1.1 plus 4 new Agent SDK tables:

| Entity | Description | New in v2.0 |
|--------|-------------|-------------|
| **ai_sessions** | Persistent AI conversation state per user per capability | ✓ |
| **ai_agent_configs** | Per-tenant, per-capability agent configuration (model, tools, hooks) | ✓ |
| **ai_hook_log** | Hook execution audit log (event, tool, decision, latency) | ✓ |
| **ai_mcp_servers** | MCP server registry (name, transport, config, tools manifest) | ✓ |

See design.md Section 9 for complete DDL for all 34 tables.

### 26.2 Data Retention Policies

| Data Type | Retention | Strategy |
|-----------|-----------|----------|
| Audit logs | 7 years | Monthly partitioning; S3 Glacier after 90 days |
| Task data | Tenant lifetime | Soft delete |
| AI action logs | 2 years | Archived to S3 after 6 months |
| AI cost logs | 2 years | Aggregated monthly; raw archived |
| **AI sessions** | **30 days (configurable)** | **Expired sessions archived to S3; transcript files retained 90 days** |
| **AI hook logs** | **1 year** | **Archived to S3 after 3 months** |
| Embeddings | Refreshed on source change | Old overwritten on re-embedding |
| Database backups | 30 days | Cross-region replication |

### 26.3 Embedding Requirements

Unchanged from v1.1: text-embedding-3-small, 1536 dimensions, pgvector, IVFFlat (R0-R2), tenant-scoped.

---

## 27. Integration Requirements

### 27.1 Claude AI API (via Agent SDK)

| Attribute | Specification |
|-----------|--------------|
| **Provider** | Anthropic (hosted API) |
| **SDK** | `@anthropic-ai/claude-agent-sdk` (NEW in v2.0) |
| **Models** | Claude Opus 4 (wbs-generator, risk-predictor, sow-generator); Claude Sonnet 4.5 (all other subagents) |
| **Integration** | Agent SDK orchestrator + subagents with MCP tools and hooks |
| **Retry** | Exponential backoff with model fallback (Opus → Sonnet) |
| **Circuit Breaker** | 5 failures → 60s open state |
| **Rate Limiting** | Per-tenant via rate-limiter hook |
| **Cost Control** | Pre-flight budget check via cost-tracker hook |
| **Streaming** | Enabled for NL queries and writing assistant |

### 27.2-27.6

All other integrations (Git, Slack, Calendar, Jira, AWS) unchanged from v1.1 except that Git, Slack, and Calendar are now accessed via MCP tool servers rather than direct API integration.

---

## 28. Constraints and Assumptions

### 28.1 Technical Constraints

All v1.1 constraints preserved, plus:

| Constraint | Detail |
|-----------|--------|
| **Agent SDK** | `@anthropic-ai/claude-agent-sdk` (TypeScript); pin version for stability |
| **MCP Protocol** | Model Context Protocol for all AI-to-tool communication |
| **No custom LLM pipeline** | Agent SDK replaces the custom 7-stage pipeline entirely |

### 28.2 Business Constraints

Unchanged from v1.1.

### 28.3 Assumptions

All v1.1 assumptions preserved, plus:

| Assumption | Impact if Invalid |
|-----------|------------------|
| Agent SDK API remains stable through R3 | Abstract behind interface; evaluate fallback to direct Claude API |
| MCP protocol gains adoption | Evaluate custom tool protocol if MCP is deprecated |

---

## 29. Enhanced Traceability Matrix

### 29.1 Full Matrix (115 FRs)

| FR | F-xxx | Title | Release | Priority | Architecture Tier | UI Wireframe |
|----|-------|-------|---------|----------|------------------|-------------|
| FR-100 | F-001 | Event-driven architecture spine | R0 | Cannot Cut | Tier 5 | N/A |
| FR-101 | F-002 | Tenant-aware data model | R0 | Cannot Cut | Tier 6 | N/A |
| FR-102 | F-003 | Core schema with constraints | R0 | Cannot Cut | Tier 6 | N/A |
| FR-103 | F-004 | Authentication | R0 | Cannot Cut | Tier 2 | W-01 |
| FR-104 | F-005 | RBAC engine | R0 | Cannot Cut | Tier 2 | N/A |
| FR-105 | F-006 | Task data model | R0 | Cannot Cut | Tier 3 | W-05 |
| FR-106 | F-007 | Task dependencies | R0 | Cannot Cut | Tier 3 | W-05, W-18 |
| FR-107 | F-008 | Sub-tasks | R0 | Cannot Cut | Tier 3 | W-05 |
| FR-108 | F-009 | Audit trail infrastructure | R0 | Cannot Cut | Tier 3 | W-05 |
| FR-109 | F-010 | Admin-configurable values | R0 | Could Defer | Tier 2 | W-10 |
| FR-200 | F-011 | NL-to-WBS generator | R0 | Cannot Cut | Tier 4 | W-06, W-08 |
| FR-201 | F-012 | AI-curated "What's Next" | R0 | Cannot Cut | Tier 4 | W-02, W-07 |
| FR-202 | F-013 | AI daily/weekly summary | R0 | Could Defer | Tier 4 | W-02 |
| FR-203 | F-014 | AI-powered NL querying | R0 | Could Defer | Tier 4 | W-09, W-09a |
| FR-300 | F-015 | Autonomy policy engine | R0 | Cannot Cut | Tier 4 | W-10 |
| FR-301 | F-016 | AI review/approve interface | R0 | Cannot Cut | Tier 1 | W-08 |
| FR-302 | F-017 | AI shadow mode | R0 | Cannot Cut | Tier 4 | W-08 |
| FR-303 | F-018 | Confidence thresholds | R0 | Cannot Cut | Tier 4 | W-08 |
| FR-304 | F-019 | Rollback/revert semantics | R0 | Could Defer | Tier 4 | W-08 |
| FR-305 | F-035 | AI decision log | R1 | Cannot Cut | Tier 4 | W-08 |
| FR-400 | F-020 | AI traceability pipeline | R0 | Cannot Cut | Tier 4 | W-08 |
| FR-401 | F-021 | AI evaluation harness | R0 | Could Defer | Tier 4 | N/A |
| FR-402 | F-022 | Runtime monitoring dashboard | R0 | Could Defer | Tier 10 | W-10 |
| FR-500 | F-023 | Task detail view | R0 | Cannot Cut | Tier 1 | W-05 |
| FR-501 | F-024 | Project/task list views | R0 | Could Defer | Tier 1 | W-03, W-04 |
| FR-502 | F-025 | Role-based sidebar navigation | R0 | Cannot Cut | Tier 1 | W-02 |
| FR-503 | F-026 | Comment system | R0 | Could Defer | Tier 3 | W-05 |
| FR-600 | F-027 | Adaptive task engine | R1 | Cannot Cut | Tier 4 | W-02 |
| FR-601 | F-028 | AI PM agent | R1 | Cannot Cut | Tier 4 | N/A |
| FR-602 | F-029 | Auto-generated status reports | R1 | Cannot Cut | Tier 4 | W-04 |
| FR-603 | F-030 | Risk prediction | R1 | Cannot Cut | Tier 4 | W-15, W-16 |
| FR-604 | F-031 | Cross-project dependency mapping | R1 | Cannot Cut | Tier 4 | W-16 |
| FR-605 | F-032 | Resource optimization engine | R1 | Cannot Cut | Tier 4 | W-16 |
| FR-606 | F-033 | Auto-escalation workflows | R1 | Cannot Cut | Tier 4 | W-17 |
| FR-607 | F-034 | Scope creep detector | R1 | Cannot Cut | Tier 4 | W-04 |
| FR-700 | F-036 | Slack/Teams integration | R1 | Cannot Cut | Tier 7 | N/A |
| FR-701 | F-037 | Git integration | R1 | Cannot Cut | Tier 7 | W-05 |
| FR-702 | F-038 | Calendar integration | R1 | Could Defer | Tier 7 | W-13 |
| FR-800 | F-039 | SSO integration | R1 | Cannot Cut | Tier 2 | W-01 |
| FR-801 | F-040 | MFA | R1 | Cannot Cut | Tier 2 | W-01 |
| FR-802 | F-041 | Session hardening | R1 | Cannot Cut | Tier 2 | N/A |
| FR-900 | F-042 | Client projection data model | R1 | Cannot Cut | Tier 3 | N/A |
| FR-901 | F-043 | Basic read-only client view | R1 | Cannot Cut | Tier 1 | W-19 |
| FR-902 | F-044 | Tenant plan + feature flags | R1 | Cannot Cut | Tier 2 | W-10 |
| FR-903 | F-045 | SOC 2 prep | R1 | Cannot Cut | Tier 8 | N/A |
| FR-904 | F-046 | AI cost tracking | R1 | Cannot Cut | Tier 4 | W-10 |
| FR-1000 | F-047 | Default + custom tags | R1 | Could Defer | Tier 3 | W-05 |
| FR-1001 | F-048 | Bulk task import | R2 | Could Defer | Tier 3 | N/A |
| FR-1002 | F-049 | Full-text search | R1 | Could Defer | Tier 6 | W-02 |
| FR-1003 | F-050 | Advanced filtering + sorting | R1 | Could Defer | Tier 1 | W-04 |
| FR-1100 | F-051 | Dependency chain visualization | R1 | Could Defer | Tier 1 | W-18 |
| FR-1101 | F-052 | AI-annotated timeline | R1 | Could Defer | Tier 1 | W-15 |
| FR-1102 | F-053 | Portfolio dashboard | R1 | Could Defer | Tier 1 | W-16 |
| FR-1200 | F-054 | Multi-tenancy live | R2 | Cannot Cut | Tier 6 | N/A |
| FR-1201 | F-055 | Client portal (full) | R2 | Cannot Cut | Tier 1 | W-19 |
| FR-1202 | F-056 | Client role + permissions | R2 | Cannot Cut | Tier 2 | N/A |
| FR-1203 | F-057 | Automated client reporting | R2 | Cannot Cut | Tier 4 | W-19 |
| FR-1204 | F-058 | Self-service client onboarding | R2 | Cannot Cut | Tier 1 | W-19 |
| FR-1205 | F-059 | Client-facing AI assistant | R2 | Cannot Cut | Tier 4 | W-19 |
| FR-1300 | F-060 | Tiered pricing | R2 | Cannot Cut | Tier 2 | W-10 |
| FR-1301 | F-061 | AI cost management | R2 | Cannot Cut | Tier 4 | W-10 |
| FR-1302 | F-062 | Data export | R2 | Could Defer | Tier 1 | N/A |
| FR-1400 | F-063 | API layer | R2 | Could Defer | Tier 1 | N/A |
| FR-1401 | F-064 | Webhook system | R2 | Could Defer | Tier 7 | N/A |
| FR-1402 | F-065 | SOC 2 Type I audit | R2 | Cannot Cut | Tier 8 | N/A |
| FR-1403 | F-066 | AI guardrails multi-tenant | R2 | Cannot Cut | Tier 8 | N/A |
| FR-1500 | F-067 | Predictive delivery dating | R2 | Could Defer | Tier 4 | W-15, W-21 |
| FR-1501 | F-068 | AI meeting prep + follow-up | R2 | Could Defer | Tier 4 | N/A |
| FR-1502 | F-069 | Scenario planning | R2 | Could Defer | Tier 4 | N/A |
| FR-1503 | F-070 | AI sprint planning | R2 | Could Defer | Tier 4 | N/A |
| FR-1504 | F-071 | Custom AI rules per project | R2 | Could Defer | Tier 4 | W-10 |
| FR-1505 | F-072 | Smart time tracking | R2 | Optional | Tier 4 | W-05 |
| FR-1506 | F-073 | Additional integrations | R2 | Could Defer | Tier 7 | N/A |
| FR-1600 | F-074 | Per-tenant AI learning | R3 | Cannot Cut | Tier 4 | N/A |
| FR-1601 | F-075 | AI estimation engine | R3 | Cannot Cut | Tier 4 | W-05 |
| FR-1602 | F-076 | Template intelligence | R3 | Could Defer | Tier 4 | N/A |
| FR-1603 | F-077 | AI coaching layer | R3 | Could Defer | Tier 4 | N/A |
| FR-1604 | F-078 | AI retrospective facilitator | R3 | Could Defer | Tier 4 | N/A |
| FR-1700 | F-079 | Full self-service onboarding | R3 | Cannot Cut | Tier 1 | N/A |
| FR-1701 | F-080 | Enterprise tier | R3 | Could Defer | Tier 6 | N/A |
| FR-1702 | F-081 | Project Manager role | R3 | Cannot Cut | Tier 2 | N/A |
| FR-1703 | F-082 | SOC 2 Type II | R3 | Cannot Cut | Tier 8 | N/A |
| FR-1800 | F-083 | AI-generated SOWs | R3 | Cannot Cut | Tier 4 | N/A |
| FR-1801 | F-084 | Knowledge capture | R3 | Could Defer | Tier 4 | N/A |
| FR-1802 | F-085 | AI onboarding for new joiners | R3 | Could Defer | Tier 4 | N/A |
| FR-1803 | F-086 | Embedded analytics + benchmarking | R3 | Optional | Tier 1 | N/A |
| FR-1900 | F-087 | Read-only Kanban board | R1 | Cannot Cut | Tier 1 | W-12 |
| FR-1901 | F-088 | Gantt chart view | R2 | Could Defer | Tier 1 | W-21 |
| FR-2000 | F-089 | Task checklists | R0 | Cannot Cut | Tier 3 | W-05 |
| FR-2001 | F-090 | Recurring tasks | R1 | Could Defer | Tier 3 | W-05 |
| FR-2002 | F-091 | Calendar view | R1 | Cannot Cut | Tier 1 | W-13 |
| FR-2003 | F-092 | Table view | R1 | Cannot Cut | Tier 1 | W-14 |
| FR-2004 | F-093 | @Mentions in comments | R0 | Cannot Cut | Tier 3 | W-05 |
| FR-2005 | F-094 | Custom fields | R1 | Cannot Cut | Tier 3 | W-05, W-14 |
| FR-2006 | F-095 | Goals & OKRs | R2 | Could Defer | Tier 3 | W-20 |
| FR-2007 | F-096 | Smart notification system | R1 | Cannot Cut | Tier 3 | W-17 |
| FR-2008 | F-097 | Assigned comments / action items | R1 | Could Defer | Tier 3 | W-05 |
| FR-2009 | F-098 | Custom automations | R2 | Could Defer | Tier 3 | W-10 |
| FR-2010 | F-099 | Form view / task intake | R2 | Could Defer | Tier 3 | N/A |
| FR-2011 | F-100 | Formula / computed fields | R2 | Could Defer | Tier 3 | W-14 |
| FR-2012 | F-101 | Docs & knowledge base | R2 | Could Defer | Tier 3 | W-04 |
| FR-2013 | F-102 | AI writing assistant | R2 | Could Defer | Tier 4 | W-05, W-09 |
| FR-2014 | F-103 | Task reminders | R1 | Could Defer | Tier 3 | W-05 |
| **FR-3000** | **F-104** | **Multi-agent orchestrator** | **R0** | **Cannot Cut** | **Tier 4** | **N/A** |
| **FR-3001** | **F-105** | **Subagent definitions** | **R0** | **Cannot Cut** | **Tier 4** | **N/A** |
| **FR-3002** | **F-106** | **MCP integration layer** | **R0** | **Cannot Cut** | **Tier 4** | **N/A** |
| **FR-3003** | **F-107** | **AI session persistence** | **R0** | **Cannot Cut** | **Tier 4** | **W-09a** |
| **FR-3004** | **F-108** | **Hooks safety layer** | **R0** | **Cannot Cut** | **Tier 4** | **N/A** |
| **FR-3005** | **F-109** | **Permission evaluation chain** | **R0** | **Cannot Cut** | **Tier 4** | **N/A** |
| **FR-3006** | **F-110** | **Tool restrictions per agent** | **R0** | **Cannot Cut** | **Tier 4** | **W-24** |
| **FR-3007** | **F-111** | **Custom tool extension API** | **R1** | **Could Defer** | **Tier 4** | **N/A** |
| **FR-3008** | **F-112** | **Agent session dashboard** | **R1** | **Could Defer** | **Tier 1** | **W-22** |
| **FR-3009** | **F-113** | **Subagent parallelization** | **R1** | **Could Defer** | **Tier 4** | **N/A** |
| **FR-3010** | **F-114** | **Dynamic agent configuration** | **R2** | **Could Defer** | **Tier 4** | **W-24** |
| **FR-3011** | **F-115** | **Conversational NL query** | **R0** | **Cannot Cut** | **Tier 4** | **W-09a** |

### 29.2 Release Summary

| Release | FR Count | Cannot Cut | Could Defer | Optional |
|---------|----------|-----------|-------------|----------|
| **R0** | 36 | 25 | 11 | 0 |
| **R1** | 38 | 24 | 14 | 0 |
| **R2** | 28 | 12 | 15 | 1 |
| **R3** | 13 | 7 | 5 | 1 |
| **Total** | **115** | **68** | **45** | **2** |

---

## 30. Appendices

### 30.1 Glossary

See Section 1.3 for complete glossary including Agent SDK terms.

### 30.2 Post-12-Month Backlog

| Feature | Description | Why Deferred |
|---------|-------------|-------------|
| F-116 | White-label option for resellers | Requires different GTM motion |
| F-117 | Marketplace for AI playbooks | Needs thousands of active users |
| F-118 | Open plugin SDK (extends MCP servers) | Ecosystem play; premature before PMF |
| F-119 | Voice interface for AI queries | Validate demand first |
| F-120 | AI-to-AI handoff (CI/CD auto-updates) | Deep integration with client infra |
| F-121 | Vertical-specific editions | Requires market validation |
| F-122 | Sentiment analysis on communications | Requires text corpus + privacy guardrails |
| F-123 | Client satisfaction prediction | Needs many tenants |
| F-124 | Competitive benchmarking | Needs enough tenants for anonymization |

### 30.3 Open Questions

| Question | Recommended Direction | Decision Deadline |
|----------|----------------------|-------------------|
| Pricing model specifics | Hybrid: subscription + AI metering + portal add-on | End of R1 |
| Organizational structure | Spin out as dedicated product team | Before R2 launch |
| First target sub-vertical | High-compliance engineering (fintech, medtech) | R2 planning |
| Legal framework | IP, data isolation, AI liability terms | Before R2 launch |
| Team scaling | 8-10 engineers for R2-R3 | R1 retrospective |
| Agent SDK version pinning | Pin major version; update quarterly | R0-3 sprint planning |

---

*End of Document*
