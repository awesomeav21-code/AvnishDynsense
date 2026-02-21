# AI-Native PM Tool -- System Architecture Reference

> **Version:** 1.0 | **Date:** February 2026 | **Status:** Approved
> **Source documents:** Architecture v3.0, Technical Design v1.0, Product Roadmap v2
> **Audience:** Engineering team, new hires, technical reviewers

---

## 1. Executive Summary

The AI-Native PM Tool is a project management platform where **the AI runs the project and the human supervises**. Unlike traditional PM tools that add AI as a feature, this product treats AI as the primary operator -- generating work breakdown structures from natural language, autonomously nudging stalled work, predicting risks, and producing client-facing narratives. Humans approve, override, and steer.

**Target market:** Consultancy firms and SaaS delivery teams managing complex projects where AI-driven automation can replace manual PM overhead.

**Scale trajectory:**

| Release | Timeline | Tenants | Users | Tasks | Focus |
|---------|----------|---------|-------|-------|-------|
| R0 | Months 1-3 | 1 (internal) | 10 | 1K | Core PM + NL-to-WBS + AI safety |
| R1 | Months 4-6 | 1-2 (pilot) | 20 | 10K | Integrations + AI PM Agent + Risk |
| R2 | Months 7-9 | 3-5 | 50 | 50K | Multi-tenant SaaS + Client portal |
| R3 | Months 10-12 | 10+ | 100+ | 100K+ | Per-tenant learning + SOW generation |

**Stack in one sentence:** Next.js 15 App Router + Fastify 5 modular monolith + PostgreSQL 16/pgvector + NATS JetStream + Claude AI (Opus 4 / Sonnet 4.5), deployed on AWS ECS Fargate, managed with AWS CDK in TypeScript.

**Team:** 5-7 engineers over a 12-month build. Every architecture decision optimizes for operator simplicity at this team size.

---

## 2. Architecture Principles

Seven governing principles resolve every design tension and inform every decision in this document.

| # | Principle | What It Means |
|---|-----------|---------------|
| 1 | **AWS-managed over self-managed** | ECS Fargate over Kubernetes. RDS over self-hosted PostgreSQL. ElastiCache over self-managed Redis. A 5-person team cannot operate a K8s cluster and build an AI product simultaneously. |
| 2 | **Monorepo, modular monolith, not microservices** | One deployable API with well-separated internal modules (project, task, dependency, comment, audit, user, AI). Extract services only when independent scaling is required (AI worker in R1). Premature microservices kill velocity at this team size. |
| 3 | **Event-driven from day 1** | NATS JetStream for the event bus -- lighter than Kafka, persistent with replay, sufficient through R3. Every state mutation emits an event. Every AI capability consumes events. |
| 4 | **Single database, stretched intelligently** | PostgreSQL 16 with pgvector for relational + vector in one engine. RLS for tenant isolation. JSONB for flexible fields. Evaluate a dedicated vector store only if p95 similarity search exceeds 100ms at 1M+ embeddings. |
| 5 | **AI is first-class infrastructure** | The AI engine is not a feature bolted onto a PM tool. It has its own orchestration pipeline, cost tracking, autonomy policies, traceability, evaluation harness, and circuit breakers -- all from R0. |
| 6 | **Security is structural** | `tenant_id` on every table from day 1. RLS enforced at the database layer. Immutable audit trail. SOC 2 controls built into the architecture, not retrofitted. |
| 7 | **Evergreen: build the R3 data model in R0** | The schema, event streams, and AI pipeline support per-tenant learning, client projection, and enterprise isolation from day 1 -- even if those features are not exposed until R2-R3. No rewrite gates between releases. |

---

## 3. System Context

### Actors

| Actor | Role | Release |
|-------|------|---------|
| **Site Admin** | Tenant management, AI policy configuration, user management, full system access | R0 |
| **Developer** | Task execution, What's Next consumer, AI action approvals (project-scoped) | R0 |
| **Client** | Portal access, scoped NL queries, view projected data only | R2 |
| **PM** | Project creation, AI oversight, client narrative approval, reporting | R3 |

### AI Models

| Model | Use Cases | Characteristics |
|-------|-----------|-----------------|
| **Claude Opus 4** | NL-to-WBS generation, risk prediction, SOW generation | Highest quality, higher latency, used for critical generation tasks |
| **Claude Sonnet 4.5** | NL queries, summaries, AI PM Agent nudges, scope creep detection | Fast, cost-efficient, used for high-frequency and interactive operations |

### External Integrations

| System | Protocol | Direction | Release |
|--------|----------|-----------|---------|
| GitHub / GitLab / Azure DevOps | Webhooks (inbound), REST API | Bidirectional | R1 |
| Slack / Microsoft Teams | OAuth 2.0, Events API, Slash commands | Bidirectional | R1 |
| Google / Outlook Calendar | CalDAV, OAuth 2.0, Microsoft Graph | Inbound (availability) | R1 |
| Jira | REST API (batch import) | Inbound only | R2 |
| Tenant webhooks | HMAC-SHA256 signed HTTP | Outbound | R2 |

### AWS Infrastructure

| Service | Purpose |
|---------|---------|
| ECS Fargate | Compute for API, AI workers, web, NATS cluster |
| RDS (Multi-AZ) | PostgreSQL 16 + pgvector |
| ElastiCache | Redis 7 (sessions, caching, rate limiting, queues) |
| S3 + CloudFront | File storage, static assets, CDN |
| ALB + WAF | Load balancing, TLS termination, OWASP protection |
| CloudWatch + X-Ray | Metrics, logs, distributed tracing |
| Secrets Manager | Database credentials, API keys, JWT signing keys |
| CDK (TypeScript) | Infrastructure as code |

---

## 4. 10-Tier Architecture

```
+============================================================================+
|  TIER 1: CLIENT LAYER                                                       |
|  Next.js 15 App Router | (internal) routes | (portal) routes | Slack Bot   |
+============================================================================+
          |                           |                        |
          v                           v                        v
+============================================================================+
|  TIER 2: GATEWAY & AUTH                                                     |
|  AWS ALB + WAF | JWT (RS256) | RBAC Engine | Tenant Config | WebSocket(R1)|
+============================================================================+
          |
          v
+============================================================================+
|  TIER 3: APPLICATION SERVICES (Fastify Modular Monolith)                    |
|  Project | Task | Dependency | Comment | Audit | User | Projection | Config|
+============================================================================+
          |                           |
          v                           v
+============================================================================+
|  TIER 4: AI ENGINE (THE PRODUCT)                                            |
|  Orchestrator (7-stage) | Capabilities (9) | Shared Infra (Gateway, RAG)   |
+============================================================================+
          |                           |
          v                           v
+============================================================================+
|  TIER 5: EVENT BUS                                                          |
|  NATS JetStream (3-node) | 6 Streams | 8 Durable Consumers | DLQ          |
+============================================================================+
          |
          v
+============================================================================+
|  TIER 6: DATABASE                                                           |
|  PostgreSQL 16 + pgvector (RDS) | Redis 7 (ElastiCache) | S3              |
+============================================================================+
          |
+============================================================================+
|  TIER 7: INTEGRATION GATEWAY                                                |
|  Git Adapter | Slack Adapter | Calendar Adapter | Webhooks | Jira Import   |
+============================================================================+

+============================================================================+
|  TIER 8: SECURITY & AI SAFETY                                               |
|  Encryption (AES-256/TLS 1.3) | RLS | Secrets Manager | PII | Prompt Def. |
+============================================================================+

+============================================================================+
|  TIER 9: DEPLOYMENT & CI/CD                                                 |
|  ECS Fargate | AWS CDK (TypeScript) | GitHub Actions | ECR | CloudFront   |
+============================================================================+

+============================================================================+
|  TIER 10: MONITORING & OBSERVABILITY                                        |
|  CloudWatch Metrics/Logs | X-Ray Tracing | Sentry | AI Dashboard          |
+============================================================================+
```

### Tier 1: Client Layer

**Purpose:** All user-facing surfaces. The AI is the primary interaction model; traditional PM interfaces are fallbacks.

**Technology:** Next.js 15, App Router, React Server Components, TypeScript 5+, Shadcn UI + Tailwind CSS

| Surface | Route Group | Release | Description |
|---------|-------------|---------|-------------|
| Web Application | `(internal)` | R0 | Primary PM interface. AI Review/Approve UI (FR-301), What's Next developer view (FR-201), NL Query panel (FR-203), project dashboards. Server Components for data fetching, Client Components for interactivity. |
| Client Portal | `(portal)/[tenantSlug]` | R2 | Client-facing view consuming the projection layer only. Filtered tasks, AI-generated narratives, scoped NL queries. White-labelable via tenant config. |
| Slack/Teams Bot | Lambda-backed | R1 | AI PM Agent delivery channel. Slash commands (`/aipm status`, `/aipm next`, `/aipm query`), inbound context, outbound nudges and summaries. |
| Public REST API | `/api/v1/` | R2 | External programmatic access with API key auth, cursor-based pagination, rate limiting, OpenAPI 3.1 docs. |

**Key decisions:**
- Single Next.js app with route groups avoids maintaining two frontends. No separate portal deployment.
- No mobile app in year 1. The Slack bot IS the mobile interface.
- No GraphQL. REST with composite endpoints (`?include=phases,tasks,dependencies`) handles all query patterns without schema overhead.

**Key UI surfaces:**
- **AI Review UI:** High-density review screen (not a chat box). Up to 50 AI suggestions in a scannable list. Bulk approve/reject. Keyboard shortcuts (a=approve, r=reject, j/k=navigate). Confidence-coded badges. Inline editing before approval.
- **What's Next view:** Per-developer prioritized task list. Replaces Kanban as default. R0: rules-based ranking (dependency status, due date, priority, downstream impact). R1: LLM-ranked with explanations.
- **NL Query panel:** Slide-out via Cmd/Ctrl+K. Streaming token display. Source references linked to tasks/projects. Confidence indicator.

### Tier 2: Gateway & Auth

**Purpose:** Single entry point for all traffic. Every request is authenticated, tenant-resolved, and rate-limited before reaching application code.

**Technology:** AWS ALB + WAF, custom Fastify auth plugin, RS256 JWT

| Component | Configuration | Release |
|-----------|---------------|---------|
| **ALB + WAF** | TLS 1.3 termination. Path-based routing: `/api/*` to API, `/*` to Web. WAF: OWASP Core Rule Set, Known Bad Inputs, IP Reputation, rate limiting (1000 req/5min/IP). | R0 |
| **JWT Auth** | RS256 asymmetric signing. Access token: 1h expiry, carries `{tenant_id, user_id, role}`. Refresh token: 30d, stored in Redis, HttpOnly/Secure/SameSite=Strict cookie. Key rotation every 90 days. | R0 |
| **RBAC Engine** | 4-stage rollout: Admin + Developer (R0), +Client (R2), +PM (R3). Per-request chain: authenticate -> resolve tenant -> set RLS context -> check role -> check resource scope. | R0-R3 |
| **Session State** | Redis (ElastiCache). Max 5 concurrent sessions/user. Forced logout by key deletion. Token rotation on every refresh. | R0 |
| **SSO/MFA** | SAML 2.0 (passport-saml) + OIDC (openid-client). TOTP MFA via authenticator apps. Admin-enforceable per-role. | R1 |
| **Tenant Config** | Per-tenant settings (status labels, priority scales, AI preferences, feature flags, autonomy defaults). Redis-cached (5min TTL), NATS-invalidated on update. | R0 |

**Key decision -- custom auth over Auth0/Clerk:** The trust model requires full control over tenant isolation in JWT claims, session management, and audit trails. Third-party auth creates a dependency where tenant isolation is someone else's responsibility.

### Tier 3: Application Services (Modular Monolith)

**Purpose:** One deployable Fastify API with well-separated internal modules. Each module owns its domain logic, database queries, and event emissions.

**Technology:** Fastify 5, Node.js 22 LTS, Drizzle ORM, TypeBox + Zod, Turborepo + pnpm workspaces

**Module structure (each module follows this pattern):**
```
modules/{name}/
  routes/           -> HTTP handlers (thin, delegates to service)
  services/         -> Business logic (domain rules)
  repositories/     -> Database access (Drizzle queries)
  types/            -> Module-specific TypeScript types
  events/           -> NATS event producers
```

| Module | Key Responsibilities | Key Design Decisions |
|--------|---------------------|---------------------|
| **Project** | CRUD, NL description storage, WBS baseline snapshots (JSONB), phase management, composite endpoints | Baseline snapshot enables scope creep detection |
| **Task** | Full lifecycle state machine (created -> in_progress -> in_review -> completed), multiple assignees via `task_assignments` junction table (assignee/reviewer/approver roles), effort tracking, `ai_generated` + `ai_confidence` flags, single-level sub-tasks | State machine enforced in service layer, not DB triggers |
| **Dependency** | Finish-to-start relationships, circular dependency prevention via app-layer DAG traversal (BFS), automatic blocked/unblocked status propagation | App-layer over DB triggers for testability |
| **Comment** | Per-task threads, `client_visible` boolean for projection filtering, edit/delete with "edited" indicator, feeds embedding pipeline for RAG | Default `client_visible = false` (internal by default) |
| **Audit** | Immutable `audit_log` (INSERT only, no UPDATE/DELETE). Field-level diffs: entity_type, entity_id, field_name, old_value, new_value, actor_type (user/ai/system/integration), ai_action_id FK. Monthly partitioning. | Dual approach: service call + NATS consumer for coverage |
| **User** | Tenant-scoped user management, `/users/me/next` endpoint for What's Next, availability tracking, workload metrics | What's Next is a core endpoint, not a secondary feature |
| **Projection** | Internal truth -> client-safe view transformation. Field-level redaction, internal/external classification, narrative generation, approval workflow for client-facing content | Data layer, not UI filter. All fields internal by default. |
| **Config** | Per-tenant settings (status labels, priorities, AI thresholds, autonomy mode, quiet hours, SSO, branding) | Redis-cached with 5min TTL, NATS event invalidation |

**Cross-module rules:**
- Modules communicate via service interfaces, never importing another module's repository
- Cross-module queries use in-process service-to-service calls (no HTTP between modules)
- Events are the primary mechanism for cross-module side effects

### Tier 4: AI Engine (THE PRODUCT)

**Purpose:** This is the product. Every other tier exists to feed data into and execute actions from this tier.

#### 4A. AI Orchestrator -- 7-Stage Pipeline

All AI operations flow through a single orchestration pipeline. No AI capability calls the LLM directly.

```
Stage 1: TRIGGER
  Input:  Event from NATS, user request from API, or scheduled job
  Output: { trigger_id, capability, context_requirements }

Stage 2: AUTONOMY CHECK
  Input:  { trigger_id, capability, action_type, tenant_id }
  Output: { disposition: shadow | propose | execute, policy_ref }
  Logic:  Load tenant autonomy policy -> match action type -> return mode

Stage 3: CONTEXT ASSEMBLY
  Input:  { trigger_id, capability, context_requirements }
  Output: { assembled_context, token_count, rag_results[], domain_template }
  Steps:  Tenant data -> pgvector search (cosine, top-k=10) -> event history -> template -> token budget

Stage 4: CONFIDENCE CHECK
  Input:  { assembled_context, capability_thresholds }
  Output: { confidence_score, proceed: boolean, degradation_strategy? }
  Factors: RAG quality, context completeness, data freshness, historical volume
  Threshold: 0.6 default (configurable per tenant)
  Fallbacks: ask_human, reduce_scope, use_template, skip

Stage 5: LLM CALL
  Input:  { prompt, model, context, streaming: boolean }
  Output: { raw_response, model_used, input_tokens, output_tokens, latency_ms }
  Route:  Via LLM Gateway with circuit breaker, retry, fallback chain

Stage 6: POST-PROCESSING
  Input:  { raw_response, expected_schema }
  Output: { parsed_result, validation_status, actions[] }
  Logic:  Parse JSON -> validate schema -> extract actions -> retry once on failure

Stage 7: DISPOSITION
  Input:  { parsed_result, actions[], disposition_mode }
  Output: { ai_action_id, status: logged | proposed | executed }
  Modes:  shadow (log only) | propose (human approval) | execute (apply + log + rollback data)
```

#### 4B. AI Capabilities (9 Total)

| Capability | Model | Release | Token Profile | Core Value |
|------------|-------|---------|---------------|------------|
| **NL-to-WBS Generator** | Opus 4 | R0 | 5K in / 3K out | Converts NL project descriptions to structured WBS via 5-stage sub-pipeline (domain detection -> template selection -> RAG enrichment -> generation -> schema validation). 40%+ of R0 AI effort. |
| **What's Next Engine** | Rules (R0), Sonnet (R1) | R0 | 1K/500 (R1) | Per-developer task prioritization. R0: dependency resolved -> due date -> priority -> downstream impact (pure algorithm). R1: LLM-ranked with velocity context. |
| **NL Query Engine** | Sonnet 4.5 | R0 | 2K/1K | Natural language questions about project state. RAG retrieval -> Sonnet synthesis. Streaming, target p95 <8s. |
| **Summary Engine** | Sonnet 4.5 | R0/R1 | 3K/1K | Daily summaries (R0), weekly status reports (R1), client narratives through projection layer (R2). |
| **Risk Predictor** | Opus 4 | R1 | 4K/2K | Pattern analysis: blocker duration, stalled tasks, dependency chain growth, scope drift, resource concentration, velocity decline. Shadow mode first 2-4 weeks. |
| **AI PM Agent** | Sonnet 4.5 | R1 | 2K/500/action | Autonomous async agent on 15-min loop. Chases overdue via Slack DMs, nudges stalled work, proposes escalations. Quiet hours enforced, max 2 nudges/task/day. |
| **Scope Creep Detector** | Sonnet 4.5 | R1 | 3K/1K | Monitors task additions vs original WBS baseline. Alerts when scope drifts >15%. |
| **SOW Generator** | Opus 4 | R3 | 8K/5K | Revenue-generating: generates Statements of Work from historical delivery data. Long-context with template system + mandatory approval. |
| **Per-Tenant Learning** | RAG enrichment | R3 | Variable | Tenant-scoped RAG that improves as projects complete. Not fine-tuning -- pattern recognition from historical delivery data embedded in pgvector. |

#### 4C. Shared AI Infrastructure

| Component | Purpose |
|-----------|---------|
| **Context Assembly Layer** | Loads tenant data, pgvector similarity search (cosine, top-k=10, tenant-scoped), event history aggregation, domain template selection, per-operation token budget enforcement. |
| **LLM Gateway** | Model routing (Opus for generation/risk, Sonnet for queries/summaries). Retry with exponential backoff (3 attempts: 1s, 2s, 4s). Fallback chain: Opus -> Sonnet. Streaming for interactive queries. Per-tenant rate limiting. **Circuit breaker: 5 consecutive failures -> 60s open -> cached/fallback responses -> half-open probe -> closed on success.** |
| **Prompt Registry** | Versioned YAML files in repo (`/prompts/{capability}/v{N}.yaml`). Handlebars-style context injection. Schema validation for output format. Version-pinned per capability. PR-reviewed like code. A/B testing support. |
| **Evaluation Harness** | Golden test sets per capability. Automated on prompt version changes. Tracks: acceptance rate (target >80%, alert <60%), override rate (alert >40%), hallucination incidents (any = investigation), schema validation pass rate (target >95%). |
| **Traceability Pipeline** | Every AI action logged in `ai_actions` table: trigger_event -> context_assembled (truncated) -> prompt_sent (hash) -> model_output -> confidence_score -> disposition -> human_review -> rollback_data. Full chain queryable via API. |
| **Cost Tracker** | Redis counters per tenant per month. `ai_cost_log` table for per-operation detail. Pre-flight budget check before every LLM call. Alerts at 80% and 100%. Non-critical operations throttled at 100%, critical operations continue with warning. |

### Tier 5: Event Bus

**Purpose:** The nervous system. Every AI capability, integration, and observability pipeline consumes from this bus.

**Technology:** NATS JetStream 2.10+, 3-node cluster on ECS Fargate, EFS persistence, 30-day retention, at-least-once delivery.

**Stream Topology (6 Streams):**

| Stream | Key Subjects | Producers | Key Consumers |
|--------|-------------|-----------|---------------|
| `pm.tasks` | `.created`, `.updated`, `.status_changed`, `.assigned`, `.completed`, `.dependency_resolved`, `.dependency_blocked` | Task Module | AI Adaptive Engine, Audit Writer, Embedding Pipeline, Notification Router, Projection Updater |
| `pm.projects` | `.created`, `.updated`, `.phase_changed`, `.baseline_set` | Project Module | AI Summarizer, Embedding Pipeline, Scope Creep Detector |
| `pm.comments` | `.created`, `.updated`, `.deleted` | Comment Module | Embedding Pipeline, Notification Router |
| `pm.ai` | `.action_proposed`, `.action_approved`, `.action_rejected`, `.action_executed`, `.confidence_low` | AI Orchestrator | Traceability Pipeline, Cost Tracker, Evaluation Harness |
| `pm.integrations` | `.git_commit`, `.git_pr_merged`, `.slack_message`, `.calendar_updated` | Integration Adapters | AI Adaptive Engine, Task Module (auto-complete) |
| `pm.system` | `.config_changed`, `.tenant_created`, `.user_invited` | Config, User Modules | Config Cache Invalidation, Notification Router |

**Durable Consumers (8):**

| Consumer | Subscribes To | Purpose | Release |
|----------|--------------|---------|---------|
| `audit-writer` | `pm.tasks.*`, `pm.projects.*`, `pm.comments.*`, `pm.ai.*` | Immutable audit log entries | R0 |
| `ai-adaptive` | `pm.tasks.*`, `pm.integrations.*` | Feeds AI task engine | R0/R1 |
| `ai-summarizer` | `pm.tasks.*`, `pm.projects.*`, `pm.comments.*` | Aggregates for summaries | R0 |
| `embedding-pipeline` | `pm.tasks.created/updated`, `pm.comments.created`, `pm.projects.created` | Generates pgvector embeddings | R0 |
| `projection-updater` | `pm.tasks.*`, `pm.projects.*`, `pm.comments.*` | Updates client-facing views | R0/R2 |
| `notification-router` | `pm.tasks.assigned/status_changed`, `pm.comments.created`, `pm.ai.action_proposed` | Routes to in-app, email, Slack | R0/R1 |
| `cost-tracker` | `pm.ai.*` | Per-tenant AI cost tracking | R0 |
| `escalation-monitor` | `pm.tasks.status_changed`, `pm.tasks.dependency_blocked` | Monitors escalation conditions | R1 |

**DLQ:** 3 retries with exponential backoff (1s, 5s, 25s). Per-consumer DLQ stream. 7-day retention. CloudWatch alarm on any DLQ message. Manual replay via admin CLI.

**Idempotency:** All consumers deduplicate via event `id` field stored in Redis (7-day TTL).

**Key decision -- NATS over Kafka:** At 8 consumers and <10K events/day, NATS JetStream provides persistence, replay, and consumer groups without ZooKeeper, broker tuning, or partition rebalancing. Revisit when consumer count >50 or throughput >100K events/min.

### Tier 6: Database

**Purpose:** One database, stretched intelligently. Separate stores only where access patterns demand it.

| Store | AWS Service | Configuration | Purpose |
|-------|-------------|---------------|---------|
| **PostgreSQL 16** | RDS Multi-AZ | R0: `db.r6g.large` (2 vCPU, 16 GB). R2: `db.r6g.xlarge` + read replica | Primary relational store. `tenant_id` on every table. Strong FK constraints. JSONB for baselines, AI metadata, configurable fields. Drizzle ORM with versioned migrations. |
| **pgvector** | Co-located in RDS | `text-embedding-3-small` (1536d). IVFFlat index (R0-R2), evaluate HNSW at R3 | Task/comment/project embeddings for RAG. Co-located enables SQL JOINs in vector queries. |
| **Redis 7** | ElastiCache Serverless | AOF persistence + hourly snapshots | Sessions, rate limiting, AI queues (BullMQ), config cache, AI response cache, presence |
| **S3** | S3 Standard + Glacier | 4 buckets: uploads, exports, reports, backups. Cross-region replication on backups | Files, exports, generated PDFs, DB backups, prompt archives |
| **Full-Text Search** | PostgreSQL FTS | `tsvector` columns + GIN indexes on tasks, projects, comments | Avoids Elasticsearch until R3 scale (>500K documents or faceted search needed) |

**Row-Level Security (Tenant Isolation):**

Every tenant-scoped table has an RLS policy:
```sql
CREATE POLICY tenant_isolation ON tasks
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

The API middleware sets `app.current_tenant_id` per request from the JWT claim via `SET LOCAL` (scoped to the current transaction -- no cross-request leakage). Application code physically cannot query across tenants. This is database-enforced, not application-trust.

**Schema design principles:**
- `tenant_id` first column in every composite index (tenant locality in B-tree scans)
- Soft deletes (`deleted_at`) on all user-facing entities
- `ai_generated` boolean + `ai_confidence` float on tasks, comments, and project fields
- `audit_log`: INSERT-only, monthly partitioned, no UPDATE/DELETE grants
- `created_at` / `updated_at` auto-managed via triggers

### Tier 7: Integration Gateway

**Purpose:** Adapters that bring external signals into the event bus. Each adapter is a Fastify plugin that normalizes events to `pm.integrations.*` NATS subjects.

| Adapter | Protocol | Release | Key Value |
|---------|----------|---------|-----------|
| **Git** (GitHub, GitLab, Azure DevOps) | Webhooks inbound | R1 | Ground truth signal. Auto-link commits/PRs to tasks via branch naming. Auto-complete tasks on PR merge (when autonomy allows). Prevents AI from hallucinating progress based on stale data. |
| **Slack / Teams** | OAuth 2.0 + Events API + Slash commands | R1 | Bidirectional. Inbound: slash commands, message context. Outbound: AI PM Agent nudges, daily summaries, risk alerts. App Home tab. |
| **Calendar** (Google, Outlook) | CalDAV / OAuth 2.0 | R1 | Team availability for resource optimization. Milestone meetings auto-created. |
| **Webhooks** (outbound) | Tenant-configurable | R2 | HMAC-SHA256 signed. 3 retries (10s, 60s, 300s). Auto-disable on persistent failure. |
| **Jira Import** | REST API batch | R2 | One-time migration: projects, tasks, dependencies, comments. Sales friction reduction. |

**Adapter architecture:** Each integration is a Fastify plugin with three responsibilities: (1) authenticate the external service, (2) normalize inbound events to NATS, (3) format outbound messages. Adapters share no state. Adding a new integration = adding a new plugin file.

### Tier 8: Security & AI Safety

**Purpose:** Security is structural in this architecture, not a feature. This tier covers additional controls beyond the per-tier enforcement.

**Encryption:**

| Data State | Method |
|------------|--------|
| At rest (RDS, S3, ElastiCache) | AES-256 via AWS KMS (automatic key rotation) |
| In transit (all connections) | TLS 1.3 (ACM-managed certificates) |
| JWT signing | RS256 asymmetric keypair in Secrets Manager |

**Three-Layer Tenant Isolation:**
```
Layer 1: JWT Claims     -> tenant_id verified at auth middleware
Layer 2: App Middleware  -> SET LOCAL app.current_tenant_id = '<tenant_id>'
Layer 3: PostgreSQL RLS  -> USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
```

**AI-specific isolation:** RAG queries include `WHERE tenant_id = :tenant_id` (not post-filter). Embedding queries filter at the vector search level. Context assembly assertions verify single-tenant data.

**Additional controls:**

| Control | Implementation | Release |
|---------|---------------|---------|
| Secrets management | AWS Secrets Manager. Auto-rotation (DB: 30d, JWT: 90d). Never in env vars or code. | R0 |
| Immutable audit trail | INSERT-only table. No UPDATE/DELETE grants. Monthly partitioning. 7yr retention. | R0 |
| PII handling | Comment redaction before LLM, email hashing in logs, configurable regex patterns | R1 |
| Prompt injection defense | Input sanitization, structured fields, output schema validation, action logging | R2 |
| SOC 2 Type I | Access controls, change management, data protection, monitoring | R2 |
| SOC 2 Type II | 6-month sustained evidence collection, automated control monitoring | R3 |

### Tier 9: Deployment & CI/CD

**Purpose:** Managed infrastructure optimized for a small team. GitOps for reproducibility.

**ECS Fargate Services:**

| Service | R0 | R3 | CPU | Memory |
|---------|----|----|-----|--------|
| API | 2 tasks | 2-8 tasks | 1 vCPU | 2 GB |
| AI Workers | 1 (in-process) | 2-6 (separate) | 1 vCPU | 4 GB |
| Web (Next.js) | 2 tasks | 2-4 tasks | 0.5 vCPU | 1 GB |
| NATS Cluster | 3-node | 3-5 node | 0.5 vCPU | 1 GB |

**Auto-scaling:** API scales on CPU 70%. AI Workers scale on BullMQ queue depth >50. Web scales on CPU 70%.

**CDK Stacks (5):**

| Stack | Resources |
|-------|-----------|
| `VpcStack` | VPC, subnets (public/private/isolated), NAT gateways, security groups |
| `DatabaseStack` | RDS PostgreSQL, ElastiCache Redis, S3 buckets |
| `ComputeStack` | ECS cluster, Fargate services, ALB, target groups, auto-scaling |
| `MonitoringStack` | CloudWatch dashboards, alarms, SNS topics, X-Ray |
| `PipelineStack` | ECR repositories, IAM roles |

**CI/CD Pipeline (GitHub Actions):**
```
PR Created/Updated
  |-- [Parallel] lint (ESLint + Prettier)
  |-- [Parallel] type-check (tsc --noEmit)
  |-- [Parallel] unit test (Vitest, coverage)
  |
  +-- [Sequential]
      |-- integration test (testcontainers: PG, Redis, NATS)
      |-- build (Turborepo)
      |-- Docker build + push to ECR
      |-- Deploy to staging + smoke tests
      |-- [Manual gate] Approve production
      +-- Deploy to production (rolling, zero-downtime, auto-rollback)
```

**Environments:** dev (single-AZ, minimal), staging (mirrors prod topology), prod (Multi-AZ, encrypted, PagerDuty).

**Key decision -- ECS Fargate over Kubernetes:** No node pools, no Helm, no ArgoCD, no cluster RBAC. Fargate provides auto-scaling containers at the complexity ceiling a 5-person team should operate. Revisit when service count >15 or team has a dedicated platform engineer.

### Tier 10: Monitoring & Observability

**Purpose:** AI-specific observability beyond standard application monitoring.

| Component | Tool | Purpose |
|-----------|------|---------|
| Metrics | CloudWatch + EMF | Request latency, error rates, task throughput, AI operation latency, token usage, cost per operation, confidence distributions |
| Logging | CloudWatch Logs + Insights | Centralized structured JSON logs. 30-day retention (prod), 7-day (staging). |
| Tracing | AWS X-Ray | End-to-end request tracing: API -> AI Orchestrator -> LLM Gateway -> Database |
| Errors | Sentry (SaaS) | Frontend error capture with source maps, breadcrumbs, release tracking |
| Alerting | CloudWatch Alarms -> SNS -> PagerDuty/Slack | See alerting rules below |

**Alerting Rules:**

| Condition | Severity | Channel |
|-----------|----------|---------|
| Circuit breaker OPEN | Critical | PagerDuty + Slack |
| AI failure rate >10% (5min window) | High | Slack |
| Per-tenant budget exceeded | Medium | Slack + tenant admin email |
| NATS consumer lag >1000 | High | Slack |
| RDS connection pool >80% | High | PagerDuty |
| API p95 latency >2s | Medium | Slack |
| 5xx spike >5% in 5min | Critical | PagerDuty + Slack |
| Any DLQ message | Medium | Slack |
| ECS task crash loop (>3 in 10min) | Critical | PagerDuty |

**AI Observability Dashboard:** Per-capability latency histograms, per-tenant budget gauges, acceptance/rejection rates, token usage by capability, circuit breaker state, shadow vs live distribution, confidence histograms, cost per tenant per day.

---

## 5. Data Architecture

### Entity Relationship Summary

```
tenants 1---* users
tenants 1---* projects
tenants 1---* tenant_configs

projects 1---* phases
projects 1---* tasks

tasks 1---* task_assignments ---* users
tasks 1---* task_dependencies (self-referential: task_id <-> blocked_by_task_id)
tasks 1---* comments
tasks *---* tags (via task_tags)
tasks 1---* tasks (parent_task_id, single-level only)

ai_actions *---1 users (reviewed_by)
audit_log *---? ai_actions (ai_action_id, nullable)

embeddings (tenant_id, entity_type, entity_id) -- polymorphic reference to tasks/comments/projects
```

### Key Tables

| Table | Key Columns (beyond id, tenant_id, timestamps) | Purpose |
|-------|------------------------------------------------|---------|
| `tenants` | name, slug, plan, settings (JSONB), ai_budget_monthly_usd | Workspace entities |
| `users` | email, password_hash, role, mfa_enabled, notification_prefs (JSONB) | Tenant-scoped users |
| `projects` | name, nl_description, wbs_baseline (JSONB), status, dates | Project containers |
| `phases` | project_id, name, sort_order, status | Ordered phases within projects |
| `tasks` | project_id, phase_id, parent_task_id, title, status, priority, estimated/actual_effort, ai_generated, ai_confidence, client_visible, search_vector (tsvector), metadata (JSONB) | Core work items |
| `task_assignments` | task_id, user_id, role (assignee/reviewer/approver), assigned_by | Multiple assignees per task |
| `task_dependencies` | task_id, blocked_by_task_id, dependency_type (finish_to_start) | DAG of task dependencies |
| `comments` | task_id, author_id, content, client_visible, edited_at | Per-task discussions |
| `ai_actions` | trigger_source, capability, model_used, prompt_version/hash, input/output_tokens, cost_usd, confidence_score, disposition, status, model_output (JSONB), rollback_data (JSONB), reviewed_by | Full AI traceability |
| `ai_cost_log` | ai_action_id, capability, model, input/output_tokens, cost_usd | Per-operation cost detail |
| `audit_log` | entity_type, entity_id, action, field_name, old_value, new_value, actor_type, actor_id, ai_action_id | Immutable field-level audit |
| `embeddings` | entity_type, entity_id, content_hash, embedding (vector 1536), metadata (JSONB) | pgvector for RAG |
| `tenant_configs` | config_key, config_value (JSONB) | Per-tenant settings |

### Embedding Strategy

| Aspect | Configuration |
|--------|---------------|
| Model | `text-embedding-3-small` (OpenAI) |
| Dimensions | 1536 |
| Index | IVFFlat (R0-R2), evaluate HNSW at R3 |
| Similarity | Cosine distance |
| Retrieval | top-k=10, always scoped by `tenant_id` in WHERE clause |
| Entities embedded | Tasks, comments, project descriptions, audit summaries |
| Deduplication | `content_hash` (SHA-256) prevents re-embedding unchanged content |

### Data Retention

| Data | Retention | Archive |
|------|-----------|---------|
| Audit logs | 7 years | S3 Glacier after 90 days |
| Task/project data | Tenant lifetime | Soft delete, hard delete after retention period |
| AI action logs | 2 years | S3 Glacier after 90 days |
| AI cost logs | 2 years | Aggregated monthly after 90 days |
| Embeddings | Tenant lifetime | Regenerated on content change |
| Event bus (NATS) | 30 days | N/A |
| Application logs | 30 days (prod) | S3 for 1 year |

---

## 6. AI Pipeline Deep Dive

### 7-Stage Pipeline (I/O per Stage)

| Stage | Input | Output | Latency Target |
|-------|-------|--------|----------------|
| 1. TRIGGER | NATS event, API request, or cron | `{trigger_id, capability, context_requirements}` | <5ms |
| 2. AUTONOMY CHECK | `{trigger_id, capability, tenant_id}` | `{disposition: shadow/propose/execute}` | <5ms |
| 3. CONTEXT ASSEMBLY | `{trigger_id, context_requirements}` | `{assembled_context, token_count, rag_results[], template}` | <500ms |
| 4. CONFIDENCE CHECK | `{assembled_context, thresholds}` | `{confidence_score, proceed, degradation_strategy?}` | <5ms |
| 5. LLM CALL | `{prompt, model, context, streaming}` | `{raw_response, tokens, latency_ms}` | 2-30s (model dependent) |
| 6. POST-PROCESSING | `{raw_response, expected_schema}` | `{parsed_result, actions[]}` | <100ms |
| 7. DISPOSITION | `{parsed_result, actions[], mode}` | `{ai_action_id, status}` | <50ms |

### NL-to-WBS Sub-Pipeline (5 Stages)

```
Stage 1: DOMAIN DETECTION
  Method: Keyword analysis + Sonnet classification (lightweight)
  Output: { domain: software_delivery | data_migration | consultancy | general }

Stage 2: TEMPLATE SELECTION
  Method: Load domain-specific prompt YAML from Prompt Registry
  Output: { template_path, domain_context }

Stage 3: RAG ENRICHMENT
  Method: Embed NL description -> pgvector cosine search (tenant-scoped, top-10)
  Output: { similar_projects[], estimation_accuracy }

Stage 4: OPUS GENERATION
  Method: Claude Opus 4 with structured output
  Input:  Template + NL description + similar projects + estimation patterns
  Output: { raw_wbs_json }

Stage 5: SCHEMA VALIDATION
  Method: Validate JSON (phases, tasks, dependencies, estimates)
  Retry:  Once with format correction prompt on failure
  Output: { validated_wbs, validation_errors[] }
```

### Autonomy Modes

| Mode | Data Modified? | User Visible? | Human Approval? | Use Case |
|------|---------------|---------------|-----------------|----------|
| `shadow` | No | Admin-only dashboard | No | Trust-building. AI runs but nothing happens. |
| `propose` | No (until approved) | AI Review UI | Yes, mandatory | Default for most actions. Human supervises. |
| `execute` | Yes, immediately | Post-hoc activity feed | No (but logged) | Low-risk, high-confidence, tenant opted-in. |

**Default policy:** Propose everything, execute nothing. Read-only operations (What's Next, NL Query, daily summaries) default to execute. Data-modifying operations (WBS generation, escalations, client narratives) always require approval.

### Circuit Breaker Pattern

```
CLOSED (normal) --[5 consecutive failures]--> OPEN (60s cooldown)
                                                |
                                   All requests return cached/fallback
                                                |
                                   After 60s --> HALF-OPEN (probe)
                                                |
                               1 request allowed through
                                   /              \
                              success           failure
                                |                  |
                             CLOSED              OPEN (reset timer)
```

### Cost Tracking & Budget Enforcement

- **Real-time counters:** Redis key `ai_cost:{tenant_id}:{year}:{month}` incremented on every LLM call
- **Persistent log:** `ai_cost_log` table with per-operation detail
- **Pre-flight check:** Before every LLM call, verify tenant is within monthly budget
- **Tier budgets:** Starter (500 ops/mo), Pro (2000 ops/mo), Enterprise (5000+ ops/mo)
- **Alerts:** 80% and 100% of budget
- **At 100%:** Non-critical operations throttled, critical operations continue with warning

---

## 7. Event Architecture

### Stream Topology

| Stream | Subject Count | Expected Volume (R2) | Retention |
|--------|--------------|---------------------|-----------|
| `pm.tasks` | 7 subjects | ~5K events/day | 30 days |
| `pm.projects` | 4 subjects | ~200 events/day | 30 days |
| `pm.comments` | 3 subjects | ~1K events/day | 30 days |
| `pm.ai` | 5 subjects | ~500 events/day | 30 days |
| `pm.integrations` | 4 subjects | ~2K events/day | 30 days |
| `pm.system` | 3 subjects | ~50 events/day | 30 days |

### Event Schema (Base Interface)

All events extend this base:
```typescript
interface BaseEvent {
  type: string;           // dot-notation subject (e.g., "pm.tasks.created")
  id: string;             // unique UUID for idempotency
  timestamp: string;      // ISO 8601
  tenant_id: string;      // every event is tenant-scoped
  actor: {
    type: 'user' | 'ai' | 'system' | 'integration';
    id: string;
  };
}
```

### Event Flow Example: Task Creation via WBS

```
1. User approves WBS        -> POST /api/v1/ai/actions/:id/approve
2. Task Module: bulk create  -> 28x INSERT INTO tasks
3. Events emitted:
   - pm.ai.action_approved  (1 event)
   - pm.tasks.created       (28 events)
   - pm.projects.baseline_set (1 event)
4. Consumer processing:
   - audit-writer:          writes 28 audit_log entries
   - embedding-pipeline:    generates 28 embeddings
   - projection-updater:    updates client-visible task views
   - cost-tracker:          records AI operation cost
   - notification-router:   notifies assignees
```

### Event Flow Example: AI Action Lifecycle

```
1. AI Orchestrator generates proposal
   -> pm.ai.action_proposed { capability, confidence, summary }
2. Human reviews in AI Review UI
   -> pm.ai.action_approved  (or pm.ai.action_rejected)
3. If approved: orchestrator executes
   -> pm.ai.action_executed { affected_entities }
4. Consumers:
   - traceability-pipeline: updates ai_actions record
   - cost-tracker: logs token usage
   - evaluation-harness: tracks acceptance rate
```

---

## 8. Key Data Flows

### Flow 1: NL-to-WBS (The Core Product Flow)

```
User describes project in NL (Web App)
  -> POST /api/v1/projects/:id/generate-wbs
    -> Auth + tenant resolution
    -> AI Orchestrator:
       1. TRIGGER: WBS generation
       2. AUTONOMY: mode = propose (always for WBS)
       3. CONTEXT: pgvector similar projects + domain template + estimation history
       4. CONFIDENCE: 0.82 (proceed)
       5. LLM: Claude Opus 4 (4.2K in, 2.8K out, 11.2s)
       6. POST-PROCESS: Parse JSON, validate -> 4 phases, 28 tasks
       7. DISPOSITION: Create ai_action (proposed)
  -> Response: WBS proposal in AI Review UI
  -> Human: approve / edit / reject
    -> If approved: Task Module bulk creates 28 tasks
    -> Events: pm.ai.action_approved + 28x pm.tasks.created + pm.projects.baseline_set
    -> Consumers: audit-writer, embedding-pipeline, projection-updater
```

### Flow 2: AI PM Agent Loop (Autonomous Operations)

```
Every 15 minutes (BullMQ scheduled job):
  -> For each active project in each tenant:
    -> Query overdue tasks (due_date < now, not completed)
    -> Query stalled tasks (no update in >48h, not blocked)
    -> Query newly unblocked tasks (dependency resolved in last 15min)
    -> For each actionable item:
      -> Orchestrator: TRIGGER (agent loop)
      -> Autonomy: nudge = execute if policy allows; escalation = propose
      -> Context: task details + assignee + project
      -> LLM: Sonnet generates contextual message
      -> Disposition:
         Nudge (execute): check quiet hours + rate limit -> Slack DM
         Escalation (propose): create proposal for PM review
      -> Events: pm.ai.action_executed (nudge) or pm.ai.action_proposed (escalation)
```

### Flow 3: Client Portal NL Query (Projection-Filtered)

```
Client asks: "When will Phase 2 be done?" (Portal)
  -> POST /api/v1/portal/query
    -> Auth: client JWT (client role, tenant-scoped)
    -> Orchestrator: TRIGGER
    -> Context: RAG scoped to tenant_id AND client_visible=true ONLY
       (no internal estimates, resource conflicts, risk flags)
    -> Confidence: can AI answer from projected data alone?
    -> LLM: Sonnet
    -> Post-process: verify no internal data in response (redaction check)
    -> Disposition:
       confidence >0.8 + no sensitive content: direct response
       confidence <0.8 or sensitive: flag for PM review before delivery
```

### Flow 4: Git Commit to Task Update

```
Developer pushes branch: feature/TASK-abc123
  -> GitHub webhook fires to /webhooks/git/github
    -> Verify webhook signature
    -> Parse branch name: extract TASK-abc123
    -> Normalize to NATS: pm.integrations.git_commit
    -> Consumer links commit to task

Developer merges PR
  -> GitHub webhook: PR merged
    -> Extract linked task IDs from branch + PR body
    -> Check autonomy policy: auto-complete allowed?
    -> If yes: transition task to completed (actor_type = integration)
    -> Events: pm.tasks.completed, pm.tasks.status_changed
    -> If no: create AI proposal for task completion
```

---

## 9. Technology Decision Records

| ADR | Decision | Over | Rationale | Revisit When |
|-----|----------|------|-----------|-------------|
| ADR-001 | Hosted Claude API | Self-hosted/fine-tuned LLM | 5-person team cannot run GPU infra. Latest models, predictable pricing, zero ML-ops. | R3: fine-tuning when tenant data volume justifies it |
| ADR-002 | RAG with pgvector | Prompt engineering only / dedicated vector DB | Co-located with relational data enables SQL JOINs in RAG queries. Single DB to operate. | p95 vector search >100ms at 1M+ embeddings |
| ADR-003 | NATS JetStream | Kafka / Redis Streams / SQS | Kafka overprovisioned for 8 consumers. NATS: persistent, replayable, lightweight ops. | Consumer count >50 or throughput >100K events/min |
| ADR-004 | Shared schema + RLS | Schema-per-tenant / DB-per-tenant | Fast to ship. Database-enforced isolation. Single connection pool and migration path. | R3: schema isolation for enterprise compliance |
| ADR-005 | Hybrid pricing | Pure per-seat / pure usage | Per-seat erodes margins on heavy AI users. Hybrid: base subscription + AI metering. | After first 10 paying tenants |
| ADR-006 | PostgreSQL 16 + pgvector | Separate Pinecone/Weaviate | One DB to operate, backup, scale. Co-location enables relational+vector queries. | Vector corpus >1M rows or latency degrades |
| ADR-007 | Fastify (Node.js + TS) | NestJS / FastAPI (Python) | Shared language with Next.js = single hiring profile. Fastest Node.js framework. | Python-specific ML requirements in R3 |
| ADR-008 | ECS Fargate | EKS (Kubernetes) | Zero cluster management. No Helm, no ArgoCD, no node pools. | Service count >15 or dedicated platform engineer |
| ADR-009 | AWS CDK (TypeScript) | Terraform / CloudFormation | Same language as entire stack. Higher-level constructs. | Multi-cloud becomes a requirement |
| ADR-010 | Modular monolith | Microservices from day 1 | Microservices at 5 engineers = ops overhead that kills velocity. Clean extraction path. | Module scaling requirements diverge significantly |
| ADR-011 | Next.js 15 single app | Separate frontends | One codebase, shared components, single deployment. Route groups for separation. | Portal requires fundamentally different deployment |
| ADR-012 | CloudWatch + X-Ray + Sentry | Datadog / Grafana Cloud | CloudWatch included with AWS. X-Ray native tracing. Sentry for frontend. Three focused tools. | Observability outgrows CloudWatch |

---

## 10. Cost Model

### Monthly Infrastructure (AWS)

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
| **Total** | **~$380** | **~$565** | **~$1,030** | **~$2,110** |

### AI Token Costs per Tier

| Pricing Tier | AI Ops/Month | Estimated Token Cost | Subscription Price |
|--------------|-------------|---------------------|--------------------|
| Starter | ~500 | $8-15 | $29/mo |
| Pro | ~2,000 | $25-50 | $99/mo |
| Enterprise | ~5,000+ | $60-120 | $249+/mo |

### Unit Economics at R2

- Revenue per tenant: ~$500/mo (Pro tier average)
- Infrastructure cost per tenant: ~$110/mo (shared infra amortized + per-tenant AI)
- **Gross margin: ~78%**
- At R3 (10 tenants): ~$5,000 revenue / ~$2,110 infra = **~58% gross margin** (AI costs scale sub-linearly with caching and prompt optimization)

---

## 11. Release-Architecture Alignment

| Tier | R0 (Months 1-3) | R1 (Months 4-6) | R2 (Months 7-9) | R3 (Months 10-12) |
|------|------------------|------------------|------------------|---------------------|
| **Client** | Web app (internal) | + Slack/Teams bot | + Client portal, + Public API | + Kanban/Gantt views |
| **Gateway** | ALB + WAF, password auth, RBAC (Admin+Dev) | + SSO, + MFA, + WebSocket | + Client role | + PM role |
| **Application** | Project, Task, Dependency, Comment, Audit, User modules | + Feature flags, + Config service enhancements | + Projection module live, + Webhooks | + Enterprise config |
| **AI Engine** | NL-to-WBS, What's Next (rules), NL Query, Shadow mode, Autonomy policy, Traceability | + AI PM Agent, + Risk predictor, + Scope creep, + Summary (full), + Adaptive engine | + AI guardrails (multi-tenant), + Cost dashboard | + Per-tenant learning, + SOW generator |
| **Event Bus** | NATS 3-node, 6 streams, core consumers | + Integration event subjects | No changes needed | Evaluate 5-node if needed |
| **Database** | PG 16 + pgvector (r6g.large), Redis, S3 | No tier changes | + Read replica | Evaluate schema isolation |
| **Integrations** | None | + Git, + Slack/Teams, + Calendar | + Webhooks, + Jira import | + Additional providers |
| **Security** | RLS, encryption, audit, secrets | + SOC 2 controls | + PII, + Prompt defense, + SOC 2 Type I | + SOC 2 Type II |
| **Deployment** | ECS Fargate (2 tasks), CDK, CI/CD | + AI Worker separate service | + Auto-scaling, + Staging mirrors prod | + Performance tuning |
| **Monitoring** | CloudWatch basics, Sentry | + X-Ray, + AI dashboard | + Custom alerting | + Tenant-level monitoring |

---

## 12. Monorepo Structure

```
ai-pm-tool/
|-- apps/
|   |-- web/                        # Next.js 15 (internal + portal)
|   |   |-- app/
|   |   |   |-- (internal)/         # Internal PM routes (dashboard, projects, tasks, ai-review, settings)
|   |   |   |-- (portal)/           # Client portal routes (R2): /portal/[tenantSlug]/*
|   |   |   +-- api/                # BFF routes proxying to Fastify API
|   |   |-- components/
|   |   |   |-- ui/                 # Shadcn UI primitives
|   |   |   |-- ai/                 # AI review, What's Next, NL Query components
|   |   |   |-- projects/           # Project-specific components
|   |   |   +-- tasks/              # Task-specific components
|   |   +-- lib/                    # Utilities, API client
|   |-- api/                        # Fastify API server
|   |   +-- src/
|   |       |-- modules/            # 8 domain modules, each: routes/ services/ repositories/ types/ events/
|   |       |   |-- project/
|   |       |   |-- task/
|   |       |   |-- dependency/
|   |       |   |-- comment/
|   |       |   |-- audit/
|   |       |   |-- user/
|   |       |   |-- projection/
|   |       |   +-- config/
|   |       |-- ai/
|   |       |   |-- orchestrator/   # 7-stage pipeline
|   |       |   |-- capabilities/   # wbs-generator, whats-next, nl-query, summary, risk, pm-agent, scope-creep
|   |       |   |-- gateway/        # LLM Gateway + circuit breaker
|   |       |   |-- context/        # Context assembly + RAG
|   |       |   |-- evaluation/     # Eval harness
|   |       |   +-- traceability/   # AI action logging
|   |       |-- events/             # NATS producers + consumers
|   |       |-- integrations/       # Git, Slack, Calendar adapter plugins
|   |       |-- auth/               # Authentication + RBAC
|   |       +-- common/             # Middleware, error handling, logging
|   +-- ai-worker/                  # R1+: Separate ECS service for async AI
|       +-- src/
|           |-- agent-loop/         # AI PM Agent 15-min cycle
|           |-- consumers/          # NATS event consumers for AI
|           +-- scheduled/          # Cron-triggered AI jobs
|-- packages/
|   |-- shared/                     # Shared types, Zod validators, constants
|   |-- db/                         # Drizzle schema, migrations, seeds
|   +-- prompts/                    # Versioned YAML prompt templates per capability
|-- infra/                          # AWS CDK (5 stacks: VPC, Database, Compute, Monitoring, Pipeline)
|-- tests/
|   |-- integration/                # Testcontainers (PG, Redis, NATS)
|   |-- ai-evaluation/             # Golden test sets per AI capability
|   +-- load/                       # Load testing
|-- turbo.json                      # Turborepo pipeline config
|-- pnpm-workspace.yaml             # pnpm workspace packages
+-- docker-compose.yml              # Local dev: PostgreSQL, Redis, NATS
```

---

## 13. Deployment Architecture

### AWS Infrastructure Layout

```
                      Internet
                         |
                   [CloudFront CDN]
                         |
                    [AWS WAF]
                         |
                    [AWS ALB]
                    /         \
              /api/*          /*
                |               |
         +------+------+   +---+----+
         |  API (ECS)  |   | Web    |
         |  2-8 tasks  |   | (ECS)  |
         +------+------+   +--------+
                |
    +-----------+-----------+
    |           |           |
[RDS PG16]  [Redis]   [NATS 3-node]
 Multi-AZ  ElastiCache   ECS + EFS
    |
[pgvector]

         [AI Workers (ECS)]
          1-6 tasks, 4GB RAM
          BullMQ queue consumer
```

### VPC Network Layout

| Subnet Type | CIDR | Contents |
|-------------|------|----------|
| Public (2 AZs) | 10.0.1.0/24, 10.0.2.0/24 | ALB, NAT Gateways |
| Private (2 AZs) | 10.0.10.0/24, 10.0.20.0/24 | ECS tasks (API, Web, AI Worker, NATS) |
| Isolated (2 AZs) | 10.0.100.0/24, 10.0.200.0/24 | RDS primary/standby, ElastiCache |

### Security Groups

| Group | Inbound | Outbound |
|-------|---------|----------|
| ALB | 443 from 0.0.0.0/0 | ECS SG |
| ECS | ALB SG only | RDS SG, ElastiCache SG, NATS SG, internet (Claude API) |
| RDS | 5432 from ECS SG | None |
| ElastiCache | 6379 from ECS SG | None |
| NATS | 4222/6222/8222 from ECS SG | None |

---

## What Makes This Architecture Evergreen

1. **No rewrite gates.** The R0 schema supports R3 features. `tenant_id` on every table from day 1. The projection module's data model exists even if the portal does not ship until R2. Per-tenant learning in R3 consumes the same event bus and embedding pipeline built in R0.

2. **Scaling is configuration, not architecture.** R0 to R2 scaling = changing ECS task counts and RDS instance sizes in CDK config. No service topology changes until AI worker extraction in R1 (planned, not reactive).

3. **AI capabilities are pluggable.** Adding a new capability (e.g., SOW Generator in R3) means: create a new directory under `ai/capabilities/`, define prompt templates, context requirements, and confidence thresholds, register with the orchestrator. The pipeline, traceability, cost tracking, and evaluation harness handle it automatically.

4. **Technology choices degrade gracefully.** pgvector to dedicated vector store is a connection string change + migration. ECS Fargate to EKS is a deployment-layer swap. NATS to Kafka is a producer/consumer interface change (same event schema). None require application logic changes.

5. **The event bus decouples everything.** Adding a new consumer (analytics pipeline, new integration) requires zero changes to producers. The event schema is the contract.

---

*AI-Native PM Tool | Architecture v1.0 | AWS-native | Event-driven | Tenant-isolated | Observable AI | Evergreen R0 through R3+*
