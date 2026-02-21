# AI-Native PM Tool — Definitive System Architecture v3.0

> **Design philosophy:** The AI runs the project. The human supervises. Every architectural decision answers: "Does this let the AI act autonomously, safely, and observably — and does it survive from R0 through R3 without a rewrite?"
>
> **Cloud:** AWS (single-cloud, managed services preferred)
> **Team:** 5–7 engineers. Every choice optimizes for operator simplicity at this team size.
> **Target scale:** R0: 1 tenant, 10 users → R3: 10+ tenants, 100+ users, 100K+ tasks
>
> **v3.0 · February 2026 · Aligned to Product Roadmap v2**

---

## Architecture Principles

These seven principles resolve every "v1 vs v2" tension and govern every decision below.

1. **AWS-managed over self-managed.** ECS Fargate over Kubernetes. RDS over self-hosted PostgreSQL. ElastiCache over self-managed Redis. A 5-person team cannot operate a Kubernetes cluster and build an AI product simultaneously.

2. **Monorepo, modular monolith, not microservices.** One deployable API service with well-separated internal modules (project, task, dependency, comment, audit, user, AI). Split into services only when independently scaling AI workers is required (R1+). Premature microservices at this team size creates operational overhead that kills velocity.

3. **Event-driven from day 1, but start simple.** NATS JetStream for the event bus — lighter than Kafka, persistent with replay, sufficient through R3. Every state mutation emits an event. Every AI capability consumes events.

4. **Single database, stretched intelligently.** PostgreSQL 16 with pgvector for relational + vector in one engine. RLS for tenant isolation. JSONB for flexible fields. Evaluate dedicated vector store only if p95 similarity search exceeds 100ms at 1M+ embeddings.

5. **AI is a first-class infrastructure concern.** The AI engine is not a feature bolted onto a PM tool. It has its own orchestration pipeline, cost tracking, autonomy policies, traceability, evaluation harness, and circuit breakers — all from R0.

6. **Security is structural, not aspirational.** tenant_id on every table from day 1. RLS enforced at the database layer. Immutable audit trail. SOC 2 controls built into the architecture, not retrofitted.

7. **Evergreen means building the R3 data model in R0.** The schema, event streams, and AI pipeline support per-tenant learning, client projection, and enterprise isolation from day 1 — even if those features aren't exposed until R2–R3. No "rewrite required" gates between releases.

---

## Tier 1 — Client Layer

All user-facing surfaces. The AI is the primary interaction model; traditional PM interfaces are fallbacks.

| Component | Technology | Release | Purpose |
|-----------|-----------|---------|---------|
| **Web Application** | Next.js 15 · App Router · React Server Components · TypeScript 5+ | R0 | Primary PM interface. AI review/approve UI (F-016), "What's Next" developer view (F-012), NL query panel (F-014), project dashboards. SSR for initial load, client components for interactivity. |
| **Client Portal** | Next.js 15 · Separate route group (`/portal/[tenantSlug]`) | R2 | Client-facing view consuming only the projection layer. Filtered tasks, AI-generated narratives, scoped NL queries (F-055, F-059). White-labelable via tenant config. |
| **Slack / Teams Bot** | Slack Bolt SDK / Teams Bot Framework · Lambda-backed | R1 | AI PM Agent's delivery channel. Slash commands (`/aipm status`, `/aipm next`, `/aipm query`), inbound message context, outbound nudges and summaries (F-036). |
| **Public REST API** | Versioned `/api/v1/` · Cursor-based pagination · API key auth | R2 | External programmatic access with per-key rate limiting, webhook subscriptions, OpenAPI 3.1 documentation (F-063). |

**Key decisions:**

- Next.js 15 over 14 for React Server Components maturity and App Router stability. Single Next.js app with route groups for internal vs portal — avoids maintaining two frontends.
- No mobile app in year 1. The Slack bot IS the mobile interface. Evaluate React Native at R3 if demand validates.
- No GraphQL. REST with composite endpoints (`?include=phases,tasks,dependencies`) handles all current query patterns. GraphQL adds schema complexity that a 5-person team shouldn't carry.

---

## Tier 2 — API Gateway & Authentication

Single entry point for all traffic. Every request is authenticated, tenant-resolved, and rate-limited before reaching application code.

| Component | Technology | Release | Purpose |
|-----------|-----------|---------|---------|
| **API Gateway** | AWS ALB + AWS WAF | R0 | TLS 1.3 termination, request routing (web app vs API vs portal), WAF rules for OWASP Top 10, geo-blocking if needed. No Kong/API Gateway — ALB is sufficient at this scale and avoids another managed service. |
| **Authentication Service** | Custom auth module (Fastify plugin) · RS256 JWT | R0 | Password auth with bcrypt (R0). SAML/OIDC SSO via `passport-saml` + `openid-client` (R1). MFA via TOTP (R1). JWT carries `tenant_id`, `user_id`, `role` claims. 1h access tokens, 30d refresh with rotation. |
| **RBAC Engine** | Application-layer enforcement + DB check | R0→R3 | Four-stage rollout: Admin + Developer (R0) → +Client (R2) → +PM (R3). Enforcement chain per request: authenticate → resolve tenant (from JWT) → set RLS context → check role → check resource scope. |
| **Config Service** | Tenant config table + in-memory cache (5min TTL) | R0 | Per-tenant settings: custom status labels, priority scales, AI model preferences, feature flags, autonomy policy defaults (F-010). Redis-cached, invalidated on update via NATS event. |
| **WebSocket Gateway** | Socket.io on Fastify · ALB WebSocket support | R1 | Real-time task board updates, comment streams, AI decision notifications, user presence per project view. Authenticated via same JWT. |

**Key decisions:**

- Custom auth over Auth0/Clerk/Supabase Auth. The product's trust model requires full control over tenant isolation in JWT claims, session management, and the audit trail of who-accessed-what. Third-party auth services create a dependency where tenant isolation is someone else's responsibility.
- ALB over API Gateway (AWS). ALB handles routing and TLS without the per-request pricing and Lambda cold-start overhead of API Gateway. WAF attaches directly to ALB.
- Session state in Redis (ElastiCache). Refresh tokens, active session tracking, concurrent session limits, forced logout all require server-side session state.

---

## Tier 3 — Application Services (Modular Monolith)

One deployable Fastify API service with well-separated internal modules. Each module owns its domain logic, database queries, and event emissions. They share a process, a database connection pool, and a NATS client.

| Module | Key Responsibilities | Feature Refs |
|--------|---------------------|-------------|
| **Project Module** | Project CRUD, NL description storage, WBS baseline snapshots (JSONB), phase management, composite endpoints for project-with-phases views. | F-003, F-011 |
| **Task Module** | Full task lifecycle: configurable statuses, multiple assignees (junction table `task_assignments` with roles: assignee, reviewer, approver), effort tracking (estimated/actual), `ai_generated` + `ai_confidence` flags, single-level sub-tasks with parent rollup. | F-006, F-008 |
| **Dependency Module** | Finish-to-start relationships, circular dependency prevention via application-layer DAG traversal (not DB trigger — more testable), automatic blocked/unblocked status propagation, dependency notes. | F-007 |
| **Comment Module** | Per-task threads, `client_visible` boolean for projection layer filtering, edit/delete with "edited" indicator, feeds embedding pipeline for RAG. | F-026 |
| **Audit Module** | Immutable `audit_log` table (INSERT only, no UPDATE/DELETE). Field-level diffs: `entity_type`, `entity_id`, `field_name`, `old_value`, `new_value`, `actor_type` (user/ai/system/integration), `actor_id`, `ai_action_id` FK, `timestamp`. Partitioned by month at 1M+ rows. | F-009 |
| **User Module** | Tenant-scoped user management, `/users/me/next` endpoint for AI-curated task prioritization (F-012), availability tracking, workload metrics. | F-004, F-012 |
| **Projection Module** | Internal truth → client-safe view transformation. Field-level redaction rules, `internal` vs `external` classification on tasks/comments, narrative object generation, approval workflow for client-facing content. This is a data layer, not a UI filter. | F-042, F-055 |

**Technology stack:**

| Choice | Technology | Rationale |
|--------|-----------|-----------|
| Runtime | Node.js 22 LTS | Shared language with Next.js frontend. TypeScript end-to-end. Single hiring profile. |
| Framework | Fastify 5 | Fastest Node.js HTTP framework. Plugin architecture maps cleanly to modules. Schema-based validation via TypeBox. |
| ORM | Drizzle ORM | TypeScript-first, generates SQL you can read, schema-as-code with versioned migrations. Lighter than Prisma, more control than Knex. |
| Validation | TypeBox (Fastify native) + Zod (shared with frontend) | Request validation at the framework level. Shared types between API and Next.js via monorepo packages. |
| Monorepo | Turborepo + pnpm workspaces | `packages/shared` for types/validators, `apps/web` for Next.js, `apps/api` for Fastify, `apps/ai-worker` for async AI processing (R1). |

**Why modular monolith, not microservices:**

A 5–7 person team deploying 6+ independently versioned services on day 1 will spend more time on service discovery, distributed tracing, deployment choreography, and network debugging than on building the AI engine. The modular monolith gives you clean separation (each module has its own directory, routes, service layer, and repository layer) with zero operational overhead from distributed systems. When the AI worker needs to scale independently (R1, when the PM Agent runs async loops), extract it as the first — and possibly only — separate service.

---

## Tier 4 — AI Engine

This is the product. Every other tier exists to feed data into and execute actions from this tier.

### 4A — AI Orchestrator

All AI operations flow through a single orchestration pipeline. No AI capability calls the LLM directly.

**7-Stage Pipeline:**

```
1. TRIGGER        → Event from NATS or user request from API
2. AUTONOMY CHECK → Policy engine determines: propose or execute? (F-015)
3. CONTEXT ASSEMBLY → RAG retrieval + event history + domain template + token budget
4. CONFIDENCE CHECK → Pre-flight: is context sufficient? Below threshold → graceful degradation (F-018)
5. LLM CALL       → Routed through LLM Gateway (model selection, retry, streaming)
6. POST-PROCESSING → Parse structured output, validate against schema, extract actions
7. DISPOSITION     → Shadow mode: log only. Propose mode: create proposal for review. Execute mode: apply changes + log.
```

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Orchestrator** | TypeScript module in API (R0) → separate ECS service (R1+) | Routes all AI requests through the 7-stage pipeline. No AI capability bypasses this. |
| **Autonomy Policy Engine** | Config-driven rules per action type per tenant | Determines per action whether AI proposes (human approves) or executes autonomously. Supports shadow mode (F-017), quiet hours, nudge limits (max 2/task/day). Default: propose everything, execute nothing. |
| **Shadow Mode** | Boolean flag per tenant + per AI capability | All AI actions logged but not executed or surfaced to users. Admins review accuracy in a dedicated dashboard. Trust-building mechanism before enabling live mode. |

### 4B — AI Capabilities

Each capability is a self-contained module that plugs into the orchestrator. Each defines its own prompt templates, context requirements, confidence thresholds, and fallback behavior.

| Capability | Model | Release | Token Profile | Purpose |
|------------|-------|---------|---------------|---------|
| **NL→WBS Generator** | Claude Opus 4 | R0 | ~5K in / ~3K out | Converts NL project descriptions to structured WBS via 5-stage sub-pipeline: domain detection → template selection → RAG enrichment (similar past projects) → Opus generation → schema validation. Domain-specific prompt templates for software delivery, data migration, consultancy engagement. **This is the product. 40%+ of R0 AI engineering time here.** |
| **"What's Next" Engine** | Rules-based (R0) → Claude Sonnet (R1) | R0 | ~1K in / ~500 out (R1) | Per-developer task prioritization. R0: dependency resolved → due date → priority (pure algorithm, no LLM). R1: LLM-ranked with velocity context and natural language explanations. |
| **NL Query Engine** | Claude Sonnet 4.5 | R0 | ~2K in / ~1K out | Natural language questions about project state. RAG retrieval from pgvector → context assembly → Sonnet synthesis. Interactive, target p95 <8s. |
| **Summary Engine** | Claude Sonnet 4.5 | R0 (daily) / R1 (formal reports) | ~3K in / ~1K out | Daily summaries (F-013), weekly status reports (F-029), client-facing narratives (F-057). Client summaries route through projection layer + mandatory approval. |
| **Risk Predictor** | Claude Opus 4 | R1 | ~4K in / ~2K out | Pattern analysis: blocker duration, stalled tasks, dependency chain growth, scope drift vs baseline. Shadow mode for first 2–4 weeks. Outputs risk flags with confidence scores and suggested mitigations. |
| **AI PM Agent** | Claude Sonnet 4.5 | R1 | ~2K in / ~500 out per action | Autonomous async agent on a 15-min loop. Chases overdue updates via Slack DMs, nudges stalled work, proposes escalations. Operates under autonomy policy with quiet hours. Delivered via Slack — not in-tool only. |
| **Scope Creep Detector** | Claude Sonnet 4.5 | R1 | ~3K in / ~1K out | Monitors task additions vs original WBS baseline (JSONB snapshot). Alerts when scope drifts >15% before timeline impact. |
| **SOW Generator** | Claude Opus 4 | R3 | ~8K in / ~5K out | Revenue-generating: generates Statements of Work from historical delivery data. Long-context Opus with template system + approval workflow. The consultancy killer feature. |
| **Per-Tenant Learning** | Fine-tuned context / RAG enrichment | R3 | Variable | Tenant-scoped model contexts that improve WBS, estimation, and risk prediction from each org's own delivery history. The moat. |

### 4C — Shared AI Infrastructure

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Context Assembly Layer** | TypeScript module | Loads tenant data, retrieves similar historical context via pgvector (cosine similarity, top-k=10), aggregates recent events from NATS consumer, selects domain-specific prompt template, enforces per-operation token budget. |
| **LLM Gateway** | TypeScript module wrapping Anthropic SDK | Model routing (Opus for generation/risk, Sonnet for queries/summaries). Retry with exponential backoff + fallback (Opus → Sonnet if Opus unavailable). Streaming for interactive queries. Rate limiting per tenant. **Circuit breaker:** 5 consecutive failures → 60s open state → cached/fallback responses during outage. |
| **Prompt Registry** | Versioned YAML files in repo (`/prompts/{capability}/v{N}.yaml`) | Central repository of prompt templates with Handlebars-style context injection. Schema validation for expected output format. Version-pinned per capability — prompt changes are PR-reviewed like code. |
| **Evaluation Harness** | Golden test sets + acceptance tracking | Automated quality checks on every prompt version change. Tracks: acceptance rate (<60% triggers review), override rate (>40% = miscalibration), hallucination incidents. R0: manual review augmented with golden set. R1: fully automated CI integration. |
| **Traceability Pipeline** | `ai_actions` table + structured logs | Every AI action logged: `trigger_event` → `context_assembled` (truncated) → `prompt_sent` (hash) → `model_output` → `confidence_score` → `disposition` (proposed/executed/rejected) → `human_review` → `rollback_data`. Full chain queryable. (F-020) |
| **Cost Tracker** | Redis counters + `ai_cost_log` table | Per-operation: input tokens, output tokens, USD cost, model used, capability, tenant_id. Per-tenant monthly budget caps with pre-flight check. Alerts at 80% and 100% of budget. Feeds tiered pricing (F-046, F-061). |

---

## Tier 5 — Event Bus

The nervous system. Every AI capability, every integration, and every observability pipeline consumes from this bus.

| Component | Technology | Configuration |
|-----------|-----------|---------------|
| **NATS JetStream** | NATS 2.10+ · 3-node cluster on ECS | Persistent streams with 30-day retention. At-least-once delivery. Dead letter queue per consumer for failed processing. |

**Stream Topology (6 streams):**

| Stream | Subjects | Producers | Key Consumers |
|--------|----------|-----------|---------------|
| `pm.tasks` | `pm.tasks.created`, `.updated`, `.status_changed`, `.assigned`, `.completed`, `.dependency_resolved`, `.dependency_blocked` | Task Module | AI Adaptive Engine, Audit Writer, Embedding Pipeline, Notification Router, Projection Updater |
| `pm.projects` | `pm.projects.created`, `.updated`, `.phase_changed`, `.baseline_set` | Project Module | AI Summarizer, Embedding Pipeline, Scope Creep Detector |
| `pm.comments` | `pm.comments.created`, `.updated`, `.deleted` | Comment Module | Embedding Pipeline, Notification Router |
| `pm.ai` | `pm.ai.action_proposed`, `.action_approved`, `.action_rejected`, `.action_executed`, `.confidence_low` | AI Orchestrator | Traceability Pipeline, Cost Tracker, Evaluation Harness |
| `pm.integrations` | `pm.integrations.git_commit`, `.git_pr_merged`, `.slack_message`, `.calendar_updated` | Integration Adapters | AI Adaptive Engine, Task Module (auto-complete on merge) |
| `pm.system` | `pm.system.config_changed`, `.tenant_created`, `.user_invited` | Config, User Modules | Config Cache Invalidation, Notification Router |

**Consumer Groups (8 durable consumers):**

`audit-writer` · `ai-adaptive` · `ai-summarizer` · `embedding-pipeline` · `projection-updater` · `notification-router` · `cost-tracker` · `escalation-monitor`

All consumers are idempotent (event ID deduplication). Failed events route to DLQ after 3 retries with exponential backoff.

**Key decision — NATS over Kafka:** Kafka is the right choice at 1000+ consumers and petabyte-scale streams. At 8 consumers and <10K events/day, NATS JetStream provides persistence, replay, and consumer groups with dramatically lower operational complexity. A 3-node NATS cluster on ECS Fargate requires zero ZooKeeper, zero broker tuning, and zero partition rebalancing.

---

## Tier 6 — Data Layer

One database, stretched intelligently. Separate stores only where access patterns demand it.

| Component | AWS Service | Configuration | Purpose |
|-----------|-------------|---------------|---------|
| **PostgreSQL 16** | RDS (Multi-AZ) | R0: `db.r6g.large` (2 vCPU, 16 GB). R2: `db.r6g.xlarge` + read replica. R3: evaluate schema isolation for enterprise tier. | Primary relational store. `tenant_id` on every table. Strong FK constraints. JSONB for WBS baselines, AI action metadata, configurable fields. Immutable `audit_log` (INSERT only). Drizzle ORM with versioned migrations. |
| **pgvector** | Co-located in RDS PostgreSQL | `text-embedding-3-small` (1536 dimensions). IVFFlat index R0–R2, evaluate HNSW at R3. | Embeddings for tasks, comments, project descriptions, audit summaries. Co-located = SQL JOINs in RAG queries (e.g., "find similar tasks in this tenant's history"). No separate vector DB until p95 search >100ms at 1M+ rows. |
| **Redis 7** | ElastiCache Serverless | AOF persistence + hourly snapshots. | Session storage, per-tenant rate limiting counters, AI operation queues (BullMQ), real-time presence, config cache, AI response cache (TTL-based). |
| **S3** | S3 Standard + S3 Glacier | 4 buckets: `uploads`, `exports`, `reports`, `backups`. Versioning enabled. Glacier lifecycle for audit log archives >90 days. Cross-region replication on `backups` bucket. | File attachments, export artifacts, generated report PDFs, database backups, prompt version archives. |
| **Full-Text Search** | PostgreSQL FTS (built-in) | `tsvector` columns on tasks, projects, comments. GIN indexes. | Task and project search. Avoids Elasticsearch/OpenSearch infrastructure until R3 scale demands it. Evaluate upgrade when search corpus exceeds 500K documents or query patterns require faceted search. |

**Row-Level Security (RLS) — Tenant Isolation:**

Every tenant-scoped table has an RLS policy:

```sql
CREATE POLICY tenant_isolation ON tasks
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

The API middleware sets `app.current_tenant_id` per request from the JWT claim before any query executes. Application code physically cannot query across tenants. This is database-enforced, not application-trust.

**Schema design principles:**

- `tenant_id` as the first column in every composite index (tenant locality in B-tree scans)
- Soft deletes (`deleted_at` timestamp) on all user-facing entities; hard deletes only via background jobs after retention period
- `created_at` and `updated_at` auto-managed via Drizzle defaults + `ON UPDATE` triggers
- `ai_generated` boolean + `ai_confidence` float on tasks, comments, and project fields — the AI's fingerprint is part of the data model
- `audit_log` table: INSERT-only, partitioned by month, no application-level DELETE or UPDATE permissions

---

## Tier 7 — Integration Gateway

Adapters that bring external signals into the event bus. Each adapter is a lightweight Fastify plugin that normalizes external events into `pm.integrations.*` NATS subjects.

| Adapter | Protocol | Release | Signal Value |
|---------|----------|---------|-------------|
| **Git (GitHub, GitLab, Azure DevOps)** | Inbound webhooks (push, PR merge) | R1 | **Most important signal source.** Commit activity is ground truth — prevents AI from hallucinating progress based on stale task data. Auto-link commits/PRs to tasks via branch naming convention or commit message parsing. Auto-complete tasks on PR merge (when autonomy policy allows). |
| **Slack / Teams** | OAuth 2.0 + Events API + Slash commands | R1 | Bidirectional. Inbound: slash commands, message mentions for context. Outbound: AI PM Agent nudges, daily summaries, risk alerts, escalation notifications. App Home tab with project overview. |
| **Calendar (Google, Outlook)** | CalDAV / OAuth 2.0 | R1 | Team member availability for resource optimization (F-032). Milestone meetings auto-created. Sprint planning sessions scheduled. |
| **Webhook System (outbound)** | Tenant-configurable subscriptions | R2 | Tenants subscribe to event notifications delivered to external URLs. Retry with exponential backoff. Signature verification (HMAC-SHA256). Standard SaaS integration pattern. |
| **Jira Import** | REST API batch migration | R2 | One-time inbound migration: projects, tasks, dependencies, comments. Sales enablement — reduces friction for new customers switching from Jira. |

**Key decision — Adapter architecture:** Each integration is a Fastify plugin with three responsibilities: (1) authenticate the external service (OAuth token management), (2) normalize inbound events to NATS subjects, (3) format outbound messages for the external service's API. Adapters share no state with each other. Adding a new integration = adding a new plugin file.

---

## Tier 8 — Security & AI Safety

Security is structural in this architecture, not a feature. Every tier already enforces tenant isolation, authentication, and audit. This tier covers the additional controls required for SOC 2 compliance and AI-specific threats.

| Control | Implementation | Release |
|---------|---------------|---------|
| **Encryption at rest** | AES-256 via AWS KMS. RDS encrypted storage. S3 server-side encryption. ElastiCache in-transit + at-rest encryption. | R0 |
| **Encryption in transit** | TLS 1.3 on all connections: ALB→services, services→RDS, services→ElastiCache, services→NATS. | R0 |
| **Tenant isolation** | PostgreSQL RLS (database-enforced). JWT tenant_id claims. Per-request context setting. Application code cannot cross tenant boundaries. | R0 |
| **Secrets management** | AWS Secrets Manager for database credentials, API keys, JWT signing keys. Rotated automatically. Never in environment variables or code. | R0 |
| **Immutable audit trail** | `audit_log` table: INSERT only. No UPDATE/DELETE grants. Field-level diffs with actor tracking (user/ai/system/integration). Monthly partitioning. | R0 |
| **PII handling** | Client comments with `client_visible=false` redacted before LLM ingestion. User emails hashed in logs. AI prompts sanitized before archival. Configurable per-project redaction regex patterns. | R1 |
| **Prompt injection defense** | Input sanitization before LLM context assembly. Tenant data in structured fields (not raw user input in system prompts). Output validation against expected schema. AI actions always logged for forensic review. | R2 |
| **AI cross-tenant data leakage prevention** | RAG retrieval scoped by `tenant_id` in WHERE clause (not post-filter). Embedding queries include tenant filter in the vector search. AI context assembly verified to contain only current tenant's data. | R0 |
| **SOC 2 Type I** | Access controls, change management (GitOps), data protection, monitoring, incident response, vendor management. Audit initiated R2. | R2 |
| **SOC 2 Type II** | 6-month sustained evidence collection. Automated control monitoring via AWS Config + custom checks. | R3 |

---

## Tier 9 — Deployment & CI/CD

Optimized for a small team on AWS. Managed services everywhere. GitOps for reproducibility.

| Component | AWS Service / Tool | Configuration |
|-----------|-------------------|---------------|
| **Compute — API** | ECS Fargate | R0: 2 tasks (1 vCPU, 2 GB each). R2: 3–4 tasks with target-tracking auto-scaling (CPU 70%). R3: 2–8 tasks. No EC2 instances to manage. |
| **Compute — AI Workers** | ECS Fargate (separate service) | R0: 1 task. R1: 2 tasks. R2: queue-depth auto-scaling (scale up when BullMQ pending >50). Larger memory allocation (4 GB) for context assembly. |
| **Compute — Next.js** | ECS Fargate or AWS Amplify Hosting | R0: ECS Fargate alongside API for simplicity (single ALB). Evaluate Amplify if SSR caching and edge deployment become priorities. |
| **Event Bus** | ECS Fargate (NATS cluster) | 3-node StatefulSet equivalent using ECS Service Discovery + EFS for JetStream persistence. |
| **CI/CD** | GitHub Actions → AWS CDK / Terraform | Trunk-based development. All changes via PR with approval. Automated: lint → type-check → unit test → integration test (testcontainers) → build → deploy to staging → smoke test → promote to production. |
| **Infrastructure as Code** | AWS CDK (TypeScript) | TypeScript IaC aligns with the entire stack. Manages: VPC, ALB, ECS services, RDS, ElastiCache, S3, IAM roles, Secrets Manager, CloudWatch. Single `cdk deploy` for full environment. |
| **Container Registry** | ECR | Private registry. Lifecycle policy: retain last 10 images per service. |
| **DNS / CDN** | Route 53 + CloudFront | CloudFront for static assets and Next.js edge caching. Route 53 for DNS management. |
| **Environments** | 3 environments: `dev`, `staging`, `prod` | `dev`: single-AZ, smallest instances. `staging`: mirrors prod topology. `prod`: Multi-AZ, encrypted, monitored. Feature flags (via tenant config) for gradual rollout. |

**Key decision — ECS Fargate over Kubernetes:**

Kubernetes (EKS) provides capabilities this product won't need for 18+ months: custom operators, service mesh, complex scheduling constraints, multi-cloud portability. ECS Fargate provides auto-scaling containers with zero cluster management. The team writes Dockerfiles and task definitions — no Helm charts, no ArgoCD, no node pool sizing, no RBAC policies for the cluster itself. If the product reaches a scale where EKS is justified (50+ services, dedicated platform team), migration is a deployment-layer change, not an application rewrite.

**Key decision — AWS CDK over Terraform:**

TypeScript CDK keeps the entire stack in one language. The team already knows TypeScript. CDK constructs provide higher-level abstractions (e.g., `ApplicationLoadBalancedFargateService` creates ALB + target group + ECS service + security groups in one construct). Terraform is more mature for multi-cloud, but we've committed to AWS.

---

## Tier 10 — Monitoring & Observability

The AI engine requires purpose-built observability beyond standard application monitoring.

| Component | AWS Service / Tool | Purpose |
|-----------|-------------------|---------|
| **Metrics** | CloudWatch Metrics + CloudWatch Dashboards | Application metrics (request latency, error rates, task throughput), database metrics (connections, replication lag, query performance), AI metrics (operation latency, token usage, cost per operation, confidence distribution). Custom metrics via CloudWatch EMF (Embedded Metric Format) for zero-overhead structured logging. |
| **Logging** | CloudWatch Logs + Logs Insights | Centralized structured JSON logs from all ECS services. CloudWatch Logs Insights for ad-hoc querying. Log groups per service with 30-day retention (prod), 7-day (staging). |
| **Distributed Tracing** | AWS X-Ray | End-to-end request tracing: API → AI Orchestrator → LLM Gateway → Database. X-Ray SDK integrated into Fastify middleware. Critical for debugging AI operation latency chains. |
| **Error Tracking** | Sentry (SaaS) | Real-time error capture with source maps, breadcrumbs, and release tracking. Sentry over CloudWatch-only because CloudWatch lacks frontend error grouping and release correlation. |
| **Alerting** | CloudWatch Alarms → SNS → PagerDuty/Slack | Alert rules: circuit breaker open, AI failure rate >10%, per-tenant budget exceeded, NATS consumer lag >1000, RDS connection pool >80%, p95 API latency >2s, any 5xx spike. |
| **AI Observability Dashboard** | CloudWatch Dashboard (custom) | Dedicated AI dashboard: per-capability latency histograms, per-tenant budget usage gauges, acceptance/rejection rates, prompt version A/B comparison, circuit breaker state, shadow mode vs live mode toggle status. |
| **Runtime Monitoring** | F-022 | Basic in R0 (CloudWatch metrics + alarms). Full dashboard in R1. AI evaluation harness metrics integrated in R1. |

---

## Cross-Cutting: Data Flow Patterns

### Pattern 1 — NL→WBS (The Core Product Flow)

```
User describes project in NL (Web App)
  → POST /api/projects/generate-wbs
    → API authenticates, resolves tenant
    → AI Orchestrator: TRIGGER
    → Autonomy Check: WBS generation always requires human approval
    → Context Assembly:
        - Retrieve similar past projects from pgvector (tenant-scoped)
        - Load domain-specific prompt template (software delivery, data migration, etc.)
        - Aggregate tenant's historical estimation accuracy
        - Enforce token budget (5K input)
    → Confidence Check: is context sufficient? (>0.6 threshold)
    → LLM Call: Claude Opus 4 via LLM Gateway
    → Post-Processing: parse structured JSON, validate schema (phases, tasks, dependencies, estimates)
    → Disposition: PROPOSE (create ai_action with status=proposed)
  → Response: WBS proposal rendered in AI Review/Approve UI (F-016)
  → Human: approve / edit / reject
    → NATS: pm.ai.action_approved (or rejected)
    → If approved: Task Module creates all tasks, phases, dependencies
    → NATS: pm.tasks.created (N events), pm.projects.baseline_set
    → Consumers: audit-writer, embedding-pipeline, projection-updater all process
```

### Pattern 2 — AI PM Agent Loop (Autonomous Operations)

```
Every 15 minutes (scheduled ECS task or BullMQ recurring job):
  → For each active project in each tenant:
    → Query overdue tasks (due_date < now, status != completed)
    → Query stalled tasks (no status change in >48h, not blocked)
    → Query newly unblocked tasks (dependency just resolved)
    → For each actionable item:
      → AI Orchestrator: TRIGGER (agent loop)
      → Autonomy Check: nudge = auto-execute if policy allows; escalation = propose
      → Context Assembly: task details + assignee + project context
      → LLM Call: Claude Sonnet generates contextual nudge message
      → Disposition:
        - Nudge: deliver via Slack DM (respecting quiet hours, max 2/task/day)
        - Escalation: create proposal for PM review
      → NATS: pm.ai.action_executed (nudge) or pm.ai.action_proposed (escalation)
```

### Pattern 3 — Client Portal Query (Tenant-Isolated, Projection-Filtered)

```
Client asks: "When will Phase 2 be done?" (Client Portal NL Query)
  → POST /api/portal/query
    → Authenticate client JWT (client role, tenant-scoped)
    → AI Orchestrator: TRIGGER
    → Context Assembly:
        - RAG retrieval scoped to tenant_id AND client_visible=true
        - Only projected data (no internal estimates, resource conflicts, risk flags)
    → Confidence Check: can the AI answer from projected data alone?
    → LLM Call: Claude Sonnet
    → Post-Processing: verify response contains no internal data (redaction check)
    → Disposition:
        - If confidence > 0.8 and no sensitive content: direct response
        - If confidence < 0.8 or sensitive: flag for PM review before delivery (F-059)
```

---

## Cost Model

### Infrastructure Costs (Monthly, AWS)

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

### Unit Economics (R2 Target)

- Revenue per tenant: $500/mo (Pro tier average)
- Infrastructure cost per tenant: ~$110/mo (shared infra amortized over 3 tenants + per-tenant AI)
- **Gross margin: ~78%**
- At 10 tenants (R3): ~$5,000 revenue / ~$2,110 infra = **~58% gross margin** (AI costs scale sub-linearly with caching and prompt optimization)

### AI Token Cost Model (Per Tenant Per Month)

| Tier | AI Ops/Month | Estimated Token Cost | Subscription Price |
|------|-------------|---------------------|--------------------|
| Starter | ~500 | $8–15 | $29/mo |
| Pro | ~2,000 | $25–50 | $99/mo |
| Enterprise | ~5,000+ | $60–120 | $249+/mo |

---

## Release-Architecture Alignment

| Tier | R0 (Months 1–3) | R1 (Months 4–6) | R2 (Months 7–9) | R3 (Months 10–12) |
|------|------------------|------------------|------------------|---------------------|
| **Client** | Web app (internal) | + Slack/Teams bot | + Client portal, + Public API | Optional: Kanban/Gantt views |
| **Gateway** | ALB + WAF, password auth, RBAC (Admin+Dev) | + SSO, + MFA, + WebSocket | + Client role | + PM role |
| **Application** | Project, Task, Dependency, Comment, Audit, User modules | + Feature flags, + Config service | + Projection module live, + Webhook system | + Enterprise tier config |
| **AI Engine** | NL→WBS, "What's Next" (rules), NL Query (basic), Shadow mode, Autonomy policy, Traceability | + Adaptive engine (data-driven), + AI PM Agent, + Risk predictor, + Scope creep detector, + Summary engine (full) | + AI guardrails (multi-tenant), + Cost dashboard | + Per-tenant learning, + SOW generator, + Estimation engine |
| **Event Bus** | NATS 3-node, 6 streams, core consumers | + Integration event subjects | No changes needed | Evaluate 5-node if throughput demands |
| **Data** | PG 16 + pgvector (r6g.large), Redis, S3 | No tier changes needed | + Read replica, + Multi-tenant billing tables | Evaluate schema isolation for enterprise |
| **Integrations** | None | + Git, + Slack/Teams, + Calendar | + Webhooks (outbound), + Jira import | + Additional Git providers |
| **Security** | RLS, encryption, audit trail, secrets mgmt | + SOC 2 controls implementation | + PII scanning, + prompt injection defense, + SOC 2 Type I audit | + SOC 2 Type II prep |
| **Deployment** | ECS Fargate (2 tasks), CDK, GitHub Actions CI/CD | + AI Worker as separate service | + Auto-scaling policies, + staging environment mirrors prod | + Performance optimization |
| **Monitoring** | CloudWatch basics, Sentry | + X-Ray tracing, + AI observability dashboard | + Custom alerting rules | + Tenant-level monitoring |

---

## Architecture Decision Records (ADR Summary)

| ADR | Decision | Over | Rationale | Revisit When |
|-----|----------|------|-----------|-------------|
| ADR-001 | Hosted Claude API | Self-hosted / fine-tuned LLM | Lower ops burden, faster iteration, latest model access. A 5-person team cannot run GPU infrastructure. | R3: evaluate fine-tuning when tenant-specific data volume justifies it |
| ADR-002 | RAG with pgvector | Prompt engineering only / dedicated vector DB | Prompt engineering doesn't scale past single project. pgvector co-located with relational data enables SQL JOINs in RAG queries. | When p95 vector search >100ms at 1M+ embeddings |
| ADR-003 | NATS JetStream | Kafka / Redis Streams / SQS | Kafka is overprovisioned for 8 consumers. Redis Streams lack replay durability. SQS lacks fan-out. NATS: persistent, replayable, lightweight ops. | When consumer count >50 or throughput >100K events/min |
| ADR-004 | Shared schema + RLS | Schema-per-tenant / DB-per-tenant | Fast to ship. Database-enforced isolation (not application-trust). Single connection pool. | R3: evaluate schema isolation for enterprise tier with compliance requirements |
| ADR-005 | Hybrid pricing (subscription + AI metering) | Pure per-seat / pure usage-based | Per-seat erodes margins on heavy AI users. Pure usage is unpredictable for buyers. Hybrid: base subscription for predictability + AI metering for cost alignment. | After first 10 paying tenants — validate with real usage data |
| ADR-006 | PostgreSQL 16 + pgvector | Separate Pinecone/Weaviate + PostgreSQL | One database to operate, backup, monitor, and scale. pgvector is sufficient for R0–R2 scale. Co-location enables relational+vector queries. | When vector corpus >1M rows or search latency degrades |
| ADR-007 | Fastify (Node.js + TypeScript) | NestJS / FastAPI (Python) | Shared language with Next.js = single hiring profile. Fastify is the fastest Node.js framework. TypeScript end-to-end with shared types via monorepo. | If Python-specific ML/data science requirements emerge in R3 |
| ADR-008 | ECS Fargate | EKS (Kubernetes) | Zero cluster management. No node pool sizing, no RBAC for infra, no Helm charts. Fargate provides auto-scaling containers at the complexity ceiling a 5-person team should operate. | When service count >15 or team has dedicated platform engineer |
| ADR-009 | AWS CDK (TypeScript) | Terraform / CloudFormation | Same language as the entire stack. Higher-level constructs reduce IaC boilerplate. Not multi-cloud (we committed to AWS). | If multi-cloud becomes a requirement |
| ADR-010 | Modular monolith → extract AI worker | Microservices from day 1 | Microservices at 5 engineers = operational overhead that kills product velocity. Clean module boundaries enable extraction when independently scaling is needed (AI worker in R1). | When a module's scaling requirements diverge significantly from the monolith |
| ADR-011 | Next.js 15 (single app, route groups) | Separate frontends for internal + portal | One codebase, shared components, single deployment. Route groups (`/(internal)/` and `/(portal)/`) provide clean separation without operational overhead of two apps. | If portal requires fundamentally different deployment model (e.g., edge-only) |
| ADR-012 | CloudWatch + X-Ray + Sentry | Datadog / Grafana Cloud / self-hosted Prometheus | CloudWatch is included with AWS services (no additional vendor). X-Ray provides distributed tracing natively. Sentry adds frontend error tracking that CloudWatch lacks. Three tools, not one expensive vendor. | If observability needs outgrow CloudWatch (complex custom dashboards, long-term metric retention) — evaluate Grafana Cloud |

---

## Monorepo Structure

```
ai-pm-tool/
├── apps/
│   ├── web/                    # Next.js 15 (internal + portal)
│   │   ├── app/
│   │   │   ├── (internal)/     # Internal PM routes
│   │   │   ├── (portal)/       # Client portal routes
│   │   │   └── api/            # Next.js API routes (BFF pattern)
│   │   └── ...
│   ├── api/                    # Fastify API server
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── project/
│   │   │   │   ├── task/
│   │   │   │   ├── dependency/
│   │   │   │   ├── comment/
│   │   │   │   ├── audit/
│   │   │   │   ├── user/
│   │   │   │   ├── projection/
│   │   │   │   └── config/
│   │   │   ├── ai/
│   │   │   │   ├── orchestrator/
│   │   │   │   ├── capabilities/
│   │   │   │   │   ├── wbs-generator/
│   │   │   │   │   ├── whats-next/
│   │   │   │   │   ├── nl-query/
│   │   │   │   │   ├── summary/
│   │   │   │   │   ├── risk-predictor/
│   │   │   │   │   ├── pm-agent/
│   │   │   │   │   └── scope-creep/
│   │   │   │   ├── gateway/        # LLM Gateway + circuit breaker
│   │   │   │   ├── context/        # Context assembly + RAG
│   │   │   │   ├── evaluation/     # Eval harness
│   │   │   │   └── traceability/   # AI action logging
│   │   │   ├── events/             # NATS producers + consumers
│   │   │   ├── integrations/       # Git, Slack, Calendar adapters
│   │   │   ├── auth/               # Authentication + RBAC
│   │   │   └── common/             # Middleware, error handling, logging
│   │   └── ...
│   └── ai-worker/              # R1+: Separate ECS service for async AI
│       └── src/
│           ├── agent-loop/     # AI PM Agent 15-min cycle
│           ├── consumers/      # NATS event consumers for AI processing
│           └── scheduled/      # Cron-triggered AI jobs (summaries, reports)
├── packages/
│   ├── shared/                 # Shared types, validators, constants
│   │   ├── types/              # TypeScript interfaces (Project, Task, etc.)
│   │   ├── validators/         # Zod schemas (shared between API + web)
│   │   └── constants/          # Status labels, priority levels, event subjects
│   ├── db/                     # Drizzle schema + migrations
│   │   ├── schema/
│   │   ├── migrations/
│   │   └── seeds/
│   └── prompts/                # Versioned prompt templates
│       ├── wbs-generator/
│       │   ├── v1.0.yaml
│       │   └── v1.1.yaml
│       ├── nl-query/
│       ├── summary/
│       └── risk-predictor/
├── infra/                      # AWS CDK
│   ├── lib/
│   │   ├── vpc-stack.ts
│   │   ├── database-stack.ts
│   │   ├── compute-stack.ts
│   │   ├── monitoring-stack.ts
│   │   └── pipeline-stack.ts
│   └── bin/
│       └── app.ts
├── tests/
│   ├── integration/
│   ├── ai-evaluation/          # Golden test sets for AI capabilities
│   └── load/
├── turbo.json
├── pnpm-workspace.yaml
└── docker-compose.yml          # Local dev: PG, Redis, NATS
```

---

## What Makes This Architecture Evergreen

1. **No rewrite gates.** The R0 schema supports R3 features. `tenant_id` is on every table from day 1. The projection module's data model exists even if the portal UI doesn't ship until R2. Per-tenant AI learning in R3 consumes the same event bus and embedding pipeline built in R0.

2. **Scaling is configuration, not architecture.** R0→R2 scaling = changing ECS task counts and RDS instance sizes in CDK config. No service topology changes until AI worker extraction in R1 (planned, not reactive).

3. **AI capabilities are pluggable.** Adding a new AI capability (e.g., SOW Generator in R3) means: create a new directory under `ai/capabilities/`, define its prompt templates, context requirements, and confidence thresholds, and register it with the orchestrator. The pipeline, traceability, cost tracking, and evaluation harness handle it automatically.

4. **Technology choices degrade gracefully.** pgvector → dedicated vector store is a connection string change + migration. ECS Fargate → EKS is a deployment-layer swap. NATS → Kafka is a producer/consumer interface change (same event schema). None of these require application logic changes.

5. **The event bus decouples everything.** Adding a new consumer (e.g., a new analytics pipeline, a new integration) requires zero changes to producers. The event schema is the contract.

---

*AI-Native PM Tool · Architecture v3.0 · Definitive · AWS-native · Event-driven · Tenant-isolated · Observable AI · Evergreen from R0 through R3+*
