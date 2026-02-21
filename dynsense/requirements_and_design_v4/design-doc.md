# Dynsense — System Design Document

**Version:** 4.0
**Date:** February 18, 2026
**Status:** Draft for Review
**Methodology:** Produced using swarm parallel agent research (3 concurrent agents)

---

## 1. Executive Summary

Dynsense is an AI-native project management platform targeting consultancy firms. The core thesis: **"The AI runs the project. The human supervises."** The system combines a full-featured PM tool (tasks, dependencies, checklists, comments, audit trails) with an AI orchestration engine that generates work breakdown structures, prioritizes tasks, predicts risks, nudges team members, and generates reports — all under configurable human oversight.

**Timeline:** 12 months, 4 releases (R0-R3), 24 sprints (2-week each)
**Team:** 5-7 engineers (2 backend, 1-2 AI/ML, 1-2 fullstack, 1 DevOps)
**Total Features:** 115 across all releases

---

## 2. Build Scope

### 2.1 Sprint Overview — All Not Started (Fresh Build)

| Sprint | Scope | Status |
|--------|-------|--------|
| **R0-1** | Infrastructure + Schema | NOT STARTED |
| **R0-2** | Auth + RBAC + Core API (9 modules) | NOT STARTED |
| **R0-3** | Agent SDK Foundation (orchestrator, hooks, MCP) | NOT STARTED |
| **R0-4** | AI Core Capabilities (WBS, review UI, shadow mode) | NOT STARTED |
| **R0-5** | What's Next + Summary + Frontend Core | NOT STARTED |
| **R0-6** | Confidence, Evaluation, Monitoring, Polish | NOT STARTED |

### 2.2 Target State (R0 Delivery)

**Infrastructure & Schema (R0-1):**
- Turborepo monorepo with 4 packages (web, agents, db, shared) via pnpm workspaces
- Next.js 14+ App Router as the single application (API Routes + UI)
- 19 Drizzle ORM tables in @vercel/postgres with RLS policies
- @vercel/kv for event pub/sub, rate limiting, session storage, cost tracking
- Pinecone SDK for vector embeddings (1536-dim, tenant-scoped)
- GitHub Actions CI/CD pipeline

**Auth & Core API (R0-2):**
- Auth.js v5+ credentials provider with bcrypt (cost 12)
- src/middleware.ts: tenant isolation + RBAC route guards + @vercel/kv rate limiting
- 9 Next.js API route modules: auth, users, projects, tasks, dependencies, comments, checklists, audit, config
- Field-level audit trail, DAG dependency detection, sub-tasks, @mentions, checklists

**Agent SDK Foundation (R0-3):**
- AIOrchestrator with 7-stage pipeline
- 4 subagent definitions: wbs-generator (Opus), whats-next (Sonnet), nl-query (Sonnet), summary-writer (Sonnet)
- 3 MCP servers: pm-db, pinecone, pm-events (@vercel/kv)
- 8 lifecycle hooks in deterministic order
- Permission chain (4-step evaluation)
- Autonomy policy engine (shadow/propose/execute)
- Session management backed by @vercel/kv

### 2.3 Full Build Scope by Release

| Area | Work | Target |
|------|------|--------|
| Infrastructure + Schema | Monorepo, @vercel/postgres, 19 tables, CI/CD | R0-1 |
| Auth + Core API | Auth.js v5+, 9 API modules, audit trail, RBAC | R0-2 |
| Agent SDK | Orchestrator, 4 agents, 3 MCP servers, 8 hooks, sessions | R0-3 |
| AI Core Capabilities | WBS generator, AI review UI, shadow mode | R0-4 |
| Frontend Core | Dashboard, task detail, auth pages, API client | R0-5 |
| AI Polish + Monitoring | Confidence checks, golden tests, NL query panel, Sentry | R0-6 |
| Advanced AI + Integrations | Risk predictor, AI PM agent, scope creep, Git/Slack | R1 |
| Client Portal + Monetization | Client portal, billing, goals, automations, docs | R2 |
| Per-Tenant AI + Enterprise | SOW generator, per-tenant learning, SOC 2 | R3 |

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
                        CLIENT LAYER
     Next.js 14+ (App Router, RSC) + Shadcn UI + Tailwind
     Internal PM Interface + Client Portal (R2)
                            |
                       HTTPS / WSS
                            |
                    GATEWAY & AUTH
     Vercel Edge | Auth.js v5+ | RBAC (4 roles) | @vercel/kv Rate Limiting
                            |
                   APPLICATION SERVICES
     Next.js API Routes — 9 Modules R0, 14 Modules Full
     (auth, users, projects, tasks, dependencies, comments,
     checklists, audit, config, notification, views, goals,
     automation, ai)
           |                |                |
      AI ENGINE        EVENT BUS       INTEGRATION
      7-Stage          @vercel/kv      GATEWAY
      Pipeline         pub/sub         Git, Slack
      10 Capabilities  channels        Calendar
           |                |
                   DATA LAYER
     @vercel/postgres (PostgreSQL 16) | @vercel/kv | @vercel/blob
     Pinecone (1536-dim, tenant-scoped)
     30 tables, RLS, embeddings
```

### 3.2 10-Tier Architecture

| Tier | Technology | Purpose |
|------|-----------|---------|
| 1. Client | Next.js 14+, React, Shadcn UI, Tailwind | Internal PM + Client Portal |
| 2. Gateway | Vercel Edge, Auth.js v5+, @vercel/edge-config | TLS, auth, rate limiting |
| 3. Application | Next.js API Routes, 9 modules R0 → 14 full | Business logic, CRUD, workflows |
| 4. AI Engine | Claude API (Opus/Sonnet), 7-stage pipeline | 10 AI capabilities |
| 5. Event Bus | @vercel/kv pub/sub channels | Async communication |
| 6. Database | @vercel/postgres (PostgreSQL 16) + Pinecone + @vercel/kv | Persistence, vectors, cache |
| 7. Integration | OAuth adapters for Git, Slack, Calendar | External signal collection |
| 8. Security | RLS, encryption, audit trails, SOC 2 | Multi-layer tenant isolation |
| 9. Deployment | Vercel (web), Vercel Cron Jobs (AI worker) | Serverless orchestration |
| 10. Observability | Vercel Analytics, Sentry | Metrics, traces, errors |

### 3.3 Module Architecture

Each API module follows the same structure:

```
app/api/v1/{name}/
  ├── route.ts      # Next.js API Route handler + Zod input validation
  └── service.ts    # Business logic + Drizzle ORM database operations
```

**14 Modules:**

| Module | Release | Status |
|--------|---------|--------|
| auth | R0 | NOT STARTED |
| users | R0 | NOT STARTED |
| projects | R0 | NOT STARTED |
| tasks | R0 | NOT STARTED |
| dependencies | R0 | NOT STARTED |
| comments | R0 | NOT STARTED |
| checklists | R0 | NOT STARTED |
| audit | R0 | NOT STARTED |
| config | R0 | NOT STARTED |
| ai | R0 | NOT STARTED |
| notification | R1 | NOT STARTED |
| views | R1 | NOT STARTED |
| goals | R2 | NOT STARTED |
| automation | R2 | NOT STARTED |

---

## 4. AI Engine Design

### 4.1 Seven-Stage Orchestration Pipeline

Every AI operation flows through a mandatory pipeline:

```
Stage 1: TRIGGER
  Input:  @vercel/kv event / API request / Vercel Cron Job
  Output: trigger_id, capability, context_requirements

Stage 2: AUTONOMY CHECK
  Input:  trigger_id, capability, tenant_id
  Output: disposition (shadow | propose | execute)

Stage 3: CONTEXT ASSEMBLY
  Input:  capability, context_requirements
  Output: assembled_context, token_count, RAG results
  Process: Pinecone (cosine, top-k=10) → event history → domain template → token budget

Stage 4: CONFIDENCE CHECK
  Input:  assembled_context, token_count
  Output: confidence_score (0.0-1.0), proceed boolean
  Threshold: 0.6 default, configurable per capability

Stage 5: LLM CALL
  Input:  prompt, model, context
  Output: raw_response, tokens, latency
  Routing: Opus for generation/risk, Sonnet for queries/summaries
  Retry: exponential backoff (1s, 2s, 4s), fallback Opus → Sonnet

Stage 6: POST-PROCESSING
  Input:  raw_response, expected_schema
  Output: parsed_result, validation_status, actions[]
  Validation via Zod, retry once on parse failure

Stage 7: DISPOSITION
  Input:  parsed_result, disposition_mode
  Output: ai_action_id, status
  Shadow: log only | Propose: create for review | Execute: apply + log
```

### 4.2 Ten AI Capabilities

| # | Capability | Model | Release | Token Profile | Purpose |
|---|-----------|-------|---------|---------------|---------|
| 1 | NL-to-WBS Generator | Opus | R0 | 5K/3K | Domain-aware project decomposition |
| 2 | What's Next Engine | Rules→Sonnet | R0→R1 | 1K/500 | Per-developer task prioritization |
| 3 | NL Query Engine | Sonnet | R0 | 2K/1K | Natural language project queries |
| 4 | Summary Engine | Sonnet | R0 | 3K/1K | Daily/weekly/client summaries |
| 5 | Risk Predictor | Opus | R1 | 4K/2K | Delay pattern analysis |
| 6 | AI PM Agent | Sonnet | R1 | 2K/500 | 15-min autonomous loop |
| 7 | Scope Creep Detector | Sonnet | R1 | 3K/1K | WBS baseline delta monitoring |
| 8 | AI Writing Assistant | Sonnet | R2 | 2K/1K | Content generation/improvement |
| 9 | SOW Generator | Opus | R3 | 8K/5K | Statements of Work from history |
| 10 | Per-Tenant Learning | RAG | R3 | Variable | Org-specific intelligence |

### 4.3 Autonomy Policy Engine

| Mode | Behavior | Default |
|------|----------|---------|
| Shadow | Runs pipeline, logs only. Admin-only review. Trust-building. | No |
| Propose | Generates proposal, human must approve/reject. | Yes (all) |
| Execute | Applies changes directly. Low-risk, tenant opt-in. | No |

Constraints: quiet hours (per timezone), nudge limits (2/task/day), confidence thresholds.

### 4.4 Hook System

| Phase | Hook | Purpose |
|-------|------|---------|
| PreToolUse (sequential) | tenant-isolator | Block cross-tenant, inject tenant_id |
| PreToolUse (sequential) | autonomy-enforcer | Shadow/propose/execute enforcement |
| PreToolUse (sequential) | rate-limiter | Redis sliding window + daily cost cap |
| PostToolUse (parallel) | cost-tracker | Token/cost to DB + Redis |
| PostToolUse (parallel) | audit-writer | Hook decision audit trail |
| PostToolUse (parallel) | traceability | Link tool calls to AI actions |
| PostToolUse (parallel) | notification-hook | User notifications on mutations |
| Stop (sequential) | session-manager | Persist session state |

### 4.5 MCP Tool System

| Server | Tools | Access |
|--------|-------|--------|
| pm-db | query, mutate, get_by_id | Read + Write (per agent permission) |
| pinecone | search, search_by_text | Read-only |
| pm-events | publish, subscribe | Event emission via @vercel/kv |

---

## 5. Database Design

### 5.1 Schema (30 Tables at Full Build)

**Core (R0):** tenants, users, projects, phases, tasks, task_assignments, task_dependencies, comments, mentions, task_checklists, checklist_items, audit_log, tenant_configs

**AI (R0):** ai_actions, ai_cost_log, ai_agent_configs, ai_sessions, ai_hook_log, ai_mcp_servers

**Extensions (R1-R2):** tags, task_tags, embeddings, custom_field_definitions, custom_field_values, saved_views, notifications, notification_preferences, reminders, goals, goal_task_links, automation_rules, forms, documents

### 5.2 Tenant Isolation (Three Layers)

1. **JWT Claims:** tenant_id in every access token
2. **Application Middleware:** SET LOCAL app.current_tenant_id per request
3. **PostgreSQL RLS:** USING clause on all 30 tables

### 5.3 Indexing Strategy

- tenant_id first in all composite indexes
- GIN for full-text search
- IVFFlat for pgvector (R0-R2), HNSW (R3+)
- Partial indexes on soft-delete flags
- Monthly partitioning on audit_log at 1M+ rows

---

## 6. Event-Driven Architecture

### 6.1 NATS JetStream (12 Streams)

| Stream | Key Subjects | Key Consumers |
|--------|-------------|---------------|
| pm.tasks | status_changed, assigned, completed, dependency_resolved | audit, ai-adaptive, embedding, notification, projection, automation |
| pm.projects | created, updated, phase_changed, baseline_set | ai-summarizer, embedding, scope-creep |
| pm.comments | created, updated, mention_created | embedding, notification |
| pm.ai | action_proposed, approved, rejected, executed, confidence_low | traceability, cost-tracker, evaluation |
| pm.integrations | git_commit, git_pr_merged, slack_message | ai-adaptive, task-module |
| pm.notifications | created | notification-router |
| pm.reminders | due | notification-generator |
| pm.goals | progress_updated, at_risk | notification, ai-adaptive |
| pm.automations | triggered, executed | audit-writer |
| pm.forms | submitted | task-module |
| pm.documents | created, updated | embedding-pipeline |
| pm.system | config_changed, tenant_created | cache-invalidation |

### 6.2 Consumer Guarantees

- At-least-once delivery with idempotent processing
- DLQ: 3 retries (1s, 5s, 25s), 7-day retention
- CloudWatch alarm on DLQ messages

---

## 7. Frontend Architecture

### 7.1 Technology

- Next.js 15 App Router + React Server Components
- Shadcn UI (Radix) + Tailwind CSS
- TanStack Query v5 for server state
- WebSocket for real-time (R1+)

### 7.2 Route Structure

```
app/
├── (internal)/              # PM interface
│   ├── dashboard/           # What's Next, AI summary, projects
│   ├── projects/[id]/       # Project detail + task views
│   ├── ai-review/           # Pending proposals
│   ├── notifications/       # Inbox (R1)
│   ├── goals/               # OKRs (R2)
│   ├── documents/           # KB (R2)
│   └── settings/            # Profile, AI policy, integrations
├── (portal)/                # Client-facing (R2)
│   └── [tenantSlug]/
└── (auth)/                  # Login, register, SSO
```

### 7.3 Key UI Surfaces

| Surface | Release | Description |
|---------|---------|-------------|
| Dashboard | R0 | What's Next, AI summary, projects, confidence gauges |
| Task Detail | R0 | Three-column: details + sidebar + activity |
| AI Review | R0 | High-density proposals with bulk actions |
| NL Query | R0 | Cmd+K panel, streaming, suggested queries |
| List View | R0 | Filterable/sortable task list |
| Kanban Board | R1 | Read-only AI-annotated (R1), drag-drop (R2) |
| Calendar View | R1 | Month/week/day with task chips |
| Table View | R1 | Spreadsheet-like with bulk edit |
| Client Portal | R2 | Milestones, completion %, AI assistant |

### 7.4 Design System

- **Typography:** Inter, text-xs (12px) baseline
- **AI Color:** Violet-600 (#7C3AED)
- **Confidence:** Green (>0.8), Yellow (0.6-0.8), Red (<0.6)
- **Priority:** Red (critical), Orange (high), Yellow (medium), Blue (low)
- **Grid:** 4px base, Tailwind spacing
- **Animations:** 300ms spring, prefers-reduced-motion

---

## 8. Security Architecture

### 8.1 Authentication

| Mechanism | Release |
|-----------|---------|
| Auth.js v5+ credentials provider, bcrypt (cost 12+), session JWT | R0 |
| RBAC: site_admin, pm, developer, client | R0 |
| SSO: SAML 2.0, OIDC | R1 |
| MFA: TOTP with recovery codes | R1 |
| Session hardening | R1 |

### 8.2 Data Protection

- AES-256 at rest (AWS KMS), TLS 1.3 in transit
- Client comments redacted before LLM
- Prompt injection defense: sanitization, structured fields, output validation

### 8.3 Compliance

| Milestone | Release |
|-----------|---------|
| SOC 2 controls implementation | R1 |
| SOC 2 Type I audit | R2 |
| SOC 2 Type I certification | R3 |
| SOC 2 Type II evidence | R3 |

---

## 9. Infrastructure & Deployment

### 9.1 Services (ECS Fargate)

| Service | R0 Tasks | R3 Tasks | CPU | Memory |
|---------|----------|----------|-----|--------|
| API | 2 | 2-8 | 1 vCPU | 2 GB |
| AI Worker | In-process | 2-6 | 1 vCPU | 4 GB |
| Web | 2 | 2-4 | 0.5 vCPU | 1 GB |
| NATS | 3 | 3 | 0.5 vCPU | 1 GB |

### 9.2 Cost Projection

| Release | Monthly Cost |
|---------|-------------|
| R0 | $380 |
| R1 | $565 |
| R2 (3 tenants) | $1,030 |
| R3 (10 tenants) | $2,110 |

---

## 10. Non-Functional Requirements

| Category | Target |
|----------|--------|
| API latency (p95) | <500ms core, <8s NL query, <30s WBS |
| Error rate | <0.1% |
| Availability | 99.9% |
| Tasks per tenant | 10,000+ |
| Concurrent tenants (R3) | 100+ |
| RTO / RPO | <1h / <15min |
| Encryption | AES-256 at rest, TLS 1.3 in transit |
| Audit retention | 7 years, immutable |
| Vector search (p95) | <100ms at 1M embeddings |

---

## 11. Architecture Decision Records

| ADR | Decision | Over | Rationale |
|-----|----------|------|-----------|
| 001 | Hosted Claude API | Self-hosted LLM | No GPU ops for 5-person team |
| 002 | pgvector co-located | Separate vector DB | One DB, SQL JOINs with vectors |
| 003 | NATS JetStream | Kafka | Lighter ops, sufficient scale |
| 004 | Shared schema + RLS | Schema-per-tenant | Fast, DB-enforced isolation |
| 005 | Hybrid pricing | Per-seat only | Aligns cost with AI value |
| 006 | PostgreSQL 16 | Multi-DB | Single operational surface |
| 007 | Fastify + TypeScript | NestJS / Python | Shared lang with Next.js |
| 008 | ECS Fargate | EKS | Zero cluster management |
| 009 | AWS CDK (TypeScript) | Terraform | Same language as app |
| 010 | Modular monolith | Microservices | Extract when scaling demands |
| 011 | Next.js 15 single app | Separate frontends | One codebase, route groups |
| 012 | CloudWatch + Sentry | Datadog | AWS-native, cost-effective |
