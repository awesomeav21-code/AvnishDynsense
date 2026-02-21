# Dynsense — Requirements Document

**Version:** 4.0
**Date:** February 18, 2026
**Status:** Draft for Review
**Methodology:** Produced using swarm parallel agent research (3 concurrent agents)
**Aligned to:** Architecture v4.0 · Agent SDK Architecture v1.0 · Product Roadmap v2.3 · UI/UX Design v2.0 · Design v2.0

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | February 9, 2026 | Initial SRS — 103 features (FR-100 through FR-2014), 12 NFRs, 5 personas, traceability matrix |
| v1.1 | February 10, 2026 | Architecture alignment with v3.1 (12 streams, 30 tables, 14 modules, ~85 endpoints). Added UI/UX design cross-refs (21 wireframes W-01 through W-21). Enhanced traceability matrix. |
| v2.0 | February 2026 | Agent SDK-native redesign. Added 12 new FRs (FR-3000–FR-3011) for multi-agent orchestrator, subagents, MCP tool servers, hooks, sessions, permissions. Added 2 new NFRs (NFR-013, NFR-014). Updated architecture refs to v4.0 (34 tables, 14 NATS streams, ~95 endpoints, 16 ADRs). Added 4 new wireframes (W-09a, W-22–W-24). Total: 115 FRs, 14 NFRs. |
| v4.0 | February 18, 2026 | Swarm parallel agent redesign. Restructured all requirements with swarm agent assignments, sync barriers, and parallel execution rules. Added infrastructure, CI/CD, and release gate requirements. Retained all 115 FRs and 14+ NFRs from v2.0. |

---

## Document Ecosystem

| Document | File | Version | Purpose |
|----------|------|---------|---------|
| **Software Requirements Specification** | `requirements.md` (this document) | v4.0 | 115+ functional requirements, 14+ NFRs, personas, traceability — with swarm agent assignments |
| **Agent SDK Architecture** | `agent-sdk-architecture.md` | v1.0 | Multi-agent orchestrator, 10 subagents, 6 MCP servers, 8 hooks, sessions, permissions |
| **System Architecture** | `architecture-v4.md` | v4.0 | 10-tier architecture, 14 Mermaid diagrams, 34 DDL tables, 14 NATS streams, 13 consumers, 15 modules, ~95 endpoints, 16 ADRs |
| **Technical Design** | `design.md` | v2.0 | Implementable specifications for all 10 tiers, 34 database schemas, API contracts, event flows, deployment configs |
| **Product Roadmap** | `roadmap-v2.md` | v2.3 | 115 in-year features (F-001–F-115), post-12-month features, release gates |
| **UI/UX & System Design** | `ui-ux-design.md` | v2.0 | 25 ASCII wireframes (W-01–W-24), design tokens, component architecture, Agent SDK UI |
| **Implementation Plan** | `implementation-plan.md` | v2.0 | 24 sprints across R0–R3, Agent SDK integration in R0-3/R0-4 |
| **QA Plan** | `qa-plan.md` | v1.0 | Test strategy, coverage targets, release gates |

---

## 1. Introduction & Vision

### 1.1 Purpose

This document defines the complete functional and non-functional requirements for Dynsense — an AI-native project management platform for consultancy firms. It translates the 115-feature product roadmap (v2.3) and the system architecture (v4.0) into formal, testable requirements that engineering, QA, and product teams use as the single source of truth for implementation. All requirements are designed for implementation using **swarm parallel agents**, where independent workstreams are executed concurrently by specialized agents to maximize throughput and reduce delivery time.

### 1.2 Scope

Dynsense is an AI-first project management platform where the AI runs the project and the human supervises. The product targets consultancy firms as the first vertical, delivering AI-generated work breakdown structures, autonomous project monitoring, client-safe reporting, and per-tenant intelligence over a 12-month, four-release roadmap (R0 through R3).

This document covers all 115 in-year features (F-001 through F-115), 14+ non-functional requirements, data requirements, integration requirements, and traceability to the roadmap, architecture, and Agent SDK architecture documents.

### 1.3 Core Thesis

> "The AI runs the project. The human supervises."

Dynsense replaces manual PM overhead with autonomous AI subagents that generate work breakdown structures, prioritize tasks, predict risks, nudge teams, and produce reports — all under configurable human oversight with three autonomy modes (shadow, propose, execute).

### 1.4 Glossary of Key Terms

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
| **Swarm** | A group of parallel implementation agents that develop independent modules concurrently with sync barriers |

### 1.5 Document Conventions

- **FR-xxx**: Functional Requirement (numbered by domain group; FR-3000 series for Agent SDK)
- **NFR-xxx**: Non-Functional Requirement
- **F-xxx**: Roadmap feature identifier (F-001 through F-115)
- **AC-n**: Acceptance Criterion within a requirement
- **Release tags**: R0 (months 1-3), R1 (months 4-6), R2 (months 7-9), R3 (months 10-12)
- **Priority**: P0 (Cannot Cut) / P1 (Could Defer) / P2-P3 (Optional)
- **Design references**: Refer to design.md section numbers and agent-sdk-architecture.md section numbers
- **Wireframe references**: Refer to ui-ux-design.md wireframes (W-xx)
- **Architecture tier**: Refer to the 10-tier architecture (Tier 1–10 from architecture-v4.md)
- **Swarm Agent**: Implementation agent responsible for the requirement in the parallel swarm model

### 1.6 Cross-Reference Scheme

| Prefix | Source Document | Example |
|--------|----------------|---------|
| **FR-xxx** | requirements.md (this document) | FR-201 (NL to WBS) |
| **NFR-xxx** | requirements.md (this document) | NFR-001 (Performance) |
| **F-xxx** | roadmap-v2.md | F-011 (NL project setup) |
| **ADR-xxx** | architecture-v4.md / design.md | ADR-001 (Hosted Claude API) |
| **W-xxx** | ui-ux-design.md | W-06 (Task Detail wireframe) |
| **Tier N** | architecture-v4.md | Tier 4 (AI Engine) |

### 1.7 Swarm Parallel Agent Strategy

All implementation follows a swarm pattern where **independent requirement groups are developed in parallel by concurrent agents**:

| Agent Swarm | Concurrent Tracks | Sync Points |
|-------------|-------------------|-------------|
| **Infrastructure Swarm** | DB schema, Docker setup, CI/CD pipeline | Merge after all three pass build |
| **Backend API Swarm** | Auth module, Project module, Task module, AI module | Merge after API contract tests pass |
| **AI Engine Swarm** | Orchestrator, MCP servers, Hook chain, Prompt templates | Merge after integration tests pass |
| **Frontend Swarm** | Auth pages, Dashboard, Task views, AI review panel | Merge after component tests pass |
| **QA Swarm** | Unit tests, Integration tests, E2E tests, Security scans | Continuous — gates each release |

**Rules for parallel execution:**
- Each agent owns a bounded module with explicit interface contracts
- Agents may run concurrently when no data dependency exists between their outputs
- Sync barriers are placed at integration test gates before merging tracks
- Shared types live in `@dynsense/shared` — the single source of truth for cross-agent contracts

---

## 2. Product Vision

### 2.1 Problem Statement

Project managers in consultancy firms spend 60%+ of their time on low-value operational overhead: chasing status updates from team members, manually compiling progress reports for clients, shuffling task priorities when blockers emerge, and reconstructing project context for new team members. This administrative burden means PMs spend more time reporting on work than enabling it.

Existing PM tools (Jira, Asana, Monday.com) digitize the overhead without eliminating it. Their recent AI additions bolt intelligence onto fundamentally manual workflows. The interaction model remains: human operates, tool records.

### 2.2 Vision Statement

**"The AI runs the project. The human supervises."**

Dynsense inverts the traditional PM interaction model. The AI generates project structures from natural language descriptions, tells each developer what to work on and why, autonomously chases stalled work, predicts risks before they materialize, and generates client-ready reports from real delivery data. Humans review, approve, and override — they do not manually operate.

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
| **Key Feature Interactions** | Auth config, autonomy policies, hooks config (FR-340s), agent session dashboard (FR-3008), dynamic agent config (FR-3010) |
| **Release Entry** | R0 |
| **Swarm Agent** | auth-agent, policy-agent |

### 3.2 Developer

| Attribute | Description |
|-----------|-------------|
| **Role** | Developer |
| **Goals** | Know what to work on next; update task status; respond to AI nudges; understand project context quickly; have multi-turn conversations with AI |
| **Pain Points** | Wastes time figuring out priorities; dependency chains are opaque; status meetings interrupt flow |
| **Key Feature Interactions** | What's Next (FR-202), task detail (FR-152), comments (FR-128), AI sessions (FR-3003), conversational NL query (FR-3011) |
| **Release Entry** | R0 |
| **Swarm Agent** | task-agent, frontend-agent |

### 3.3 Project Manager (R3)

| Attribute | Description |
|-----------|-------------|
| **Role** | Project Manager |
| **Goals** | Manage projects, create/assign tasks, review AI suggestions, generate client reports, plan sprints |
| **Pain Points** | Spends 60%+ time on status chasing; client communication requires sanitizing internal details |
| **Key Feature Interactions** | NL-to-WBS (FR-201), risk prediction (FR-205), status reports (FR-204), client portal (FR-700s) |
| **Release Entry** | R3 (uses Admin role in R0-R2) |
| **Swarm Agent** | orchestrator-agent, portal-agent |

### 3.4 Client

| Attribute | Description |
|-----------|-------------|
| **Role** | Client (external user) |
| **Goals** | View project progress, ask NL questions about delivery, approve deliverables |
| **Key Feature Interactions** | Client portal (FR-700s), client NL query (FR-703), client feedback (FR-705) |
| **Release Entry** | R2 |
| **Swarm Agent** | portal-agent |

### 3.5 AI PM Agent (System Actor)

| Attribute | Description |
|-----------|-------------|
| **Role** | AI PM Agent — implemented as Agent SDK subagents with the orchestrator |
| **Goals** | Generate WBS, prioritize work, chase stalled tasks, predict risks, generate summaries, maintain project momentum |
| **Key Feature Interactions** | Orchestrator (FR-3000), subagents (FR-3001), MCP (FR-3002), all AI capabilities (FR-200s) |
| **Release Entry** | R0 (rules-based) evolving through R3 (per-tenant learning) |
| **Swarm Agent** | orchestrator-agent, sdk-agent |

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

---

## 5. Project Scope

### 5.1 Target Users

| Persona | Role | Primary Needs |
|---------|------|---------------|
| **Consultancy PM** | pm | AI-generated WBS, risk prediction, daily summaries, SOW generation |
| **Developer** | developer | What's Next prioritization, task detail, dependency tracking, status updates |
| **Firm Admin** | site_admin | Tenant config, AI autonomy policies, cost monitoring, user management |
| **Client Stakeholder** | client | Read-only milestone view, AI-answered questions, scoped portal (R2) |

### 5.2 Release Scope

| Release | Duration | Feature Count | Theme |
|---------|----------|---------------|-------|
| **R0** | Sprints 1-6 (12 weeks) | 35 | Foundation — Auth, Core PM, Agent SDK, WBS, Dashboard |
| **R1** | Sprints 7-12 (12 weeks) | 39 | Intelligence — Risk, AI PM agent, integrations, SaaS prep |
| **R2** | Sprints 13-18 (12 weeks) | 28 | Growth — Multi-tenancy, client portal, monetization, SOC 2 Type I |
| **R3** | Sprints 19-24 (12 weeks) | 13 | Platform — Per-tenant AI learning, SOW generation, enterprise tier |

**Total:** 115 features (103 core + 12 Agent SDK) across 24 sprints (12 months)

### 5.3 Out of Scope

- Native mobile applications (web-responsive only)
- On-premise deployment (cloud-only SaaS)
- Non-English language support (English-only for R0-R3)
- Custom LLM fine-tuning (prompt engineering + RAG only)
- Real-time collaborative editing (single-user edit model)

---

## 6. Functional Requirements — Core PM

> **Swarm assignment:** Backend API Swarm (4 parallel agents — one per module group)

### 6.1 Authentication & Authorization (FR-100 series)

| ID | Requirement | Priority | Release | Swarm Agent |
|----|-------------|----------|---------|-------------|
| FR-100 | Users register with email + password (bcrypt cost 12+) | P0 | R0 | auth-agent |
| FR-101 | Login issues JWT RS256 access token (1h) + refresh token (30d) | P0 | R0 | auth-agent |
| FR-102 | Refresh token rotation — old token invalidated on use | P0 | R0 | auth-agent |
| FR-103 | Logout invalidates all active sessions for the user | P0 | R0 | auth-agent |
| FR-104 | RBAC with 4 roles: site_admin, pm, developer, client | P0 | R0 | auth-agent |
| FR-105 | Role-based endpoint protection via middleware | P0 | R0 | auth-agent |
| FR-106 | SSO integration (SAML 2.0 / OIDC) | P1 | R1 | auth-agent |
| FR-107 | Multi-factor authentication (TOTP) | P1 | R1 | auth-agent |
| FR-108 | Session hardening (device fingerprint, IP pinning) | P2 | R1 | auth-agent |

### 6.2 Project Management (FR-110 series)

| ID | Requirement | Priority | Release | Swarm Agent |
|----|-------------|----------|---------|-------------|
| FR-110 | CRUD projects with name, description, status, dates | P0 | R0 | project-agent |
| FR-111 | Project phases (e.g., Discovery, Build, Deliver) with ordering | P0 | R0 | project-agent |
| FR-112 | WBS baseline storage — snapshot of generated structure | P0 | R0 | project-agent |
| FR-113 | Soft delete with recovery window | P0 | R0 | project-agent |
| FR-114 | Project templates (clone from existing) | P1 | R1 | project-agent |
| FR-115 | Goals & OKRs linked to projects | P2 | R2 | project-agent |

### 6.3 Task Management (FR-120 series)

| ID | Requirement | Priority | Release | Swarm Agent |
|----|-------------|----------|---------|-------------|
| FR-120 | CRUD tasks with title, description, status, priority, dates, effort | P0 | R0 | task-agent |
| FR-121 | Status transitions: created → ready → in_progress → review → completed/blocked/cancelled | P0 | R0 | task-agent |
| FR-122 | Task assignment to one or more users | P0 | R0 | task-agent |
| FR-123 | Sub-tasks (single-level nesting) with promote/demote | P0 | R0 | task-agent |
| FR-124 | Task dependencies (DAG model) with circular detection via BFS | P0 | R0 | task-agent |
| FR-125 | Auto-unblock dependents when blocking task completes | P0 | R0 | task-agent |
| FR-126 | Filtering by project, phase, status, priority, assignee | P0 | R0 | task-agent |
| FR-127 | Task checklists with groups, items, completion percentage | P0 | R0 | task-agent |
| FR-128 | Comments with @mention parsing (UUID extraction) | P0 | R0 | task-agent |
| FR-129 | Client-visible comment filtering | P1 | R2 | task-agent |
| FR-130 | Custom fields (text, number, date, select) per project | P1 | R1 | task-agent |
| FR-131 | Tags and labels with color coding | P1 | R1 | task-agent |
| FR-132 | Recurring tasks (daily, weekly, sprint-aligned) | P2 | R1 | task-agent |
| FR-133 | Bulk import from CSV/JSON | P2 | R2 | task-agent |
| FR-134 | Full-text search across tasks, projects, and comments | P1 | R1 | task-agent |
| FR-135 | Advanced filtering + sorting with saved filter presets | P1 | R1 | task-agent |
| FR-136 | Assigned comments / action items — comments assignable as work items | P2 | R1 | task-agent |
| FR-137 | Task reminders — configurable per-task reminder notifications | P2 | R1 | task-agent |
| FR-138 | Formula / computed fields — derived field values from expressions | P2 | R2 | task-agent |

### 6.4 Audit & Traceability (FR-140 series)

| ID | Requirement | Priority | Release | Swarm Agent |
|----|-------------|----------|---------|-------------|
| FR-140 | Field-level audit trail on all mutations | P0 | R0 | audit-agent |
| FR-141 | Actor type tracking (human vs AI) | P0 | R0 | audit-agent |
| FR-142 | Immutable audit_log (UPDATE/DELETE blocked at DB level) | P0 | R0 | audit-agent |
| FR-143 | AI action traceability — link every AI mutation to ai_action record | P0 | R0 | audit-agent |
| FR-144 | Audit log export for compliance review | P2 | R2 | audit-agent |

### 6.5 Views & Navigation (FR-150 series)

| ID | Requirement | Priority | Release | Swarm Agent |
|----|-------------|----------|---------|-------------|
| FR-150 | Dashboard with What's Next list, AI summary card, project overview | P0 | R0 | frontend-agent |
| FR-151 | Task list view with sorting and filtering | P0 | R0 | frontend-agent |
| FR-152 | Task detail view — three-column layout (details, sidebar, activity) | P0 | R0 | frontend-agent |
| FR-153 | Kanban board view | P1 | R1 | frontend-agent |
| FR-154 | Calendar view | P1 | R1 | frontend-agent |
| FR-155 | Table view (spreadsheet-style) | P1 | R1 | frontend-agent |
| FR-156 | Gantt chart view | P2 | R2 | frontend-agent |
| FR-157 | Sidebar navigation (role-based, collapsible, responsive) | P0 | R0 | frontend-agent |
| FR-158 | Smart notification system — in-app + push, configurable per event type per user | P1 | R1 | frontend-agent |
| FR-159 | Dependency chain visualization — interactive DAG view of task dependencies | P2 | R1 | frontend-agent |
| FR-160 | AI-annotated timeline — timeline view with AI-predicted milestones and risk markers | P2 | R1 | frontend-agent |
| FR-161 | Portfolio dashboard — cross-project health, resource utilization, risk summary | P2 | R1 | frontend-agent |

---

## 7. Functional Requirements — AI Engine

> **Swarm assignment:** AI Engine Swarm (4 parallel agents — orchestrator, MCP, hooks, prompts)

### 7.1 AI Orchestration Pipeline (FR-200 series)

| ID | Requirement | Priority | Release | Swarm Agent |
|----|-------------|----------|---------|-------------|
| FR-200 | 7-stage orchestration pipeline: Trigger → Autonomy → Context → Confidence → LLM → PostProcess → Disposition | P0 | R0 | orchestrator-agent |
| FR-201 | NL-to-WBS generator — convert natural language project descriptions into structured work breakdown | P0 | R0 | orchestrator-agent |
| FR-202 | What's Next engine — rank tasks by dependency resolution, due date, priority | P0 | R0 | orchestrator-agent |
| FR-203 | NL Query engine — answer natural language questions about project state | P0 | R0 | orchestrator-agent |
| FR-204 | Summary Writer — auto-generate daily/weekly status reports | P0 | R0 | orchestrator-agent |
| FR-205 | Risk Predictor — flag delays, scope creep, resource issues proactively | P1 | R1 | orchestrator-agent |
| FR-206 | AI PM Agent — 15-minute autonomous loops for nudges, status checks, escalations | P1 | R1 | orchestrator-agent |
| FR-207 | Scope Creep Detector — monitor task additions vs. baseline WBS | P1 | R1 | orchestrator-agent |
| FR-208 | AI Writing Assistant — help draft task descriptions, comments, reports | P2 | R2 | orchestrator-agent |
| FR-209 | SOW Generator — produce statements of work from project/delivery history | P2 | R3 | orchestrator-agent |
| FR-210 | Per-Tenant Learning — RAG-based accuracy improvement from tenant history | P2 | R3 | orchestrator-agent |
| FR-211 | AI Evaluation Harness — automated test suite for AI output quality (golden tests, acceptance rate tracking) | P1 | R0 | orchestrator-agent |
| FR-212 | Runtime Monitoring Dashboard — AI operations dashboard showing latency, cost, error rates, confidence distributions | P1 | R0 | orchestrator-agent |
| FR-213 | AI Estimation Engine — predict task effort from historical actual-vs-estimated data | P1 | R3 | orchestrator-agent |
| FR-214 | Template Intelligence — AI-improved project templates from cross-tenant patterns | P2 | R3 | orchestrator-agent |
| FR-215 | AI Coaching Layer — proactive suggestions to PMs on process improvements | P2 | R3 | orchestrator-agent |
| FR-216 | AI Retrospective Facilitator — auto-generate sprint retrospective insights from delivery data | P2 | R3 | orchestrator-agent |
| FR-217 | AI Onboarding for New Joiners — auto-generate project context briefings for new team members | P2 | R3 | orchestrator-agent |

### 7.2 Autonomy & Safety (FR-300 series)

| ID | Requirement | Priority | Release | Swarm Agent |
|----|-------------|----------|---------|-------------|
| FR-300 | Three autonomy modes: shadow (log only), propose (human approval), execute (auto-apply) | P0 | R0 | policy-agent |
| FR-301 | AI Review page — pending proposals list, detail panel, approve/reject/edit | P0 | R0 | policy-agent |
| FR-302 | Shadow mode — _shadow flag on mutations, admin-only log view | P0 | R0 | policy-agent |
| FR-303 | Confidence threshold (default 0.6) — route low-confidence results to human | P0 | R0 | policy-agent |
| FR-304 | Rollback — store pre-action snapshot, one-click revert of AI mutations | P1 | R0 | policy-agent |
| FR-305 | Quiet hours — block AI nudges outside configured hours (midnight-wrapping) | P1 | R0 | policy-agent |
| FR-306 | Nudge limits — max 2 per task per day | P1 | R0 | policy-agent |
| FR-307 | Daily AI cost cap per tenant with Redis tracking | P0 | R0 | policy-agent |
| FR-308 | Per-capability autonomy overrides (e.g., summary-writer always execute) | P1 | R1 | policy-agent |

### 7.3 MCP Tool System (FR-320 series)

| ID | Requirement | Priority | Release | Swarm Agent |
|----|-------------|----------|---------|-------------|
| FR-320 | pm-db server — query, mutate, get_by_id tools with Drizzle ORM | P0 | R0 | mcp-agent |
| FR-321 | pinecone server — cosine similarity search, metadata text search (1536-dim, tenant-scoped index) | P0 | R0 | mcp-agent |
| FR-322 | pm-events server — @vercel/kv publish/subscribe with auto tenant_id injection | P0 | R0 | mcp-agent |
| FR-323 | Tool allowlist enforcement — agents can only access explicitly permitted tools | P0 | R0 | mcp-agent |
| FR-324 | MCP registry — tool dispatch, server lifecycle management | P0 | R0 | mcp-agent |

### 7.4 Lifecycle Hooks (FR-340 series)

| ID | Requirement | Priority | Release | Swarm Agent |
|----|-------------|----------|---------|-------------|
| FR-340 | PreToolUse hooks execute sequentially (first-deny-wins) | P0 | R0 | hooks-agent |
| FR-341 | tenant-isolator hook — block cross-tenant access, inject tenant_id | P0 | R0 | hooks-agent |
| FR-342 | autonomy-enforcer hook — enforce shadow/propose/execute per action | P0 | R0 | hooks-agent |
| FR-343 | rate-limiter hook — @vercel/kv sliding window + daily cost cap | P0 | R0 | hooks-agent |
| FR-344 | PostToolUse hooks execute in parallel (all-must-complete) | P0 | R0 | hooks-agent |
| FR-345 | cost-tracker hook — token/cost accounting to DB + @vercel/kv | P0 | R0 | hooks-agent |
| FR-346 | audit-writer hook — log all hook decisions to ai_hook_log | P0 | R0 | hooks-agent |
| FR-347 | traceability hook — link mutations to ai_action records | P0 | R0 | hooks-agent |
| FR-348 | notification-hook — notify users on AI-initiated mutations | P1 | R0 | hooks-agent |
| FR-349 | session-manager (stop hook) — persist session state and turn count | P0 | R0 | hooks-agent |

### 7.5 LLM Routing & Cost (FR-360 series)

| ID | Requirement | Priority | Release | Swarm Agent |
|----|-------------|----------|---------|-------------|
| FR-360 | Model routing — Opus for generation/risk, Sonnet for queries/summaries | P0 | R0 | orchestrator-agent |
| FR-361 | Retry with exponential backoff (1s, 2s, 4s) and model fallback (Opus → Sonnet) | P0 | R0 | orchestrator-agent |
| FR-362 | Token budget enforcement in context assembly (60% truncation threshold) | P0 | R0 | orchestrator-agent |
| FR-363 | Per-tenant cost tracking with daily/monthly rollups | P0 | R0 | orchestrator-agent |
| FR-364 | Pre-flight budget check before LLM calls | P1 | R1 | orchestrator-agent |

### 7.6 Agent SDK Architecture (FR-3000 series)

> **Swarm assignment:** AI Engine Swarm — orchestrator-agent and sdk-agent in parallel

These 12 requirements define the production-grade Agent SDK that replaces the conceptual 7-stage pipeline with a concrete multi-agent orchestration framework.

| ID | Requirement | Priority | Release | Swarm Agent |
|----|-------------|----------|---------|-------------|
| FR-3000 | Multi-Agent Orchestrator — central entry point for all AI operations, routes to subagents by capability | P0 | R0 | orchestrator-agent |
| FR-3001 | 10 Subagent Definitions — each with isolated context, assigned model (Opus/Sonnet), tool restrictions, permission mode, max turn count | P0 | R0 | sdk-agent |
| FR-3002 | MCP Integration Layer — 6 MCP tool servers: 3 system (pm-db, pinecone, pm-events) + 3 external (slack, github, calendar) | P0 | R0 (system), R1-R2 (external) | mcp-agent |
| FR-3003 | AI Session Persistence — resumable, forkable sessions stored in PostgreSQL with 30-day retention and parent_session_id tracking | P0 | R0 | sdk-agent |
| FR-3004 | Hooks Safety Layer — 8 lifecycle hooks in deterministic order: PreToolUse (tenant-isolator → autonomy-enforcer → rate-limiter), PostToolUse (cost-tracker ∥ audit-writer ∥ traceability ∥ notification-hook), Stop (session-manager) | P0 | R0 | hooks-agent |
| FR-3005 | Permission Evaluation Chain — 4-step evaluation: (1) hook results → (2) ai_agent_configs rules → (3) agent permission mode (default/acceptEdits/bypassPermissions) → (4) fallback DENY mutations, ALLOW reads | P0 | R0 | sdk-agent |
| FR-3006 | Tool Restrictions per Agent — principle of least privilege; read-only agents (whats-next, nl-query, summary-writer) cannot access mutate tools; only wbs-generator gets acceptEdits | P0 | R0 | sdk-agent |
| FR-3007 | Custom Tool Extension API — MCP-based plugin architecture allowing tenants to register custom AI tools | P2 | R1 | mcp-agent |
| FR-3008 | Agent Session Dashboard — admin UI showing active/historical AI sessions, turn counts, cost, decisions | P1 | R1 | frontend-agent |
| FR-3009 | Subagent Parallelization — concurrent subagent execution for independent capabilities (e.g., summary + whats-next in parallel) | P1 | R1 | orchestrator-agent |
| FR-3010 | Dynamic Agent Configuration — per-tenant runtime config factory for model overrides, tool additions, system prompt extensions | P2 | R2 | sdk-agent |
| FR-3011 | Conversational NL Query — multi-turn sessions replacing stateless single-shot queries, with context carryover | P1 | R0 | orchestrator-agent |

**Subagent Specifications (R0):**

| Subagent | Model | Permission Mode | Tools (R/W) | Max Turns |
|----------|-------|----------------|-------------|-----------|
| wbs-generator | Opus | acceptEdits | pm-db (R/W), pinecone (R), pm-events (W) | 15 |
| whats-next | Sonnet | default (read-only) | pm-db (R), pinecone (R) | 5 |
| nl-query | Sonnet | default (read-only) | pm-db (R), pinecone (R) | 10 |
| summary-writer | Sonnet | default (read-only) | pm-db (R), pinecone (R) | 5 |

**Subagent Specifications (R1+):**

| Subagent | Model | Permission Mode | Tools (R/W) | Max Turns | Release |
|----------|-------|----------------|-------------|-----------|---------|
| risk-predictor | Opus | default (read-only) | pm-db (R), pinecone (R) | 10 | R1 |
| ai-pm-agent | Sonnet | acceptEdits | pm-db (R/W), pm-events (W), slack (W) | 25 | R1 |
| scope-detector | Sonnet | default (read-only) | pm-db (R), pinecone (R) | 10 | R1 |
| writing-assistant | Sonnet | default (read-only) | pm-db (R) | 10 | R2 |
| sow-generator | Opus | default (read-only) | pm-db (R), pinecone (R) | 15 | R3 |
| learning-agent | Sonnet | default (read-only) | pm-db (R), pinecone (R) | 15 | R3 |

---

## 8. Non-Functional Requirements

> **Swarm assignment:** Cross-cutting — validated by QA Swarm in parallel with feature development

### 8.1 Performance

| ID | Requirement | Target (R0) | Target (R3) |
|----|-------------|-------------|-------------|
| NFR-001 | API CRUD p95 latency | < 500ms | < 500ms |
| NFR-002 | WBS generation p95 | < 30s | < 20s |
| NFR-003 | NL Query p95 | < 8s | < 5s |
| NFR-004 | Vector search p95 | < 100ms | < 100ms |
| NFR-005 | Dashboard load time | < 2s | < 1s |
| NFR-006 | Concurrent users supported | 50 | 1,000 |
| NFR-007 | API error rate | < 0.1% | < 0.1% |

### 8.2 Security

| ID | Requirement | Priority | Release |
|----|-------------|----------|---------|
| NFR-010 | Three-layer tenant isolation: JWT claims + app middleware + PostgreSQL RLS | P0 | R0 |
| NFR-011 | Cross-tenant access returns 404 (not 403) — no information leakage | P0 | R0 |
| NFR-012 | All queries parameterized via Drizzle ORM — no raw SQL | P0 | R0 |
| NFR-013 | OWASP Top 10 compliance (SQLi, XSS, CSRF, prompt injection) | P0 | R0 |
| NFR-014 | Encryption at rest (AES-256) and in transit (TLS 1.3) | P0 | R1 |
| NFR-015 | Prompt injection defense — structured fields, output validation via Zod | P0 | R0 |
| NFR-016 | SOC 2 Type I certification | P1 | R2 |
| NFR-017 | SOC 2 Type II sustained compliance | P2 | R3 |

### 8.3 Reliability & Availability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-020 | System availability | 99.9% uptime |
| NFR-021 | Health check interval | 30s (API, DB, @vercel/kv, Pinecone) |
| NFR-022 | Claude API circuit breaker | Open after 5 consecutive failures |
| NFR-023 | Graceful degradation on AI failure | Fallback strategies: ask_human, reduce_scope, use_template, skip |
| NFR-024 | Zero data loss on infrastructure failure | Vercel Postgres WAL replication, @vercel/kv persistence |

### 8.4 Scalability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-030 | Tenant scaling | 100 tenants × 100 users (R2), 500+ tenants (R3) |
| NFR-031 | Task volume | 100K tasks with no degradation (R3) |
| NFR-032 | Vector index | IVFFlat (R0) → HNSW (R3) for sub-100ms at scale |
| NFR-033 | Horizontal API scaling | Stateless Next.js API Routes auto-scaled on Vercel Edge |

### 8.5 AI Quality

| ID | Requirement | Target | Alert Threshold |
|----|-------------|--------|-----------------|
| NFR-040 | WBS acceptance rate | > 60% | < 60% triggers prompt review |
| NFR-041 | AI override rate | < 40% | > 40% triggers recalibration |
| NFR-042 | Hallucination incidents | Zero tolerance | Any occurrence → P0 |
| NFR-043 | Zod validation pass rate | > 90% | < 90% triggers prompt review |
| NFR-044 | Confidence distribution mean | > 0.6 | < 0.6 triggers model review |

### 8.6 Agent SDK Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-045 | AI session resume latency | < 100ms |
| NFR-046 | AI session creation latency | < 50ms |
| NFR-047 | AI session fork latency | < 200ms |
| NFR-048 | Max turns per session | 100 |
| NFR-049 | MCP full tool discovery | < 500ms |
| NFR-04A | MCP individual tool retrieval | < 50ms |
| NFR-04B | MCP tool cache TTL | 5 minutes |
| NFR-04C | MCP servers supported per tenant | Up to 50 |

### 8.7 Maintainability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-060 | Test coverage (unit + integration) | 80% minimum |
| NFR-061 | TypeScript strict mode; zero `any` types | Enforced via tsconfig |
| NFR-062 | Modular monolith with clean module boundaries | Verified via dependency analysis |
| NFR-063 | Versioned DB migrations with rollback support | Drizzle migration chain |
| NFR-064 | Prompt templates version-controlled in repo | Git-tracked, reviewed in PRs |

### 8.8 Usability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-070 | New user productive (first task created) | Within 15 minutes |
| NFR-071 | AI proposal batch review speed | 50 proposals reviewable in 30 seconds |
| NFR-072 | Developer finds next task | Within 5 seconds of login |
| NFR-073 | Client finds project status | Within 10 seconds |
| NFR-074 | Mobile-responsive viewport | 375px+ supported |

### 8.9 Observability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-080 | Structured JSON logging on all services | All API + worker logs |
| NFR-081 | Distributed tracing (AWS X-Ray) | End-to-end request traces |
| NFR-082 | Per-subagent dashboards | Latency, cost, acceptance rate, confidence, hook decisions |
| NFR-083 | Alert rules | Circuit breaker, AI failure > 10%, budget exceeded, consumer lag |
| NFR-084 | Agent session monitoring | Active sessions, avg duration, resume success rate |

### 8.10 Disaster Recovery

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-090 | Recovery Point Objective (RPO) | < 1 hour |
| NFR-091 | Recovery Time Objective (RTO) | < 4 hours |
| NFR-092 | Cross-region backups | Daily automated, 30-day retention |
| NFR-093 | DR plan tested | Quarterly |

### 8.11 Swarm Parallelism Constraints

| ID | Constraint | Rationale |
|----|-----------|-----------|
| NFR-050 | Max 4 concurrent implementation agents per sprint | Prevent merge conflict explosion |
| NFR-051 | Shared type changes require sync barrier before parallel resume | `@dynsense/shared` is the cross-agent contract |
| NFR-052 | Each agent must pass module-level tests before merging to integration branch | Gate quality at agent boundary |
| NFR-053 | Integration test suite runs after all parallel agents merge | Catch cross-module regressions |
| NFR-054 | DB migration files numbered sequentially — no parallel migration authoring | Prevent migration ordering conflicts |

---

## 9. Integration Requirements

> **Swarm assignment:** Integration Swarm (3 parallel agents — one per integration domain)

### 9.1 Slack / Microsoft Teams (FR-400 series)

| ID | Requirement | Priority | Release | Swarm Agent |
|----|-------------|----------|---------|-------------|
| FR-400 | Slack app installation via OAuth 2.0 with per-tenant workspace binding | P1 | R1 | comms-agent |
| FR-401 | AI nudge delivery — send task reminders to assigned user's Slack DM | P1 | R1 | comms-agent |
| FR-402 | Daily summary push — post AI-generated status report to configured channel | P1 | R1 | comms-agent |
| FR-403 | Slash command `/dynsense` — trigger NL Query from Slack, return streamed response | P2 | R1 | comms-agent |
| FR-404 | Microsoft Teams bot — equivalent functionality to Slack (nudges, summaries, commands) | P2 | R1 | comms-agent |
| FR-405 | Channel mapping — configure which Dynsense project maps to which Slack channel | P1 | R1 | comms-agent |
| FR-406 | Notification preferences — per-user opt-in/out for Slack notifications by event type | P2 | R1 | comms-agent |

### 9.2 Git Providers (FR-420 series)

| ID | Requirement | Priority | Release | Swarm Agent |
|----|-------------|----------|---------|-------------|
| FR-420 | GitHub App installation with repository-level permissions | P1 | R1 | git-agent |
| FR-421 | GitLab webhook registration for push, MR, and pipeline events | P2 | R1 | git-agent |
| FR-422 | Commit-to-task linking — parse `[TASK-xxx]` from commit messages, attach to task activity | P1 | R1 | git-agent |
| FR-423 | PR/MR status sync — auto-transition task to `review` when PR opened, `completed` when merged | P1 | R1 | git-agent |
| FR-424 | Branch name suggestion — AI generates branch name from task title (e.g., `feat/TASK-42-add-login`) | P2 | R1 | git-agent |
| FR-425 | Pipeline status display — show CI pass/fail on task detail sidebar | P2 | R1 | git-agent |
| FR-426 | Scope Creep Detector input — feed commit frequency and file change volume into risk model | P2 | R1 | git-agent |

### 6.3 Calendar & Scheduling (FR-440 series)

| ID | Requirement | Priority | Release | Swarm Agent |
|----|-------------|----------|---------|-------------|
| FR-440 | Google Calendar OAuth integration — sync task due dates as calendar events | P2 | R2 | calendar-agent |
| FR-441 | Outlook/O365 calendar sync via Microsoft Graph API | P2 | R2 | calendar-agent |
| FR-442 | Two-way sync — calendar event reschedule updates task due date and vice versa | P2 | R2 | calendar-agent |
| FR-443 | Sprint milestone events — auto-create calendar entries for sprint start/end/demo | P2 | R2 | calendar-agent |

### 6.4 Webhooks & External Systems (FR-460 series)

| ID | Requirement | Priority | Release | Swarm Agent |
|----|-------------|----------|---------|-------------|
| FR-460 | Outbound webhook system — configurable HTTP POST on task/project/AI events | P2 | R2 | webhook-agent |
| FR-461 | Webhook payload signing (HMAC-SHA256) for receiver verification | P2 | R2 | webhook-agent |
| FR-462 | Retry with exponential backoff (3 attempts) on delivery failure | P2 | R2 | webhook-agent |
| FR-463 | Webhook delivery log — status, response code, latency per delivery | P2 | R2 | webhook-agent |
| FR-464 | Inbound webhook — accept external events (e.g., Jira, Asana) for task creation | P2 | R3 | webhook-agent |

### 6.5 Integration Swarm Parallelism

All three integration agents (comms, git, calendar) develop concurrently with the following constraints:

| Constraint | Detail |
|-----------|--------|
| **Shared interface** | All integrations emit events via NATS `integration.*` subjects — contract defined before agents start |
| **Credential storage** | All OAuth tokens stored in `integration_credentials` table — schema owned by infra-agent, consumed by all |
| **Tenant scoping** | Every integration operation must include `tenant_id` — enforced by existing tenant-isolator hook |
| **Independent testing** | Each agent runs its own mock server tests — no cross-agent test dependencies |
| **Sync barrier** | All three agents merge only after each passes its integration test suite against NATS event contracts |

---

## 7. Infrastructure & Deployment Requirements

> **Swarm assignment:** Infrastructure Swarm (3 parallel agents — compute, data, CI/CD)

### 7.1 Local Development (FR-500 series)

| ID | Requirement | Priority | Release | Swarm Agent |
|----|-------------|----------|---------|-------------|
| FR-500 | Docker Compose with PostgreSQL 16 + pgvector, NATS 2.10 JetStream, Redis 7 | P0 | R0 | infra-agent |
| FR-501 | Single `pnpm dev` command starts all 6 packages in watch mode via Turborepo | P0 | R0 | infra-agent |
| FR-502 | Deterministic seed script — 3 tenants, 5 users/tenant, 3 projects/tenant, 20-50 tasks/project | P0 | R0 | infra-agent |
| FR-503 | Mock Claude API for offline development — deterministic responses per capability | P1 | R0 | infra-agent |
| FR-504 | `.env.example` with all required variables documented | P0 | R0 | infra-agent |

### 7.2 Cloud Infrastructure (FR-520 series)

| ID | Requirement | Priority | Release | Swarm Agent |
|----|-------------|----------|---------|-------------|
| FR-520 | AWS ECS Fargate for API and web containers — stateless, auto-scaling | P0 | R1 | compute-agent |
| FR-521 | ALB with TLS 1.3 termination, path-based routing (`/api/*` → API, `/*` → web) | P0 | R1 | compute-agent |
| FR-522 | RDS PostgreSQL 16 with pgvector extension, Multi-AZ standby | P0 | R1 | data-agent |
| FR-523 | ElastiCache Redis 7 cluster for rate limiting, caching, cost tracking | P0 | R1 | data-agent |
| FR-524 | Amazon MSK or self-hosted NATS JetStream on ECS for event bus | P1 | R1 | data-agent |
| FR-525 | S3 for document storage, audit log archives, and backup retention | P1 | R2 | data-agent |
| FR-526 | CloudWatch for metrics, logs, and alarms — all services instrumented | P0 | R1 | compute-agent |
| FR-527 | AWS CDK (TypeScript) for all infrastructure-as-code — no manual console changes | P0 | R1 | compute-agent |
| FR-528 | VPC with private subnets for data layer, public subnets for ALB only | P0 | R1 | compute-agent |

### 7.3 CI/CD Pipeline (FR-540 series)

| ID | Requirement | Priority | Release | Swarm Agent |
|----|-------------|----------|---------|-------------|
| FR-540 | GitHub Actions workflow: lint → build → test on every PR | P0 | R0 | cicd-agent |
| FR-541 | Turborepo remote caching for build artifact reuse across CI runs | P1 | R0 | cicd-agent |
| FR-542 | Automated staging deployment on merge to `main` | P0 | R1 | cicd-agent |
| FR-543 | Production deployment via manual approval gate after staging soak | P0 | R1 | cicd-agent |
| FR-544 | Database migration runner in CI — Drizzle push with rollback on failure | P0 | R1 | cicd-agent |
| FR-545 | E2E smoke tests run against staging after each deployment | P1 | R1 | cicd-agent |
| FR-546 | OWASP ZAP security scan on staging — block promotion on high/critical findings | P1 | R1 | cicd-agent |
| FR-547 | Docker image scanning (Trivy) for CVE detection before deployment | P1 | R1 | cicd-agent |

### 7.4 NATS JetStream Event Bus (FR-560 series)

| ID | Requirement | Priority | Release | Swarm Agent |
|----|-------------|----------|---------|-------------|
| FR-560 | 12 JetStream streams covering all domain events (task.*, project.*, ai.*, integration.*) | P0 | R0 | data-agent |
| FR-561 | Consumer groups for horizontal scaling — multiple API instances consume without duplication | P0 | R1 | data-agent |
| FR-562 | Dead letter queue (DLQ) for failed message processing with retry policy | P1 | R1 | data-agent |
| FR-563 | Event replay capability for audit and debugging | P2 | R2 | data-agent |
| FR-564 | Consumer lag monitoring — CloudWatch alarm on lag > 1000 messages | P0 | R1 | data-agent |

### 7.5 Infrastructure Swarm Parallelism

Three infrastructure agents (compute, data, cicd) run concurrently:

| Agent | Owns | Dependencies |
|-------|------|-------------|
| **compute-agent** | ECS tasks, ALB, VPC, CDK stack, CloudWatch | None — independent infrastructure layer |
| **data-agent** | RDS, ElastiCache, NATS, S3, migrations | None — independent data layer |
| **cicd-agent** | GitHub Actions, Docker builds, deployment scripts | Depends on compute-agent and data-agent outputs for deployment targets |

**Sync barrier:** cicd-agent waits for compute-agent and data-agent to define resource ARNs before wiring deployment pipelines. compute-agent and data-agent run fully in parallel.

---

## 8. Data Model Requirements

> **Swarm assignment:** Data Swarm (2 parallel agents — core schema, AI schema)

### 8.1 Core Tables (FR-600 series)

| ID | Table | Key Columns | Tenant Scoped | Release | Swarm Agent |
|----|-------|-------------|---------------|---------|-------------|
| FR-600 | `tenants` | id, name, slug, settings (JSONB), plan_tier | No (root table) | R0 | core-schema-agent |
| FR-601 | `users` | id, tenant_id, email, password_hash, role, status | Yes | R0 | core-schema-agent |
| FR-602 | `projects` | id, tenant_id, name, description, status, phase, wbs_baseline (JSONB) | Yes | R0 | core-schema-agent |
| FR-603 | `tasks` | id, tenant_id, project_id, parent_task_id, title, status, priority, assignee_id, effort, due_date | Yes | R0 | core-schema-agent |
| FR-604 | `task_assignments` | task_id, user_id, assigned_at | Yes | R0 | core-schema-agent |
| FR-605 | `task_dependencies` | id, tenant_id, blocker_task_id, blocked_task_id, type | Yes | R0 | core-schema-agent |
| FR-606 | `comments` | id, tenant_id, task_id, author_id, body, client_visible | Yes | R0 | core-schema-agent |
| FR-607 | `mentions` | comment_id, user_id | Yes | R0 | core-schema-agent |
| FR-608 | `task_checklists` | id, tenant_id, task_id, title, position | Yes | R0 | core-schema-agent |
| FR-609 | `checklist_items` | id, checklist_id, label, completed, position | Yes | R0 | core-schema-agent |
| FR-610 | `audit_log` | id, tenant_id, entity_type, entity_id, action, actor_id, actor_type, diff (JSONB) | Yes (immutable) | R0 | core-schema-agent |
| FR-611 | `phases` | id, tenant_id, project_id, name, position | Yes | R0 | core-schema-agent |

### 8.2 AI Tables (FR-620 series)

| ID | Table | Key Columns | Tenant Scoped | Release | Swarm Agent |
|----|-------|-------------|---------------|---------|-------------|
| FR-620 | `ai_actions` | id, tenant_id, capability, status, input (JSONB), output (JSONB), confidence, disposition, rollback_data | Yes | R0 | ai-schema-agent |
| FR-621 | `ai_cost_log` | id, tenant_id, ai_action_id, model, input_tokens, output_tokens, cost_usd | Yes | R0 | ai-schema-agent |
| FR-622 | `ai_agent_configs` | id, tenant_id, capability, model_override, max_turns, permission_mode | Yes | R0 | ai-schema-agent |
| FR-623 | `ai_sessions` | id, tenant_id, user_id, capability, parent_session_id, turn_count, state (JSONB), expires_at | Yes | R0 | ai-schema-agent |
| FR-624 | `ai_hook_log` | id, tenant_id, hook_name, phase, decision, reason, ai_action_id | Yes | R0 | ai-schema-agent |
| FR-625 | `ai_mcp_servers` | id, name, status, tools (JSONB), config (JSONB) | No | R0 | ai-schema-agent |

### 8.3 Future Tables (FR-640 series)

| ID | Table | Purpose | Release | Swarm Agent |
|----|-------|---------|---------|-------------|
| FR-640 | `tags` | Task/project tagging with colors | R1 | core-schema-agent |
| FR-641 | `embeddings` | pgvector 1536-dim for RAG context | R0 | ai-schema-agent |
| FR-642 | `custom_fields` | Per-project custom field definitions | R1 | core-schema-agent |
| FR-643 | `notifications` | In-app + push notification queue | R1 | core-schema-agent |
| FR-644 | `goals` | OKRs linked to projects | R2 | core-schema-agent |
| FR-645 | `automation_rules` | Trigger-condition-action rules | R2 | core-schema-agent |
| FR-646 | `forms` | Intake forms for task/project creation | R2 | core-schema-agent |
| FR-647 | `documents` | Rich-text documents linked to projects | R2 | core-schema-agent |
| FR-648 | `views` | Saved filter/sort/group configurations | R1 | core-schema-agent |

### 8.4 Database Constraints

| Constraint | Enforcement |
|-----------|-------------|
| Tenant isolation | RLS `USING (tenant_id = current_setting('app.current_tenant_id')::uuid)` on all tenant-scoped tables |
| Audit immutability | `BEFORE UPDATE OR DELETE` trigger on `audit_log` raises exception |
| Referential integrity | Foreign keys with `ON DELETE CASCADE` for child records, `ON DELETE RESTRICT` for cross-entity refs |
| Unique constraints | `(tenant_id, email)` on users, `(blocker_task_id, blocked_task_id)` on dependencies |
| Soft delete | `deleted_at` column with default query filter `WHERE deleted_at IS NULL` |
| Indexing | B-tree on all foreign keys, GIN on JSONB columns, IVFFlat/HNSW on embeddings |

### 8.5 Data Retention Policies

| Data Type | Retention | Archival Strategy |
|-----------|----------|-------------------|
| `audit_log` | 7 years | Archive to S3 Glacier after 1 year |
| `ai_actions` | 2 years | Archive to S3 after 6 months |
| `ai_cost_log` | 2 years | Aggregate monthly after 3 months, archive raw to S3 |
| `ai_sessions` | 30 days active, 1 year archived | Expire stale sessions via batch job, archive to S3 |
| `ai_hook_log` | 90 days | Rotate and compress after 30 days |
| `comments` | Lifetime of tenant | Soft delete only, never hard purge |
| `embeddings` | Refreshed on content change | Stale embeddings re-generated on schedule |
| `tasks` / `projects` | Lifetime of tenant | Soft delete with 30-day recovery window |
| Backups (full DB) | 30 days point-in-time | RDS automated backups + daily S3 snapshots |
| NATS JetStream | 7 days message retention | DLQ messages retained 30 days |

### 8.6 Data Swarm Parallelism

| Agent | Tables Owned | Sync Point |
|-------|-------------|------------|
| **core-schema-agent** | tenants, users, projects, tasks, assignments, dependencies, comments, mentions, checklists, checklist_items, audit_log, phases, tags, custom_fields, notifications, goals, automation_rules, forms, documents, views | Migration files merged sequentially |
| **ai-schema-agent** | ai_actions, ai_cost_log, ai_agent_configs, ai_sessions, ai_hook_log, ai_mcp_servers, embeddings | Migration files merged sequentially |

**Constraint:** Both agents define migrations independently but merge into a single sequential migration chain. Migration numbering is coordinated via a shared counter file — no parallel migration authoring.

---

## 9. Client Portal & Monetization Requirements

> **Swarm assignment:** Platform Swarm (2 parallel agents — portal, billing)

### 9.1 Client Portal (FR-700 series)

| ID | Requirement | Priority | Release | Swarm Agent |
|----|-------------|----------|---------|-------------|
| FR-700 | Client role — read-only access scoped to milestones, deliverables, and client-visible comments | P1 | R1 (model) | portal-agent |
| FR-701 | Client portal UI — separate Next.js route group `/client/*` with simplified navigation | P1 | R2 | portal-agent |
| FR-702 | Project projection layer — PM selects which tasks/milestones are client-visible | P1 | R2 | portal-agent |
| FR-703 | Client NL Query — scoped AI responses that never expose internal tasks, costs, or team discussions | P0 | R2 | portal-agent |
| FR-704 | Client onboarding — invite-by-email flow with branded login page per tenant | P2 | R2 | portal-agent |
| FR-705 | Client feedback — structured comment submission on deliverables | P2 | R2 | portal-agent |

### 9.2 Monetization & Billing (FR-720 series)

| ID | Requirement | Priority | Release | Swarm Agent |
|----|-------------|----------|---------|-------------|
| FR-720 | Three-tier pricing: Starter (5 users, 3 projects), Pro (25 users, unlimited), Enterprise (custom) | P1 | R2 | billing-agent |
| FR-721 | Feature flags — gate capabilities by plan tier (e.g., Risk Predictor = Pro+, SOW Generator = Enterprise) | P1 | R1 | billing-agent |
| FR-722 | AI usage metering — track per-tenant token consumption with monthly rollup | P0 | R0 | billing-agent |
| FR-723 | Cost dashboard — admin view showing AI spend by capability, trend charts, budget alerts | P1 | R2 | billing-agent |
| FR-724 | Budget alerts — notify tenant admin at 80% and 100% of monthly AI budget | P1 | R2 | billing-agent |
| FR-725 | Stripe integration for subscription management and payment processing | P1 | R2 | billing-agent |
| FR-726 | Usage-based AI add-on — overage billing for AI tokens beyond plan allowance | P2 | R3 | billing-agent |

### 9.4 Platform Features (FR-740 series)

> **Swarm assignment:** Platform Swarm — portal-agent and platform-agent in parallel

| ID | Requirement | Priority | Release | Swarm Agent |
|----|-------------|----------|---------|-------------|
| FR-740 | Custom automations — trigger-condition-action rules for workflow automation | P2 | R2 | platform-agent |
| FR-741 | Form view / task intake — configurable forms for standardized task/project creation | P2 | R2 | platform-agent |
| FR-742 | Docs & knowledge base — rich-text documents linked to projects | P2 | R2 | platform-agent |
| FR-743 | Full self-service onboarding — guided setup wizard for new tenants (no manual provisioning) | P1 | R3 | platform-agent |
| FR-744 | Embedded analytics & benchmarking — cross-tenant anonymized performance benchmarks | P3 | R3 | platform-agent |
| FR-745 | Enterprise tier — custom user/project limits, dedicated support flag, SLA configuration | P2 | R3 | platform-agent |
| FR-746 | Project Manager role — dedicated PM role with permissions between admin and developer | P1 | R3 | platform-agent |

### 9.3 Platform Swarm Parallelism

| Agent | Owns | Dependencies |
|-------|------|-------------|
| **portal-agent** | Client routes, projection layer, scoped queries, client onboarding | Depends on existing RBAC (client role from R0) |
| **billing-agent** | Feature flags, Stripe integration, cost dashboard, metering | Depends on existing ai_cost_log (from R0) |

**Sync barrier:** Both agents run in parallel. portal-agent consumes `client` role defined in R0. billing-agent consumes `ai_cost_log` from R0. No cross-dependency between the two agents.

---

## 10. Release Gates & Acceptance Criteria

> **Swarm assignment:** QA Swarm validates all gates — runs in parallel with feature development

### 10.1 R0 Gate (Foundation)

| Criterion | Target | Verified By |
|-----------|--------|-------------|
| Unit test coverage (backend + agents) | 80%+ | CI coverage report |
| All 37+ hook integration tests passing | 100% | CI test suite |
| API integration flow tests | 20+ passing | CI test suite |
| Critical E2E journeys automated | 5 journeys | Playwright suite |
| WBS golden test set | 10+ passing, acceptance > 60% | AI evaluation harness |
| What's Next golden test set | 10+ passing | AI evaluation harness |
| NL Query golden test set | 15+ passing | AI evaluation harness |
| API p95 latency | < 500ms | k6 load test |
| WBS generation p95 | < 30s | k6 load test |
| Cross-tenant isolation tests | Zero leakage | Security test suite |
| High/critical security vulnerabilities | Zero | OWASP ZAP scan |
| Staging stability | 1 week with no P0/P1 | Monitoring dashboards |

### 10.2 R1 Gate (Intelligence)

| Criterion | Target | Verified By |
|-----------|--------|-------------|
| All R0 gates still passing | 100% | Regression suite |
| AI PM agent 15-min loops operational | Running on staging | CloudWatch metrics |
| Nudges delivered via Slack | End-to-end verified | E2E test |
| Risk predictions accuracy | > 70% on test set | AI evaluation harness |
| Status reports acceptable without editing | > 80% | Human review panel |
| Git integration (commit-to-task) | Functional on staging | Integration test |
| SSO + MFA working | Verified with test IdP | Security test |
| Feature flags operational | 3+ features gated by tier | Integration test |

### 10.3 R2 Gate (Growth)

| Criterion | Target | Verified By |
|-----------|--------|-------------|
| All R0 + R1 gates still passing | 100% | Regression suite |
| Multi-tenant test (3 tenants) | Zero cross-contamination | Isolation test suite |
| Client portal E2E | Automated journey | Playwright suite |
| Billing accuracy | Stripe charges match usage | Billing reconciliation test |
| Load test (100 tenants × 10 users) | p95 < 500ms, zero cross-tenant | k6 load test |
| SOC 2 controls verified | All CC6/CC7/CC8/PI1 controls | Compliance checklist |
| Cost dashboard accuracy | Matches ai_cost_log within 1% | Data reconciliation |

### 10.4 R3 Gate (Platform)

| Criterion | Target | Verified By |
|-----------|--------|-------------|
| All previous gates still passing | 100% | Regression suite |
| Per-tenant learning | Measurable accuracy improvement | A/B evaluation |
| SOW generation | Valid SOWs from project history | Human review panel |
| Scale test (10 tenants, 100K tasks) | No degradation | k6 stress test |
| SOC 2 Type I certified | Certificate issued | External auditor |
| Enterprise tier functional | Custom limits, dedicated support flag | Integration test |

---

## 11. Risk Register & Dependencies

### 11.1 Technical Risks

| ID | Risk | Likelihood | Impact | Mitigation | Swarm Owner |
|----|------|-----------|--------|------------|-------------|
| RISK-001 | WBS quality too generic for niche domains | Medium | High | Domain-specific prompt templates, golden test sets, continuous evaluation | orchestrator-agent |
| RISK-002 | Claude API rate limits under load | Medium | High | Circuit breaker, per-tenant budgets, Opus → Sonnet fallback, request queuing | hooks-agent |
| RISK-003 | Cross-tenant data leakage | Low | Critical | Three-layer isolation (JWT + middleware + RLS), dedicated integration tests, P0 incident response | core-schema-agent |
| RISK-004 | AI cost exceeds revenue per tenant | Medium | High | Pre-flight budget checks, daily cost caps, usage-based overage billing | billing-agent |
| RISK-005 | Scope creep on R0 AI capabilities | High | Medium | Strict feature lock — no R1 features in R0 sprints, PM approval for any addition | All agents |
| RISK-006 | Prompt injection via user input | Medium | High | Structured input fields (not free-form prompts), Zod output validation, content filtering | policy-agent |
| RISK-007 | NATS message loss under high load | Low | Medium | JetStream persistence, DLQ with retry, consumer lag alerting | data-agent |
| RISK-008 | Merge conflicts from parallel agent development | Medium | Medium | Bounded module ownership, interface contracts, sequential migration numbering | All agents |

### 11.2 Data Readiness Dependencies

| Dependency | Required Data Volume | Blocks | Earliest Available |
|-----------|---------------------|--------|-------------------|
| What's Next LLM upgrade | 50+ completed tasks per tenant | R1-3 (enhanced ranking) | Mid-R1 |
| Risk Predictor training | 100+ task status transitions per tenant | R1-1 (risk model) | Early R1 |
| Per-Tenant Learning | 2+ completed projects per tenant | R3-1 (RAG tuning) | Early R3 |
| Scope Creep Detector | 1+ WBS baseline per project | R1-3 (drift detection) | R0-4 (after WBS ships) |
| AI estimation engine | 200+ tasks with actual vs. estimated effort | R3-2 (estimation) | Mid-R3 |

### 11.3 External Dependencies

| Dependency | Provider | Risk | Mitigation |
|-----------|----------|------|------------|
| Claude API availability | Anthropic | API downtime blocks all AI features | Circuit breaker, graceful degradation, template fallbacks |
| Slack API | Slack/Salesforce | Breaking changes or rate limit changes | Version-pinned SDK, webhook fallback, rate limit handling |
| GitHub API | Microsoft | Token permission changes, API deprecation | GitHub App model (stable), version-pinned REST API |
| Stripe API | Stripe | Payment processing changes | Stripe SDK with webhook-driven flow, idempotent operations |
| PostgreSQL pgvector | Open source | Extension compatibility with RDS upgrades | Pin extension version, test on each RDS upgrade |

---

## 12. Traceability Matrix

> Maps each requirement to its design-doc section, implementation-plan sprint, and qa-plan test coverage.

### 12.1 Core PM Traceability

| Requirement | Design Doc Section | Impl Plan Sprint | QA Plan Coverage |
|------------|-------------------|------------------|-----------------|
| FR-100 to FR-105 (Auth) | §4.1 Auth Architecture | R0-2 | §2.1 auth.service (15+ unit), §2.2 Auth flow integration |
| FR-110 to FR-113 (Projects) | §4.2 Project Model | R0-2 | §2.1 project.service (10+ unit), §2.2 Project CRUD integration |
| FR-120 to FR-128 (Tasks) | §4.3 Task Model | R0-2 | §2.1 task.service (20+ unit), §2.2 Task lifecycle integration |
| FR-124 to FR-125 (Dependencies) | §4.4 DAG Model | R0-2 | §2.1 dependency.service (10+ unit), §2.2 Dependency chain integration |
| FR-140 to FR-143 (Audit) | §4.7 Audit Trail | R0-2 | §2.1 audit.service (6+ unit), §2.4 Audit immutability security test |
| FR-134 to FR-138 (Search, Filters, Reminders, Formulas) | §4.3 Task Model | R1-R2 | §2.1 search/filter tests, §2.6 E2E journeys |
| FR-150 to FR-161 (Views, Notifications, Visualizations) | §6.1 Frontend Routes | R0-R1 | §2.6 E2E journeys (5 critical paths), §2.1 notification tests |

### 12.2 AI Engine Traceability

| Requirement | Design Doc Section | Impl Plan Sprint | QA Plan Coverage |
|------------|-------------------|------------------|-----------------|
| FR-200 (Orchestrator) | §5.1 AI Pipeline | R0-3 | §2.1 Orchestrator tests, §2.2 Hook chain (37 tests) |
| FR-201 (WBS Generator) | §5.2 Capabilities | R0-4 | §2.3 WBS golden tests (10+), §2.5 WBS p95 < 30s |
| FR-202 (What's Next) | §5.2 Capabilities | R0-5 | §2.3 What's Next golden tests (10+) |
| FR-203 (NL Query) | §5.2 Capabilities | R0-6 | §2.3 NL Query golden tests (15+) |
| FR-211 to FR-217 (Eval Harness, Monitoring, R3 AI) | §5.2 Capabilities | R0-R3 | §2.3 AI evaluation harness, §Monitoring dashboards |
| FR-300 to FR-308 (Autonomy) | §5.3 Autonomy Engine | R0-3 + R0-4 | §2.3 Autonomy mode tests (shadow/propose/execute) |
| FR-320 to FR-324 (MCP) | §5.4 MCP Servers | R0-3 | §2.2 MCP tool resolution tests |
| FR-340 to FR-349 (Hooks) | §5.5 Hook System | R0-3 | §2.2 Hook chain (37 integration tests) |

### 12.3 Agent SDK Traceability

| Requirement | Design Doc Section | Impl Plan Sprint | QA Plan Coverage |
|------------|-------------------|------------------|-----------------|
| FR-3000 (Multi-Agent Orchestrator) | §5.1 AI Pipeline | R0-3 | §2.1 Orchestrator tests (64 total) |
| FR-3001 (Subagent Definitions) | §5.2 Subagent Specs | R0-3 | §2.2 Agent registry tests, tool resolution |
| FR-3002 (MCP Integration Layer) | §5.4 MCP Servers | R0-3 (system), R1-R2 (external) | §2.2 MCP tool resolution, §2.6 Integration E2E |
| FR-3003 (AI Session Persistence) | §5.7 Session Management | R0-3 | §2.1 Session service (8+ unit: create, resume, fork, expire) |
| FR-3004 (Hooks Safety Layer) | §5.5 Hook System | R0-3 | §2.2 Hook chain (37 integration tests) |
| FR-3005 (Permission Evaluation Chain) | §5.6 Permission Chain | R0-3 | §2.1 Permission chain (10+ tests: 4-step eval) |
| FR-3006 (Tool Restrictions per Agent) | §5.2 Subagent Specs | R0-3 | §2.2 Multi-agent tool isolation tests |
| FR-3007 (Custom Tool Extension API) | §5.4 MCP Extension | R1-3 | §2.2 Custom tool registration tests |
| FR-3008 (Agent Session Dashboard) | §6.3 Admin UI | R1-4 | §2.6 Admin E2E journey |
| FR-3009 (Subagent Parallelization) | §5.1 Orchestrator | R1-3 | §2.2 Concurrent subagent execution tests |
| FR-3010 (Dynamic Agent Configuration) | §5.8 Config Factory | R2-2 | §2.2 Per-tenant config override tests |
| FR-3011 (Conversational NL Query) | §5.2 NL Query | R0-6 | §2.3 Multi-turn NL Query golden tests |

### 12.4 Integration Traceability

| Requirement | Design Doc Section | Impl Plan Sprint | QA Plan Coverage |
|------------|-------------------|------------------|-----------------|
| FR-400 to FR-406 (Slack) | §7.1 Slack Integration | R1-2 | §2.6 Integration flow E2E |
| FR-420 to FR-426 (Git) | §7.2 Git Integration | R1-2 | §2.2 Git webhook integration tests |
| FR-440 to FR-443 (Calendar) | §7.3 Calendar | R2-3 | §2.6 Calendar sync E2E |
| FR-460 to FR-464 (Webhooks) | §7.4 Webhook System | R2-4 | §2.2 Webhook delivery integration tests |

### 12.5 Platform Features Traceability

| Requirement | Design Doc Section | Impl Plan Sprint | QA Plan Coverage |
|------------|-------------------|------------------|-----------------|
| FR-700 to FR-705 (Client Portal) | §8.1 Client Portal | R1 (model), R2 (portal) | §2.6 Client portal E2E |
| FR-720 to FR-726 (Monetization) | §8.2 Billing | R0-R3 | §2.2 Billing reconciliation tests |
| FR-740 to FR-746 (Platform Features) | §8.3 Platform | R2-R3 | §2.6 Platform E2E, §2.2 Automation integration tests |

### 12.6 NFR Traceability

| Requirement | Design Doc Section | Verified In Sprint | QA Plan Coverage |
|------------|-------------------|-------------------|-----------------|
| NFR-001 to NFR-007 (Performance) | §9.1 NFR Targets | Every sprint | §2.5 Load tests (k6/Artillery) |
| NFR-010 to NFR-017 (Security) | §8.1 Security Architecture | Every sprint | §2.4 Security tests (OWASP, tenant isolation) |
| NFR-020 to NFR-024 (Reliability) | §9.2 Availability | R1+ | §2.5 Stress tests, §Monitoring dashboards |
| NFR-040 to NFR-044 (AI Quality) | §5.6 AI Quality Metrics | R0-6+ | §2.3 AI evaluation harness, continuous tracking |
| NFR-060 to NFR-064 (Maintainability) | §9.3 Code Quality | Every sprint | §CI lint + type-check + coverage gates |
| NFR-070 to NFR-074 (Usability) | §6.2 UX Targets | R0-6, R1+ | §2.6 E2E usability journeys |
| NFR-080 to NFR-084 (Observability) | §9.4 Monitoring | R0+ | §2.5 Monitoring dashboards, §CloudWatch alarms |
| NFR-090 to NFR-093 (Disaster Recovery) | §9.5 DR Plan | R1+ | §Quarterly DR drills |

---

## 13. Claude AI API Integration

| Attribute | Specification |
|-----------|--------------|
| **Provider** | Anthropic (hosted API) |
| **SDK** | `@anthropic-ai/claude-agent-sdk` |
| **Models** | Claude Opus 4 (wbs-generator, risk-predictor, sow-generator); Claude Sonnet 4.5 (all other subagents) |
| **Integration** | Agent SDK orchestrator + subagents with MCP tools and hooks |
| **Retry** | Exponential backoff with model fallback (Opus → Sonnet) |
| **Circuit Breaker** | 5 failures → 60s open state |
| **Rate Limiting** | Per-tenant via rate-limiter hook |
| **Cost Control** | Pre-flight budget check via cost-tracker hook |
| **Streaming** | Enabled for NL queries and writing assistant |
| **Swarm Owner** | orchestrator-agent, hooks-agent |

### 13.1 Embedding Requirements

- Model: text-embedding-3-small
- Dimensions: 1536
- Storage: Pinecone serverless index (dynsense-embeddings, tenant-scoped via metadata filter)
- Index: Pinecone serverless (R0-R2), Pinecone pods (R3)
- Scope: All vector searches are tenant-scoped via tenant_id filter
- Swarm Owner: ai-schema-agent

---

## 14. Constraints and Assumptions

### 14.1 Technical Constraints

| Constraint | Detail |
|-----------|--------|
| **Runtime** | Node.js 20 LTS, TypeScript 5.x strict mode |
| **Framework** | Next.js 14+ App Router (API Routes + UI, single app) |
| **Database** | @vercel/postgres (PostgreSQL 16) + Drizzle ORM |
| **ORM** | Drizzle ORM — no raw SQL |
| **Agent SDK** | `@anthropic-ai/claude-agent-sdk` (TypeScript); pin version for stability |
| **MCP Protocol** | Model Context Protocol for all AI-to-tool communication |
| **No custom LLM pipeline** | Agent SDK replaces the custom 7-stage pipeline entirely |
| **Monorepo** | pnpm workspaces + Turborepo |
| **Swarm constraint** | Max 4 concurrent agents per sprint; shared types require sync barrier |

### 14.2 Business Constraints

| Constraint | Detail |
|-----------|--------|
| **Team size** | 2-3 engineers for R0-R1; scale to 8-10 for R2-R3 |
| **Budget** | AI costs must stay within tiered subscription revenue per tenant |
| **Timeline** | 12 months (4 releases × 3 months each) — no extensions |
| **First customer** | Internal dogfooding in R0; pilot client by end of R1 |

### 14.3 Assumptions

| Assumption | Impact if Invalid |
|-----------|------------------|
| Claude API remains available with current pricing through R3 | Abstract behind interface; evaluate fallback to direct Claude API |
| Agent SDK API remains stable through R3 | Abstract behind interface; evaluate fallback to direct Claude API |
| MCP protocol gains adoption | Evaluate custom tool protocol if MCP is deprecated |
| Consultancy firms will pay $50-200/month for AI PM tools | Validate pricing with pilot clients in R1; adjust tiers if needed |
| 60% WBS acceptance rate is achievable with prompt engineering + RAG | Invest in domain-specific templates and golden test sets |
| Team of 2-3 engineers can deliver R0 in 12 weeks with swarm parallelism | Swarm model maximizes throughput; descope Could Defer features if behind |

---

## 15. Appendices

### 15.1 Glossary

See Section 1.4 for complete glossary including Agent SDK and Swarm terms.

### 15.2 Post-12-Month Backlog

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

### 15.3 Open Questions

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