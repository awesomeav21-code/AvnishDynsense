# AI-Native PM Tool — Implementation Plan

> **Version:** 1.1 · February 10, 2026
> **Aligned to:** Product Roadmap v2.2 (roadmap-v2.md) · Architecture v3.1 (architecture-v3.1.md) · UI/UX Design v1.0 (ui-ux-design.md)
> **Methodology:** Agile Scrum, 2-week sprints, trunk-based development
> **Timeline:** 12 months (48 weeks), 4 releases, 24 sprints

---

## Changelog from v1.0

| Change | v1.0 | v1.1 |
|--------|------|------|
| Architecture reference | v3.0 (FINAL_AI_Native_PM_Tool_Architecture_v3_Definitive.md) | v3.1 (architecture-v3.1.md) |
| Roadmap reference | v2.1 | v2.2 (roadmap-v2.md) |
| UI/UX reference | None | ui-ux-design.md (21 wireframes, 6 Mermaid diagrams) |
| NATS streams | 6 | 12 (6 new: pm.notifications, pm.reminders, pm.goals, pm.automations, pm.forms, pm.documents) |
| Durable consumers | 8 | 11 (3 new: notification-generator, recurrence-scheduler, automation-engine) |
| DDL tables | ~16 | 30 (14 new tables for gap features) |
| New Infrastructure Required section | None | Section 7 — maps 14 tables, 6 streams, 3 consumers to sprints |
| Wireframe references | None | Every UI sprint references specific wireframes (W-01 through W-21) |

---

## 1. Introduction

### 1.1 Purpose

This document is the execution plan for the AI-Native PM Tool over a 12-month development cycle. It translates the 103 features defined in the Product Roadmap v2.2 (88 original + 15 ClickUp gap features) and the architecture decisions in the System Architecture v3.1 into a sprint-by-sprint delivery schedule with concrete work items, team allocations, exit criteria, risk mitigations, and quality gates.

### 1.2 Methodology

- **Agile Scrum** with 2-week sprints (10 working days each)
- **Trunk-based development** with short-lived feature branches and PR-required merges
- **Continuous Integration** from Sprint R0-1; Continuous Deployment from Sprint R0-3
- **Quality Gates** at each release boundary (R0, R1, R2, R3) — no release ships without passing its gate

### 1.3 Cross-Reference Scheme

All documents (requirements, roadmap, architecture, UI/UX design) use a unified cross-reference scheme:

- **FR-xxx** = Functional Requirements (from requirements.md)
- **NFR-xxx** = Non-Functional Requirements (from requirements.md)
- **F-xxx** = Roadmap Feature IDs (from roadmap-v2.md)
- **ADR-xxx** = Architecture Decision Records (from architecture-v3.1.md)
- **W-xxx** = Wireframe IDs (from ui-ux-design.md)
- **RISK-xxx** = Risk Register entries (this document, section 13)
- **M-xxx** = Milestones (this document, section 15)

### 1.4 FR-to-F Mapping

| FR Range | F Range | Domain |
|----------|---------|--------|
| FR-100 to FR-109 | F-001 to F-010 | Platform Foundation |
| FR-200 to FR-203 | F-011 to F-014 | AI Core Loop |
| FR-300 to FR-304 | F-015 to F-019 | AI Safety |
| FR-400 to FR-402 | F-020 to F-022 | AI Observability |
| FR-500 to FR-503 | F-023 to F-026 | Human Surfaces |
| FR-600 to FR-608 | F-027 to F-035 | R1 Intelligence |
| FR-700 to FR-702 | F-036 to F-038 | R1 Integrations |
| FR-800 to FR-802 | F-039 to F-041 | R1 Security |
| FR-900 to FR-904 | F-042 to F-046 | R1 SaaS Prep |
| FR-1000 to FR-1003 | F-047 to F-050 | R1 Enhanced Tasks |
| FR-1100 to FR-1102 | F-051 to F-053 | R1 Visualization |
| FR-1200 to FR-1205 | F-054 to F-059 | R2 Client Access |
| FR-1300 to FR-1302 | F-060 to F-062 | R2 Monetization |
| FR-1400 to FR-1403 | F-063 to F-066 | R2 Platform |
| FR-1500 to FR-1506 | F-067 to F-073 | R2 Enhanced AI |
| FR-1600 to FR-1604 | F-074 to F-078 | R3 Intelligence |
| FR-1700 to FR-1703 | F-079 to F-082 | R3 Productization |
| FR-1800 to FR-1803 | F-083 to F-086 | R3 Consultancy Moat |
| FR-1900 | F-087 | Kanban Board (promoted to R1) |
| FR-1901 | F-088 | Gantt Chart (promoted to R2) |
| FR-2000 to FR-2014 | F-089 to F-103 | ClickUp Gap Features (R0/R1/R2) |

---

## 2. Program Overview

### 2.1 Timeline Structure

The 12-month program is divided into 4 releases, each comprising 6 two-week sprints:

| Release | Months | Weeks | Sprints | Focus | Users |
|---------|--------|-------|---------|-------|-------|
| **R0** | 1-3 | 1-12 | R0-1 to R0-6 | Foundation + Core AI Loop | Internal team |
| **R1** | 4-6 | 13-24 | R1-1 to R1-6 | Intelligence + SaaS Prep | Internal + pilot client |
| **R2** | 7-9 | 25-36 | R2-1 to R2-6 | External Launch + Monetization | Internal + paying clients |
| **R3** | 10-12 | 37-48 | R3-1 to R3-6 | Platform + Scale | Scaled clients |

A **Pre-R0 Week 0** precedes the main program for architecture decisions and proof-of-concept validation.

### 2.2 Team Structure

| Role | Count | Primary Responsibilities |
|------|-------|-------------------------|
| Backend Engineers | 2 | Fastify API, PostgreSQL schema, NATS event bus, Drizzle ORM, integration adapters |
| AI/ML Engineers | 1-2 | Claude API integration, RAG pipeline, prompt engineering, evaluation harness, AI orchestrator |
| Fullstack Engineers | 1-2 | Next.js 15 App Router, React Server Components, Shadcn UI, TypeScript, client portal |
| DevOps/Infra Engineer | 1 | AWS CDK, ECS Fargate, CI/CD pipelines, monitoring, security infrastructure |
| **Total** | **5-7** | |

### 2.3 RACI Matrix

| Activity | Backend | AI/ML | Fullstack | DevOps | PM (Human) |
|----------|---------|-------|-----------|--------|------------|
| Schema design | R/A | C | I | I | I |
| API development | R/A | C | I | I | I |
| AI pipeline & orchestrator | C | R/A | I | I | I |
| Prompt engineering & eval | I | R/A | I | I | A |
| UI implementation | I | C | R/A | I | I |
| Client portal | I | I | R/A | I | I |
| Infrastructure provisioning | I | I | I | R/A | I |
| CI/CD pipeline | C | I | I | R/A | I |
| Integration adapters | R/A | I | C | I | I |
| Security & compliance | C | C | C | R/A | A |
| Testing | R | R | R | R | A |
| Release management | C | C | C | R/A | A |

**Legend:** R = Responsible, A = Accountable, C = Consulted, I = Informed

### 2.4 Working Agreements

- **Daily standups:** 15 min, async-first via Slack thread, synchronous only when blockers exist
- **Sprint planning:** 2 hours at sprint start, backlog groomed in advance
- **Sprint demo:** 1 hour at sprint end, all stakeholders
- **Retrospective:** 45 min at sprint end, action items tracked
- **PR reviews:** Required within 4 hours during business hours, 1 approval minimum
- **Architecture reviews:** Any change touching 3+ modules or introducing a new dependency requires team review

### 2.5 Definition of Done

Every work item must satisfy ALL of the following before marking complete:

- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Unit tests pass with 80%+ coverage on new/modified code
- [ ] Integration tests pass (where applicable)
- [ ] TypeScript strict mode — no `any` types, no type errors
- [ ] Documentation updated (API docs, inline JSDoc, README if new setup steps)
- [ ] Deployed to staging environment
- [ ] Security scan clean (no high/critical vulnerabilities)
- [ ] AI-generated code labeled with `@ai-gen` metadata tag
- [ ] Feature flag gated (if partial delivery)

---

## 3. Pre-R0: Week 0

**Duration:** 1 week (5 working days)
**Goal:** Validate architectural decisions, prove technical feasibility, and establish the development environment.

### 3.1 Architecture Decision Records

Finalize all 12 ADRs (ref: architecture-v3.1.md):

| ADR | Decision | Status |
|-----|----------|--------|
| ADR-001 | Hosted Claude API over self-hosted LLM | Sign off |
| ADR-002 | RAG with pgvector over prompt engineering only | Sign off |
| ADR-003 | NATS JetStream over Kafka/Redis Streams | Sign off |
| ADR-004 | Shared schema + RLS over schema-per-tenant | Sign off |
| ADR-005 | Hybrid pricing (subscription + AI metering) | Sign off |
| ADR-006 | PostgreSQL 16 + pgvector (single DB) | Sign off |
| ADR-007 | Fastify (Node.js + TypeScript) over NestJS/FastAPI | Sign off |
| ADR-008 | ECS Fargate over EKS (Kubernetes) | Sign off |
| ADR-009 | AWS CDK (TypeScript) over Terraform | Sign off |
| ADR-010 | Modular monolith, extract AI worker in R1 | Sign off |
| ADR-011 | Next.js 15 single app with route groups | Sign off |
| ADR-012 | CloudWatch + X-Ray + Sentry for observability | Sign off |

### 3.2 Proof-of-Concept Spikes

Three PoC spikes run in parallel, each with explicit exit criteria:

**PoC 1: Claude API — NL to WBS Generation**

- Objective: Validate that Claude Opus 4 can generate structured WBS from natural language project descriptions
- Method: 3 test project descriptions (software delivery, data migration, consultancy engagement), measure quality/latency/cost
- Exit criteria:
  - WBS output parseable to valid JSON schema (phases, tasks, dependencies, estimates)
  - p95 latency < 30 seconds
  - Cost per generation < $0.50
  - Output is domain-aware (not generic project management boilerplate)
- Owner: AI/ML Engineer
- Duration: 3 days

**PoC 2: NATS JetStream — Event Bus Validation**

- Objective: Validate NATS JetStream for persistent, replayable event streaming
- Method: Set up 3-node cluster locally, publish/consume events across 3 streams, verify persistence and replay
- Exit criteria:
  - Events persist across node restart
  - Consumer groups work (multiple consumers, each gets unique events)
  - Dead letter queue functional (failed events route after 3 retries)
  - Replay from sequence number works correctly
- Owner: Backend Engineer
- Duration: 2 days

**PoC 3: pgvector — Embedding Storage and Similarity Search**

- Objective: Validate pgvector for tenant-scoped embedding storage and retrieval
- Method: Store 1000 test embeddings (text-embedding-3-small, 1536 dimensions), perform similarity search with tenant_id filtering
- Exit criteria:
  - Similarity search with `tenant_id` filter returns relevant results (top-5 precision > 80%)
  - p95 search latency < 100ms at 1000 embeddings
  - IVFFlat index works correctly with tenant filtering
  - SQL JOINs between vector results and relational data execute correctly
- Owner: Backend Engineer + AI/ML Engineer
- Duration: 2 days

### 3.3 Development Environment Setup

- Docker Compose configuration for local development (PostgreSQL 16 + pgvector, Redis 7, NATS 2.10)
- Monorepo scaffold: Turborepo + pnpm workspaces (`apps/api`, `apps/web`, `packages/shared`, `packages/db`, `packages/prompts`)
- ESLint + Prettier configuration (TypeScript strict)
- Git repository initialized with branch protection rules
- `.env.example` with all required environment variables documented

### 3.4 Week 0 Exit Criteria

- [ ] All 3 PoCs pass their exit criteria
- [ ] All 12 ADRs reviewed and signed off by team
- [ ] Local dev environment documented and reproducible (`docker-compose up` -> all services running)
- [ ] Monorepo scaffold created with build/lint/type-check working
- [ ] GitHub Actions CI skeleton (lint + type-check) green on main branch

---

## 4. R0 (Months 1-3): Foundation + Core AI Loop — 6 Sprints

**Goal:** One workflow loop works end-to-end: describe project in NL, AI generates WBS, human reviews/approves, AI tells developers what to work on next, AI generates daily summary. (ref: roadmap-v2.md, R0)

**Success gate:** Is the internal team using NL project setup daily? Does the AI-generated WBS save measurable time vs manual creation? Are developers checking "what's next" from the AI instead of a spreadsheet?

**Feature count:** 28 features (F-001 through F-026 + F-089 Checklists + F-093 @Mentions), of which 17 are "Cannot Cut."

---

### Sprint R0-1 (Weeks 1-2): Infrastructure + Schema

**Features:** F-001 (FR-100), F-002 (FR-101), F-003 (FR-102)

**UI/UX References:** W-01 (App Shell wireframe — ui-ux-design.md, section 4.1)

**New Infrastructure:** NATS streams `pm.tasks`, `pm.projects`, `pm.comments`, `pm.ai`, `pm.integrations`, `pm.system` (6 of 12 initial streams)

**Work Items:**

| # | Work Item | Owner | Est. |
|---|-----------|-------|------|
| 1 | Docker Compose local dev: PostgreSQL 16 + pgvector, Redis 7-alpine, NATS 2.10-alpine with JetStream enabled | DevOps | 4h |
| 2 | Monorepo structure: `apps/api` (Fastify 5), `apps/web` (Next.js 15), `packages/shared` (types/validators), `packages/db` (Drizzle schema), `packages/prompts` (YAML templates) | Backend + DevOps | 8h |
| 3 | AWS CDK bootstrap: `VpcStack` (VPC, subnets, NAT Gateway, security groups), `DatabaseStack` (RDS PostgreSQL 16 + pgvector, `db.r6g.large`) | DevOps | 16h |
| 4 | Drizzle ORM schema — core tables: `tenants`, `users`, `projects`, `phases`, `tasks`, `task_assignments`, `task_dependencies`, `comments`, `audit_log` | Backend | 24h |
| 5 | `tenant_id` as first column in every composite index, UUID type, NOT NULL constraints | Backend | 4h |
| 6 | RLS policies on ALL tenant-scoped tables (ref: architecture-v3.1.md, Tier 6) | Backend | 8h |
| 7 | Soft delete support (`deleted_at` timestamp) on all user-facing entities | Backend | 4h |
| 8 | `ai_generated` boolean + `ai_confidence` float fields on tasks, comments, project fields | Backend | 2h |
| 9 | JSONB columns for WBS baseline snapshots, configurable fields, AI action metadata | Backend | 4h |
| 10 | Drizzle migration pipeline: `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:seed` | Backend | 8h |
| 11 | GitHub Actions CI skeleton: lint (ESLint), type-check (tsc --noEmit), unit test (Vitest) | DevOps | 8h |
| 12 | NATS JetStream cluster setup: 12 streams as defined in architecture-v3.1.md, Tier 5 (initial 6 streams active: pm.tasks, pm.projects, pm.comments, pm.ai, pm.integrations, pm.system) | Backend | 8h |

**Team Allocation:** Backend 100%, DevOps 100%, AI/ML ramp-up (reading codebase, prompt template drafting), Fullstack ramp-up (Next.js scaffold prep)

**Exit Criteria:**
- [ ] `docker-compose up` runs PostgreSQL + pgvector, Redis, NATS — all healthy
- [ ] Drizzle schema deploys with all core tables and RLS policies enforced
- [ ] `SELECT * FROM tasks` with wrong `app.current_tenant_id` returns 0 rows (RLS verified)
- [ ] CI pipeline green on main branch (lint + type-check + unit tests)
- [ ] NATS streams created and accepting published events

**Milestone:** M1 — Local dev environment running (Week 1)

---

### Sprint R0-2 (Weeks 3-4): Auth + Tasks + Events + Checklists

**Features:** F-004 (FR-103), F-005 (FR-104), F-006 (FR-105), F-007 (FR-106), F-008 (FR-107), F-089 (FR-2000)

**UI/UX References:** W-11 (Login wireframe — ui-ux-design.md, section 5.9)

**New Infrastructure:** Tables `task_checklists`, `checklist_items` (2 of 14 new tables)

**Work Items:**

| # | Work Item | Owner | Est. |
|---|-----------|-------|------|
| 1 | JWT authentication module (Fastify plugin): RS256 key pair, 1h access tokens, 30d refresh tokens with rotation | Backend | 16h |
| 2 | Password auth: bcrypt hashing/salting, password reset flow, session management | Backend | 12h |
| 3 | RBAC middleware: Admin + Developer roles, enforcement at route level, role from JWT claims | Backend | 12h |
| 4 | Session state in Redis: refresh tokens, active session tracking, concurrent session limits, forced logout | Backend | 8h |
| 5 | Task CRUD API: all fields (title, description, status, priority, assignee(s), start/due dates, estimated/actual effort, phase, `ai_generated`, `ai_confidence`) | Backend | 16h |
| 6 | Task assignments: junction table `task_assignments` with roles (assignee, reviewer, approver), multiple assignees per task | Backend | 8h |
| 7 | Task dependencies API: `blocked_by`/`blocks` relationships, circular dependency prevention via application-layer DAG traversal, dependency notes | Backend | 16h |
| 8 | Automatic blocked/unblocked status propagation on dependency resolution | Backend | 8h |
| 9 | Sub-tasks: single level of nesting, parent progress rollup, promote/demote between task and sub-task | Backend | 12h |
| 10 | Task checklists: `task_checklists` + `checklist_items` tables, CRUD API (`/api/v1/tasks/:id/checklists`, `/api/v1/checklists/:id/items`), inline checklist widget with progress bar, `pm.tasks.checklist_updated` event | Backend | 12h |
| 11 | NATS event producers on ALL mutations: `pm.tasks.created`, `.updated`, `.status_changed`, `.assigned`, `.completed`, `.dependency_resolved`, `.dependency_blocked`, `.checklist_updated` | Backend | 8h |
| 12 | Core NATS consumers: `audit-writer` (writes to `audit_log`), `embedding-pipeline` (placeholder — stores embedding jobs in Redis queue) | Backend | 12h |
| 13 | Next.js 15 scaffold: App Router structure, `(internal)` route group, Tailwind CSS + Shadcn UI setup, TypeScript strict | Fullstack | 16h |
| 14 | LLM Gateway skeleton: Anthropic SDK wrapper, model routing config, retry with exponential backoff, circuit breaker (5 failures -> 60s open) | AI/ML | 16h |

**Team Allocation:** Backend 100%, AI/ML 50% (LLM Gateway), Fullstack 50% (Next.js scaffold), DevOps 25% (CI improvements)

**Exit Criteria:**
- [ ] JWT auth works: register -> login -> receive tokens -> access protected endpoints -> refresh -> logout
- [ ] RBAC enforced: Developer cannot access Admin-only endpoints
- [ ] Task CRUD: create, read, update, delete (soft) with all fields
- [ ] Dependencies: create dependency -> verify blocked status -> resolve dependency -> verify unblocked propagation
- [ ] Sub-tasks: create under parent -> verify parent rollup
- [ ] Checklists: create checklist on task -> add items -> toggle completion -> verify progress bar data
- [ ] Events flowing: every mutation emits to NATS, `audit-writer` consumer writes to `audit_log`
- [ ] Next.js app renders at `localhost:3000` with Shadcn UI components

**Milestone:** M2 — Auth + CRUD complete (Week 4)

---

### Sprint R0-3 (Weeks 5-6): Audit + AI Foundation

**Features:** F-009 (FR-108), F-015 (FR-300), F-020 (FR-400)

**Work Items:**

| # | Work Item | Owner | Est. |
|---|-----------|-------|------|
| 1 | Audit trail implementation: INSERT-only `audit_log` table, field-level diffs (`entity_type`, `entity_id`, `field_name`, `old_value`, `new_value`), actor tracking (`actor_type`: user/ai/system/integration, `actor_id`, `ai_action_id` FK), timestamp | Backend | 16h |
| 2 | Audit consumer: `audit-writer` NATS consumer processes all mutation events, extracts field diffs, writes immutable records | Backend | 8h |
| 3 | Audit query API: filter by entity, actor, date range, field — read-only endpoint | Backend | 8h |
| 4 | AI Orchestrator skeleton: 7-stage pipeline (ref: architecture-v3.1.md, section 4), stages 1-2 (TRIGGER + AUTONOMY CHECK) functional, stages 3-7 stubbed | AI/ML | 24h |
| 5 | LLM Gateway completion: Claude API integration (Opus 4 + Sonnet 4.5), model routing logic, streaming support for interactive queries, rate limiting per tenant | AI/ML | 16h |
| 6 | Autonomy Policy Engine: policy schema (per-action-type, per-tenant), default policy "propose everything, execute nothing", shadow mode boolean per tenant per capability | AI/ML | 12h |
| 7 | pgvector setup: embedding pipeline consumer, `text-embedding-3-small` integration (1536 dimensions), IVFFlat index, tenant-scoped embedding storage | AI/ML + Backend | 16h |
| 8 | AI traceability: `ai_actions` table (`trigger_event`, `context_assembled`, `prompt_hash`, `model_output`, `confidence_score`, `disposition`, `human_review`, `rollback_data`), logging pipeline | AI/ML | 12h |
| 9 | Cost tracker: `ai_cost_log` table (input tokens, output tokens, USD cost, model, capability, tenant_id), Redis counters for real-time budget tracking, alerts at 80% and 100% of budget | AI/ML | 8h |
| 10 | Context Assembly Layer skeleton: loads tenant data, retrieves from pgvector (cosine similarity, top-k=10), aggregates recent events, selects prompt template, enforces token budget | AI/ML | 16h |

**Team Allocation:** Backend 50% audit + 50% AI support, AI/ML 100% on orchestrator + gateway + pgvector, Fullstack continues UI pages, DevOps maintains infrastructure

**Exit Criteria:**
- [ ] Audit trail captures all mutations with field-level diffs and correct actor attribution
- [ ] `audit_log` table has no UPDATE/DELETE grants (verified)
- [ ] AI Orchestrator processes a test request end-to-end (hardcoded test input -> 7 stages -> logged output)
- [ ] LLM Gateway successfully calls Claude Opus 4 and Claude Sonnet 4.5 with retry and circuit breaker
- [ ] Embeddings stored in pgvector for test tasks, similarity search returns relevant results with tenant filtering
- [ ] `ai_actions` table records every AI operation with full trace chain
- [ ] Cost tracker logs token usage and USD cost per AI operation

**Milestone:** M3 — AI Orchestrator functional (Week 6)

---

### Sprint R0-4 (Weeks 7-8): NL to WBS + What's Next

> **WARNING: MAKE-OR-BREAK SPRINT.** This sprint contains the core product feature (NL to WBS). 40%+ of R0 AI engineering effort is concentrated here. If this sprint slips, everything downstream slips. (ref: roadmap-v2.md, R0 Technical Risk — F-011)

**Features:** F-011 (FR-200), F-012 (FR-201), F-017 (FR-302)

**Work Items:**

| # | Work Item | Owner | Est. |
|---|-----------|-------|------|
| 1 | NL to WBS Generator: 5-stage sub-pipeline (ref: architecture-v3.1.md, section 4) | AI/ML | 40h |
| | — Stage 1: Domain detection (classify project description: software delivery, data migration, consultancy) | AI/ML | 8h |
| | — Stage 2: Template selection (load domain-specific prompt template from `/packages/prompts/wbs-generator/`) | AI/ML | 4h |
| | — Stage 3: RAG enrichment (retrieve similar past projects from pgvector, tenant-scoped) | AI/ML | 8h |
| | — Stage 4: Opus generation (Claude Opus 4, structured JSON output: phases, tasks, dependencies, estimates) | AI/ML | 12h |
| | — Stage 5: Schema validation (parse output, validate against WBS schema, reject malformed output) | AI/ML | 8h |
| 2 | Domain-specific prompt templates v1.0: software delivery, data migration, consultancy engagement (3 YAML files in `/packages/prompts/wbs-generator/`) | AI/ML | 16h |
| 3 | WBS API endpoint: `POST /api/projects/generate-wbs` — accepts NL description, returns WBS proposal | Backend | 8h |
| 4 | WBS approval flow: create `ai_action` with `status=proposed`, approve/reject/edit endpoints, on approval -> Task Module creates all tasks/phases/dependencies | Backend + AI/ML | 16h |
| 5 | WBS baseline snapshot: store approved WBS as JSONB in `projects.wbs_baseline` for scope creep detection in R1 | Backend | 4h |
| 6 | "What's Next" engine (rules-based, R0): per-developer task prioritization — dependency resolved -> due date -> priority -> assignment (ref: architecture-v3.1.md, section 4) | Backend | 16h |
| 7 | `/users/me/next` API endpoint: returns prioritized task list with explanations | Backend | 4h |
| 8 | Shadow mode implementation: all AI actions logged but not executed, admin dashboard to review accuracy | AI/ML | 8h |
| 9 | Golden test set v1: 10 project descriptions (3 software delivery, 3 data migration, 4 consultancy) with expected WBS structure | AI/ML | 12h |
| 10 | Prompt iteration: run golden test set, measure pass rate, iterate on prompts until >60% acceptance | AI/ML | 16h |

**Team Allocation:** AI/ML 100% (this is the sprint), Backend 50% supporting WBS API + What's Next, Fullstack continues UI, DevOps on standby

**Critical Flag:** 40%+ of R0 AI engineering effort is concentrated in this sprint. The AI/ML engineer(s) should have zero distractions. Backend engineers support API endpoints but do not pull AI/ML into non-AI work.

**Exit Criteria:**
- [ ] NL to WBS produces valid WBS for all 3 domain types (software delivery, data migration, consultancy)
- [ ] WBS output parseable to valid JSON schema (phases, tasks, dependencies, estimates)
- [ ] Golden test set pass rate > 60% (6 of 10 produce acceptable WBS)
- [ ] WBS approval flow works: propose -> review -> approve -> tasks/phases/dependencies created
- [ ] "What's Next" returns correctly prioritized task list (dependency order verified with test data)
- [ ] Shadow mode: all AI actions logged without execution when enabled
- [ ] p95 NL to WBS latency < 30 seconds
- [ ] Cost per WBS generation < $0.50

**Milestone:** M4 — NL to WBS demo-ready (Week 8)

---

### Sprint R0-5 (Weeks 9-10): UI + AI Safety

**Features:** F-016 (FR-301), F-018 (FR-303), F-019 (FR-304), F-023 (FR-500), F-024 (FR-501), F-025 (FR-502)

**UI/UX References:** W-01 (App Shell), W-03 (Dashboard/What's Next), W-04 (Project List), W-05 (Project Detail), W-06 (Task Detail), W-07 (Task List), W-08 (AI Review Panel), W-09 (NL Query Panel), W-10 (Settings/AI Policy) — ui-ux-design.md, sections 4.1, 5.1-5.8

**Work Items:**

| # | Work Item | Owner | Est. |
|---|-----------|-------|------|
| 1 | AI Review/Approve UI (W-08): high-density review screen for WBS proposals — approve, edit, reject per item, bulk approve/reject, keyboard shortcuts (a=approve, r=reject, e=edit, j/k=navigate) | Fullstack | 24h |
| 2 | Confidence thresholds UI: per-capability threshold display, graceful degradation when below threshold ("AI is not confident — please provide more detail"), visual confidence indicators | Fullstack + AI/ML | 12h |
| 3 | Rollback/revert: "undo last AI action" button on AI-generated items (full rollback deferred to R1 per F-019 cut line) | Fullstack + Backend | 8h |
| 4 | Task detail view (W-06): all fields, sub-tasks, dependencies (both directions), audit history timeline, comments, AI action history, checklists (F-089) | Fullstack | 16h |
| 5 | Project list view (W-04): filterable by status, sortable by name/date, project health indicator | Fullstack | 8h |
| 6 | Task list view (W-07): filterable by status/priority/assignee/phase, sortable by due date/priority/updated | Fullstack | 12h |
| 7 | "What's Next" developer view (W-03): personalized prioritized task list with AI explanations, one-click task action | Fullstack | 12h |
| 8 | Sidebar navigation (W-01): Dashboard (AI summary), Projects, Settings — active route highlighting, responsive, role-based visibility | Fullstack | 8h |
| 9 | NL project setup flow: text input -> loading state -> WBS review screen -> approve -> project created | Fullstack | 12h |
| 10 | Dashboard page (W-03): AI-generated daily summary, "What's Next" widget, recent activity | Fullstack | 8h |
| 11 | Confidence threshold configuration: per-capability defaults (0.6 for WBS, 0.7 for risk, 0.5 for summary), admin override | AI/ML | 4h |

**Team Allocation:** Fullstack 100%, AI/ML refining prompts based on UI testing, Backend supporting API endpoints for UI needs, DevOps on staging deployment

**Exit Criteria:**
- [ ] End-to-end flow works in UI: describe project -> see WBS -> approve -> see tasks -> see "What's Next"
- [ ] AI Review/Approve screen handles 50+ items with bulk actions and keyboard shortcuts
- [ ] Confidence indicators visible on all AI-generated content
- [ ] "Undo last AI action" works for WBS approval
- [ ] Task detail view shows all fields, dependencies, audit history, comments, checklists
- [ ] Sidebar navigation with Dashboard, Projects, Settings — responsive on mobile
- [ ] All views accessible via keyboard navigation

**Milestone:** M5 — R0 UI complete (Week 10)

---

### Sprint R0-6 (Weeks 11-12): NL Query + Summary + Polish

**Features:** F-010 (FR-109), F-013 (FR-202), F-014 (FR-203), F-021 (FR-401), F-022 (FR-402), F-026 (FR-503), F-093 (FR-2004)

**UI/UX References:** W-09 (NL Query Panel — ui-ux-design.md, section 5.7)

**New Infrastructure:** Table `mentions` (1 of 14 new tables)

**Work Items:**

| # | Work Item | Owner | Est. |
|---|-----------|-------|------|
| 1 | NL Query engine: RAG retrieval from pgvector (tenant-scoped) -> context assembly -> Claude Sonnet 4.5 synthesis -> natural language response (ref: architecture-v3.1.md, section 4) | AI/ML | 20h |
| 2 | NL Query UI (W-09): text input panel, streaming response display, query history | Fullstack | 12h |
| 3 | Daily summary generation: event-driven consumer processes `pm.tasks.*` and `pm.projects.*` events, generates end-of-day summary via Claude Sonnet 4.5 | AI/ML | 12h |
| 4 | Summary display: dashboard widget with daily/weekly toggle | Fullstack | 4h |
| 5 | Admin-configurable values: status labels, priority levels via admin UI, stored in tenant config (ref: F-010 — basic implementation, not full phase templates) | Backend + Fullstack | 12h |
| 6 | AI evaluation harness v1: manual review workflow + golden test set CI integration — run on every prompt template change, track acceptance rate | AI/ML | 12h |
| 7 | Runtime monitoring: basic CloudWatch metrics (API latency, error rate, AI operation latency/cost) + Sentry integration (frontend + backend error tracking) | DevOps | 12h |
| 8 | CloudWatch alarms: circuit breaker open, AI failure rate >10%, p95 API latency >2s, any 5xx spike | DevOps | 4h |
| 9 | Comment system: add/view comments on tasks, `client_visible` boolean field, comments feed embedding pipeline | Backend + Fullstack | 8h |
| 10 | @Mentions (F-093): `mentions` table, @-autocomplete dropdown in comment input, `pm.comments.mention_created` event, GET `/api/v1/users/me/mentions` endpoint | Backend + Fullstack | 8h |
| 11 | Staging environment deployment: full CDK deploy to AWS staging (mirrors prod topology) | DevOps | 16h |
| 12 | R0 Quality Gate execution: full regression test, security scan, performance baseline measurement | All | 16h |
| 13 | Documentation: API docs, dev setup guide, runbook for common operations | All | 8h |

**Team Allocation:** All hands on polish and quality. AI/ML on NL Query + eval harness, Fullstack on UI polish + comment system, Backend on config service + comment API, DevOps on staging + monitoring.

**Exit Criteria:**
- [ ] NL Query works: ask "what's blocked right now?" -> get accurate answer from project data
- [ ] Daily summary generated for active projects
- [ ] Admin can configure status labels and priority levels
- [ ] Golden test set runs in CI, pass rate >60%
- [ ] CloudWatch metrics and Sentry capturing errors
- [ ] Comments can be added and viewed on tasks
- [ ] @Mentions: type @ -> see autocomplete -> select user -> mention saved -> appears in `/users/me/mentions`
- [ ] R0 Quality Gate passes (see section 14.1)

**Milestone:** M6 — R0 Release (Week 12)

---

### R0 Cut Line

If behind schedule at month 2, protect these features at all costs:

**PROTECT (Cannot Cut):**
- F-011 / FR-200 — NL to WBS Generator
- F-012 / FR-201 — "What's Next" Engine
- F-015 / FR-300 — Autonomy Policy Engine
- F-016 / FR-301 — AI Review/Approve Interface
- F-017 / FR-302 — Shadow Mode
- F-018 / FR-303 — Confidence Thresholds
- F-020 / FR-400 — AI Traceability Pipeline
- F-089 / FR-2000 — Task Checklists
- F-093 / FR-2004 — @Mentions

**CAN CUT (ship reduced or defer):**
- F-010 / FR-109 — Admin-configurable values (use hardcoded defaults)
- F-013 / FR-202 — Daily summaries (manual summaries)
- F-014 / FR-203 — NL Query (defer to R1)
- F-019 / FR-304 — Rollback (manual rollback only)
- F-021 / FR-401 — Evaluation harness (manual eval only)
- F-022 / FR-402 — Runtime monitoring (basic logging only)
- F-024 / FR-501 — Task list view (minimal list)
- F-026 / FR-503 — Comments (add-only, no edit/delete)

---

## 5. R1 (Months 4-6): Intelligence + SaaS Prep — 6 Sprints

**Goal:** The AI stops assisting and starts operating. Cross-project intelligence. Integrations bring passive signal. SaaS infrastructure is ready for external users. (ref: roadmap-v2.md, R1)

**Success gate:** AI PM agent actively chasing updates via Slack. Risk predictions >70% accuracy. Cross-project dependencies surfaced. Status reports generated without human editing.

**Feature count:** 36 features (F-027 through F-053 minus F-048 deferred to R2, plus F-087 Kanban promoted, F-076a Templates basic, F-090 Recurring, F-091 Calendar View, F-092 Table View, F-094 Custom Fields, F-096 Notifications, F-097 Action Items, F-103 Reminders)

---

### Sprint R1-1 (Weeks 13-14): Git + Slack Integration

**Features:** F-036 (FR-700), F-037 (FR-701)

**Work Items:**

| # | Work Item | Owner | Est. |
|---|-----------|-------|------|
| 1 | Git adapter (GitHub): webhook endpoint for `push`, `pull_request` events, signature verification (HMAC-SHA256) | Backend | 12h |
| 2 | Commit/PR to task linking: branch naming convention parser + commit message parser, `task_id` extraction | Backend | 8h |
| 3 | Auto-complete on merge: when PR merges and linked to task, propose task completion (respects autonomy policy) | Backend + AI/ML | 8h |
| 4 | Git events to NATS: `pm.integrations.git_commit`, `pm.integrations.git_pr_merged` subjects | Backend | 4h |
| 5 | Slack adapter: OAuth 2.0 flow, app installation, Slack Bolt SDK integration | Backend | 12h |
| 6 | Slash commands: `/aipm status [project]`, `/aipm next`, `/aipm query [question]` | Backend | 12h |
| 7 | Outbound notifications: task assignments, status changes, AI proposals -> Slack channel/DM | Backend | 8h |
| 8 | Slack events to NATS: `pm.integrations.slack_message` subject | Backend | 4h |
| 9 | Integration configuration UI: connect/disconnect GitHub/Slack, webhook status, activity log | Fullstack | 8h |

**Team Allocation:** Backend 100% on integrations, Fullstack 50% on integration UI + 50% on R0 polish items, AI/ML preparing R1-2 adaptive engine, DevOps supporting webhook infrastructure

**Exit Criteria:**
- [ ] GitHub webhook receives push/PR events, links commits to tasks
- [ ] Auto-complete on merge creates AI proposal (not auto-executed)
- [ ] Slack app installed, slash commands respond correctly
- [ ] Outbound Slack notifications delivered for task events
- [ ] Integration events flowing through NATS

**Milestone:** M7 — Git + Slack live (Week 14)

---

### Sprint R1-2 (Weeks 15-16): AI PM Agent + Adaptive Engine

**Features:** F-027 (FR-600), F-028 (FR-601), F-033 (FR-606)

**Work Items:**

| # | Work Item | Owner | Est. |
|---|-----------|-------|------|
| 1 | Adaptive task engine: upgrade "What's Next" from rules-based to data-driven using velocity data (actual vs estimated effort, completion rate by developer) | AI/ML | 20h |
| 2 | AI PM Agent: autonomous async agent on 15-min loop (BullMQ recurring job on ECS), queries overdue tasks, stalled tasks (no change >48h), newly unblocked tasks | AI/ML | 24h |
| 3 | AI PM Agent delivery: Slack DM nudges with contextual messages via Claude Sonnet 4.5, quiet hours enforcement (configurable per tenant), nudge limits (max 2/task/day) | AI/ML + Backend | 16h |
| 4 | Auto-escalation workflows: configurable thresholds per project (e.g., blocker unresolved >24h -> escalate to PM), escalation creates AI proposal for review | AI/ML | 12h |
| 5 | AI Worker extraction: separate ECS service (`apps/ai-worker`) for async AI processing — agent loop, NATS consumers for AI, scheduled jobs (ref: architecture-v3.1.md, ADR-010) | DevOps + AI/ML | 16h |
| 6 | Agent configuration UI: enable/disable per project, quiet hours, nudge limits, escalation thresholds | Fullstack | 8h |

**Team Allocation:** AI/ML 100%, Backend 50% supporting agent infrastructure, Fullstack on agent configuration UI, DevOps on AI Worker ECS service

**Exit Criteria:**
- [ ] Adaptive task engine uses velocity data (verified with test data showing different prioritization than rules-based)
- [ ] AI PM Agent sends nudges via Slack DM for overdue/stalled tasks
- [ ] Quiet hours respected (no nudges outside configured hours)
- [ ] Nudge limit enforced (max 2/task/day)
- [ ] Auto-escalation creates proposals when thresholds exceeded
- [ ] AI Worker running as separate ECS service

**Milestone:** M8 — AI PM Agent active (Week 16)

---

### Sprint R1-3 (Weeks 17-18): Risk + Scope Creep + Decision Log

**Features:** F-029 (FR-602), F-030 (FR-603), F-034 (FR-607), F-035 (FR-608)

**Work Items:**

| # | Work Item | Owner | Est. |
|---|-----------|-------|------|
| 1 | Risk predictor: pattern analysis (blocker duration, stalled tasks, dependency chain growth, scope drift vs baseline) via Claude Opus 4 — shadow mode for first 2-4 weeks | AI/ML | 24h |
| 2 | Risk flags: confidence scores, suggested mitigations, severity levels (low/medium/high/critical) | AI/ML | 8h |
| 3 | Scope creep detector: monitors task additions vs original WBS baseline (JSONB snapshot), calculates scope delta percentage, alerts when drift >15% | AI/ML | 16h |
| 4 | Auto-generated status reports (full): weekly/on-demand, RAG status calculated from real task data (completion rates, velocity, blockers, risks) | AI/ML | 12h |
| 5 | AI decision log (full): every AI action explainable, queryable log with filter by capability/project/date/disposition, "Why did it flag this?" always answered | AI/ML + Backend | 12h |
| 6 | Risk dashboard UI: risk flags per project, scope creep indicator, trending risk visualization | Fullstack | 12h |
| 7 | Status report UI: generated report view, edit before sending, schedule configuration | Fullstack | 8h |
| 8 | Decision log UI: searchable/filterable log of all AI decisions, overrides, and explanations | Fullstack | 8h |

**Team Allocation:** AI/ML 100%, Backend supporting data access, Fullstack on risk/report/decision UIs

**Exit Criteria:**
- [ ] Risk predictor generates risk flags in shadow mode (not visible to non-admins)
- [ ] Scope creep detector calculates delta against WBS baseline
- [ ] Status reports generated from real task data, editable before distribution
- [ ] Decision log queryable: filter by capability, project, date, disposition
- [ ] All risk predictions include confidence scores and suggested mitigations

**Milestone:** M9 — Risk prediction shadow (Week 18)

---

### Sprint R1-4 (Weeks 19-20): Security + SaaS Infrastructure

**Features:** F-039 (FR-800), F-040 (FR-801), F-041 (FR-802), F-044 (FR-902), F-045 (FR-903), F-046 (FR-904)

**Work Items:**

| # | Work Item | Owner | Est. |
|---|-----------|-------|------|
| 1 | SSO integration: SAML via `passport-saml`, OIDC via `openid-client`, support Google Workspace + Microsoft Entra ID + Okta | Backend | 24h |
| 2 | MFA: TOTP (authenticator app) via `otplib`, optional per user, admin-enforceable per role | Backend | 12h |
| 3 | Session hardening: configurable token expiry, refresh token rotation, concurrent session limits, forced logout | Backend | 8h |
| 4 | Tenant plan + feature flags: `tenant_plans` table, plan definitions (internal, beta, starter, pro), feature gating middleware | Backend | 12h |
| 5 | Usage metering: AI operations counter per tenant per feature, stored in Redis + persisted to `ai_usage_log` | Backend | 8h |
| 6 | SOC 2 controls: access control documentation, change management (GitOps), data encryption verification, retention policies, incident response procedures | DevOps + Backend | 20h |
| 7 | AI cost tracking live: per-tenant cost dashboards, rate limiting enforced per tenant, cost alerts at 80%/100% of budget | AI/ML + Backend | 8h |
| 8 | Security UI: SSO configuration, MFA setup, session management admin panel | Fullstack | 12h |

**Team Allocation:** Backend 80% on security + SaaS infra, DevOps on SOC 2, Fullstack on security UI, AI/ML on cost tracking

**Exit Criteria:**
- [ ] SSO works with at least 1 provider (Google Workspace or Microsoft Entra ID)
- [ ] MFA (TOTP) can be enabled per user, enforced per role by admin
- [ ] Feature flags gate features per tenant plan
- [ ] Usage metering accurate: AI operations counted per tenant
- [ ] SOC 2 controls documented with evidence collection process
- [ ] AI cost tracking per tenant functional with alerts

**Milestone:** M10 — SaaS infrastructure ready (Week 20)

---

### Sprint R1-5 (Weeks 21-22): Data Model Extensions + Client Projection

**Features:** F-042 (FR-900), F-043 (FR-901), F-047 (FR-1000), F-094 (FR-2005), F-090 (FR-2001), F-097 (FR-2008), F-103 (FR-2014)

> **Trade-offs:** F-048 (Bulk CSV Import) deferred to R2 — not needed until external onboarding. F-038 (Calendar Integration) deferred to R2 — Calendar *view* ships R1 (F-091), but external calendar *sync* moves to R2.

**UI/UX References:** W-19 (Client Portal — ui-ux-design.md, section 7.1)

**New Infrastructure:** Tables `custom_field_definitions`, `custom_field_values`, `reminders` (3 of 14 new tables). NATS stream `pm.reminders` activated. Consumer `recurrence-scheduler` deployed.

**Work Items:**

| # | Work Item | Owner | Est. |
|---|-----------|-------|------|
| 1 | Client projection data model: internal vs external task/workstream classification, field-level redaction rules, `client_visible` boolean enforcement at data layer, "client-facing narrative objects" schema | Backend | 20h |
| 2 | Projection module: internal truth -> client-safe view transformation, approval workflow for client-facing content (ref: architecture-v3.1.md, Tier 3 — Projection Module) | Backend | 16h |
| 3 | Basic read-only client view (pilot): minimal page showing milestones, completion percentage, AI-generated summary — scoped to 1-2 internal projects shared with trusted client contact | Fullstack | 16h |
| 4 | Custom field definitions + values: `custom_field_definitions` + `custom_field_values` tables, CRUD API, field types (text, number, date, select, multi_select, URL, email, checkbox), inline display in task detail + table views, `pm.tasks.custom_field_updated` event | Backend + Fullstack | 16h |
| 5 | Recurring tasks (F-090): `recurrence_rule` (iCal RRULE), `recurrence_parent_id`, `next_recurrence_at` columns on tasks, `recurrence-scheduler` NATS consumer, clone logic, `pm.tasks.recurrence_triggered` event | Backend | 12h |
| 6 | Assigned comments / action items (F-097): `assigned_to`, `is_action_item`, `action_status` columns on comments, PATCH `/api/v1/comments/:id/assign`, GET `/api/v1/users/me/action-items`, `pm.comments.action_assigned` event | Backend | 8h |
| 7 | Task reminders (F-103): `reminders` table, POST/GET/DELETE API, pg_cron scheduler (1-min interval), `pm.reminders.due` event, notification delivery | Backend | 8h |
| 8 | Default + custom tags (F-047): project/tenant-scoped tags with name/color, admin CRUD, tag assignment on tasks | Backend + Fullstack | 8h |

**Team Allocation:** Backend 80% on projection + data model extensions, Fullstack on client view + custom field UI, AI/ML refining risk predictor based on shadow mode data

**Exit Criteria:**
- [ ] Projection module transforms internal data to client-safe view (verified: no internal fields leak)
- [ ] Client pilot view renders for 1-2 test projects with milestones and AI summary
- [ ] Custom fields: create definitions, set values on tasks, filter by custom field
- [ ] Recurring tasks: configure recurrence -> instance auto-created on schedule
- [ ] Action items: assign comment -> appears in "What's Next" and action items list
- [ ] Reminders: set reminder -> notification delivered at scheduled time
- [ ] Tags assignable to tasks, filterable in list views

**Milestone:** M11 — Client projection + data model extensions (Week 22)

---

### Sprint R1-6 (Weeks 23-24): Views + Visualization + Notifications + Quality Gate

**Features:** F-091 (FR-2002), F-092 (FR-2003), F-087 (FR-1900), F-096 (FR-2007), F-076a (Templates basic), F-031 (FR-604), F-032 (FR-605), F-049 (FR-1002), F-050 (FR-1003), F-051 (FR-1100), F-052 (FR-1101), F-053 (FR-1102)

**UI/UX References:** W-12 (Kanban Board — section 6.1), W-13 (Calendar View — section 6.2), W-14 (Table View — section 6.3), W-15 (AI-Annotated Timeline — section 6.4), W-16 (Portfolio Dashboard — section 6.5), W-17 (Notification Inbox — section 6.6), W-18 (Dependency Graph — section 6.7) — all from ui-ux-design.md

**New Infrastructure:** Tables `saved_views`, `notifications`, `notification_preferences` (3 of 14 new tables). NATS stream `pm.notifications` activated. Consumer `notification-generator` deployed.

**Work Items:**

| # | Work Item | Owner | Est. |
|---|-----------|-------|------|
| 1 | Calendar view (W-13): month/week/day grid, tasks as colored chips on due date, drag to reschedule, view toggle integration | Fullstack | 12h |
| 2 | Table view (W-14): spreadsheet-like grid, inline editing, column resize/reorder/hide, `saved_views` table + CRUD API | Fullstack + Backend | 16h |
| 3 | Read-only Kanban board (W-12): tasks in status columns, AI annotations (blocked/priority/stalled), view toggle integration | Fullstack | 12h |
| 4 | Smart notification system (W-17): `notifications` + `notification_preferences` tables, `notification-generator` NATS consumer, bell icon + dropdown, filter by type, mark read, preferences API | Backend + Fullstack | 16h |
| 5 | Basic templates (F-076a, CRUD): create project template from existing project, create project from template, template list/edit/delete | Backend + Fullstack | 8h |
| 6 | Cross-project dependency mapping (F-031): AI identifies where Project A blocks Project B, surfaces in dashboards and NL queries | AI/ML + Backend | 12h |
| 7 | Resource optimization engine (F-032): workload balancing across projects, burnout risk flags, reallocation suggestions | AI/ML | 12h |
| 8 | Full-text search (F-049): `tsvector` columns on tasks/projects/comments, GIN indexes, search API with permission scoping | Backend | 8h |
| 9 | Advanced filtering + sorting (F-050): filter by any combination (status, priority, assignee, phase, date range, tags, custom fields), saveable filter views | Backend + Fullstack | 12h |
| 10 | Dependency chain visualization (W-18): upstream/downstream graph from any task, critical path highlighted, click-through navigation | Fullstack | 16h |
| 11 | AI-annotated timeline view (W-15): tasks on time axis with AI overlays (predicted delays, at-risk milestones, resource conflicts) | Fullstack | 16h |
| 12 | Portfolio dashboard (W-16): cross-project admin view with AI curation (projects at risk, resource conflicts, blocked dependencies, delivery confidence) | Fullstack | 12h |
| 13 | WebSocket gateway: Socket.io on Fastify, real-time task board updates, comment streams, AI decision notifications | Backend | 12h |
| 14 | R1 Quality Gate execution: full regression, security scan, performance test, AI quality metrics review | All | 16h |

**Team Allocation:** All hands on views, notifications, visualization, polish, and quality gate.

**Exit Criteria:**
- [ ] Calendar view renders tasks by due date with month/week/day modes
- [ ] Table view supports inline editing, column customization, saved views
- [ ] Kanban board renders tasks in status columns with AI annotations
- [ ] Smart notification system: bell icon with unread count, filterable inbox, user preferences
- [ ] Basic project templates: create from project, create project from template
- [ ] Cross-project dependencies visible in portfolio dashboard
- [ ] Resource optimization suggestions generated for overallocated developers
- [ ] Search works across tasks, projects, comments (permission-scoped)
- [ ] Dependency visualization renders upstream/downstream graph
- [ ] Timeline view shows AI overlays (predicted delays)
- [ ] WebSocket delivers real-time updates
- [ ] R1 Quality Gate passes (see section 14.2)

**Milestone:** M12 — R1 Release (Week 24)

---

### R1 Cut Line

**PROTECT:**
- F-027 to F-035 / FR-600 to FR-608 — AI operations core (adaptive engine, PM agent, risk, scope creep, reports, decision log)
- F-036, F-037 / FR-700, FR-701 — Git + Slack integrations (critical signal sources)
- F-042, F-043 / FR-900, FR-901 — Client projection layer + pilot view (R2 dependency)
- F-044 to F-046 / FR-902 to FR-904 — SaaS infrastructure (feature flags, SOC 2, cost tracking)
- F-087 / FR-1900 — Kanban board view (promoted, table-stakes)
- F-091 / FR-2002 — Calendar view (table-stakes)
- F-092 / FR-2003 — Table view (table-stakes)
- F-094 / FR-2005 — Custom fields (table-stakes)
- F-096 / FR-2007 — Smart notification system (table-stakes)

**CAN CUT (defer to R2):**
- F-047 / FR-1000 — Tags
- F-049 / FR-1002 — Search
- F-050 / FR-1003 — Advanced filters
- F-051 to F-053 / FR-1100 to FR-1102 — Visualizations (dependency graph, timeline, portfolio dashboard)
- F-090 / FR-2001 — Recurring tasks
- F-097 / FR-2008 — Action items
- F-103 / FR-2014 — Reminders
- F-076a — Basic templates

**ALREADY DEFERRED TO R2:**
- F-048 / FR-1001 — Bulk CSV Import (not needed until external onboarding)
- F-038 / FR-702 — Calendar Integration (external sync — calendar *view* ships R1)

---

## 6. R2 (Months 7-9): External Launch — 6 Sprints

**Goal:** Clients access the product. Multi-tenancy is live. The AI curates what clients see. You have paying users. (ref: roadmap-v2.md, R2)

**Success gate:** 3+ paying client tenants active. Client NPS >40. Client portal questions answered by AI >60% without human intervention. SOC 2 Type I audit initiated.

**Feature count:** 27 features (F-054 through F-073 + F-088 Gantt promoted + F-048 Bulk Import deferred from R1 + F-038 Calendar Integration deferred from R1 + F-095 Goals + F-098 Automations + F-099 Forms + F-100 Formulas + F-101 Docs + F-102 AI Writing)

---

### Sprint R2-1 (Weeks 25-26): Multi-Tenancy + Portal Foundation

**Features:** F-054 (FR-1200), F-055 (FR-1201), F-056 (FR-1202)

**UI/UX References:** W-19 (Client Portal — ui-ux-design.md, section 7.1)

**Work Items:**

| # | Work Item | Owner | Est. |
|---|-----------|-------|------|
| 1 | Multi-tenancy live: tenant creation API, tenant switching for internal admins, data isolation verification test suite | Backend | 16h |
| 2 | Tenant onboarding flow: create tenant -> invite admin -> configure settings -> ready | Backend + Fullstack | 12h |
| 3 | Client portal: `(portal)` route group in Next.js, white-label configuration per tenant (logo, colors, domain), projection layer consumption | Fullstack | 24h |
| 4 | Client portal views: milestone progress, AI-generated summaries, delivery confidence, risk flags (framed appropriately through projection layer) | Fullstack | 16h |
| 5 | Client role + permissions: RBAC extension — clients scoped to own portal, can view status/roadmaps/AI updates, can comment/approve deliverables, cannot modify tasks/assignments/structure | Backend | 12h |
| 6 | Cross-tenant isolation test suite: automated tests attempting cross-tenant data access at DB, API, and AI levels — all must fail | Backend + DevOps | 8h |

**Team Allocation:** Backend 60% on multi-tenancy + client role, Fullstack 100% on client portal, DevOps on isolation testing, AI/ML on AI guardrails prep

**Exit Criteria:**
- [ ] Multiple tenants created with isolated data (verified by cross-tenant test suite)
- [ ] Tenant switching works for internal admins
- [ ] Client portal renders white-labeled view consuming projection layer
- [ ] Client role enforced: client users cannot access internal data or modify tasks
- [ ] Cross-tenant isolation test suite passes (0 cross-tenant data leaks)

---

### Sprint R2-2 (Weeks 27-28): Client Reporting + Onboarding

**Features:** F-057 (FR-1203), F-058 (FR-1204), F-059 (FR-1205)

**Work Items:**

| # | Work Item | Owner | Est. |
|---|-----------|-------|------|
| 1 | Automated client reporting: AI generates client-ready progress updates on configurable schedule (weekly/biweekly), consumes projection layer, configurable tone/detail per client | AI/ML | 16h |
| 2 | Report approval workflow: PM reviews AI-generated report -> approve/edit -> deliver to client portal/email | Backend + Fullstack | 12h |
| 3 | Self-service client onboarding: invite link -> account creation -> portal landing -> AI guided walkthrough | Fullstack | 12h |
| 4 | Client-facing AI assistant: NL query scoped to client permissions, answers from projected data only, human-in-the-loop filter for sensitive content (confidence < 0.8 or risk-related -> flag for PM review before delivery) (ref: architecture-v3.1.md, Cross-Cutting Pattern 3) | AI/ML | 20h |
| 5 | Client AI assistant UI: chat-style interface in portal, streaming responses, query history | Fullstack | 12h |

**Team Allocation:** AI/ML on client reporting + AI assistant, Fullstack on portal UX + onboarding, Backend supporting approval workflow

**Exit Criteria:**
- [ ] Automated reports generated on schedule, consuming only projected data
- [ ] PM can review/edit/approve reports before client delivery
- [ ] Client self-service onboarding works end-to-end (invite -> account -> portal)
- [ ] Client AI assistant answers questions from projected data, flags sensitive content for PM review
- [ ] No internal data leaks through client AI assistant (verified with adversarial test queries)

**Milestone:** M13 — Client portal live (Week 28)

---

### Sprint R2-3 (Weeks 29-30): Monetization

**Features:** F-060 (FR-1300), F-061 (FR-1301), F-062 (FR-1302)

**Work Items:**

| # | Work Item | Owner | Est. |
|---|-----------|-------|------|
| 1 | Tiered pricing: Starter (basic tracking, limited AI — 500 ops/mo) and Pro (full AI operations — 2000 ops/mo), feature gating enforced via tenant plan + feature flags (F-044) | Backend | 16h |
| 2 | Usage metering dashboard: per-tenant AI operations count, cost breakdown by capability, included tier usage vs overage | Backend + Fullstack | 12h |
| 3 | AI cost management live: per-tenant cost dashboards, rate limiting enforced at plan tier, cost alerts, token budget allocation per operation type, margin tracking per tenant | AI/ML + Backend | 12h |
| 4 | Billing integration: Stripe (or manual invoicing v1) for subscription + overage billing | Backend | 12h |
| 5 | Data export: CSV/JSON export of project data (tasks, history, reports) — full data portability per client | Backend + Fullstack | 8h |

**Team Allocation:** Backend 80% on billing + metering, Fullstack on dashboards + export UI, AI/ML on cost management

**Exit Criteria:**
- [ ] Starter and Pro tiers enforced: feature gating + AI operation limits
- [ ] Usage metering accurate: AI operations counted correctly per tenant per capability
- [ ] Billing: subscription charges + overage billing functional
- [ ] Data export: client can export all their project data in CSV/JSON
- [ ] Margin tracking: per-tenant cost vs revenue visible to admins

---

### Sprint R2-4 (Weeks 31-32): Platform Security

**Features:** F-063 (FR-1400), F-064 (FR-1401), F-065 (FR-1402), F-066 (FR-1403)

**Work Items:**

| # | Work Item | Owner | Est. |
|---|-----------|-------|------|
| 1 | Public REST API v1: versioned `/api/v1/` endpoints for projects, tasks, status, comments — API key management, rate limiting, cursor-based pagination, OpenAPI 3.1 documentation | Backend | 24h |
| 2 | Webhook system: tenant-configurable subscriptions for key events (task completed, status changed, milestone reached, risk flagged), retry with exponential backoff, HMAC-SHA256 signature verification | Backend | 16h |
| 3 | SOC 2 Type I audit initiation: controls documentation complete, evidence collection automated (AWS Config + custom checks), formal audit engagement with auditor | DevOps | 16h |
| 4 | AI guardrails for multi-tenant: PII handling (redaction before LLM ingestion, configurable per-project regex patterns), prompt injection defense (input sanitization, output validation against expected schema), cross-tenant AI context verification | AI/ML + Backend | 20h |
| 5 | Penetration testing: auth bypass attempts, RLS bypass attempts, prompt injection attacks, cross-tenant data access attempts | DevOps + Backend | 12h |

**Team Allocation:** Backend 70% on API + webhooks, DevOps on SOC 2 + pen testing, AI/ML on AI guardrails

**Exit Criteria:**
- [ ] Public API v1 functional with API key auth, rate limiting, OpenAPI docs
- [ ] Webhooks delivered with retry and signature verification
- [ ] SOC 2 Type I audit formally initiated with auditor
- [ ] PII redaction verified: no PII in LLM prompts (tested with known PII inputs)
- [ ] Prompt injection defense: adversarial inputs blocked (tested with injection test suite)
- [ ] Cross-tenant AI context verified: AI operations contain only current tenant's data

---

### Sprint R2-5 (Weeks 33-34): Enhanced AI + Gap Features

**Features:** F-067 (FR-1500), F-068 (FR-1501), F-069 (FR-1502), F-070 (FR-1503), F-071 (FR-1504), F-095 (FR-2006), F-098 (FR-2009), F-088 (FR-1901)

**UI/UX References:** W-20 (Goals & OKR Dashboard — ui-ux-design.md, section 7.2), W-21 (Gantt Chart — ui-ux-design.md, section 7.3)

**New Infrastructure:** Tables `goals`, `goal_task_links`, `automation_rules` (3 of 14 new tables). NATS streams `pm.goals`, `pm.automations` activated. Consumer `automation-engine` deployed.

**Work Items:**

| # | Work Item | Owner | Est. |
|---|-----------|-------|------|
| 1 | Predictive delivery dating: "You're trending 8 days late on this milestone, here are 3 recovery options" — internal view + client-facing version filtered through projection layer | AI/ML | 16h |
| 2 | AI meeting prep + follow-up: auto-agenda from project state before meetings, action item extraction from meeting notes -> task creation/updates | AI/ML | 16h |
| 3 | Scenario planning: "What if we lose a developer for 2 weeks?" — AI models timeline impact and shows recovery options | AI/ML | 16h |
| 4 | AI sprint planning: AI suggests sprint scope from velocity + capacity data, flags overcommitment, human reviews and adjusts | AI/ML | 12h |
| 5 | Custom AI rules per project: per-project escalation thresholds, notification preferences, risk sensitivity configuration | Backend + Fullstack | 8h |
| 6 | Goals & OKRs (W-20): `goals` + `goal_task_links` tables, CRUD API, goal tree view, auto-calculated progress from linked tasks, `pm.goals.progress_updated` + `pm.goals.at_risk` events, goals sidebar nav item | Backend + Fullstack | 16h |
| 7 | Custom automations: `automation_rules` table, `automation-engine` NATS consumer, CRUD API + execution logs, automation builder UI (Settings > Automations) | Backend + Fullstack | 16h |
| 8 | Gantt chart view (W-21, promoted from R3): AI overlays (predicted delays, critical path, at-risk milestones), zoom levels (day/week/month), view toggle integration | Fullstack | 16h |
| 9 | Enhanced AI UI: delivery predictions in timeline view, meeting prep panel, scenario planning interface, sprint planning wizard | Fullstack | 16h |

**Team Allocation:** AI/ML 100% on enhanced AI capabilities, Fullstack on AI feature UIs + Gantt + goals, Backend on automations + goals

**Exit Criteria:**
- [ ] Delivery predictions generated for active milestones with recovery options
- [ ] Meeting prep auto-generates agenda from project state
- [ ] Scenario planning models impact of resource changes
- [ ] Sprint planning suggests scope with overcommitment warnings
- [ ] Custom AI rules configurable per project
- [ ] Goals: create -> link tasks -> auto-progress tracking -> at-risk alerts
- [ ] Automations: create rule -> trigger fires -> action executes -> logged
- [ ] Gantt chart renders with AI overlays (predicted delays, critical path)

---

### Sprint R2-6 (Weeks 35-36): Launch Polish + Remaining Gap Features + Quality Gate

**Features:** F-072 (FR-1505), F-073 (FR-1506), F-048 (FR-1001 deferred from R1), F-038 (FR-702 deferred from R1), F-099 (FR-2010), F-100 (FR-2011), F-101 (FR-2012), F-102 (FR-2013)

**New Infrastructure:** Tables `forms`, `documents` (2 of 14 new tables). NATS streams `pm.forms`, `pm.documents` activated.

**Work Items:**

| # | Work Item | Owner | Est. |
|---|-----------|-------|------|
| 1 | Smart time tracking: AI infers effort from activity (commits, task transitions, comment patterns), human confirms — confidence-gated (only surface when accuracy is high) | AI/ML | 12h |
| 2 | Jira import: REST API batch migration (projects, tasks, dependencies, comments), mapping UI | Backend + Fullstack | 16h |
| 3 | Additional Git providers: GitLab + Azure DevOps webhook support | Backend | 8h |
| 4 | Bulk task import (F-048, deferred from R1): CSV/XLSX upload with column mapping UI, validation, error preview, correction before commit | Backend + Fullstack | 12h |
| 5 | Calendar integration (F-038, deferred from R1): CalDAV/OAuth 2.0, external calendar sync (Google/Outlook), team member availability read | Backend | 12h |
| 6 | Form view / task intake forms (F-099): `forms` table, form builder UI, public submission endpoint, `pm.forms.submitted` event | Backend + Fullstack | 12h |
| 7 | Formula / computed fields (F-100): 'formula' field_type extension on custom_field_definitions, server-side evaluation, arithmetic + field refs + date diffs + aggregations | Backend | 8h |
| 8 | Docs & knowledge base (F-101): `documents` table, CRUD API, Markdown editor, full-text search, `pm.documents.*` events -> embedding pipeline for RAG enrichment | Backend + Fullstack | 12h |
| 9 | AI writing assistant (F-102): POST `/api/v1/ai/write`, streaming response, context-aware content generation (draft, improve, summarize, translate tone) | AI/ML | 8h |
| 10 | Performance optimization: API response time audit, database query optimization, AI operation latency review | All | 12h |
| 11 | Load testing: concurrent multi-tenant load test (3+ tenants, 10+ concurrent users per tenant) using k6 | DevOps | 12h |
| 12 | R2 Quality Gate execution: most comprehensive gate — see section 14.3 and section 16.3 (Go-Live Checklist) | All | 24h |
| 13 | Legal preparation: terms of service, privacy policy, data processing agreement review | PM | 8h |
| 14 | Client onboarding documentation: setup guide, FAQ, support escalation paths | All | 8h |

**Team Allocation:** All hands on launch polish, gap features, and quality gate.

**Exit Criteria:**
- [ ] R2 Quality Gate passes (see section 14.3)
- [ ] R2 Go-Live Checklist complete (see section 16.3)
- [ ] Load test passes with 3+ concurrent tenants
- [ ] Jira import functional for prospect migration
- [ ] Bulk import: CSV upload -> preview -> corrections -> commit -> tasks created
- [ ] Calendar sync: external calendar availability data accessible
- [ ] Forms: create form -> share public link -> submission creates task
- [ ] Formula fields: computed values display correctly in task detail + table view
- [ ] Docs: create/edit/search documents, client_visible flag, RAG-indexed
- [ ] AI writing: generate/improve content from task/project context
- [ ] Legal documents reviewed

**Milestone:** M14 — R2 Release / External Launch (Week 36)

---

### R2 Cut Line

**PROTECT:**
- F-054 to F-059 / FR-1200 to FR-1205 — Client access (this is the launch)
- F-060, F-061 / FR-1300, FR-1301 — Monetization (billing + cost management)
- F-065, F-066 / FR-1402, FR-1403 — Security (SOC 2 + AI guardrails)

**CAN CUT (defer to R3):**
- F-062 / FR-1302 — Data export
- F-063, F-064 / FR-1400, FR-1401 — Public API + webhooks
- F-067 to F-073 / FR-1500 to FR-1506 — Enhanced AI capabilities
- F-088 / FR-1901 — Gantt chart view
- F-095 / FR-2006 — Goals & OKRs
- F-098 / FR-2009 — Custom automations
- F-099 / FR-2010 — Form view
- F-100 / FR-2011 — Formula fields
- F-101 / FR-2012 — Docs & knowledge base
- F-102 / FR-2013 — AI writing assistant
- F-048 / FR-1001 — Bulk import (deferred from R1)
- F-038 / FR-702 — Calendar integration (deferred from R1)

---

## 7. New Infrastructure Required (v3.1 Additions)

This section maps the 14 new database tables, 6 new NATS streams, and 3 new durable consumers introduced by the ClickUp gap analysis to specific sprints.

### 7.1 New Database Tables (14)

| # | Table | Feature | FR | Sprint | Notes |
|---|-------|---------|-----|--------|-------|
| 1 | `task_checklists` | F-089 Checklists | FR-2000 | R0-2 | Parent table for checklist groups within tasks |
| 2 | `checklist_items` | F-089 Checklists | FR-2000 | R0-2 | Individual items with completion state |
| 3 | `mentions` | F-093 @Mentions | FR-2004 | R0-6 | @mention records in comments, feeds notification pipeline |
| 4 | `custom_field_definitions` | F-094 Custom Fields | FR-2005 | R1-5 | Tenant/project-scoped field schemas (text/number/date/select/formula) |
| 5 | `custom_field_values` | F-094 Custom Fields | FR-2005 | R1-5 | Polymorphic field values per task |
| 6 | `saved_views` | F-092 Table View | FR-2003 | R1-6 | View configs for list/board/calendar/table/gantt/timeline |
| 7 | `notifications` | F-096 Notifications | FR-2007 | R1-6 | User notification records |
| 8 | `notification_preferences` | F-096 Notifications | FR-2007 | R1-6 | Per-user per-type per-channel delivery preferences |
| 9 | `reminders` | F-103 Reminders | FR-2014 | R1-5 | Personal task reminders with scheduled delivery |
| 10 | `goals` | F-095 Goals | FR-2006 | R2-5 | OKR hierarchy (goal/objective/key_result) |
| 11 | `goal_task_links` | F-095 Goals | FR-2006 | R2-5 | Goal-to-task association for progress tracking |
| 12 | `automation_rules` | F-098 Automations | FR-2009 | R2-5 | If-then automation rule definitions |
| 13 | `forms` | F-099 Forms | FR-2010 | R2-6 | Form definitions, public slugs, field schemas |
| 14 | `documents` | F-101 Docs | FR-2012 | R2-6 | Markdown docs with draft/published/archived lifecycle |

**RLS enforcement:** All 14 tables have RLS policies enabled with `tenant_id` scoping (ref: architecture-v3.1.md, Tier 6).

### 7.2 New NATS Streams (6)

The original v3.0 architecture defined 6 streams. v3.1 adds 6 more for a total of 12:

| # | Stream | Subjects | Activated In | Producers | Key Consumers |
|---|--------|----------|-------------|-----------|---------------|
| 7 | `pm.notifications` | `.created` | R1-6 | notification-generator | notification-router (delivery) |
| 8 | `pm.reminders` | `.due` | R1-5 | Reminder scheduler (pg_cron) | notification-generator |
| 9 | `pm.goals` | `.progress_updated`, `.at_risk` | R2-5 | Goals Module | notification-generator, ai-adaptive |
| 10 | `pm.automations` | `.triggered`, `.executed` | R2-5 | automation-engine | audit-writer, cost-tracker |
| 11 | `pm.forms` | `.submitted` | R2-6 | Forms Module (public endpoint) | Task Module (creates task), notification-generator |
| 12 | `pm.documents` | `.created`, `.updated` | R2-6 | Documents Module | embedding-pipeline (RAG), notification-generator |

**Note:** All 12 NATS streams are created in Sprint R0-1 during the initial JetStream cluster setup, but the new streams remain idle until their producing features are activated in the sprints listed above.

### 7.3 New Durable Consumers (3)

The original v3.0 architecture defined 8 consumers. v3.1 adds 3 more for a total of 11:

| # | Consumer | Subscribes To | Purpose | Deployed In |
|---|----------|--------------|---------|-------------|
| 9 | `notification-generator` | `pm.tasks.*`, `pm.comments.*`, `pm.ai.*`, `pm.reminders.*`, `pm.goals.*`, `pm.forms.*`, `pm.documents.*` | Creates notification records based on user preferences | R1-6 |
| 10 | `recurrence-scheduler` | `pm.tasks.recurrence_triggered` | Clones recurring tasks when iCal RRULE schedule fires | R1-5 |
| 11 | `automation-engine` | `pm.tasks.*`, `pm.comments.*` | Evaluates and executes user-defined automation rules | R2-5 |

---

## 8. R3 (Months 10-12): Platform + Scale — 6 Sprints

**Goal:** The tool becomes a platform. Per-tenant AI learning. Self-service at scale. Consultancy-specific moat features. (ref: roadmap-v2.md, R3)

**Success gate:** 10+ paying tenants. Per-tenant AI accuracy measurably improves. SOC 2 Type I certified. AI-generated SOWs used in real client proposals.

**Feature count:** 13 features (F-074 through F-086 + F-076 AI-enhanced templates; F-087 Kanban promoted to R1, F-088 Gantt promoted to R2)

---

### Sprint R3-1 (Weeks 37-38): Per-Tenant Learning

**Features:** F-074 (FR-1600), F-075 (FR-1601)

**Work Items:**

| # | Work Item | Owner | Est. |
|---|-----------|-------|------|
| 1 | Per-tenant AI learning: tenant-scoped model contexts, delivery history analysis (completed projects -> estimation accuracy, phase duration patterns, risk patterns) | AI/ML | 24h |
| 2 | Tenant context enrichment: RAG pipeline enhanced to weight tenant-specific historical data higher than general knowledge | AI/ML | 12h |
| 3 | AI estimation engine: historical data (estimated vs actual effort) -> calibrated effort estimates per tenant, confidence intervals | AI/ML | 20h |
| 4 | Estimation UI: effort estimates with confidence intervals, historical comparison ("similar tasks in your org took X-Y hours") | Fullstack | 8h |
| 5 | A/B test framework: measure per-tenant learning improvement vs generic model (control group) | AI/ML | 8h |

**Team Allocation:** AI/ML 100%, Fullstack on estimation UI, Backend supporting data access

**Exit Criteria:**
- [ ] Per-tenant context enrichment active for tenants with 2+ completed projects
- [ ] Estimation engine produces calibrated estimates (verified against held-out test data)
- [ ] A/B test shows measurable accuracy improvement with tenant-specific data vs generic

---

### Sprint R3-2 (Weeks 39-40): Templates + SOW Generation

**Features:** F-076 (FR-1602), F-083 (FR-1800), F-084 (FR-1801)

**Work Items:**

| # | Work Item | Owner | Est. |
|---|-----------|-------|------|
| 1 | Template intelligence (AI-enhanced): auto-generate project templates from completed projects ("Projects like your last 3 data migrations looked like this"). Basic manual template CRUD shipped in R1 (F-076a). | AI/ML | 16h |
| 2 | SOW Generator: Claude Opus 4 long-context, generates Statements of Work from historical delivery data + scope description, template system, approval workflow | AI/ML | 24h |
| 3 | Knowledge capture: AI extracts lessons learned at project close, builds searchable org knowledge base | AI/ML | 12h |
| 4 | Template library UI: browse/search templates, create project from template, AI-suggested templates | Fullstack | 8h |
| 5 | SOW UI: generation wizard, review/edit interface, approval flow, export to PDF/DOCX | Fullstack | 12h |

**Team Allocation:** AI/ML 100% on template intelligence + SOW generator, Fullstack on UIs

**Exit Criteria:**
- [ ] Template generation produces usable templates from completed project data
- [ ] SOW generator produces draft SOWs reviewed favorably by consultancy team
- [ ] Knowledge base captures lessons learned, searchable by topic
- [ ] SOW approval workflow works end-to-end

---

### Sprint R3-3 (Weeks 41-42): Self-Service + Enterprise

**Features:** F-079 (FR-1700), F-080 (FR-1701), F-081 (FR-1702)

**Work Items:**

| # | Work Item | Owner | Est. |
|---|-----------|-------|------|
| 1 | Full self-service onboarding: sign up -> AI walkthrough -> import from Jira/Asana/spreadsheets -> project structure suggestion -> settings configuration — zero human intervention | Fullstack + AI/ML | 24h |
| 2 | Enterprise tier configuration: custom AI rules, API access, dedicated support queue, SSO enforcement, schema isolation option (evaluate per ADR-004) | Backend | 16h |
| 3 | PM role implementation: manages projects, creates tasks, assigns work within designated clients, no site-wide admin privileges | Backend | 8h |
| 4 | Enterprise admin panel: tenant management, plan configuration, feature flag overrides | Fullstack | 8h |

**Team Allocation:** Fullstack on onboarding flow, Backend on enterprise tier + PM role, AI/ML supporting onboarding intelligence

**Exit Criteria:**
- [ ] Self-service onboarding tested with zero human intervention (full flow)
- [ ] Enterprise tier: schema isolation option functional (if implemented) or documented for manual configuration
- [ ] PM role enforced: can manage within designated scope, cannot access site-wide admin

---

### Sprint R3-4 (Weeks 43-44): AI Coaching + Retrospectives

**Features:** F-077 (FR-1603), F-078 (FR-1604), F-085 (FR-1802)

**Work Items:**

| # | Work Item | Owner | Est. |
|---|-----------|-------|------|
| 1 | AI coaching layer: PM delivery pattern analysis ("You tend to underestimate QA cycles by 30%"), coaching recommendations based on top-performing project patterns | AI/ML | 20h |
| 2 | AI retrospective facilitator: analyzes actual delivery data to surface what caused delays vs what the team thinks, data-driven retro prompts | AI/ML | 16h |
| 3 | AI onboarding for new joiners: mid-project brief (decisions made, current risks, who owns what, what's next) generated from project data | AI/ML | 12h |
| 4 | Coaching UI: insights dashboard per PM, improvement tracking over time | Fullstack | 8h |
| 5 | Retrospective UI: facilitation wizard, data-driven prompts, action item capture | Fullstack | 8h |

**Team Allocation:** AI/ML 100%, Fullstack on coaching + retro UIs

**Exit Criteria:**
- [ ] AI coaching generates actionable insights from PM delivery history (minimum 5 completed projects)
- [ ] Retrospective facilitator surfaces data-driven insights vs anecdotal
- [ ] New joiner briefing generated from project data, reviewed favorably by test users

---

### Sprint R3-5 (Weeks 45-46): SOC 2 Type II + Analytics

**Features:** F-082 (FR-1703), F-086 (FR-1803)

**Work Items:**

| # | Work Item | Owner | Est. |
|---|-----------|-------|------|
| 1 | SOC 2 Type II: continuous compliance monitoring, automated evidence collection (AWS Config + custom checks), 6-month sustained evidence collection pipeline | DevOps | 24h |
| 2 | Embedded analytics: tenant-level delivery metrics dashboards (velocity, estimation accuracy, completion rates) | Backend + Fullstack | 16h |
| 3 | Anonymized benchmarking: cross-platform delivery metrics comparison (opt-in, anonymized) | Backend + AI/ML | 12h |
| 4 | Performance optimization pass: identify and resolve bottlenecks at 10+ tenant scale | DevOps + Backend | 12h |

**Team Allocation:** DevOps on SOC 2 + performance, Backend + Fullstack on analytics, AI/ML on benchmarking

**Exit Criteria:**
- [ ] SOC 2 Type II evidence collection automated and running
- [ ] Analytics dashboards rendering per-tenant metrics
- [ ] Performance validated at 10+ tenant scale (load test)

---

### Sprint R3-6 (Weeks 47-48): Final Polish + Quality Gate

**Features:** (no new features — Kanban and Gantt promoted to R1/R2 respectively)

> **Note:** F-087 (Kanban) was promoted to R1 and F-088 (Gantt) was promoted to R2. This sprint is now dedicated to final polish, performance optimization, and quality gate.

**Work Items:**

| # | Work Item | Owner | Est. |
|---|-----------|-------|------|
| 1 | Kanban drag-and-drop upgrade: add drag-and-drop status transitions to the R1 read-only Kanban board | Fullstack | 12h |
| 2 | R3 Quality Gate execution: full regression, security scan, performance validation at scale | All | 16h |
| 3 | Final performance optimization: database query audit, caching optimization, bundle size audit | All | 12h |
| 4 | Cross-feature integration testing: verify all 103 features work together at 10+ tenant scale | All | 16h |
| 5 | Documentation update: API docs, admin guide, client onboarding guide, operational runbook | All | 12h |

**Team Allocation:** All hands on polish and quality gate.

**Exit Criteria:**
- [ ] Kanban board supports drag-and-drop status transitions
- [ ] R3 Quality Gate passes (see section 14.4)
- [ ] All documentation current
- [ ] Performance at 10+ tenant scale validated
- [ ] All 103 features verified in integrated testing

**Milestone:** M16 — R3 Release (Week 48)

---

### R3 Cut Line

**PROTECT:**
- F-074 to F-078 / FR-1600 to FR-1604 — Per-tenant intelligence (the moat)
- F-079 / FR-1700 — Full self-service onboarding (scale)
- F-083 / FR-1800 — SOW generation (consultancy killer feature)

**CAN CUT (defer to post-12-month):**
- F-080 / FR-1701 — Enterprise tier (do manually)
- F-081 / FR-1702 — PM role (use admin role)
- F-086 / FR-1803 — Analytics + benchmarking

> **Note:** F-087 (Kanban) has been promoted to R1 and F-088 (Gantt) has been promoted to R2. They are no longer in R3.

---

## 9. Dev Environment Setup

### 9.1 Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 22 LTS | Runtime for API + Next.js |
| pnpm | 9+ | Package manager (monorepo workspaces) |
| Docker Desktop | Latest | Local services (PostgreSQL, Redis, NATS) |
| AWS CLI | v2 | Infrastructure provisioning |
| Turbo | Latest (via pnpm) | Monorepo build orchestration |

### 9.2 Docker Compose Configuration

```yaml
version: "3.9"
services:
  postgres:
    image: pgvector/pgvector:pg16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: aipm
      POSTGRES_USER: aipm
      POSTGRES_PASSWORD: aipm_dev
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: ["redis-server", "--appendonly", "yes"]

  nats:
    image: nats:2.10-alpine
    command: ["--jetstream", "--store_dir", "/data"]
    ports:
      - "4222:4222"
      - "8222:8222"
    volumes:
      - natsdata:/data

volumes:
  pgdata:
  natsdata:
```

### 9.3 Environment Variables (.env.example)

```bash
# Database
DATABASE_URL=postgresql://aipm:aipm_dev@localhost:5432/aipm

# Redis
REDIS_URL=redis://localhost:6379

# NATS
NATS_URL=nats://localhost:4222

# Auth
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
JWT_ACCESS_TOKEN_EXPIRY=1h
JWT_REFRESH_TOKEN_EXPIRY=30d

# Claude API
ANTHROPIC_API_KEY=sk-ant-xxxxx
CLAUDE_OPUS_MODEL=claude-opus-4-20250514
CLAUDE_SONNET_MODEL=claude-sonnet-4-5-20241022

# Embeddings
OPENAI_API_KEY=sk-xxxxx
EMBEDDING_MODEL=text-embedding-3-small

# Application
NODE_ENV=development
API_PORT=3001
WEB_PORT=3000
```

### 9.4 Local Development Workflow

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure services
docker-compose up -d

# 3. Generate and run database migrations
pnpm db:generate
pnpm db:migrate

# 4. Seed development data
pnpm db:seed

# 5. Start all applications (API + Web)
pnpm dev
```

---

## 10. Infrastructure Provisioning Order

Infrastructure is provisioned in 7 phases with explicit dependencies. All phases use AWS CDK (TypeScript) as per ADR-009.

### Phase 1: Networking (Week 1)

**No dependencies.**

- VPC with 2 public + 2 private subnets across 2 AZs
- NAT Gateway (single, for cost — upgrade to HA in R2)
- Security groups: API service, database, Redis, NATS, ALB
- VPC endpoints for S3, ECR, CloudWatch Logs (reduce NAT costs)

### Phase 2: Data Stores (Weeks 1-2)

**Depends on:** Phase 1 (VPC + security groups)

- RDS PostgreSQL 16 with pgvector extension: `db.r6g.large` (2 vCPU, 16 GB), Multi-AZ, encrypted (KMS), automated backups (7-day retention)
- ElastiCache Redis 7 Serverless: AOF persistence, in-transit + at-rest encryption
- S3 buckets: `uploads`, `exports`, `reports`, `backups` — versioning enabled, Glacier lifecycle for audit archives >90 days
- AWS Secrets Manager: database credentials, API keys, JWT signing keys

### Phase 3: Event Bus (Week 2)

**Depends on:** Phase 1 (VPC + security groups)

- NATS 2.10 3-node cluster on ECS Fargate
- ECS Service Discovery for NATS cluster peer resolution
- EFS for JetStream persistence (survives task restarts)
- 30-day stream retention configuration
- All 12 streams pre-created (ref: architecture-v3.1.md, Tier 5)

### Phase 4: Compute (Weeks 2-3)

**Depends on:** Phases 1, 2, 3 (networking + data stores + event bus)

- ECS Fargate cluster
- API service: 2 tasks (1 vCPU, 2 GB each), connects to RDS + Redis + NATS
- Web service: 2 tasks (0.5 vCPU, 1 GB each), Next.js SSR
- AI Worker service (R1): 1 task (1 vCPU, 4 GB — larger memory for context assembly)
- Task definitions with health checks, logging to CloudWatch

### Phase 5: Edge (Week 3)

**Depends on:** Phase 4 (compute services)

- Application Load Balancer: TLS 1.3 termination, routing rules (web vs API vs portal)
- AWS WAF: OWASP Top 10 rules, rate limiting, geo-blocking (optional)
- CloudFront: static asset caching, Next.js edge caching
- Route 53: DNS management, health checks

### Phase 6: Observability (Weeks 3-4)

**Depends on:** Phase 4 (compute services running to emit metrics)

- CloudWatch dashboards: API metrics, database metrics, AI metrics
- CloudWatch Logs: centralized structured JSON logs, 30-day retention (prod), 7-day (staging)
- AWS X-Ray: distributed tracing (API -> AI Orchestrator -> LLM Gateway -> Database)
- Sentry: frontend + backend error tracking with source maps
- CloudWatch Alarms -> SNS -> Slack: circuit breaker open, error rate >10%, latency >2s, 5xx spike

### Phase 7: CI/CD (Weeks 1-4, parallel with all phases)

**No blocking dependencies — runs in parallel.**

- GitHub Actions workflows: PR checks (lint, type-check, unit test, integration test)
- ECR repositories: `api`, `web`, `ai-worker`
- Deployment pipelines: build -> push to ECR -> deploy staging -> smoke test -> manual approval -> deploy prod
- CDK deployment commands in pipeline with environment-specific configs

---

## 11. Testing Strategy

### 11.1 Unit Testing

- **Framework:** Vitest
- **Coverage target:** 80%+ on all new/modified code
- **Pattern:** AAA (Arrange, Act, Assert)
- **Scope:** All public methods in all modules (project, task, dependency, comment, audit, user, AI orchestrator, LLM gateway, context assembly, notification, goals, automation, forms, documents)
- **Mocking:** External services mocked (Claude API, NATS, database) for unit tests
- **Run:** On every PR via GitHub Actions

### 11.2 Integration Testing

- **Framework:** Vitest + Testcontainers
- **Infrastructure:** Real PostgreSQL + pgvector, real Redis, real NATS — all in Docker containers spun up per test suite
- **Scope:** Module interactions, database queries with RLS, NATS event flow, embedding pipeline
- **Key tests:**
  - Task CRUD with RLS enforcement (cross-tenant access blocked)
  - Event emission -> NATS -> consumer processing -> audit log written
  - Embedding pipeline: task created -> embedding generated -> stored in pgvector -> similarity search returns it
  - Notification pipeline: event -> notification-generator -> notification record -> notification-router -> delivery
  - Automation engine: trigger event -> rule evaluation -> action execution
- **Run:** On every PR via GitHub Actions

### 11.3 AI-Specific Testing

**Golden Test Sets:**
- 10+ project descriptions per domain type (software delivery, data migration, consultancy)
- Expected WBS structure defined for each (phases, tasks, dependencies, estimates)
- Pass criteria: generated WBS matches expected structure at >60% similarity (schema match + content relevance)
- Maintained in `/tests/ai-evaluation/golden-sets/`

**Prompt Regression Testing:**
- Automated comparison when prompt templates change
- Before/after output comparison on golden test set
- Alert if quality degrades on any golden test case
- Run in CI on any change to `/packages/prompts/`

**Confidence Calibration:**
- Verify confidence scores correlate with actual accuracy
- Bin confidence scores (0-0.3, 0.3-0.6, 0.6-0.8, 0.8-1.0) and measure actual acceptance rate per bin
- Target: monotonic increase (higher confidence = higher acceptance)

**Acceptance Rate Tracking:**
- <60% acceptance rate on any capability triggers prompt review (ref: architecture-v3.1.md, section 4 — Evaluation Harness)
- >40% override rate = miscalibration alert
- Tracked per capability, per tenant, over 7-day rolling windows

### 11.4 End-to-End Testing

- **Framework:** Playwright
- **Critical user flows:**
  1. NL project description -> WBS generation -> review/approve -> tasks created
  2. "What's Next" — developer sees prioritized tasks after dependency resolution
  3. NL Query — ask "what's blocked?" and get accurate response
  4. Client portal — client sees only projected data, NL query scoped correctly (R2)
  5. AI PM Agent — nudge sent via Slack for overdue task (R1)
  6. Notification pipeline — event -> notification in inbox -> mark read (R1)
  7. Automation execution — trigger fires -> action executes -> audit logged (R2)
- **Run:** Smoke test subset on every staging deployment, full suite weekly

### 11.5 Load Testing

- **Framework:** k6
- **Scenarios:**
  - API endpoints under load: 100 concurrent users, 1000 requests/min
  - AI operations concurrent: 10 simultaneous NL-to-WBS generations
  - Multi-tenant: 3+ tenants with concurrent activity (R2)
  - Event bus throughput: 1000 events/minute sustained for 10 minutes
- **Targets:** API p95 < 500ms, NL-to-WBS p95 < 30s, event processing lag < 5s

### 11.6 Security Testing

- **RLS isolation verification:** Automated test suite that attempts cross-tenant data access at every level (direct SQL, API endpoints, AI context assembly) — all must return 0 results or 403
- **Prompt injection testing:** Adversarial inputs in all NL fields ("ignore previous instructions and..."), verify output validation blocks harmful output
- **Auth bypass attempts:** Invalid tokens, expired tokens, tampered JWT claims, role escalation attempts
- **Dependency vulnerability scanning:** `npm audit` in CI, Snyk integration for continuous monitoring

---

## 12. CI/CD Pipeline

### 12.1 Pipeline Architecture

```
On Pull Request:
  +-- lint (ESLint + Prettier) ----------------+
  +-- type-check (tsc --noEmit) ----------------+ Parallel
  +-- unit-test (Vitest, 80% threshold) --------+
  +-- integration-test (Testcontainers) --------+
      |
      v All pass -> PR reviewable

On Merge to main:
  +-- build (Docker images for api, web, ai-worker)
  +-- push (ECR -- tag with git SHA + latest)
  +-- deploy-staging (CDK deploy to staging environment)
  +-- smoke-test (Playwright subset -- 5 critical flows)
  +-- ai-eval (golden test set -- only if prompt templates changed)
  +-- manual-approval (required for production deployment)
  +-- deploy-prod (CDK deploy + health check + rollback on failure)
```

### 12.2 Branch Strategy

- **Trunk-based development:** `main` is always deployable
- **Feature branches:** short-lived (< 3 days), prefixed with `feat/`, `fix/`, `chore/`
- **PR required:** 1 approval minimum, all CI checks pass
- **No long-lived branches:** no `develop`, no `release/*` — feature flags for incomplete features

### 12.3 Deployment Strategy

- **Blue/green on ECS Fargate:** new task set deployed alongside old, health check validated, traffic switched, old task set drained
- **Health check:** `/health` endpoint returns 200 + database connection status + NATS connection status + Redis connection status
- **Automatic rollback:** if health check fails within 5 minutes of deployment, ECS rolls back to previous task definition
- **Database migrations:** run as a separate ECS task before application deployment, forward-only (no down migrations in production)

### 12.4 Environment Configuration

| Environment | Purpose | Config |
|-------------|---------|--------|
| `dev` | Local development | Docker Compose, single-node everything |
| `staging` | Pre-production testing | AWS, mirrors prod topology, smallest instances |
| `prod` | Production | AWS, Multi-AZ, encrypted, monitored, auto-scaling |

---

## 13. Task Dependencies & Critical Path

### 13.1 R0 Critical Path

```
Schema Design (R0-1, Week 1-2)
  +---> Auth + Task CRUD + Events + Checklists (R0-2, Week 3-4)
       +---> Audit Trail + AI Foundation (R0-3, Week 5-6)
            +---> NL->WBS + What's Next (R0-4, Week 7-8)  ** BOTTLENECK
                 +---> UI + AI Safety (R0-5, Week 9-10)
                      +---> NL Query + @Mentions + Polish (R0-6, Week 11-12)
```

**Critical path bottleneck:** Sprint R0-4 (NL to WBS) is the make-or-break sprint. If it slips, UI development (R0-5) cannot demonstrate the core flow, and polish (R0-6) loses its foundation. Mitigation: start prompt engineering in parallel during R0-2/R0-3 (AI/ML engineer begins while Backend builds infrastructure).

**Parallel tracks within R0:**
- Backend: schema -> auth -> audit -> WBS API -> comment system + checklists
- AI/ML: LLM Gateway -> orchestrator -> NL-to-WBS -> NL Query -> eval harness
- Fullstack: Next.js scaffold -> UI components -> full views -> polish
- DevOps: Docker Compose -> CI -> CDK -> staging -> monitoring

### 13.2 Cross-Release Dependencies

| Downstream Feature | Depends On | Release Gap |
|-------------------|------------|-------------|
| R1: AI PM Agent (F-028 / FR-601) | R1: Slack integration (F-036 / FR-700) — delivery channel | Same release, sequential sprints (R1-1 -> R1-2) |
| R1: Risk Predictor (F-030 / FR-603) | R0: Event bus (F-001 / FR-100) + 100+ task state transitions logged | Cross-release; data accumulates during R0 internal use |
| R1: Scope Creep Detector (F-034 / FR-607) | R0: WBS baseline snapshots (stored during F-011 approval) | Cross-release; baselines stored from R0 |
| R1: Adaptive Task Engine (F-027 / FR-600) | R0: 50+ completed tasks with actual duration data | Cross-release; data gate — may stay rules-based if not met |
| R1: Notification System (F-096 / FR-2007) | R1: notification-generator consumer + notifications tables | Same release; tables created in R1-6 |
| R2: Client Portal (F-055 / FR-1201) | R1: Projection Model (F-042 / FR-900) | Cross-release; projection model must be tested before portal |
| R2: SOC 2 Type I (F-065 / FR-1402) | R1: SOC 2 controls (F-045 / FR-903) | Cross-release; controls must be in place 3+ months before audit |
| R2: Automated Client Reporting (F-057 / FR-1203) | R1: Projection Module (F-042 / FR-900) + R0: Summary Engine (F-013 / FR-202) | Cross-release; builds on projection + summary |
| R2: Automations (F-098 / FR-2009) | R1: Custom Fields (F-094 / FR-2005) — custom_field_changed trigger type | Cross-release; trigger depends on custom field events |
| R2: Goals (F-095 / FR-2006) | R1: Notification System (F-096 / FR-2007) — goals.at_risk feeds notifications | Same release; goals module emits to notification pipeline |
| R3: Per-Tenant Learning (F-074 / FR-1600) | R2: Multi-tenancy (F-054 / FR-1200) + 2+ completed projects per tenant | Cross-release; needs multi-tenant data + project history |
| R3: SOW Generator (F-083 / FR-1800) | R3: Per-tenant learning (F-074 / FR-1600) + template intelligence (F-076 / FR-1602) | Same release; sequential sprints (R3-1 -> R3-2) |
| R3: AI Coaching (F-077 / FR-1603) | R3: Per-tenant learning (F-074 / FR-1600) + 5+ completed projects per PM | Same release; requires data accumulation |
| R3: SOC 2 Type II (F-082 / FR-1703) | R2: SOC 2 Type I (F-065 / FR-1402) + 6 months evidence collection | Cross-release; evidence collection starts in R2 |

### 13.3 Data Readiness Gates

Several R1+ features depend on accumulated data from internal use during R0:

| Feature | Data Gate | Fallback if Not Met |
|---------|-----------|---------------------|
| Adaptive Task Engine (F-027) | 50+ completed tasks with actual duration | Stay rules-based, flag for R2 |
| Risk Predictor (F-030) | 100+ task state transitions | Label as "early signal" not "prediction" |
| Resource Optimization (F-032) | 3+ active developers with tracked assignments | Defer to R2 |
| Per-Tenant Learning (F-074) | 2+ completed projects per tenant | Use generic model, flag improvement |
| AI Estimation (F-075) | 50+ tasks with estimated vs actual effort per tenant | Use industry averages with disclaimer |
| AI Coaching (F-077) | 5+ completed projects per PM | Defer or use org-wide patterns |

---

## 14. Risk Register

### RISK-001: NL to WBS Produces Generic/Low-Quality Output

| Attribute | Value |
|-----------|-------|
| **Probability** | High |
| **Impact** | Critical |
| **Category** | Technical |
| **Affected Features** | F-011 (FR-200), F-076 (FR-1602), F-083 (FR-1800) |
| **Detection** | Golden test set pass rate <60%, user acceptance rate <50%, qualitative feedback ("too generic") |

**Mitigation (most detailed — this is the product risk):**

1. **Domain-specific prompt template library:** Build 3+ domain-specific prompt templates (software delivery, data migration, consultancy engagement) from Week 0. Each template encodes domain knowledge: typical phases, common task patterns, standard deliverables, estimation heuristics. Generic prompts produce generic output — domain templates are the fix.

2. **Test against real past projects:** Use 10+ real past project descriptions from internal delivery history as golden test inputs. Compare AI-generated WBS against actual WBS that was manually created for those projects. This grounds quality assessment in reality, not synthetic tests.

3. **Iterative refinement loop:** User edits to AI-generated WBS feed back into prompt tuning. When a user edits a generated WBS, log the diff (original vs edited). Aggregate edit patterns weekly to identify systematic prompt weaknesses.

4. **Golden test set CI gate:** Golden test set (10+ cases per domain) runs in CI on every prompt template change. Pass rate must be >60% for R0, increasing to >75% by R1 and >85% by R3. Regression = blocked merge.

5. **Shadow mode for production validation:** First 2 weeks of production use, NL-to-WBS runs in shadow mode. Only enable live mode after shadow validation confirms quality meets bar.

6. **Weekly prompt review cadence:** AI/ML engineer reviews acceptance rate, override patterns, and user feedback weekly.

7. **Fallback strategy:** If quality does not meet bar after 4 weeks of iteration, simplify to structured form with AI assistance rather than full NL-to-WBS.

---

### RISK-002: Claude API Availability/Latency Issues

| Attribute | Value |
|-----------|-------|
| **Probability** | Medium |
| **Impact** | High |
| **Category** | Technical |
| **Affected Features** | All AI capabilities |
| **Detection** | Circuit breaker open, p95 latency >30s, error rate >10% |

**Mitigation:**
- Circuit breaker in LLM Gateway: 5 consecutive failures -> 60s open state -> cached/fallback responses
- Model fallback chain: Opus unavailable -> Sonnet, Sonnet unavailable -> cached response or graceful degradation
- Response caching: cache NL query responses (TTL-based), cache summary outputs
- Retry with exponential backoff (max 3 retries, max 30s total)
- Multi-region API endpoint configuration if available

---

### RISK-003: pgvector Performance Degrades at Scale

| Attribute | Value |
|-----------|-------|
| **Probability** | Low |
| **Impact** | Medium |
| **Category** | Technical |
| **Affected Features** | F-011 (RAG), F-014 (NL Query), F-074 (Per-Tenant Learning) |
| **Detection** | p95 similarity search >100ms |

**Mitigation:**
- IVFFlat index from R0, evaluate HNSW at R3 (ref: architecture-v3.1.md, Tier 6)
- `tenant_id` in WHERE clause on all vector queries (not post-filter) — limits search space
- Monitor p95 search latency continuously
- Escape hatch: migrate to dedicated vector store (Pinecone/Weaviate) if needed

---

### RISK-004: NATS Operational Complexity Underestimated

| Attribute | Value |
|-----------|-------|
| **Probability** | Low |
| **Impact** | Medium |
| **Category** | Technical |
| **Affected Features** | F-001 (Event Bus), all event-driven capabilities |
| **Detection** | Consumer lag >1000, DLQ growth, cluster instability |

**Mitigation:**
- PoC validation in Week 0 (including failure scenarios)
- 3-node cluster with EFS persistence (survives task restarts)
- Dead letter queue per consumer with monitoring
- Escape hatch: NATS -> Redis Streams (simpler) or Kafka (more robust) — same event schema, different transport

---

### RISK-005: Tenant Data Leakage Through AI Context

| Attribute | Value |
|-----------|-------|
| **Probability** | Medium |
| **Impact** | Critical |
| **Category** | Security |
| **Affected Features** | All AI capabilities in multi-tenant mode (R2+) |
| **Detection** | Cross-tenant data in AI output, security audit finding |

**Mitigation:**
- RLS at database level: application code physically cannot query across tenants
- RAG retrieval scoped by `tenant_id` in WHERE clause (not post-filter)
- AI context assembly verified to contain only current tenant's data (automated test in CI)
- Embedding queries include tenant filter in vector search
- Cross-tenant isolation test suite runs on every deployment
- Penetration testing in R2-4 specifically targeting AI context leakage

---

### RISK-006: AI Inference Costs Exceed Budget Projections

| Attribute | Value |
|-----------|-------|
| **Probability** | High |
| **Impact** | High |
| **Category** | Business |
| **Affected Features** | All AI capabilities, F-061 (Cost Management), F-060 (Pricing) |
| **Detection** | Per-tenant cost exceeds model by >30%, negative margin per tenant |

**Mitigation:**
- Cost tracker from R0 (per-operation, per-tenant, per-capability tracking)
- Per-tenant monthly budget caps with pre-flight check
- Model routing: use Sonnet (cheaper) for queries/summaries, Opus (expensive) only for generation/risk
- Response caching to avoid redundant LLM calls
- Token budget per operation type (enforced in context assembly)
- Prompt optimization: reduce input tokens through better context selection
- Tiered pricing with AI metering (usage aligns cost with revenue)

---

### RISK-007: Team Velocity Lower Than Planned

| Attribute | Value |
|-----------|-------|
| **Probability** | Medium |
| **Impact** | High |
| **Category** | Schedule |
| **Affected Features** | All — primarily R0 timeline |
| **Detection** | Sprint velocity consistently below plan for 2+ sprints |

**Mitigation:**
- Cut lines defined per release (sections 4-8) — know what to cut before you need to
- AI/ML tasks get 1.5x time buffer in capacity planning
- R0-4 (NL-to-WBS) flagged as make-or-break — protect at all costs
- Weekly velocity tracking from Sprint R0-1
- Escalation trigger: if 2 consecutive sprints miss >30% of planned work, re-plan remaining release

---

### RISK-008: SOC 2 Certification Delays

| Attribute | Value |
|-----------|-------|
| **Probability** | Medium |
| **Impact** | Medium |
| **Category** | Business |
| **Affected Features** | F-045 (SOC 2 Prep), F-065 (Type I), F-082 (Type II) |
| **Detection** | Auditor feedback, control gaps discovered |

**Mitigation:**
- Start controls implementation in R1 (6 months before Type I audit)
- Automated evidence collection from R1 (AWS Config + custom checks)
- Engage auditor early for readiness assessment
- SOC 2 Type I is initiated in R2, not completed — allows buffer

---

### RISK-009: Client Adoption Slower Than 3 Tenants by R2

| Attribute | Value |
|-----------|-------|
| **Probability** | Medium |
| **Impact** | High |
| **Category** | Business |
| **Affected Features** | R2 success gate, F-060 (Pricing), F-061 (Cost Management) |
| **Detection** | <3 signed clients by Week 30 |

**Mitigation:**
- Pilot client view in R1 (F-043) — validate value proposition early
- Internal dogfooding from R0 — the team is the first customer
- Trusted client contact engaged in R1 for feedback
- If adoption slow, extend R2 by 2 sprints (compress R3) — better to launch right than launch fast

---

### RISK-010: Prompt Injection Attacks via NL Input

| Attribute | Value |
|-----------|-------|
| **Probability** | Medium |
| **Impact** | High |
| **Category** | Security |
| **Affected Features** | F-011 (NL to WBS), F-014 (NL Query), F-059 (Client AI Assistant) |
| **Detection** | Unexpected AI output, security scan findings |

**Mitigation:**
- Input sanitization before LLM context assembly (ref: architecture-v3.1.md, Tier 8)
- Tenant data in structured fields, not raw user input in system prompts
- Output validation against expected schema (WBS must match schema, queries must reference real entities)
- AI actions always logged for forensic review
- Prompt injection test suite in CI (adversarial inputs)
- R2 (F-066): dedicated AI guardrails for multi-tenant including injection defense

---

### RISK-011: Schema Migration Complexity as Features Grow

| Attribute | Value |
|-----------|-------|
| **Probability** | Low |
| **Impact** | Medium |
| **Category** | Technical |
| **Affected Features** | All — schema underlies everything |
| **Detection** | Migration failures, data integrity issues |

**Mitigation:**
- Drizzle ORM with versioned, forward-only migrations
- Schema designed for R3 from R0 (evergreen principle — ref: architecture-v3.1.md, Principle 7)
- No down migrations in production
- Migration tested on staging (with production-like data) before production deploy
- JSONB columns for flexible/evolving fields (avoid schema changes for configuration)

---

### RISK-012: Key Personnel Departure (AI/ML Specialist)

| Attribute | Value |
|-----------|-------|
| **Probability** | Low |
| **Impact** | Critical |
| **Category** | Schedule |
| **Affected Features** | All AI capabilities |
| **Detection** | Resignation notice |

**Mitigation:**
- All prompt templates version-controlled in `/packages/prompts/` (not in anyone's head)
- AI orchestrator, gateway, and pipeline fully documented in code + ADRs
- Golden test sets provide regression safety — new engineer can iterate on prompts with confidence
- Cross-training: Backend engineers participate in AI code reviews, understand orchestrator pipeline
- Pair programming on critical AI work (R0-4 sprint especially)

---

## 15. Quality Gates

### 15.1 R0 Quality Gate

| Category | Criteria | Pass Condition |
|----------|----------|----------------|
| **Functional** | NL to WBS end-to-end | Generates valid WBS for 3 domain types |
| **Functional** | "What's Next" | Returns correct priority order (verified with test data) |
| **Functional** | CRUD operations | All task/project/dependency CRUD works with RLS |
| **Functional** | Checklists (F-089) | Checklist CRUD + progress tracking functional |
| **Functional** | @Mentions (F-093) | @mention autocomplete + notification delivery |
| **Performance** | API response time | p95 < 500ms for standard CRUD |
| **Performance** | NL to WBS latency | p95 < 30 seconds |
| **AI Quality** | Golden test set | Pass rate > 60% |
| **AI Quality** | WBS schema | Output parseable to valid JSON schema |
| **Security** | RLS isolation | Cross-tenant access returns 0 results (automated test) |
| **Security** | Auth bypass | All bypass attempts blocked (automated test) |
| **Security** | Secrets | No hardcoded secrets (automated scan) |
| **Coverage** | Unit test coverage | > 80% on new/modified code |
| **Operations** | Monitoring | CloudWatch metrics + Sentry capturing errors |
| **Operations** | Alerting | Critical alerts configured and tested |

### 15.2 R1 Quality Gate

All R0 gate criteria must still pass, plus:

| Category | Criteria | Pass Condition |
|----------|----------|----------------|
| **Functional** | AI PM Agent | Sends nudges via Slack for overdue/stalled tasks |
| **Functional** | Git integration | Commits link to tasks, auto-complete on merge proposes |
| **Functional** | Risk predictions | Generated in shadow mode with confidence scores |
| **Functional** | Scope creep | Detects scope drift vs WBS baseline |
| **Functional** | SSO/MFA | At least 1 SSO provider works, TOTP functional |
| **Functional** | Views (F-087, F-091, F-092) | Kanban, Calendar, Table views render correctly |
| **Functional** | Notifications (F-096) | Notification inbox with unread count and preferences |
| **Functional** | Custom fields (F-094) | Create definitions, set values, filter by custom field |
| **AI Quality** | Risk prediction accuracy | >70% on flagged items (shadow mode validation) |
| **AI Quality** | PM Agent nudge relevance | >80% relevance rating (internal team assessment) |
| **AI Quality** | Acceptance rate | >65% across all AI capabilities |
| **Performance** | Event processing lag | < 5 seconds from event emission to consumer processing |
| **Performance** | AI operations | p95 < 10 seconds for non-generative operations |
| **Security** | SOC 2 controls | All controls documented and evidence collection started |

### 15.3 R2 Quality Gate (Most Comprehensive — External Launch)

All prior gate criteria must still pass, plus:

| Category | Criteria | Pass Condition |
|----------|----------|----------------|
| **Security** | SOC 2 Type I | Audit initiated with auditor |
| **Security** | PII redaction | No PII in LLM prompts (tested with known PII inputs) |
| **Security** | Prompt injection defense | Adversarial inputs blocked (injection test suite) |
| **Tenant Isolation** | Database level | Cross-tenant access blocked (automated test suite) |
| **Tenant Isolation** | AI context | AI operations contain only current tenant data (verified) |
| **Tenant Isolation** | Client portal | Client sees only projected data, no internal data leakage |
| **Billing** | Usage metering | AI operations counted accurately per tenant per capability |
| **Billing** | Tier gating | Feature limits enforced per plan tier |
| **Billing** | Payment | Subscription + overage billing functional |
| **Client Portal** | Data projection | Only client-visible fields shown, internal data filtered at data layer |
| **Client Portal** | NL queries | Scoped to client permissions + projected data only |
| **Client Portal** | Reporting | AI-generated reports pass PM approval flow |
| **Performance** | Multi-tenant load | Concurrent load test with 3+ tenants passes |
| **Performance** | API under load | p95 < 500ms at 100 concurrent users |
| **Reliability** | Backup/restore | RPO (1 hour) and RTO (4 hours) verified |
| **Legal** | Terms of service | Reviewed and published |
| **Legal** | Privacy policy | Reviewed and published |
| **Legal** | DPA | Data processing agreement template ready |
| **Operations** | Incident response | Plan documented, escalation paths defined |
| **Operations** | Runbooks | Common operations documented |

### 15.4 R3 Quality Gate

All prior gate criteria must still pass, plus:

| Category | Criteria | Pass Condition |
|----------|----------|----------------|
| **AI Quality** | Per-tenant learning | Measurable accuracy improvement vs generic model (A/B test) |
| **AI Quality** | SOW generation | Usable drafts (human review panel approval from consultancy team) |
| **AI Quality** | Estimation accuracy | Calibrated estimates within 20% of actual (on held-out test data) |
| **Compliance** | SOC 2 Type II | Evidence collection automated and running |
| **Scale** | 10+ tenants | Performance validated at target scale |
| **Self-Service** | Onboarding | Zero human intervention end-to-end |

---

## 16. Milestones

| # | Milestone | Target Week | Criteria | Release |
|---|-----------|-------------|----------|---------|
| M1 | Local dev environment running | Week 1 | Docker Compose up, schema deployed, CI green | Pre-R0 |
| M2 | Auth + CRUD complete | Week 4 | JWT auth, task CRUD, dependencies, checklists, events flowing | R0 |
| M3 | AI Orchestrator functional | Week 6 | 7-stage pipeline processes test request end-to-end | R0 |
| M4 | NL to WBS demo-ready | Week 8 | Generates valid WBS for 3 domains, golden test >60% | R0 |
| M5 | R0 UI complete | Week 10 | Full internal UI: review, What's Next, task views | R0 |
| M6 | **R0 Release** | **Week 12** | R0 Quality Gate passes, internal team daily use | R0 |
| M7 | Git + Slack live | Week 14 | Commits link to tasks, Slack bot responds | R1 |
| M8 | AI PM Agent active | Week 16 | Agent sends nudges via Slack, respects quiet hours | R1 |
| M9 | Risk prediction shadow | Week 18 | Risk predictions generated (shadow mode), accuracy measured | R1 |
| M10 | SaaS infrastructure ready | Week 20 | SSO, MFA, feature flags, SOC 2 controls | R1 |
| M11 | Client projection + data model extensions | Week 22 | Custom fields, recurring tasks, reminders, client pilot view | R1 |
| M12 | **R1 Release** | **Week 24** | R1 Quality Gate passes, views + notifications + templates | R1 |
| M13 | Client portal live | Week 28 | 3+ client tenants onboarded, portal functional | R2 |
| M14 | **R2 Release (External Launch)** | **Week 36** | R2 Quality Gate passes, 3+ paying tenants | R2 |
| M15 | Per-tenant learning validated | Week 42 | Measurable accuracy improvement per tenant (A/B test) | R3 |
| M16 | **R3 Release** | **Week 48** | R3 Quality Gate passes, 10+ tenants, SOC 2 Type II prep | R3 |

---

## 17. Go-Live Checklists

### 17.1 R0 Go-Live (Internal)

- [ ] All "Cannot Cut" features functional (17 features: F-001 through F-009, F-011, F-012, F-015, F-016, F-017, F-018, F-020, F-023, F-025, F-089, F-093)
- [ ] 80%+ unit test coverage on all modules
- [ ] Security scan clean (no high/critical vulnerabilities)
- [ ] Performance baselines established (API p95, NL-to-WBS p95, event processing lag)
- [ ] Monitoring + alerting configured (CloudWatch dashboards, Sentry, critical alarms)
- [ ] Team onboarding complete (all engineers can run local dev, deploy to staging, access monitoring)
- [ ] Operational runbook documented (deployment, rollback, incident response)
- [ ] Golden test set running in CI with >60% pass rate
- [ ] Shadow mode enabled for all AI capabilities (first 2 weeks of production use)

### 17.2 R1 Go-Live (Internal + Pilot Client)

- [ ] All R0 checklist items maintained
- [ ] Git integration tested with real GitHub repositories
- [ ] Slack integration tested with real workspace (not just test workspace)
- [ ] AI PM Agent tested in shadow mode for 2+ weeks before enabling live nudges
- [ ] AI PM Agent quiet hours configured per internal team feedback
- [ ] Risk predictor shadow mode accuracy measured and documented
- [ ] Client pilot view reviewed with trusted client contact — feedback collected
- [ ] SOC 2 controls documented with evidence collection process active
- [ ] SSO tested with at least 1 real provider (Google Workspace or Microsoft Entra ID)
- [ ] Feature flags functional — pilot client gated to specific feature set
- [ ] Backup and restore tested (verify RPO/RTO)
- [ ] Notification system delivers across all channels (in-app, email, Slack)
- [ ] Custom fields, recurring tasks, reminders all functional
- [ ] All view types working (list, board, calendar, table, timeline)

### 17.3 R2 Go-Live (External Launch) — MOST COMPREHENSIVE

**Infrastructure & Reliability:**
- [ ] Multi-tenant data isolation verified (automated test suite — cross-tenant access blocked at DB, API, and AI levels)
- [ ] Performance: load test with 3+ concurrent tenants passes (API p95 <500ms, NL operations p95 <30s)
- [ ] Backup + restore tested (RPO 1 hour / RTO 4 hours verified)
- [ ] Auto-scaling policies configured and tested (ECS target-tracking on CPU 70%)
- [ ] Blue/green deployment verified with zero-downtime rollback
- [ ] Monitoring dashboards for all tenants (per-tenant views)
- [ ] Incident response plan documented with escalation paths

**Security & Compliance:**
- [ ] SOC 2 Type I audit initiated with auditor
- [ ] PII redaction verified: no PII in LLM prompts (tested with adversarial inputs containing emails, phone numbers, SSNs)
- [ ] Prompt injection defense tested: adversarial injection attempts blocked and logged
- [ ] Cross-tenant AI context verification: automated test confirms AI operations scoped to current tenant only
- [ ] Dependency vulnerability scan clean (npm audit + Snyk — zero high/critical)
- [ ] AWS WAF rules active (OWASP Top 10 protection)
- [ ] Secrets rotation verified (AWS Secrets Manager automatic rotation)

**Client Portal:**
- [ ] Client sees only projected data — no internal fields, comments, or tags leak through
- [ ] Client NL queries scoped correctly — answers only from projected data
- [ ] Client role enforced: cannot modify tasks, assignments, or project structure
- [ ] White-label configuration works (custom logo, colors)
- [ ] Client self-service onboarding tested end-to-end (invite -> account -> portal)

**Billing & Monetization:**
- [ ] Usage metering accurate: AI operations counted correctly per tenant per capability (verified with test data)
- [ ] Tier gating enforced: Starter tier cannot access Pro features
- [ ] Stripe/payment integration tested (subscription creation, overage billing, invoice generation)
- [ ] Per-tenant cost tracking verified (cost data matches billing data)

**AI Quality:**
- [ ] Golden test set pass rate >75% across all capabilities
- [ ] AI acceptance rate >65% (7-day rolling average)
- [ ] AI guardrails for multi-tenant verified (PII, injection, cross-tenant)
- [ ] Client-facing AI assistant: human-in-the-loop filter working (sensitive content flagged)

**Legal & Documentation:**
- [ ] Terms of service published
- [ ] Privacy policy published
- [ ] Data processing agreement template ready for client signature
- [ ] API documentation published (OpenAPI 3.1)
- [ ] Client onboarding guide ready
- [ ] Support: escalation paths defined, runbooks for common client issues

**Cost & Operations:**
- [ ] Cost tracking per tenant verified (infrastructure + AI inference)
- [ ] Unit economics positive per tenant at Pro tier pricing
- [ ] Rate limiting per tenant enforced
- [ ] Alert thresholds configured for all tenants

### 17.4 R3 Go-Live

- [ ] All R2 checklist items maintained
- [ ] Per-tenant learning validated with A/B test (measurable accuracy improvement)
- [ ] SOC 2 Type II evidence collection automated and running continuously
- [ ] SOW generation reviewed and approved by consultancy team (used in at least 1 real proposal)
- [ ] Self-service onboarding tested with zero human intervention (full flow from signup to first project)
- [ ] Enterprise tier isolation option verified (schema isolation if implemented, or documented for manual setup)
- [ ] Performance at 10+ tenant scale validated (load test)
- [ ] AI coaching insights validated by PMs (qualitative feedback)
- [ ] Template intelligence producing useful templates from completed projects
- [ ] Knowledge base capturing lessons learned at project close

---

## 18. Appendices

### 18.1 Sprint Capacity Model

**Base capacity:** 5 engineers x 10 days/sprint x 6 productive hours/day = **300 person-hours/sprint**

**Adjustments:**
- AI/ML tasks: 1.5x time buffer (non-deterministic outputs require more iteration)
- First sprint of each release: 0.8x capacity (onboarding, context switching)
- Last sprint of each release: 0.7x capacity (quality gate, polish, documentation)
- Meetings/overhead: already factored into 6h productive (assumes 2h/day meetings/reviews)

**Effective capacity per sprint:**

| Sprint Type | Capacity |
|-------------|----------|
| Standard | 300 person-hours |
| Release start | 240 person-hours |
| Release end (quality gate) | 210 person-hours |
| Make-or-break (R0-4) | 300 person-hours (protect — zero distractions) |

### 18.2 Feature-to-Sprint Mapping

| Sprint | Features | Count |
|--------|----------|-------|
| R0-1 | F-001, F-002, F-003 | 3 |
| R0-2 | F-004, F-005, F-006, F-007, F-008, **F-089** | 6 |
| R0-3 | F-009, F-015, F-020 | 3 |
| R0-4 | F-011, F-012, F-017 | 3 |
| R0-5 | F-016, F-018, F-019, F-023, F-024, F-025 | 6 |
| R0-6 | F-010, F-013, F-014, F-021, F-022, F-026, **F-093** | 7 |
| **R0 Total** | | **28** |
| R1-1 | F-036, F-037 | 2 |
| R1-2 | F-027, F-028, F-033 | 3 |
| R1-3 | F-029, F-030, F-034, F-035 | 4 |
| R1-4 | F-039, F-040, F-041, F-044, F-045, F-046 | 6 |
| R1-5 | F-042, F-043, F-047, **F-094**, **F-090**, **F-097**, **F-103** | 7 |
| R1-6 | **F-091**, **F-092**, **F-087**, **F-096**, **F-076a**, F-031, F-032, F-049, F-050, F-051, F-052, F-053 | 12 |
| **R1 Total** | | **34** (+2 subfeatures: F-076a, F-096) = **36 effective** |
| R2-1 | F-054, F-055, F-056 | 3 |
| R2-2 | F-057, F-058, F-059 | 3 |
| R2-3 | F-060, F-061, F-062 | 3 |
| R2-4 | F-063, F-064, F-065, F-066 | 4 |
| R2-5 | F-067, F-068, F-069, F-070, F-071, **F-095**, **F-098**, **F-088** | 8 |
| R2-6 | F-072, F-073, **F-048**, **F-038**, **F-099**, **F-100**, **F-101**, **F-102** | 8 |
| **R2 Total** | | **27** (includes 2 deferred from R1) |
| R3-1 | F-074, F-075 | 2 |
| R3-2 | F-076 (AI-enhanced), F-083, F-084 | 3 |
| R3-3 | F-079, F-080, F-081 | 3 |
| R3-4 | F-077, F-078, F-085 | 3 |
| R3-5 | F-082, F-086 | 2 |
| R3-6 | (polish + Kanban drag-and-drop upgrade) | 0 |
| **R3 Total** | | **13** |
| **Program Total** | | **103** (88 original + 15 new) |

### 18.3 Infrastructure Cost Schedule

Monthly infrastructure costs by release phase (ref: architecture-v3.1.md, Cost Model):

| Component | R0 (Internal) | R1 (Pilot) | R2 (3 Tenants) | R3 (10 Tenants) |
|-----------|---------------|------------|-----------------|------------------|
| ECS Fargate (API + AI + Web) | $120 | $200 | $400 | $800 |
| RDS PostgreSQL (Multi-AZ) | $95 | $95 | $190 | $380 |
| ElastiCache Redis | $25 | $50 | $100 | $200 |
| NATS (3-node ECS) | $60 | $60 | $60 | $90 |
| Claude API (AI operations) | $30 | $80 | $150 | $400 |
| S3 + CloudFront | $10 | $15 | $30 | $60 |
| Monitoring (CloudWatch + Sentry) | $30 | $50 | $80 | $150 |
| Secrets Manager + misc | $10 | $15 | $20 | $30 |
| **Total** | **~$380/mo** | **~$565/mo** | **~$1,030/mo** | **~$2,110/mo** |

**Unit economics at R2 target (3 tenants):**
- Revenue per tenant: ~$500/mo (Pro tier average)
- Infrastructure cost per tenant: ~$343/mo (shared infra amortized)
- AI cost per tenant: ~$50/mo
- **Gross margin: ~78%**

**Unit economics at R3 target (10 tenants):**
- Revenue: ~$5,000/mo
- Infrastructure: ~$2,110/mo
- **Gross margin: ~58%** (AI costs scale sub-linearly with caching + prompt optimization)

### 18.4 Key Architecture References

For detailed technical specifications, refer to the architecture document:

| Topic | Architecture v3.1 Section |
|-------|---------------------------|
| AI Orchestrator 7-stage pipeline | Section 4 (AI Engine) |
| AI Capabilities (all models + token profiles) | Section 4 (Capabilities) |
| LLM Gateway + circuit breaker | Section 4 (Shared Infrastructure) |
| NATS stream topology (12 streams) | Section 5 (Event Bus) |
| Database schema + RLS (30 tables) | Section 6 (Database) |
| Integration adapters | Section 7 (Integration Gateway) |
| Security controls | Section 8 (Security & AI Safety) |
| Deployment + CI/CD | Section 9 (Deployment) |
| Monitoring + observability | Section 10 (Monitoring) |
| NL-to-WBS data flow | Cross-Cutting Pattern 1 |
| AI PM Agent loop | Cross-Cutting Pattern 2 |
| Client portal query flow | Cross-Cutting Pattern 3 |
| Architecture Decision Records | ADR Summary |
| Monorepo structure | Monorepo Structure |
| Cost model | Cost Model |
| Subsystem architectures (7 new) | Section 9 (Subsystem Architectures) |

### 18.5 UI/UX Wireframe References

For detailed wireframes and interaction specifications, refer to the UI/UX design document:

| Wireframe | Section | Sprint |
|-----------|---------|--------|
| W-01 App Shell | ui-ux-design.md, section 4.1 | R0-1 (scaffold), R0-5 (implementation) |
| W-03 Dashboard / What's Next | ui-ux-design.md, section 5.1 | R0-5 |
| W-04 Project List | ui-ux-design.md, section 5.2 | R0-5 |
| W-05 Project Detail | ui-ux-design.md, section 5.3 | R0-5 |
| W-06 Task Detail | ui-ux-design.md, section 5.4 | R0-5 |
| W-07 Task List | ui-ux-design.md, section 5.5 | R0-5 |
| W-08 AI Review Panel | ui-ux-design.md, section 5.6 | R0-5 |
| W-09 NL Query Panel | ui-ux-design.md, section 5.7 | R0-6 |
| W-10 Settings / AI Policy | ui-ux-design.md, section 5.8 | R0-5 |
| W-11 Login | ui-ux-design.md, section 5.9 | R0-2 |
| W-12 Kanban Board | ui-ux-design.md, section 6.1 | R1-6 |
| W-13 Calendar View | ui-ux-design.md, section 6.2 | R1-6 |
| W-14 Table View | ui-ux-design.md, section 6.3 | R1-6 |
| W-15 AI-Annotated Timeline | ui-ux-design.md, section 6.4 | R1-6 |
| W-16 Portfolio Dashboard | ui-ux-design.md, section 6.5 | R1-6 |
| W-17 Notification Inbox | ui-ux-design.md, section 6.6 | R1-6 |
| W-18 Dependency Graph | ui-ux-design.md, section 6.7 | R1-6 |
| W-19 Client Portal | ui-ux-design.md, section 7.1 | R1-5 (pilot), R2-1 (full) |
| W-20 Goals & OKR Dashboard | ui-ux-design.md, section 7.2 | R2-5 |
| W-21 Gantt Chart | ui-ux-design.md, section 7.3 | R2-5 |

---

*AI-Native PM Tool - Implementation Plan v1.1 - February 10, 2026 - 12 months - 24 sprints - 103 features - 16 milestones - 12 risks - 4 quality gates - Aligned to architecture-v3.1.md, roadmap-v2.md, ui-ux-design.md*
