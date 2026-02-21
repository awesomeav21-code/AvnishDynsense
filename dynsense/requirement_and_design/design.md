# AI-Native PM Tool — Technical Design Document

> **Version:** 1.0
> **Date:** February 2026
> **Status:** Draft
> **Authors:** Engineering Team
> **Aligned to:** Architecture v3.0, Product Roadmap v2

---

## 1. Introduction

### 1.1 Purpose

This document provides the comprehensive technical design for the AI-Native PM Tool — a project management platform where the AI runs the project and the human supervises. It translates the system architecture (v3.0) and product roadmap (v2.1, 103 features across R0-R3) into implementable specifications covering all ten architectural tiers, database schemas, API contracts, event flows, and deployment configurations.

### 1.2 References

| Document | Description |
|----------|-------------|
| `requirements.md` | Functional (FR-xxx) and non-functional (NFR-xxx) requirements |
| `FINAL_AI_Native_PM_Tool_Architecture_v3_Definitive.md` | System architecture v3.0 — 10-tier design, ADRs, cost model |
| `roadmap-v2.md` | Product roadmap v2 — 88 features (F-001 through F-088), release gates |

### 1.3 Cross-Reference Conventions

| Prefix | Meaning | Example |
|--------|---------|---------|
| **FR-xxx** | Functional requirement from requirements.md | FR-200 (NL to WBS generation) |
| **NFR-xxx** | Non-functional requirement from requirements.md | NFR-100 (API latency p95 < 500ms) |
| **F-xxx** | Feature from roadmap-v2.md | F-011 (NL project setup) |
| **ADR-xxx** | Architecture decision record | ADR-001 (Hosted Claude API) |

### 1.4 Requirement Identifier Mapping

The following mapping connects FR identifiers used throughout this document to their corresponding roadmap features:

| FR Range | Domain | Roadmap Features |
|----------|--------|-----------------|
| FR-100–FR-109 | Platform Foundation | F-001 through F-010 |
| FR-200–FR-203 | AI Engine Core Loop | F-011 through F-014 |
| FR-300–FR-305 | AI Safety & Autonomy | F-015 through F-019, F-035 |
| FR-400–FR-402 | AI Observability | F-020 through F-022 |
| FR-500–FR-503 | Human Surfaces | F-023 through F-026 |
| FR-600–FR-607 | AI Proactive Ops (R1) | F-027 through F-034 |
| FR-700–FR-702 | Integrations | F-036 through F-038 |
| FR-800–FR-802 | Security & Identity | F-039 through F-041 |
| FR-900–FR-901 | Client Projection | F-042 through F-043 |
| FR-1000–FR-1002 | SaaS Infrastructure | F-044 through F-046 |
| FR-1100–FR-1103 | Enhanced Task Mgmt | F-047 through F-050 |
| FR-1200–FR-1202 | Visualization | F-051 through F-053 |
| FR-1300–FR-1305 | Multi-Tenancy & Client | F-054 through F-059 |
| FR-1400–FR-1402 | Monetization | F-060 through F-062 |
| FR-1500–FR-1503 | Platform Hardening | F-063 through F-066 |
| FR-1600–FR-1606 | Enhanced AI (R2) | F-067 through F-073 |
| FR-1700–FR-1704 | Per-Tenant Intelligence | F-074 through F-078 |
| FR-1800–FR-1803 | Consultancy Moat | F-083 through F-086 |
| FR-1900–FR-1901 | Visualization (Promoted) | F-087 (→R1), F-088 (→R2) |
| FR-2000–FR-2014 | ClickUp Gap Features | F-089 through F-103 |

---

## 2. Architecture Overview

### 2.1 Architecture Principles

Seven principles govern every decision in this design. They resolve all tensions between speed-to-ship and long-term scalability.

| # | Principle | Implication |
|---|-----------|-------------|
| 1 | **AWS-managed over self-managed** | ECS Fargate over Kubernetes. RDS over self-hosted PostgreSQL. ElastiCache over self-managed Redis. A 5-person team cannot operate a Kubernetes cluster and build an AI product simultaneously. |
| 2 | **Monorepo, modular monolith, not microservices** | One deployable API service with well-separated internal modules. Split into services only when independently scaling AI workers is required (R1+). |
| 3 | **Event-driven from day 1, but start simple** | NATS JetStream for the event bus. Every state mutation emits an event. Every AI capability consumes events. Lighter than Kafka, persistent with replay. |
| 4 | **Single database, stretched intelligently** | PostgreSQL 16 with pgvector for relational + vector in one engine. RLS for tenant isolation. JSONB for flexible fields. |
| 5 | **AI is a first-class infrastructure concern** | The AI engine has its own orchestration pipeline, cost tracking, autonomy policies, traceability, evaluation harness, and circuit breakers — all from R0. |
| 6 | **Security is structural, not aspirational** | `tenant_id` on every table from day 1. RLS enforced at the database layer. Immutable audit trail. SOC 2 controls built into the architecture. |
| 7 | **Evergreen means building the R3 data model in R0** | The schema, event streams, and AI pipeline support per-tenant learning, client projection, and enterprise isolation from day 1 — even if those features ship in R2-R3. |

### 2.2 10-Tier Architecture Diagram

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
|  TIER 4: AI ENGINE                                                          |
|  Orchestrator (7-stage) | Capabilities | Shared Infra (Gateway, RAG, Cost) |
+============================================================================+
          |                           |
          v                           v
+============================================================================+
|  TIER 5: EVENT BUS                                                          |
|  NATS JetStream (3-node) | 12 Streams | 11 Durable Consumers | DLQ         |
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

### 2.3 Tier Summary

| Tier | Name | Key Technology | Primary Release | Related FRs |
|------|------|---------------|----------------|-------------|
| 1 | Client Layer | Next.js 15, React Server Components | R0 | FR-500–FR-503, FR-201, FR-203 |
| 2 | Gateway & Auth | ALB + WAF, JWT RS256, RBAC | R0 | FR-103, FR-104, FR-800–FR-802 |
| 3 | Application Services | Fastify 5, Drizzle ORM, TypeBox | R0 | FR-102, FR-105–FR-109, FR-900 |
| 4 | AI Engine | Claude Opus 4 / Sonnet 4.5, Orchestrator | R0 | FR-200–FR-203, FR-300–FR-305, FR-600–FR-607 |
| 5 | Event Bus | NATS JetStream 2.10+ | R0 | FR-100 |
| 6 | Database | PostgreSQL 16, pgvector, Redis 7, S3 | R0 | FR-101, FR-102, NFR-100–NFR-103 |
| 7 | Integration Gateway | Fastify plugins, OAuth 2.0 | R1 | FR-700–FR-702 |
| 8 | Security & AI Safety | KMS, RLS, Secrets Manager | R0 | FR-800–FR-802, NFR-200–NFR-205 |
| 9 | Deployment & CI/CD | ECS Fargate, CDK, GitHub Actions | R0 | NFR-300–NFR-303 |
| 10 | Monitoring & Observability | CloudWatch, X-Ray, Sentry | R0 | FR-400–FR-402 |

---

## 3. Technology Stack

### 3.1 Decision Matrix

| Category | Choice | Over (Alternative) | Rationale |
|----------|--------|-------------------|-----------|
| Cloud | AWS (single-cloud) | Multi-cloud | Managed services, single vendor, CDK alignment |
| Compute | ECS Fargate | EKS / Kubernetes | Zero cluster management for 5-person team |
| Runtime | Node.js 22 LTS | Python / Go | Shared language with Next.js, single hiring profile |
| API Framework | Fastify 5 | NestJS / Express | Fastest Node.js framework, plugin architecture |
| Frontend | Next.js 15 App Router | Separate apps | RSC maturity, route groups for internal + portal |
| ORM | Drizzle ORM | Prisma / Knex | TypeScript-first, readable SQL, schema-as-code |
| Database | PostgreSQL 16 + pgvector | Separate vector DB | One DB to operate, relational + vector co-located |
| Event Bus | NATS JetStream | Kafka / Redis Streams | Persistent, replayable, lightweight ops |
| AI Model | Claude API (hosted) | Self-hosted LLM | Lower ops burden, latest model access |
| IaC | AWS CDK (TypeScript) | Terraform | Same language as stack, higher-level constructs |
| Monitoring | CloudWatch + X-Ray + Sentry | Datadog | Included with AWS, no additional vendor cost |
| Validation | TypeBox + Zod | Joi / Yup | Fastify-native + shared with frontend |

### 3.2 Architecture Decision Records

#### ADR-001 — Hosted Claude API over Self-Hosted LLM

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Context** | The AI engine requires large language model capabilities for WBS generation, NL querying, summarization, risk prediction, and autonomous agent operations. The team must decide between hosting/fine-tuning open-source models (LLaMA, Mistral) or using a hosted API (Claude, GPT). |
| **Decision** | Use Anthropic's hosted Claude API (Opus 4 for generation/risk, Sonnet 4.5 for queries/summaries) via the Anthropic SDK. |
| **Rationale** | A 5-person team cannot run GPU infrastructure and build an AI product simultaneously. Hosted API provides: latest model access without retraining, predictable per-token pricing, zero ML-ops overhead, built-in safety features. |
| **Consequences** | Positive: faster iteration, no GPU cost, automatic model improvements. Negative: vendor dependency, data leaves our infrastructure (mitigated by Anthropic's data handling policies), per-token costs at scale. |
| **Revisit Trigger** | R3: evaluate fine-tuning when tenant-specific data volume justifies it and per-tenant learning (FR-1700, F-074) demands customization beyond RAG. |
| **Related FRs** | FR-200, FR-203, FR-600, FR-601, FR-607 |

#### ADR-002 — RAG with pgvector over Prompt Engineering Only

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Context** | AI capabilities need access to tenant-specific historical data (past projects, task patterns, estimation accuracy) to produce contextually relevant outputs. Options: pure prompt engineering with context injection, RAG with vector storage, or model fine-tuning. |
| **Decision** | Implement RAG using pgvector co-located in PostgreSQL. Embed tasks, comments, project descriptions, and audit summaries using `text-embedding-3-small` (1536 dimensions). |
| **Rationale** | Prompt engineering alone does not scale past a single project. pgvector co-located with relational data enables SQL JOINs in RAG queries (e.g., "find similar tasks in this tenant's history" with tenant scoping in the same query). No separate vector DB infrastructure to operate. |
| **Consequences** | Positive: single database to operate, tenant-scoped vector search via SQL, JOINs between relational and vector data. Negative: pgvector performance ceiling at very large scale, IVFFlat index rebuild required periodically. |
| **Revisit Trigger** | When p95 vector similarity search exceeds 100ms at 1M+ embeddings. Evaluate dedicated Pinecone/Weaviate at that point. |
| **Related FRs** | FR-200, FR-203, FR-600, FR-1700 |

#### ADR-003 — NATS JetStream over Kafka / Redis Streams

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Context** | The event-driven architecture (FR-100, F-001) requires a persistent, replayable message bus with consumer groups. Options: Apache Kafka, NATS JetStream, Redis Streams, AWS SQS/SNS. |
| **Decision** | Use NATS JetStream 2.10+ deployed as a 3-node cluster on ECS Fargate with 30-day retention and at-least-once delivery. |
| **Rationale** | Kafka is overprovisioned for 8 consumers and <10K events/day (requires ZooKeeper/KRaft, broker tuning, partition rebalancing). Redis Streams lack replay durability. SQS lacks fan-out patterns. NATS JetStream provides persistence, replay, consumer groups, and dead letter queues with dramatically lower operational complexity. |
| **Consequences** | Positive: lightweight ops, persistent with replay, sufficient through R3. Negative: smaller ecosystem than Kafka, fewer managed service options on AWS. |
| **Revisit Trigger** | When consumer count exceeds 50 or throughput exceeds 100K events/min. |
| **Related FRs** | FR-100, FR-400 |

#### ADR-004 — Shared Schema + RLS over Schema-per-Tenant

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Context** | Multi-tenancy (FR-101, F-002) requires data isolation between tenants. Options: shared schema with `tenant_id` + RLS, schema-per-tenant, database-per-tenant. |
| **Decision** | Shared schema with `tenant_id` on every table, enforced via PostgreSQL Row-Level Security policies. |
| **Rationale** | Fast to ship. Database-enforced isolation (not application-trust). Single connection pool. Single migration path. Works from R0 (single tenant) through R2 (multi-tenant) without schema changes. |
| **Consequences** | Positive: simple operations, single connection pool, one migration path. Negative: noisy neighbor risk at extreme scale, less physical isolation for compliance-sensitive tenants. |
| **Revisit Trigger** | R3: evaluate schema isolation for enterprise tier (F-080) with strict compliance requirements. |
| **Related FRs** | FR-101, FR-1300, NFR-200 |

#### ADR-005 — Hybrid Pricing Model

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Context** | AI-heavy tools with pure per-seat pricing erode margins on heavy AI users. Pure usage-based pricing is unpredictable for buyers. The pricing model must align cost with value delivered. |
| **Decision** | Hybrid model: base subscription (per workspace) + AI operations metering (generous included tier, overage billing) + client portal seats as add-on. Three tiers: Starter ($29/mo), Pro ($99/mo), Enterprise ($249+/mo). |
| **Rationale** | Base subscription provides revenue predictability for buyers. AI metering aligns infrastructure cost with actual usage. Client portal as add-on captures additional value for consultancy use case. |
| **Consequences** | Positive: predictable revenue, cost-aligned AI usage, upsell path. Negative: complex billing logic, requires accurate cost tracking per tenant (FR-1000, F-046). |
| **Revisit Trigger** | After first 10 paying tenants — validate with real usage data. |
| **Related FRs** | FR-1400, FR-1000 |

#### ADR-006 — PostgreSQL 16 + pgvector over Separate Vector DB

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Context** | The AI engine requires vector similarity search for RAG. Options: dedicated vector database (Pinecone, Weaviate, Qdrant) alongside PostgreSQL, or pgvector extension co-located in PostgreSQL. |
| **Decision** | Use pgvector extension in PostgreSQL 16 (RDS). `text-embedding-3-small` at 1536 dimensions. IVFFlat index for R0-R2, evaluate HNSW at R3. |
| **Rationale** | One database to operate, backup, monitor, and scale. Co-location enables relational + vector queries in a single statement (tenant-scoped similarity search with JOINs). Eliminates a separate infrastructure component and its associated operational burden. |
| **Consequences** | Positive: single DB, tenant-scoped vector search via SQL, simplified operations. Negative: pgvector is less performant than dedicated vector DBs at very large scale. |
| **Revisit Trigger** | When vector corpus exceeds 1M rows or search latency degrades beyond p95 100ms. |
| **Related FRs** | FR-200, FR-203, FR-1700 |

#### ADR-007 — Fastify (Node.js + TypeScript) over NestJS / FastAPI

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Context** | The API server framework choice affects developer velocity, performance, and hiring. Options: Fastify (Node.js), NestJS (Node.js), FastAPI (Python), Express (Node.js). |
| **Decision** | Fastify 5 on Node.js 22 LTS with TypeScript 5+. |
| **Rationale** | Shared language with Next.js frontend = single hiring profile. Fastify is the fastest Node.js HTTP framework. Plugin architecture maps cleanly to the modular monolith pattern. Schema-based validation via TypeBox is native. TypeScript end-to-end with shared types via monorepo. |
| **Consequences** | Positive: highest performance Node.js framework, plugin architecture for modules, shared types with frontend. Negative: smaller ecosystem than Express, less opinionated than NestJS. |
| **Revisit Trigger** | If Python-specific ML/data science requirements emerge in R3. |
| **Related FRs** | FR-102, FR-105, NFR-100 |

#### ADR-008 — ECS Fargate over EKS

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Context** | Container orchestration for API, AI workers, web app, and NATS cluster. Options: ECS Fargate (serverless containers), EKS (managed Kubernetes), EC2 with Docker Compose. |
| **Decision** | ECS Fargate for all compute workloads. |
| **Rationale** | Zero cluster management. No node pool sizing, no RBAC for infrastructure, no Helm charts, no ArgoCD. Fargate provides auto-scaling containers at the complexity ceiling a 5-person team should operate. The team writes Dockerfiles and task definitions — not cluster configurations. |
| **Consequences** | Positive: zero cluster ops, auto-scaling, pay-per-use. Negative: less flexibility than Kubernetes, no custom operators, slightly higher per-container cost. |
| **Revisit Trigger** | When service count exceeds 15 or team has a dedicated platform engineer. |
| **Related FRs** | NFR-300, NFR-301 |

#### ADR-009 — AWS CDK (TypeScript) over Terraform

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Context** | Infrastructure as Code tool for provisioning and managing AWS resources. Options: AWS CDK (TypeScript), Terraform (HCL), CloudFormation (YAML/JSON), Pulumi. |
| **Decision** | AWS CDK with TypeScript. |
| **Rationale** | Same language as the entire stack. Higher-level constructs reduce IaC boilerplate (e.g., `ApplicationLoadBalancedFargateService` creates ALB + target group + ECS service + security groups in one construct). The team already knows TypeScript. |
| **Consequences** | Positive: single language across entire stack, high-level constructs, type safety. Negative: AWS-only (we committed to AWS), CloudFormation under the hood adds abstraction layer. |
| **Revisit Trigger** | If multi-cloud becomes a requirement. |
| **Related FRs** | NFR-300 |

#### ADR-010 — Modular Monolith, Extract AI Worker at R1

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Context** | Service topology for the application layer. Options: microservices from day 1, modular monolith, monolith without module boundaries. |
| **Decision** | Modular monolith in R0 with clean module boundaries (each module has routes/, services/, repositories/, types/, events/). Extract AI worker as the first separate ECS service in R1 when async AI processing needs independent scaling. |
| **Rationale** | Microservices at 5 engineers = operational overhead that kills product velocity (service discovery, distributed tracing, deployment choreography, network debugging). The modular monolith gives clean separation with zero distributed systems overhead. |
| **Consequences** | Positive: fast to ship, zero distributed systems overhead, clean extraction path. Negative: shared process means a bug in one module can affect others, single scaling unit until R1. |
| **Revisit Trigger** | When a module's scaling requirements diverge significantly from the monolith. |
| **Related FRs** | FR-100, NFR-300 |

#### ADR-011 — Next.js 15 Single App with Route Groups

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Context** | Frontend architecture for both internal PM interface and external client portal. Options: two separate Next.js apps, single app with route groups, micro-frontends. |
| **Decision** | Single Next.js 15 app with route groups: `(internal)` for PM interface, `(portal)` for client-facing views. |
| **Rationale** | One codebase, shared components, single deployment. Route groups provide clean URL separation without operational overhead of two apps. Shared component library (Shadcn UI) across both surfaces. |
| **Consequences** | Positive: single deployment, shared components, one build pipeline. Negative: portal and internal share the same deployment — a deploy to one affects both. |
| **Revisit Trigger** | If portal requires fundamentally different deployment model (e.g., edge-only, separate scaling). |
| **Related FRs** | FR-500, FR-1300, FR-1301 |

#### ADR-012 — CloudWatch + X-Ray + Sentry over Datadog

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Context** | Observability stack for metrics, logging, tracing, and error tracking. Options: Datadog (all-in-one), Grafana Cloud, CloudWatch + X-Ray + Sentry, self-hosted Prometheus + Grafana. |
| **Decision** | CloudWatch for metrics and logs, X-Ray for distributed tracing, Sentry for frontend error tracking. |
| **Rationale** | CloudWatch is included with AWS services (no additional vendor cost). X-Ray provides distributed tracing natively with ECS and Fastify. Sentry adds frontend error tracking with source maps and release correlation that CloudWatch lacks. Three focused tools instead of one expensive vendor. |
| **Consequences** | Positive: low cost, native AWS integration, Sentry for frontend quality. Negative: three tools to manage, CloudWatch dashboards less flexible than Datadog. |
| **Revisit Trigger** | If observability needs outgrow CloudWatch (complex custom dashboards, long-term metric retention) — evaluate Grafana Cloud. |
| **Related FRs** | FR-400, FR-402 |

---

## 4. Monorepo Structure

### 4.1 Directory Layout

```
ai-pm-tool/
├── apps/
│   ├── web/                        # Next.js 15 (internal + portal)
│   │   ├── app/
│   │   │   ├── (internal)/         # Internal PM routes
│   │   │   │   ├── dashboard/
│   │   │   │   ├── projects/
│   │   │   │   ├── tasks/
│   │   │   │   ├── ai-review/
│   │   │   │   └── settings/
│   │   │   ├── (portal)/           # Client portal routes (R2)
│   │   │   │   ├── [tenantSlug]/
│   │   │   │   │   ├── overview/
│   │   │   │   │   ├── milestones/
│   │   │   │   │   └── queries/
│   │   │   └── api/                # Next.js API routes (BFF pattern)
│   │   ├── components/
│   │   │   ├── ui/                 # Shadcn UI primitives
│   │   │   ├── ai/                 # AI review, What's Next, NL Query
│   │   │   ├── projects/
│   │   │   ├── tasks/
│   │   │   └── layout/
│   │   ├── lib/
│   │   └── styles/
│   ├── api/                        # Fastify API server
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── project/        # routes/ services/ repositories/ types/ events/
│   │   │   │   ├── task/
│   │   │   │   ├── dependency/
│   │   │   │   ├── comment/
│   │   │   │   ├── audit/
│   │   │   │   ├── user/
│   │   │   │   ├── projection/
│   │   │   │   └── config/
│   │   │   ├── ai/
│   │   │   │   ├── orchestrator/   # 7-stage pipeline
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
│   │   ├── Dockerfile
│   │   └── package.json
│   └── ai-worker/                  # R1+: Separate ECS service
│       └── src/
│           ├── agent-loop/         # AI PM Agent 15-min cycle
│           ├── consumers/          # NATS event consumers for AI
│           └── scheduled/          # Cron-triggered AI jobs
├── packages/
│   ├── shared/                     # Shared types, validators, constants
│   │   ├── types/                  # TypeScript interfaces
│   │   ├── validators/             # Zod schemas (API + web)
│   │   └── constants/              # Status labels, priorities, event subjects
│   ├── db/                         # Drizzle schema + migrations
│   │   ├── schema/
│   │   ├── migrations/
│   │   └── seeds/
│   └── prompts/                    # Versioned prompt templates
│       ├── wbs-generator/
│       │   ├── v1.0.yaml
│       │   └── v1.1.yaml
│       ├── nl-query/
│       ├── summary/
│       └── risk-predictor/
├── infra/                          # AWS CDK
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
│   ├── ai-evaluation/              # Golden test sets
│   └── load/
├── turbo.json
├── pnpm-workspace.yaml
└── docker-compose.yml              # Local dev: PG, Redis, NATS
```

### 4.2 Package Boundaries

Each module in `apps/api/src/modules/` follows a strict internal structure:

```
modules/task/
├── routes/              # Fastify route handlers (HTTP layer)
│   ├── task.routes.ts
│   └── task.schemas.ts  # TypeBox request/response schemas
├── services/            # Business logic (domain layer)
│   └── task.service.ts
├── repositories/        # Database access (data layer)
│   └── task.repository.ts
├── types/               # Module-specific TypeScript types
│   └── task.types.ts
└── events/              # NATS event producers
    └── task.events.ts
```

**Rules:**
- Modules communicate via service interfaces, never by importing another module's repository directly.
- Cross-module queries use service-to-service calls within the same process (no HTTP between modules).
- Events are the primary mechanism for cross-module side effects (audit logging, embedding generation, notifications).

### 4.3 Turborepo + pnpm Workspace Configuration

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'infra'
```

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "type-check": {},
    "test": {
      "dependsOn": ["build"]
    },
    "db:migrate": {
      "cache": false
    }
  }
}
```

---

## 5. Tier 1: Client Layer

> **Related FRs:** FR-500 (task detail view, F-023), FR-501 (project/task lists, F-024), FR-502 (sidebar nav, F-025), FR-503 (comments, F-026), FR-201 (What's Next, F-012), FR-203 (NL query, F-014), FR-301 (AI review UI, F-016)

### 5.1 Next.js 15 App Router with Route Groups

The frontend is a single Next.js 15 application using the App Router. Two route groups provide clean separation between the internal PM interface and the client-facing portal:

| Route Group | URL Pattern | Purpose | Release |
|-------------|-------------|---------|---------|
| `(internal)` | `/dashboard`, `/projects/*`, `/tasks/*`, `/ai-review/*`, `/settings/*` | Primary PM interface for admins and developers | R0 |
| `(portal)` | `/portal/[tenantSlug]/*` | Client-facing portal consuming the projection layer | R2 |
| `api/` | `/api/*` | BFF (Backend for Frontend) routes proxying to Fastify API | R0 |

### 5.2 Server vs Client Component Strategy

| Component Type | Use For | Examples |
|----------------|---------|---------|
| **Server Components** (default) | Data fetching, initial page render, SEO-critical content | Project list page, task detail page, dashboard layout |
| **Client Components** (`'use client'`) | Interactivity, real-time updates, form handling, AI streaming | NL Query panel (streaming), AI Review UI (bulk actions), task board (drag-drop), comment threads |
| **Server Actions** (`'use server'`) | Form submissions, mutations | Create project, approve AI action, update task status |

### 5.3 AI Review UI (FR-301, F-016)

The AI Review/Approve interface is the core interaction pattern for an AI-operated tool. It is a high-density review screen, not a chat box.

**Design requirements:**
- Display up to 50 AI suggestions in a scannable list format
- Each suggestion shows: capability type, confidence score (color-coded), summary, affected entities
- Bulk operations: approve all, reject all, approve selected
- Keyboard shortcuts: `a` = approve, `r` = reject, `e` = edit, `j/k` = navigate list, `Enter` = open detail
- Filter by: capability type, confidence level, status (pending/approved/rejected)
- Inline editing: modify AI-generated content before approving

**Component hierarchy:**
```
<AIReviewPage>                         // Server Component - fetches pending actions
  <AIReviewToolbar>                    // Client - filters, bulk actions, keyboard handler
  <AIReviewList>                       // Client - virtualized list for performance
    <AIReviewItem>                     // Client - individual action card
      <ConfidenceBadge />              // confidence score with color coding
      <ActionSummary />                // what the AI proposes
      <AffectedEntities />             // linked tasks/projects
      <ActionButtons />                // approve / edit / reject
    </AIReviewItem>
  </AIReviewList>
  <AIReviewDetail>                     // Client - side panel for selected item
    <DiffView />                       // shows before/after for edits
    <AIReasoning />                    // why the AI made this suggestion
    <RollbackInfo />                   // what happens on reject
  </AIReviewDetail>
</AIReviewPage>
```

### 5.4 What's Next View (FR-201, F-012)

Per-developer prioritized task list. The primary work-finding interface — replaces Kanban board as the default view.

**Design:**
- Ordered list of tasks ranked by: dependency resolution status, due date proximity, priority level
- Each item shows: task title, project name, priority badge, due date, blocking/blocked indicators, AI reasoning for rank position
- R0: pure algorithmic ranking (no LLM). R1: LLM-ranked with natural language explanations
- Quick actions: start task, mark complete, view dependencies, snooze (defer 24h)
- Auto-refreshes when task status changes (via WebSocket in R1, polling in R0)

**API endpoint:** `GET /api/v1/users/me/next` (see Section 17)

### 5.5 NL Query Panel (FR-203, F-014)

Conversational interface for asking questions about project state.

**Design:**
- Slide-out panel accessible from any page via `Cmd/Ctrl+K` shortcut
- Text input with typeahead suggestions for common queries
- Streaming response display (tokens appear as they arrive from Claude Sonnet)
- Response includes: answer text, source references (linked tasks/projects), confidence indicator
- Query history per user (last 20 queries, stored client-side)
- Example queries shown when panel is empty: "What's blocked right now?", "What did the team ship this week?", "How is Project X tracking?"

**Streaming implementation:**
```typescript
// Client component using ReadableStream
const response = await fetch('/api/v1/query', {
  method: 'POST',
  body: JSON.stringify({ query: userInput }),
  headers: { 'Content-Type': 'application/json' }
});

const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  appendToResponse(chunk);
}
```

### 5.6 Shadcn UI + Tailwind Integration

All UI primitives use Shadcn UI with Tailwind CSS tokens. No custom CSS or hardcoded color values.

| Aspect | Standard |
|--------|----------|
| Typography | Inter font, `text-xs` baseline, `font-normal` default |
| Spacing | Tailwind tokens only (4px/8px base grid) |
| Colors | Semantic tokens: `primary`, `secondary`, `success`, `error`, `warning`, `info` |
| Icons | Lucide React, 16x16px max |
| Dark mode | Full implementation using Tailwind `dark:` variants |
| Animations | 300ms spring, `prefers-reduced-motion` respected |

---

## 6. Tier 2: Gateway & Auth

> **Related FRs:** FR-103 (authentication, F-004), FR-104 (RBAC, F-005), FR-800 (SSO, F-039), FR-801 (MFA, F-040), FR-802 (session hardening, F-041)

### 6.1 ALB + WAF Configuration

| Component | Configuration | Release |
|-----------|---------------|---------|
| **AWS ALB** | TLS 1.3 termination, HTTPS listener on 443, HTTP→HTTPS redirect on 80. Target groups: `web` (Next.js), `api` (Fastify). Path-based routing: `/api/*` → API target group, `/*` → Web target group. | R0 |
| **AWS WAF** | Attached to ALB. Rule groups: AWS Managed OWASP Core Rule Set, AWS Managed Known Bad Inputs, AWS Managed IP Reputation. Custom rules: rate limiting (1000 req/5min per IP), geo-blocking (optional per tenant config). | R0 |
| **Health checks** | ALB health check: `GET /health` on API (200 OK with DB + NATS connectivity status). Unhealthy threshold: 3 consecutive failures. | R0 |

### 6.2 JWT Structure

All authenticated requests carry a JWT in the `Authorization: Bearer <token>` header.

**Access token payload (RS256, 1h expiry):**

```json
{
  "sub": "user_uuid",
  "tenant_id": "tenant_uuid",
  "role": "admin|developer|client|pm",
  "email": "user@example.com",
  "iat": 1709000000,
  "exp": 1709003600,
  "jti": "unique_token_id"
}
```

**Key management:**
- RS256 asymmetric signing (private key in Secrets Manager, public key distributed)
- Key rotation: new keypair generated every 90 days, old key valid for 7 days after rotation
- Token validation: verify signature, check `exp`, check `tenant_id` exists, check `role` is valid

### 6.3 Session Management

| Aspect | Configuration |
|--------|---------------|
| **Access token** | 1h expiry, stateless JWT, not stored server-side |
| **Refresh token** | 30-day expiry, stored in Redis (ElastiCache) with `session:{user_id}:{jti}` key |
| **Token rotation** | Every refresh request issues new access + refresh token pair, invalidates old refresh token |
| **Concurrent sessions** | Max 5 active sessions per user (configurable per tenant). New session evicts oldest. |
| **Forced logout** | Admin can invalidate all sessions for a user by deleting all `session:{user_id}:*` keys in Redis |
| **Secure cookies** | Refresh token in `HttpOnly`, `Secure`, `SameSite=Strict` cookie. Access token in memory (not cookie). |

### 6.4 SSO / MFA (R1)

**SSO (FR-800, F-039):**
- SAML 2.0 via `passport-saml` for enterprise IdPs (Okta, Azure AD)
- OIDC via `openid-client` for Google Workspace, Microsoft Entra ID
- Per-tenant SSO configuration stored in `tenant_configs` table
- SSO-only enforcement: tenant admin can disable password auth when SSO is configured

**MFA (FR-801, F-040):**
- TOTP via authenticator apps (Google Authenticator, Authy)
- Recovery codes: 10 single-use codes generated at MFA setup, stored bcrypt-hashed
- Admin-enforceable: tenant admin can require MFA for all users or specific roles
- MFA challenge inserted after password verification, before JWT issuance

### 6.5 RBAC Engine

**Permission matrix (FR-104, F-005):**

| Permission | Site Admin | Developer | Client (R2) | PM (R3) |
|------------|-----------|-----------|-------------|---------|
| Manage tenants | Yes | No | No | No |
| Create projects | Yes | No | No | Yes |
| View all projects | Yes | Yes* | No | Yes* |
| Modify tasks | Yes | Yes* | No | Yes* |
| View task details | Yes | Yes* | No | Yes* |
| Add comments | Yes | Yes* | Yes** | Yes* |
| View client portal | No | No | Yes | No |
| Configure AI policy | Yes | No | No | No |
| Approve AI actions | Yes | No | No | Yes |
| View AI decisions | Yes | Yes* | No | Yes* |
| Manage users | Yes | No | No | No |
| View audit log | Yes | No | No | Yes* |
| Export data | Yes | No | Yes** | Yes* |
| Configure integrations | Yes | No | No | No |

> `*` = scoped to assigned projects. `**` = scoped to own tenant's portal, client-visible content only.

**Enforcement chain (per request):**

```
1. Authenticate    → Verify JWT signature + expiry
2. Resolve tenant  → Extract tenant_id from JWT claims
3. Set RLS context → SET LOCAL app.current_tenant_id = '<tenant_id>'
4. Check role      → Verify user role against required permission
5. Check scope     → For project-scoped roles, verify user assignment to project
6. Execute handler → Business logic runs with tenant-isolated DB context
```

**Implementation:**
```typescript
// Fastify preHandler hook
async function authGuard(
  request: FastifyRequest,
  reply: FastifyReply,
  options: { permission: string; projectScoped?: boolean }
) {
  const { tenant_id, user_id, role } = request.user; // from JWT

  // Set RLS context
  await request.db.execute(
    sql`SET LOCAL app.current_tenant_id = ${tenant_id}`
  );

  // Check permission
  if (!hasPermission(role, options.permission)) {
    return reply.code(403).send({ error: 'Insufficient permissions' });
  }

  // Check project scope if needed
  if (options.projectScoped && role !== 'admin') {
    const projectId = request.params.projectId;
    const isAssigned = await checkProjectAssignment(user_id, projectId);
    if (!isAssigned) {
      return reply.code(403).send({ error: 'Not assigned to this project' });
    }
  }
}
```

### 6.6 Tenant Config Service (FR-109, F-010)

Per-tenant configurable values cached in Redis with 5-minute TTL.

**Stored in `tenant_configs` table:**
- Custom status labels (e.g., "In QA" instead of "In Review")
- Priority scales (3-level, 5-level, custom)
- AI model preferences (default confidence thresholds)
- Feature flags (per-tenant feature gating)
- Autonomy policy defaults
- SSO configuration (SAML/OIDC endpoints, certificates)
- Notification preferences
- Branding (portal logo, colors) for R2

**Cache invalidation:**
- Config updates emit `pm.system.config_changed` NATS event
- All API instances subscribe to this event and invalidate their local Redis cache
- Cache key: `tenant_config:{tenant_id}`
- TTL: 5 minutes (fallback if NATS invalidation fails)

---

## 7. Tier 3: Application Services

> **Related FRs:** FR-102 (project CRUD, F-003), FR-105 (task lifecycle, F-006), FR-106 (dependencies, F-007), FR-107 (sub-tasks, F-008), FR-108 (audit trail, F-009), FR-503 (comments, F-026), FR-900 (projection, F-042)

### 7.1 Module Architecture Pattern

Each module in the Fastify modular monolith follows a consistent internal structure:

```
module/
├── routes/           # HTTP handlers — thin layer, delegates to services
│   ├── module.routes.ts    # Fastify route registrations
│   └── module.schemas.ts   # TypeBox request/response schemas
├── services/         # Business logic — domain rules, orchestration
│   └── module.service.ts
├── repositories/     # Database access — Drizzle queries, SQL
│   └── module.repository.ts
├── types/            # Module-specific TypeScript types
│   └── module.types.ts
└── events/           # NATS event producers — emits on state changes
    └── module.events.ts
```

**Module registration as Fastify plugin:**
```typescript
// modules/task/routes/task.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { TaskService } from '../services/task.service';

const taskRoutes: FastifyPluginAsync = async (fastify) => {
  const taskService = new TaskService(fastify.db, fastify.nats);

  fastify.post('/tasks', {
    schema: createTaskSchema,
    preHandler: [fastify.auth({ permission: 'tasks.create', projectScoped: true })],
    handler: async (request, reply) => {
      const task = await taskService.create(request.body, request.user);
      return reply.code(201).send(task);
    }
  });
};

export default taskRoutes;
```

### 7.2 Project Module (FR-102, F-003; FR-200, F-011)

**Responsibilities:**
- Project CRUD with tenant-scoped uniqueness constraints (no duplicate project names per tenant)
- NL description storage (used as input for WBS generation)
- WBS baseline snapshots (JSONB — captures the original AI-generated WBS for scope creep detection)
- Phase management (ordered phases within a project)
- Composite endpoints: `GET /projects/:id?include=phases,tasks,dependencies` for efficient data loading

**Key service methods:**
```typescript
interface ProjectService {
  create(data: CreateProjectInput, actor: Actor): Promise<Project>;
  update(id: string, data: UpdateProjectInput, actor: Actor): Promise<Project>;
  getById(id: string, includes?: string[]): Promise<ProjectWithRelations>;
  list(filters: ProjectFilters, pagination: CursorPagination): Promise<PaginatedResult<Project>>;
  setBaseline(id: string, wbs: WBSBaseline, actor: Actor): Promise<void>;
  getBaseline(id: string): Promise<WBSBaseline | null>;
  softDelete(id: string, actor: Actor): Promise<void>;
}
```

**Events emitted:**
- `pm.projects.created` — on project creation
- `pm.projects.updated` — on any field change
- `pm.projects.phase_changed` — on phase add/remove/reorder
- `pm.projects.baseline_set` — when WBS baseline is saved (triggers scope creep monitoring)

### 7.3 Task Module (FR-105, F-006; FR-107, F-008)

**Task lifecycle state machine:**

```
                    ┌──────────────┐
                    │   created    │
                    └──────┬───────┘
                           │
                           v
                    ┌──────────────┐
              ┌─────│  in_progress │─────┐
              │     └──────┬───────┘     │
              │            │             │
              v            v             v
       ┌──────────┐ ┌──────────────┐ ┌───────────┐
       │  blocked  │ │  in_review   │ │ cancelled │
       └──────────┘ └──────┬───────┘ └───────────┘
              │            │
              │            v
              │     ┌──────────────┐
              └────>│  completed   │
                    └──────────────┘

  Valid transitions:
    created     → in_progress, cancelled
    in_progress → in_review, blocked, cancelled
    blocked     → in_progress (when dependency resolves)
    in_review   → completed, in_progress (returned), cancelled
    completed   → (terminal state)
    cancelled   → (terminal state)
```

**Assignment junction table:**

Tasks support multiple assignees via the `task_assignments` junction table with assignment roles:

| Role | Purpose |
|------|---------|
| `assignee` | Primary worker on the task |
| `reviewer` | Reviews completed work |
| `approver` | Approves the task for completion |

**AI metadata on tasks:**
- `ai_generated: boolean` — whether this task was created by the AI (e.g., WBS generation)
- `ai_confidence: float` — the AI's confidence in the task's definition (0.0 to 1.0)
- These fields are part of the data model from R0, enabling AI traceability from day 1

**Sub-tasks (FR-107, F-008):**
- Single-level nesting only (a sub-task cannot have its own sub-tasks)
- `parent_task_id` FK on the `tasks` table (nullable, self-referential)
- Parent rollup: parent task progress calculated from sub-task completion percentage
- Promote/demote: a sub-task can be promoted to a top-level task (clears `parent_task_id`) and vice versa

**Key service methods:**
```typescript
interface TaskService {
  create(data: CreateTaskInput, actor: Actor): Promise<Task>;
  update(id: string, data: UpdateTaskInput, actor: Actor): Promise<Task>;
  transition(id: string, newStatus: TaskStatus, actor: Actor): Promise<Task>;
  assign(id: string, assignments: TaskAssignment[], actor: Actor): Promise<void>;
  getById(id: string): Promise<TaskWithRelations>;
  list(filters: TaskFilters, pagination: CursorPagination): Promise<PaginatedResult<Task>>;
  getSubTasks(parentId: string): Promise<Task[]>;
  bulkCreate(tasks: CreateTaskInput[], actor: Actor): Promise<Task[]>;  // for WBS import
  softDelete(id: string, actor: Actor): Promise<void>;
}
```

**Events emitted:**
- `pm.tasks.created` — on task creation (including AI-generated)
- `pm.tasks.updated` — on any field change
- `pm.tasks.status_changed` — on status transition (separate from general update for consumer filtering)
- `pm.tasks.assigned` — on assignment change
- `pm.tasks.completed` — on transition to completed status
- `pm.tasks.dependency_resolved` — when all blocking dependencies are satisfied
- `pm.tasks.dependency_blocked` — when a new blocking dependency is added

### 7.4 Dependency Module (FR-106, F-007)

**Relationship type:** Finish-to-start (FS) only in R0. Task B is blocked by Task A — B cannot start until A is completed.

**Circular dependency prevention:**
- Application-layer DAG traversal (not a DB trigger — more testable)
- On dependency creation: traverse the dependency graph from the target task back to the source
- If the source is reachable from the target, the dependency would create a cycle — reject with 400 error
- Algorithm: iterative BFS on the `task_dependencies` table, scoped to the current project

```typescript
async function wouldCreateCycle(
  sourceTaskId: string,
  targetTaskId: string,
  projectId: string
): Promise<boolean> {
  const visited = new Set<string>();
  const queue = [targetTaskId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === sourceTaskId) return true; // cycle detected
    if (visited.has(current)) continue;
    visited.add(current);

    const dependencies = await getDependenciesOf(current, projectId);
    queue.push(...dependencies.map(d => d.blocked_by_task_id));
  }

  return false;
}
```

**Automatic status propagation:**
- When a task transitions to `completed`, check all tasks that depend on it
- For each dependent task: if ALL its dependencies are now completed, emit `pm.tasks.dependency_resolved`
- The Task Module consumer listens for `pm.tasks.dependency_resolved` and transitions blocked tasks to `in_progress` (or leaves them in `created` if they were never started)

### 7.5 Comment Module (FR-503, F-026)

**Design:**
- Per-task comment threads (comments belong to a task, not a project or phase)
- `client_visible: boolean` — determines whether the comment passes through the projection layer to the client portal
- Default: `client_visible = false` (internal comments are private by default)
- Edit/delete with "edited" indicator (`edited_at` timestamp, null if never edited)
- Soft delete: `deleted_at` timestamp, deleted comments show as "[deleted]" in the thread

**RAG pipeline integration:**
- New comments emit `pm.comments.created` event
- The `embedding-pipeline` consumer generates an embedding for the comment text
- Embeddings stored in the `embeddings` table with `entity_type = 'comment'`, `entity_id = comment.id`, `tenant_id`
- Comments are retrievable via RAG for AI context assembly (e.g., "what decisions were made about this task?")

### 7.6 Audit Module (FR-108, F-009)

**Immutable audit log — INSERT only, no UPDATE or DELETE grants.**

**Field-level diffs:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Tenant scope |
| `entity_type` | VARCHAR(50) | `task`, `project`, `phase`, `comment`, `user`, `config` |
| `entity_id` | UUID | ID of the changed entity |
| `action` | VARCHAR(50) | `created`, `updated`, `deleted`, `status_changed`, `assigned` |
| `field_name` | VARCHAR(100) | Specific field that changed (null for create/delete) |
| `old_value` | TEXT | Previous value (null for create) |
| `new_value` | TEXT | New value (null for delete) |
| `actor_type` | VARCHAR(20) | `user`, `ai`, `system`, `integration` |
| `actor_id` | UUID | User ID, AI action ID, or system identifier |
| `ai_action_id` | UUID | FK to `ai_actions` table (null if not AI-initiated) |
| `metadata` | JSONB | Additional context (IP address, request ID, integration source) |
| `created_at` | TIMESTAMPTZ | Immutable timestamp |

**Partitioning strategy:**
- Monthly partitioning when table exceeds 1M rows
- Partition by `created_at` using PostgreSQL declarative partitioning
- Old partitions (>90 days) archived to S3 Glacier via background job
- Application queries always include `created_at` range to leverage partition pruning

**Audit writer pattern:**
- The audit module exposes a service that other modules call: `auditService.log(entry)`
- Additionally, the `audit-writer` NATS consumer listens to all `pm.*` events and generates audit entries
- This dual approach ensures audit coverage even if a module forgets to call the service directly

### 7.7 User Module (FR-103, F-004; FR-201, F-012)

**Responsibilities:**
- Tenant-scoped user management (CRUD, role assignment, invitation flow)
- User profile: name, email, role, avatar, timezone, notification preferences
- `/users/me/next` endpoint: the "What's Next" API that returns AI-curated task prioritization

**What's Next endpoint (FR-201, F-012):**

```typescript
// GET /api/v1/users/me/next
// Returns prioritized list of tasks for the authenticated user

interface WhatsNextResponse {
  tasks: PrioritizedTask[];
  generated_at: string;      // ISO 8601
  algorithm: 'rules' | 'ai'; // R0: rules, R1+: ai
}

interface PrioritizedTask {
  task: Task;
  rank: number;
  reasoning: string;          // "Dependency resolved 2h ago, due tomorrow"
  project: { id: string; name: string };
  blocking_count: number;     // how many tasks this blocks
}
```

**R0 ranking algorithm (rules-based, no LLM):**
1. Tasks with all dependencies resolved (newly unblocked) — highest priority
2. Tasks sorted by due date proximity (earliest due first)
3. Within same due date: sorted by priority (critical > high > medium > low)
4. Tie-breaker: tasks that block the most other tasks (highest downstream impact)

**R1 upgrade:** LLM-ranked with velocity context and natural language explanations via the AI orchestrator.

**Workload metrics:**
- Current task count per user (by status)
- Overdue task count
- Tasks completed in the last 7/14/30 days
- Average task completion time (estimated vs actual)

### 7.8 Projection Module (FR-900, F-042)

**Purpose:** Transform internal truth into client-safe views. This is a data layer, not a UI filter.

**Design principles:**
- Internal data is the source of truth. The projection layer creates a filtered, curated view.
- Field-level redaction: each field on tasks and comments has an `internal`/`external` classification
- Default classification: all fields are `internal` unless explicitly marked `external`
- Client-visible content requires approval before it becomes visible in the portal

**Projection rules:**

| Entity | Internal Fields (hidden from clients) | External Fields (visible to clients) |
|--------|---------------------------------------|--------------------------------------|
| Task | `assignee_ids`, `actual_effort`, `ai_confidence`, `ai_generated`, internal comments, tags marked internal | `title`, `description` (sanitized), `status`, `priority`, `due_date`, `phase`, client-visible comments |
| Project | Resource allocation, internal risk flags, cost data, velocity metrics | `name`, `description`, phases, milestones, completion percentage, AI-generated narratives |
| Comment | Comments with `client_visible = false` | Comments with `client_visible = true` |

**Narrative generation:**
- The projection module can request AI-generated narratives from the Summary Engine (FR-202)
- Narratives summarize project progress in client-appropriate language
- Narratives go through an approval workflow before becoming visible

**Approval workflow:**
```
AI generates narrative → status: draft
  → PM reviews → status: approved | rejected
    → If approved: visible in client portal
    → If rejected: PM edits and resubmits, or discards
```

### 7.9 Config Module (FR-109, F-010)

**Per-tenant configurable values:**

| Config Key | Type | Default | Description |
|------------|------|---------|-------------|
| `status_labels` | JSONB | `["created","in_progress","in_review","completed","cancelled","blocked"]` | Custom task status labels |
| `priority_levels` | JSONB | `["low","medium","high","critical"]` | Priority scale |
| `ai_confidence_threshold` | FLOAT | `0.6` | Minimum confidence for AI to proceed |
| `ai_autonomy_mode` | VARCHAR | `propose` | Default autonomy mode: shadow/propose/execute |
| `quiet_hours_start` | TIME | `18:00` | AI PM Agent quiet hours start |
| `quiet_hours_end` | TIME | `09:00` | AI PM Agent quiet hours end |
| `quiet_hours_timezone` | VARCHAR | `UTC` | Timezone for quiet hours |
| `max_nudges_per_task_per_day` | INT | `2` | Rate limit for AI nudges |
| `sso_config` | JSONB | `null` | SSO provider configuration |
| `mfa_required_roles` | JSONB | `[]` | Roles requiring MFA |
| `branding` | JSONB | `{}` | Portal branding (logo URL, colors) |

**Caching strategy:**
- Read: check Redis cache (`tenant_config:{tenant_id}`) → if miss, load from DB → cache with 5min TTL
- Write: update DB → emit `pm.system.config_changed` event → all API instances invalidate cache
- Fallback: if Redis is unavailable, read directly from DB (graceful degradation)

---

## 8. Tier 4: AI Engine

> **Related FRs:** FR-200 (NL to WBS, F-011), FR-201 (What's Next, F-012), FR-202 (summaries, F-013), FR-203 (NL query, F-014), FR-300 (autonomy policy, F-015), FR-301 (AI review UI, F-016), FR-302 (shadow mode, F-017), FR-303 (confidence thresholds, F-018), FR-304 (rollback, F-019), FR-305 (decision log, F-035), FR-400 (traceability, F-020), FR-401 (evaluation harness, F-021), FR-402 (runtime monitoring, F-022), FR-600 (adaptive engine, F-027), FR-601 (AI PM agent, F-028), FR-602 (status reports, F-029), FR-603 (risk prediction, F-030), FR-604 (cross-project deps, F-031), FR-605 (resource optimization, F-032), FR-606 (auto-escalation, F-033), FR-607 (scope creep, F-034)

This is the product. Every other tier exists to feed data into and execute actions from this tier.

### 8.1 AI Orchestrator — 7-Stage Pipeline

All AI operations flow through a single orchestration pipeline. No AI capability calls the LLM directly — every call goes through the orchestrator.

#### Stage 1: TRIGGER

| Attribute | Value |
|-----------|-------|
| **Input** | NATS event or API request: `{ type, payload, tenant_id, user_id }` |
| **Output** | `{ trigger_id, capability, context_requirements }` |
| **Process** | Parse the incoming event or request. Determine which AI capability should handle it. Generate a unique `trigger_id` for traceability. Identify what context the capability needs. |

**Trigger sources:**
- User-initiated: API request (e.g., POST `/projects/generate-wbs`, POST `/query`)
- Event-driven: NATS event (e.g., `pm.tasks.status_changed` triggers risk prediction)
- Scheduled: cron/BullMQ job (e.g., 15-min agent loop, daily summary generation)

#### Stage 2: AUTONOMY CHECK

| Attribute | Value |
|-----------|-------|
| **Input** | `{ trigger_id, capability, action_type, tenant_id }` |
| **Output** | `{ disposition: 'shadow' | 'propose' | 'execute', policy_ref }` |
| **Process** | Load tenant's autonomy policy from config. Match the action type against policy rules. Return the disposition mode that governs how the AI's output will be handled. |

**Disposition modes:**
- `shadow`: AI runs the full pipeline but only logs the result. Not visible to users. Used for trust-building.
- `propose`: AI generates a proposal that a human must approve/reject before it takes effect.
- `execute`: AI applies changes directly. Reserved for low-risk, high-confidence actions with explicit tenant opt-in.

#### Stage 3: CONTEXT ASSEMBLY

| Attribute | Value |
|-----------|-------|
| **Input** | `{ trigger_id, capability, context_requirements }` |
| **Output** | `{ assembled_context, token_count, rag_results[], domain_template }` |
| **Process** | RAG retrieval (pgvector, tenant-scoped, cosine similarity, top-k=10) → event history aggregation → domain template selection → token budget enforcement |

**Context assembly steps:**
1. **Tenant data loading:** Load project, task, user data relevant to the capability's requirements
2. **pgvector search:** Query embeddings table for similar historical context, always scoped by `tenant_id`
3. **Event aggregation:** Retrieve recent events from NATS consumer for temporal context
4. **Domain template selection:** Select the appropriate prompt template from the Prompt Registry
5. **Token budget enforcement:** Trim context to fit within the capability's token budget (each capability defines max input tokens)

```typescript
interface AssembledContext {
  trigger_id: string;
  tenant_id: string;
  capability: string;
  domain_data: Record<string, unknown>;      // project/task data
  rag_results: RAGResult[];                   // similar historical items
  event_history: EventSummary[];              // recent relevant events
  domain_template: string;                    // prompt template path
  token_count: number;                        // total tokens in assembled context
  token_budget: number;                       // max tokens for this capability
}

interface RAGResult {
  entity_type: string;
  entity_id: string;
  content: string;
  similarity_score: number;
  metadata: Record<string, unknown>;
}
```

#### Stage 4: CONFIDENCE CHECK

| Attribute | Value |
|-----------|-------|
| **Input** | `{ assembled_context, token_count, capability_thresholds }` |
| **Output** | `{ confidence_score, proceed: boolean, degradation_strategy? }` |
| **Process** | Evaluate whether the assembled context is sufficient for the AI to produce a reliable output. If confidence is below threshold, trigger graceful degradation. |

**Confidence evaluation factors:**
- RAG result quality: are the similar items actually similar? (similarity scores)
- Context completeness: does the context include all required fields?
- Data freshness: is the project data current?
- Historical data volume: enough past projects/tasks for pattern recognition?

**Threshold:** 0.6 default, configurable per capability via tenant config.

**Degradation strategies (FR-303, F-018):**
- `ask_human`: Flag uncertainty, ask user for clarification or additional context
- `reduce_scope`: Proceed with reduced output (e.g., generate a simpler WBS with fewer phases)
- `use_template`: Fall back to a domain-specific template without AI customization
- `skip`: Log the attempt and skip (for event-driven non-critical capabilities)

#### Stage 5: LLM CALL

| Attribute | Value |
|-----------|-------|
| **Input** | `{ prompt, model, assembled_context, streaming: boolean }` |
| **Output** | `{ raw_response, model_used, input_tokens, output_tokens, latency_ms }` |
| **Process** | Route through LLM Gateway. Model selection based on capability. Retry with exponential backoff. Fallback chain: Opus → Sonnet. Streaming for interactive queries. |

**Model routing:**

| Capability | Primary Model | Fallback | Justification |
|------------|--------------|----------|---------------|
| NL→WBS Generator | Claude Opus 4 | Claude Sonnet 4.5 | Generation quality critical |
| What's Next Engine | Rules-based (R0) / Sonnet (R1) | Rules-based | Latency sensitive |
| NL Query Engine | Claude Sonnet 4.5 | Cached response | Interactive, p95 <8s |
| Summary Engine | Claude Sonnet 4.5 | Template-based | High volume, cost sensitive |
| Risk Predictor | Claude Opus 4 | Log + skip | Accuracy critical |
| AI PM Agent | Claude Sonnet 4.5 | Log + skip | High frequency (15-min loop) |
| Scope Creep Detector | Claude Sonnet 4.5 | Percentage-based diff | Numeric comparison fallback |
| SOW Generator (R3) | Claude Opus 4 | None (queue + retry) | Revenue-critical |

#### Stage 6: POST-PROCESSING

| Attribute | Value |
|-----------|-------|
| **Input** | `{ raw_response, expected_schema }` |
| **Output** | `{ parsed_result, validation_status, actions[] }` |
| **Process** | Parse structured output from LLM response → validate against JSON schema → extract actionable items |

**Validation steps:**
1. Parse LLM response as JSON (capabilities define expected output format)
2. Validate against the capability's JSON schema (e.g., WBS must have phases, tasks, dependencies)
3. Extract actions: list of mutations the AI proposes (create tasks, update status, send notification)
4. If validation fails: log the failure, retry LLM call once with a more explicit format instruction
5. If retry fails: trigger degradation strategy from Stage 4

**Example: WBS post-processing schema:**
```typescript
interface WBSOutput {
  project_name: string;
  phases: {
    name: string;
    order: number;
    tasks: {
      title: string;
      description: string;
      estimated_effort_hours: number;
      priority: 'low' | 'medium' | 'high' | 'critical';
      dependencies: string[];  // references to other task titles
      sub_tasks?: {
        title: string;
        estimated_effort_hours: number;
      }[];
    }[];
  }[];
  suggested_timeline_weeks: number;
  confidence_notes: string[];
}
```

#### Stage 7: DISPOSITION

| Attribute | Value |
|-----------|-------|
| **Input** | `{ parsed_result, actions[], disposition_mode }` |
| **Output** | `{ ai_action_id, status: 'logged' | 'proposed' | 'executed' }` |
| **Process** | Based on disposition mode from Stage 2, handle the AI output appropriately. |

**Disposition handling:**

| Mode | Behavior | NATS Event |
|------|----------|------------|
| `shadow` | Log to `ai_actions` table with `status = 'shadow_logged'`. Not visible to users. Admins can review in shadow mode dashboard. | `pm.ai.action_proposed` (with `shadow: true`) |
| `propose` | Create `ai_actions` record with `status = 'proposed'`. Render in AI Review UI (FR-301). Wait for human approval. | `pm.ai.action_proposed` |
| `execute` | Apply changes directly (create tasks, send notifications, update statuses). Log to `ai_actions` with `status = 'executed'`. Store rollback data. | `pm.ai.action_executed` |

**Rollback data (FR-304, F-019):**
- For every executed action, store the pre-action state in the `ai_actions.rollback_data` JSONB column
- Rollback = re-apply the stored pre-action state
- One-click rollback from the AI Review UI

### 8.2 Autonomy Policy Engine (FR-300, F-015)

**Policy schema:**

```yaml
policy:
  tenant_id: "uuid"
  defaults:
    mode: propose              # shadow | propose | execute
  overrides:
    - action: wbs_generation
      mode: propose            # always requires human approval
      constraints: {}

    - action: whats_next
      mode: execute            # safe to auto-generate, read-only
      constraints: {}

    - action: daily_summary
      mode: execute            # summaries don't modify data
      constraints: {}

    - action: nl_query
      mode: execute            # queries are read-only
      constraints: {}

    - action: nudge_stalled
      mode: execute
      constraints:
        quiet_hours:
          start: "18:00"
          end: "09:00"
          timezone: "tenant"   # uses tenant config timezone
        max_per_task_per_day: 2

    - action: auto_escalation
      mode: propose            # escalations always need approval
      constraints:
        threshold_hours: 48

    - action: risk_prediction
      mode: shadow             # shadow for first 2-4 weeks, then propose
      constraints: {}

    - action: scope_creep_alert
      mode: propose
      constraints:
        drift_threshold_percent: 15

    - action: status_report
      mode: propose            # PM reviews before distribution
      constraints: {}

    - action: client_narrative
      mode: propose            # always requires PM approval before client sees
      constraints: {}
```

**Three modes explained:**

| Mode | Data Modified? | User Visible? | Human Approval? | Use Case |
|------|---------------|---------------|-----------------|----------|
| `shadow` | No | Admin-only dashboard | No | Trust-building phase. AI runs but nothing happens. |
| `propose` | No (until approved) | AI Review UI | Yes, mandatory | Default for most actions. Human supervises. |
| `execute` | Yes, immediately | Post-hoc in activity feed | No (but logged) | Low-risk, high-confidence, tenant opted-in |

**Default:** Propose everything, execute nothing. Tenants opt into `execute` mode per action type as trust builds.

### 8.3 AI Capabilities — Detailed Design

#### 8.3.1 NL→WBS Generator (FR-200, F-011)

> **This is the product. 40%+ of R0 AI engineering time here.**

**Model:** Claude Opus 4
**Token profile:** ~5K input / ~3K output
**Release:** R0

**5-stage sub-pipeline:**

```
Stage 1: DOMAIN DETECTION
  Input:  NL project description (user-provided text)
  Output: { domain: 'software_delivery' | 'data_migration' | 'consultancy' | 'general',
            confidence: float }
  Method: Keyword analysis + Sonnet classification (lightweight call)

Stage 2: TEMPLATE SELECTION
  Input:  { domain }
  Output: { template_path: '/prompts/wbs-generator/v1.0.yaml',
            domain_context: string }
  Method: Load domain-specific prompt template from Prompt Registry

Stage 3: RAG ENRICHMENT
  Input:  { nl_description, tenant_id, domain }
  Output: { similar_projects: ProjectSummary[], estimation_accuracy: float }
  Method: Embed NL description → pgvector cosine similarity search
          → retrieve top-10 similar past projects (tenant-scoped)
          → aggregate historical estimation accuracy for this domain

Stage 4: OPUS GENERATION
  Input:  { prompt_template, nl_description, similar_projects,
            estimation_accuracy, domain_context }
  Output: { raw_wbs_json }
  Method: Claude Opus 4 call with structured output format
          System prompt includes: domain template, similar project examples,
          tenant's estimation patterns

Stage 5: SCHEMA VALIDATION
  Input:  { raw_wbs_json }
  Output: { validated_wbs: WBSOutput, validation_errors: string[] }
  Method: Validate against WBS JSON schema (phases, tasks, dependencies,
          estimates). If validation fails, retry once with format correction
          prompt. If retry fails, return partial result with errors flagged.
```

**Domain-specific prompt templates:**

| Domain | Template Focus | Example Enrichment |
|--------|---------------|-------------------|
| Software Delivery | Sprint-based phases, dev/QA/deploy tasks, PR review steps | "Your frontend tasks typically take 1.4x estimates" |
| Data Migration | Assessment/mapping/migration/validation phases, rollback plans | "Similar migrations averaged 3 weeks for ETL development" |
| Consultancy Engagement | Discovery/analysis/delivery/handoff phases, SOW alignment | "Past engagements of this size required 2.5 FTEs" |
| General | Generic phase structure, common task patterns | Baseline estimates without domain calibration |

#### 8.3.2 What's Next Engine (FR-201, F-012)

**Model:** Rules-based (R0) → Claude Sonnet 4.5 (R1)
**Token profile:** ~1K input / ~500 output (R1)
**Release:** R0 (rules), R1 (AI-ranked)

**R0 algorithm (no LLM, pure rules):**

```typescript
function rankTasks(userId: string, tenantId: string): PrioritizedTask[] {
  const assignedTasks = await getAssignedTasks(userId, tenantId);

  return assignedTasks
    .filter(t => t.status !== 'completed' && t.status !== 'cancelled')
    .map(task => ({
      task,
      score: calculateScore(task),
      reasoning: generateReasoning(task)
    }))
    .sort((a, b) => b.score - a.score);
}

function calculateScore(task: Task): number {
  let score = 0;

  // Highest: newly unblocked (dependency just resolved)
  if (task.recently_unblocked) score += 1000;

  // Due date proximity (closer = higher score)
  if (task.due_date) {
    const daysUntilDue = differenceInDays(task.due_date, new Date());
    score += Math.max(0, 100 - daysUntilDue * 10);
    if (daysUntilDue < 0) score += 500; // overdue
  }

  // Priority weight
  const priorityScores = { critical: 400, high: 300, medium: 200, low: 100 };
  score += priorityScores[task.priority] || 200;

  // Downstream impact (blocks the most other tasks)
  score += task.downstream_blocked_count * 50;

  return score;
}
```

**R1 upgrade path:**
- Replace `calculateScore` with Sonnet call that considers velocity context
- LLM receives: task list, user's historical completion patterns, current workload, team context
- LLM returns: ranked list with natural language explanations per task

#### 8.3.3 NL Query Engine (FR-203, F-014)

**Model:** Claude Sonnet 4.5
**Token profile:** ~2K input / ~1K output
**Release:** R0
**Performance target:** p95 < 8s (NFR-100)

**Pipeline:**
1. User submits NL question (e.g., "What's blocked right now?")
2. Context assembly: embed the question → pgvector search for relevant context (tenant-scoped)
3. Load current project/task data relevant to the query
4. Sonnet call with streaming enabled
5. Stream response tokens to the client as they arrive

**Streaming implementation (server-side):**
```typescript
fastify.post('/query', async (request, reply) => {
  const { query } = request.body;
  const { tenant_id, user_id } = request.user;

  // Assemble context via orchestrator
  const context = await orchestrator.assembleContext({
    capability: 'nl_query',
    query,
    tenant_id,
  });

  // Stream response
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const stream = await llmGateway.streamCall({
    model: 'claude-sonnet-4-5-20241022',
    prompt: context.prompt,
    context: context.assembled,
  });

  for await (const chunk of stream) {
    reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
  }

  reply.raw.end();
});
```

#### 8.3.4 Summary Engine (FR-202, F-013)

**Model:** Claude Sonnet 4.5
**Token profile:** ~3K input / ~1K output
**Release:** R0 (daily summaries), R1 (formal reports)

**Summary types:**

| Type | Trigger | Audience | Release | Projection Layer? |
|------|---------|----------|---------|--------------------|
| Daily summary | Scheduled (end of day) | Internal team | R0 | No |
| Weekly status report | Scheduled (Friday) | Internal + stakeholders | R1 | No |
| Client narrative | On-demand or scheduled | Client portal | R2 | Yes — mandatory |
| Sprint report | End of sprint | Internal team | R1 | No |

**Client summary flow (R2):**
```
Summary Engine generates narrative
  → Projection Module applies redaction rules
  → status: draft
  → PM reviews in AI Review UI
  → PM approves / edits / rejects
  → If approved: visible in client portal (FR-1301, F-055)
```

#### 8.3.5 Risk Predictor (FR-603, F-030)

**Model:** Claude Opus 4
**Token profile:** ~4K input / ~2K output
**Release:** R1
**Data readiness gate:** Minimum 100+ task state transitions logged

**Risk patterns detected:**
- Blocker duration: tasks blocked for >48h without action
- Stalled work: no status change in >72h on active tasks
- Dependency chain growth: new dependencies added mid-sprint
- Scope drift: task count increasing vs original WBS baseline
- Resource concentration: >60% of critical path assigned to one developer
- Review cycle time: increasing review-to-complete duration
- Velocity decline: sprint velocity trending downward over 3+ sprints

**Shadow mode (first 2-4 weeks):**
- All risk predictions logged in `ai_actions` with `disposition = 'shadow'`
- Admin dashboard shows predictions alongside actual outcomes
- After 2-4 weeks: review prediction accuracy, adjust thresholds, enable `propose` mode

**Output format:**
```typescript
interface RiskPrediction {
  risk_id: string;
  project_id: string;
  risk_type: 'blocker' | 'stalled' | 'scope_creep' | 'resource' | 'velocity' | 'review_cycle';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;          // 0.0 to 1.0
  description: string;         // human-readable explanation
  affected_tasks: string[];    // task IDs
  suggested_mitigations: string[];
  data_points: Record<string, unknown>; // evidence supporting the prediction
}
```

#### 8.3.6 AI PM Agent (FR-601, F-028)

**Model:** Claude Sonnet 4.5
**Token profile:** ~2K input / ~500 output per action
**Release:** R1
**Prerequisite:** Active Slack/Teams integration (FR-700, F-036)

**15-minute agent loop:**

```
Every 15 minutes (BullMQ recurring job → R0 in-process, R1+ separate ECS service):

FOR each active project in each tenant:
  1. Query overdue tasks:
     SELECT * FROM tasks WHERE tenant_id = :tid
       AND due_date < now() AND status NOT IN ('completed', 'cancelled')

  2. Query stalled tasks:
     SELECT * FROM tasks WHERE tenant_id = :tid
       AND status = 'in_progress' AND updated_at < now() - interval '48 hours'
       AND status != 'blocked'

  3. Query newly unblocked tasks:
     SELECT t.* FROM tasks t
       JOIN task_events te ON te.task_id = t.id
       WHERE te.type = 'dependency_resolved'
       AND te.created_at > now() - interval '15 minutes'

  FOR each actionable item:
    → AI Orchestrator: TRIGGER (source: agent_loop)
    → Autonomy Check:
        nudge → check policy (execute if allowed, else propose)
        escalation → always propose
    → Context Assembly: task details + assignee profile + project context
    → LLM Call: Sonnet generates contextual message
    → Disposition:
        Nudge (execute mode):
          - Check quiet hours (tenant config)
          - Check nudge count for this task today (max 2)
          - If passes: deliver via Slack DM to assignee
          - Emit: pm.ai.action_executed
        Escalation (propose mode):
          - Create proposal for PM review
          - Emit: pm.ai.action_proposed
```

**Quiet hours enforcement:**
- Load `quiet_hours_start`, `quiet_hours_end`, `quiet_hours_timezone` from tenant config
- Convert current time to tenant timezone
- If within quiet hours: queue the nudge for delivery at `quiet_hours_end`
- Queued nudges stored in Redis sorted set with delivery timestamp as score

#### 8.3.7 Scope Creep Detector (FR-607, F-034)

**Model:** Claude Sonnet 4.5
**Token profile:** ~3K input / ~1K output
**Release:** R1
**Data readiness gate:** Minimum 2+ projects with original AI-generated WBS preserved as baseline

**Detection mechanism:**
1. Load WBS baseline from `projects.wbs_baseline` (JSONB snapshot saved at WBS approval)
2. Load current task state for the project
3. Compare:
   - Task count: baseline vs current
   - Phase count: baseline vs current
   - Total estimated effort: baseline vs current
   - New tasks not in baseline
   - Removed tasks that were in baseline
4. Calculate drift percentage: `(current_total_effort - baseline_total_effort) / baseline_total_effort * 100`
5. If drift > 15% (configurable): trigger alert

**Alert output:**
```typescript
interface ScopeCreepAlert {
  project_id: string;
  baseline_task_count: number;
  current_task_count: number;
  baseline_effort_hours: number;
  current_effort_hours: number;
  drift_percentage: number;
  new_tasks_since_baseline: { id: string; title: string; effort: number }[];
  removed_tasks: { id: string; title: string; effort: number }[];
  ai_analysis: string;        // Sonnet-generated narrative about the drift
  suggested_actions: string[];
}
```

#### 8.3.8 SOW Generator (FR-1800, F-083)

**Model:** Claude Opus 4
**Token profile:** ~8K input / ~5K output
**Release:** R3

**Pipeline:**
1. Load tenant's completed projects with full lifecycle data
2. Load domain-specific SOW template from Prompt Registry
3. User provides: project description, client context, engagement type
4. RAG: retrieve similar past engagements (deliverables, timelines, resources, risks)
5. Opus generation: structured SOW with sections (scope, deliverables, timeline, assumptions, risks, pricing)
6. Mandatory approval workflow (PM reviews, edits, approves)

**Template system:**
- SOW templates are versioned YAML files in `/prompts/sow-generator/`
- Each template defines: sections, required fields, formatting rules, tone guidelines
- Tenants can customize templates (add/remove sections, adjust tone)

#### 8.3.9 Per-Tenant Learning (FR-1700, F-074)

**Release:** R3
**Data readiness gate:** Minimum 2+ completed projects with full lifecycle data per tenant

**Mechanism:**
- Not fine-tuning (per ADR-001, we use hosted Claude API)
- Instead: tenant-scoped RAG enrichment that improves with each completed project
- As projects complete, their full lifecycle data (estimates vs actuals, risk events, resolution patterns) is embedded and indexed
- Each subsequent AI operation for that tenant retrieves increasingly relevant historical context
- Over time, the AI "learns" that "this tenant's frontend tasks take 1.4x their estimates" through pattern recognition in RAG results

**Tenant-scoped context isolation:**
- All embeddings are tagged with `tenant_id`
- pgvector queries always filter by `tenant_id` (in the WHERE clause, not post-filter)
- No cross-tenant data leakage is possible at the database level (RLS + application-layer scoping)

### 8.4 Shared AI Infrastructure

#### 8.4.1 Context Assembly Layer

**Responsibilities:**
- Load tenant-specific data for each AI operation
- Execute pgvector similarity searches (cosine similarity, top-k=10, tenant-scoped)
- Aggregate recent events from NATS consumer history
- Select domain-specific prompt templates
- Enforce per-operation token budgets

**Token budget enforcement:**
```typescript
function enforceTokenBudget(
  context: AssembledContext,
  budget: number
): AssembledContext {
  let currentTokens = estimateTokens(context);

  // Trim strategy: RAG results first (least to most similar), then event history
  while (currentTokens > budget && context.rag_results.length > 5) {
    context.rag_results.pop(); // remove least similar
    currentTokens = estimateTokens(context);
  }

  while (currentTokens > budget && context.event_history.length > 0) {
    context.event_history.pop(); // remove oldest event
    currentTokens = estimateTokens(context);
  }

  context.token_count = currentTokens;
  return context;
}
```

#### 8.4.2 LLM Gateway

**Responsibilities:**
- Model routing (Opus for generation/risk, Sonnet for queries/summaries)
- Retry with exponential backoff (3 attempts: 1s, 2s, 4s)
- Fallback chain (Opus → Sonnet if Opus unavailable or times out)
- Streaming for interactive queries
- Rate limiting per tenant (prevent any single tenant from consuming all API quota)

**Circuit breaker:**

```
State: CLOSED (normal operation)
  → 5 consecutive failures
State: OPEN (60s cooldown)
  → All requests return cached/fallback responses
  → After 60s:
State: HALF-OPEN (probe)
  → Allow 1 request through
  → If success → CLOSED
  → If failure → OPEN (reset 60s timer)
```

**Implementation:**
```typescript
class LLMCircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly FAILURE_THRESHOLD = 5;
  private readonly COOLDOWN_MS = 60_000;

  async call<T>(fn: () => Promise<T>, fallback: () => T): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.COOLDOWN_MS) {
        this.state = 'half-open';
      } else {
        return fallback();
      }
    }

    try {
      const result = await fn();
      this.reset();
      return result;
    } catch (error) {
      this.recordFailure();
      if (this.state === 'half-open' || this.failureCount >= this.FAILURE_THRESHOLD) {
        this.trip();
      }
      return fallback();
    }
  }

  private reset() { this.state = 'closed'; this.failureCount = 0; }
  private recordFailure() { this.failureCount++; this.lastFailureTime = Date.now(); }
  private trip() { this.state = 'open'; }
}
```

#### 8.4.3 Prompt Registry

**Structure:**
```yaml
# /prompts/wbs-generator/v1.0.yaml
metadata:
  capability: wbs-generator
  version: "1.0"
  model: claude-opus-4
  max_input_tokens: 5000
  max_output_tokens: 3000
  schema: wbs-output-schema.json

system_prompt: |
  You are an expert project manager specializing in {{domain}} projects.
  Generate a detailed Work Breakdown Structure (WBS) from the project description.

  Context from similar past projects:
  {{#each rag_results}}
  - Project: {{this.name}} | Duration: {{this.duration}} | Key Learning: {{this.insight}}
  {{/each}}

  Estimation calibration for this organization:
  {{estimation_context}}

  Output format: JSON matching the WBS schema.
  Include phases, tasks with effort estimates, dependencies, and confidence notes.

user_prompt: |
  Project Description:
  {{project_description}}

  Additional Context:
  {{additional_context}}

output_schema:
  $ref: "./schemas/wbs-output.json"
```

**Version management:**
- Prompt changes are PR-reviewed like code
- Each capability is pinned to a specific prompt version
- Version rollback: change the version pin in config, no code deploy needed
- A/B testing: route a percentage of requests to a new prompt version, compare acceptance rates

#### 8.4.4 Evaluation Harness (FR-401, F-021)

**Golden test sets:**
- Each capability has a set of input/expected-output pairs
- Tests run automatically on every prompt version change
- Tests run in CI before prompt version promotion

**Metrics tracked:**

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Acceptance rate | >80% | <60% triggers review |
| Override rate | <20% | >40% = miscalibration |
| Hallucination incidents | 0% | Any incident triggers investigation |
| Schema validation pass rate | >95% | <90% blocks prompt promotion |
| Average confidence score | >0.7 | <0.5 triggers investigation |

**R0:** Manual review augmented with golden test sets.
**R1:** Fully automated CI integration — prompt changes cannot merge without passing eval.

#### 8.4.5 Traceability Pipeline (FR-400, F-020)

Every AI action is logged in the `ai_actions` table with the full chain:

```
trigger_event → context_assembled (truncated) → prompt_sent (hash) →
model_output → confidence_score → disposition (proposed/executed/rejected) →
human_review (approved/rejected/edited) → rollback_data
```

**Queryable via API:**
- `GET /api/v1/ai/actions?capability=wbs_generator&status=proposed`
- `GET /api/v1/ai/actions/:id` — full detail including prompt hash and model output
- Supports filtering by: capability, status, tenant, date range, confidence range

#### 8.4.6 Cost Tracker (FR-1000, F-046)

**Real-time tracking:**
- Redis counters: `ai_cost:{tenant_id}:{year}:{month}` — incremented on every LLM call
- `ai_cost_log` table: per-operation detail (input tokens, output tokens, USD cost, model, capability, tenant_id)

**Budget enforcement:**
- Pre-flight check before every LLM call: is this tenant within their monthly budget?
- Budget defined per pricing tier: Starter (500 ops/mo), Pro (2000 ops/mo), Enterprise (5000+ ops/mo)
- Alerts at 80% and 100% of budget
- At 100%: non-critical AI operations throttled (summaries, risk predictions), critical operations continue (queries, WBS generation) with warning to tenant admin

---

## 9. Tier 5: Event Bus

> **Related FRs:** FR-100 (event-driven architecture, F-001), FR-400 (AI traceability, F-020)

### 9.1 NATS JetStream Configuration

| Attribute | Value |
|-----------|-------|
| **Version** | NATS 2.10+ |
| **Deployment** | 3-node cluster on ECS Fargate with EFS for JetStream persistence |
| **Retention** | 30-day message retention per stream |
| **Delivery** | At-least-once delivery guarantee |
| **Max message size** | 1MB |
| **Storage** | File-based (EFS mount) for persistence across container restarts |
| **Cluster discovery** | ECS Service Discovery (Cloud Map) |

### 9.2 Stream Topology (12 Streams)

| Stream | Subjects | Producers | Key Consumers |
|--------|----------|-----------|---------------|
| `pm.tasks` | `pm.tasks.created`, `pm.tasks.updated`, `pm.tasks.status_changed`, `pm.tasks.assigned`, `pm.tasks.completed`, `pm.tasks.dependency_resolved`, `pm.tasks.dependency_blocked`, `pm.tasks.checklist_updated`, `pm.tasks.recurrence_triggered`, `pm.tasks.custom_field_updated` | Task Module, Recurrence Scheduler | AI Adaptive Engine, Audit Writer, Embedding Pipeline, Notification Router/Generator, Projection Updater, Automation Engine |
| `pm.projects` | `pm.projects.created`, `pm.projects.updated`, `pm.projects.phase_changed`, `pm.projects.baseline_set` | Project Module | AI Summarizer, Embedding Pipeline, Scope Creep Detector |
| `pm.comments` | `pm.comments.created`, `pm.comments.updated`, `pm.comments.deleted`, `pm.comments.mention_created`, `pm.comments.action_assigned` | Comment Module | Embedding Pipeline, Notification Router/Generator, Automation Engine |
| `pm.ai` | `pm.ai.action_proposed`, `pm.ai.action_approved`, `pm.ai.action_rejected`, `pm.ai.action_executed`, `pm.ai.confidence_low` | AI Orchestrator | Traceability Pipeline, Cost Tracker, Evaluation Harness |
| `pm.integrations` | `pm.integrations.git_commit`, `pm.integrations.git_pr_merged`, `pm.integrations.slack_message`, `pm.integrations.calendar_updated` | Integration Adapters | AI Adaptive Engine, Task Module (auto-complete on merge) |
| `pm.notifications` | `pm.notifications.created` | Notification Generator | Notification Router (delivery) |
| `pm.reminders` | `pm.reminders.due` | Reminder Scheduler | Notification Router/Generator |
| `pm.goals` | `pm.goals.progress_updated`, `pm.goals.at_risk` | Goals Module | Notification Generator, AI Adaptive Engine |
| `pm.automations` | `pm.automations.triggered`, `pm.automations.executed` | Automation Engine | Audit Writer, Cost Tracker |
| `pm.forms` | `pm.forms.submitted` | Forms Module (public endpoint) | Task Module (creates task), Notification Generator |
| `pm.documents` | `pm.documents.created`, `pm.documents.updated` | Documents Module | Embedding Pipeline (RAG), Notification Generator |
| `pm.system` | `pm.system.config_changed`, `pm.system.tenant_created`, `pm.system.user_invited` | Config, User Modules | Config Cache Invalidation, Notification Router |

### 9.3 Durable Consumers (11)

| Consumer | Subscribes To | Purpose | Release |
|----------|--------------|---------|---------|
| `audit-writer` | `pm.tasks.*`, `pm.projects.*`, `pm.comments.*`, `pm.ai.*` | Writes immutable audit log entries for every state change | R0 |
| `ai-adaptive` | `pm.tasks.*`, `pm.integrations.*` | Feeds task state changes and git activity to the adaptive task engine | R0 (rules) / R1 (AI) |
| `ai-summarizer` | `pm.tasks.*`, `pm.projects.*`, `pm.comments.*` | Aggregates activity for daily/weekly summary generation | R0 |
| `embedding-pipeline` | `pm.tasks.created`, `pm.tasks.updated`, `pm.comments.created`, `pm.projects.created` | Generates embeddings for new/updated content, stores in pgvector | R0 |
| `projection-updater` | `pm.tasks.*`, `pm.projects.*`, `pm.comments.*` | Updates client-facing projection views when internal data changes | R0 (data model) / R2 (active) |
| `notification-router` | `pm.tasks.assigned`, `pm.tasks.status_changed`, `pm.comments.created`, `pm.ai.action_proposed`, `pm.system.user_invited` | Routes notifications to appropriate channels (in-app, email, Slack) | R0 (in-app) / R1 (Slack) |
| `cost-tracker` | `pm.ai.*` | Tracks AI operation costs per tenant, updates Redis counters | R0 |
| `escalation-monitor` | `pm.tasks.status_changed`, `pm.tasks.dependency_blocked` | Monitors for escalation conditions (blocked >48h, overdue) | R1 |
| `notification-generator` | `pm.tasks.*`, `pm.comments.*`, `pm.ai.*`, `pm.reminders.*`, `pm.goals.*` | Creates notification records based on user preferences (FR-2007) | R1 |
| `recurrence-scheduler` | `pm.tasks.recurrence_triggered` | Clones recurring tasks when schedule fires (FR-2001) | R1 |
| `automation-engine` | `pm.tasks.*`, `pm.comments.*` | Evaluates and executes user-defined automation rules (FR-2009) | R2 |

### 9.4 TypeScript Event Schema Definitions

```typescript
// packages/shared/types/events.ts

/** Base event interface — all events extend this */
interface BaseEvent {
  type: string;                // dot-notation subject
  id: string;                  // unique event ID (UUID) for idempotency
  timestamp: string;           // ISO 8601
  tenant_id: string;           // UUID — every event is tenant-scoped
  actor: {
    type: 'user' | 'ai' | 'system' | 'integration';
    id: string;
  };
}

/** Task created event */
interface TaskCreatedEvent extends BaseEvent {
  type: 'pm.tasks.created';
  payload: {
    task_id: string;
    project_id: string;
    title: string;
    status: string;
    priority: string;
    assignee_ids: string[];
    ai_generated: boolean;
    ai_confidence?: number;
    phase_id?: string;
    parent_task_id?: string;
    estimated_effort?: number;
    due_date?: string;
  };
}

/** Task status changed event */
interface TaskStatusChangedEvent extends BaseEvent {
  type: 'pm.tasks.status_changed';
  payload: {
    task_id: string;
    project_id: string;
    old_status: string;
    new_status: string;
    transition_reason?: string;
  };
}

/** AI action proposed event */
interface AIActionProposedEvent extends BaseEvent {
  type: 'pm.ai.action_proposed';
  payload: {
    ai_action_id: string;
    capability: string;
    confidence: number;
    disposition: 'shadow' | 'proposed' | 'executed';
    summary: string;
    affected_entities: {
      type: string;
      id: string;
    }[];
    model_used: string;
    input_tokens: number;
    output_tokens: number;
    latency_ms: number;
  };
}

/** Git PR merged event */
interface GitPRMergedEvent extends BaseEvent {
  type: 'pm.integrations.git_pr_merged';
  payload: {
    pr_number: number;
    pr_title: string;
    repository: string;
    branch: string;
    merged_by: string;
    linked_task_ids: string[];  // task IDs extracted from branch name or PR body
    commit_count: number;
  };
}
```

### 9.5 Dead Letter Queue (DLQ) Strategy

| Aspect | Configuration |
|--------|---------------|
| **Retry policy** | 3 retries with exponential backoff: 1s, 5s, 25s |
| **DLQ per consumer** | Each durable consumer has a dedicated DLQ stream (e.g., `dlq.audit-writer`) |
| **DLQ retention** | 7 days |
| **DLQ monitoring** | CloudWatch alarm on DLQ message count > 0 (any DLQ message triggers alert) |
| **DLQ replay** | Manual replay via admin CLI tool: reads from DLQ, re-publishes to original stream |

### 9.6 Idempotency

All consumers implement idempotency using the event `id` field:

```typescript
async function processEvent(event: BaseEvent): Promise<void> {
  // Check if already processed
  const key = `processed:${consumerName}:${event.id}`;
  const alreadyProcessed = await redis.get(key);
  if (alreadyProcessed) return; // skip duplicate

  // Process the event
  await handleEvent(event);

  // Mark as processed (TTL: 7 days to match DLQ retention)
  await redis.set(key, '1', 'EX', 7 * 24 * 60 * 60);
}
```

---

## 10. Tier 6: Database

> **Related FRs:** FR-101 (tenant-aware data model, F-002), FR-102 (core schema, F-003), FR-105 (task data model, F-006), FR-106 (dependencies, F-007), FR-108 (audit trail, F-009), NFR-100 (query performance), NFR-200 (tenant isolation)

### 10.1 Complete Table Definitions

#### 10.1.1 Tenants

```sql
CREATE TABLE tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  slug            VARCHAR(100) NOT NULL UNIQUE,
  plan            VARCHAR(50) NOT NULL DEFAULT 'internal',
  settings        JSONB NOT NULL DEFAULT '{}',
  ai_budget_monthly_usd  DECIMAL(10,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_tenants_slug ON tenants(slug) WHERE deleted_at IS NULL;
```

#### 10.1.2 Users

```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  email           VARCHAR(255) NOT NULL,
  password_hash   VARCHAR(255),
  name            VARCHAR(255) NOT NULL,
  role            VARCHAR(50) NOT NULL DEFAULT 'developer',
  avatar_url      VARCHAR(500),
  timezone        VARCHAR(100) DEFAULT 'UTC',
  notification_prefs JSONB NOT NULL DEFAULT '{}',
  mfa_enabled     BOOLEAN NOT NULL DEFAULT false,
  mfa_secret      VARCHAR(255),
  recovery_codes  JSONB,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_users_tenant_email
  ON users(tenant_id, email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_tenant_role ON users(tenant_id, role);
```

#### 10.1.3 Projects

```sql
CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  nl_description  TEXT,
  status          VARCHAR(50) NOT NULL DEFAULT 'active',
  start_date      DATE,
  target_end_date DATE,
  actual_end_date DATE,
  wbs_baseline    JSONB,
  settings        JSONB NOT NULL DEFAULT '{}',
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_projects_tenant_name
  ON projects(tenant_id, name) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_tenant_status ON projects(tenant_id, status);
```

#### 10.1.4 Phases

```sql
CREATE TABLE phases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  status          VARCHAR(50) NOT NULL DEFAULT 'pending',
  start_date      DATE,
  end_date        DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_phases_tenant_project_name
  ON phases(tenant_id, project_id, name) WHERE deleted_at IS NULL;
CREATE INDEX idx_phases_tenant_project_order
  ON phases(tenant_id, project_id, sort_order);
```

#### 10.1.5 Tasks

```sql
CREATE TABLE tasks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  project_id        UUID NOT NULL REFERENCES projects(id),
  phase_id          UUID REFERENCES phases(id),
  parent_task_id    UUID REFERENCES tasks(id),
  title             VARCHAR(500) NOT NULL,
  description       TEXT,
  status            VARCHAR(50) NOT NULL DEFAULT 'created',
  priority          VARCHAR(20) NOT NULL DEFAULT 'medium',
  estimated_effort  DECIMAL(10,2),
  actual_effort     DECIMAL(10,2),
  start_date        DATE,
  due_date          DATE,
  actual_finish_date DATE,
  ai_generated      BOOLEAN NOT NULL DEFAULT false,
  ai_confidence     FLOAT,
  client_visible    BOOLEAN NOT NULL DEFAULT false,
  search_vector     TSVECTOR,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_by        UUID NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_tasks_tenant_project ON tasks(tenant_id, project_id);
CREATE INDEX idx_tasks_tenant_status ON tasks(tenant_id, status);
CREATE INDEX idx_tasks_tenant_priority ON tasks(tenant_id, priority);
CREATE INDEX idx_tasks_tenant_due_date ON tasks(tenant_id, due_date);
CREATE INDEX idx_tasks_tenant_phase ON tasks(tenant_id, phase_id);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX idx_tasks_search ON tasks USING GIN(search_vector);
CREATE INDEX idx_tasks_ai_generated ON tasks(tenant_id, ai_generated) WHERE ai_generated = true;

-- Auto-update search_vector
CREATE OR REPLACE FUNCTION tasks_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', coalesce(NEW.title, '') || ' ' || coalesce(NEW.description, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, description ON tasks
  FOR EACH ROW EXECUTE FUNCTION tasks_search_vector_update();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at_trigger
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

#### 10.1.6 Task Assignments

```sql
CREATE TABLE task_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  role            VARCHAR(20) NOT NULL DEFAULT 'assignee',
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by     UUID NOT NULL REFERENCES users(id),

  CONSTRAINT valid_assignment_role CHECK (role IN ('assignee', 'reviewer', 'approver'))
);

CREATE UNIQUE INDEX idx_task_assignments_unique
  ON task_assignments(tenant_id, task_id, user_id, role);
CREATE INDEX idx_task_assignments_tenant_user
  ON task_assignments(tenant_id, user_id);
CREATE INDEX idx_task_assignments_task
  ON task_assignments(task_id);
```

#### 10.1.7 Task Dependencies

```sql
CREATE TABLE task_dependencies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),
  task_id             UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  blocked_by_task_id  UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type     VARCHAR(20) NOT NULL DEFAULT 'finish_to_start',
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT no_self_dependency CHECK (task_id != blocked_by_task_id),
  CONSTRAINT valid_dependency_type CHECK (dependency_type IN ('finish_to_start'))
);

CREATE UNIQUE INDEX idx_task_deps_unique
  ON task_dependencies(tenant_id, task_id, blocked_by_task_id);
CREATE INDEX idx_task_deps_blocked_by
  ON task_dependencies(tenant_id, blocked_by_task_id);
```

#### 10.1.8 Comments

```sql
CREATE TABLE comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES users(id),
  content         TEXT NOT NULL,
  client_visible  BOOLEAN NOT NULL DEFAULT false,
  edited_at       TIMESTAMPTZ,
  search_vector   TSVECTOR,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_comments_tenant_task ON comments(tenant_id, task_id);
CREATE INDEX idx_comments_search ON comments USING GIN(search_vector);

CREATE TRIGGER comments_search_vector_trigger
  BEFORE INSERT OR UPDATE OF content ON comments
  FOR EACH ROW EXECUTE FUNCTION tasks_search_vector_update();
```

#### 10.1.9 Tags

```sql
CREATE TABLE tags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  project_id      UUID REFERENCES projects(id),
  name            VARCHAR(100) NOT NULL,
  color           VARCHAR(7) NOT NULL DEFAULT '#6B7280',
  is_internal     BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_tags_tenant_name
  ON tags(tenant_id, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'), name)
  WHERE deleted_at IS NULL;
```

#### 10.1.10 Task Tags

```sql
CREATE TABLE task_tags (
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id          UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (task_id, tag_id)
);

CREATE INDEX idx_task_tags_tenant_tag ON task_tags(tenant_id, tag_id);
```

#### 10.1.11 AI Actions

```sql
CREATE TABLE ai_actions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  trigger_event_id  VARCHAR(255),
  trigger_source    VARCHAR(50) NOT NULL,
  capability        VARCHAR(100) NOT NULL,
  model_used        VARCHAR(100) NOT NULL,
  prompt_version    VARCHAR(50),
  prompt_hash       VARCHAR(64),

  input_tokens      INTEGER NOT NULL DEFAULT 0,
  output_tokens     INTEGER NOT NULL DEFAULT 0,
  cost_usd          DECIMAL(10,6) NOT NULL DEFAULT 0,
  latency_ms        INTEGER,

  confidence_score  FLOAT,
  disposition       VARCHAR(20) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',

  context_summary   TEXT,
  model_output      JSONB,
  actions_proposed  JSONB,
  rollback_data     JSONB,

  reviewed_by       UUID REFERENCES users(id),
  reviewed_at       TIMESTAMPTZ,
  review_notes      TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_disposition CHECK (disposition IN ('shadow', 'proposed', 'executed')),
  CONSTRAINT valid_status CHECK (status IN (
    'pending', 'shadow_logged', 'proposed', 'approved', 'rejected',
    'executed', 'rolled_back', 'failed'
  ))
);

CREATE INDEX idx_ai_actions_tenant_capability ON ai_actions(tenant_id, capability);
CREATE INDEX idx_ai_actions_tenant_status ON ai_actions(tenant_id, status);
CREATE INDEX idx_ai_actions_tenant_created ON ai_actions(tenant_id, created_at);
CREATE INDEX idx_ai_actions_disposition ON ai_actions(tenant_id, disposition);
```

#### 10.1.12 AI Cost Log

```sql
CREATE TABLE ai_cost_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  ai_action_id    UUID REFERENCES ai_actions(id),
  capability      VARCHAR(100) NOT NULL,
  model           VARCHAR(100) NOT NULL,
  input_tokens    INTEGER NOT NULL,
  output_tokens   INTEGER NOT NULL,
  cost_usd        DECIMAL(10,6) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_cost_log_tenant_month
  ON ai_cost_log(tenant_id, date_trunc('month', created_at));
CREATE INDEX idx_ai_cost_log_tenant_capability
  ON ai_cost_log(tenant_id, capability);
```

#### 10.1.13 Audit Log

```sql
CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  entity_type     VARCHAR(50) NOT NULL,
  entity_id       UUID NOT NULL,
  action          VARCHAR(50) NOT NULL,
  field_name      VARCHAR(100),
  old_value       TEXT,
  new_value       TEXT,
  actor_type      VARCHAR(20) NOT NULL,
  actor_id        UUID,
  ai_action_id    UUID REFERENCES ai_actions(id),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()

  -- NO updated_at — this table is INSERT-only
  -- NO deleted_at — audit records are never deleted
) PARTITION BY RANGE (created_at);

-- Create initial partitions (monthly)
CREATE TABLE audit_log_2026_02 PARTITION OF audit_log
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE audit_log_2026_03 PARTITION OF audit_log
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
-- ... additional partitions created by scheduled job

CREATE INDEX idx_audit_tenant_entity
  ON audit_log(tenant_id, entity_type, entity_id);
CREATE INDEX idx_audit_tenant_created
  ON audit_log(tenant_id, created_at);
CREATE INDEX idx_audit_actor
  ON audit_log(tenant_id, actor_type, actor_id);
CREATE INDEX idx_audit_ai_action
  ON audit_log(ai_action_id) WHERE ai_action_id IS NOT NULL;

-- Revoke UPDATE and DELETE permissions
REVOKE UPDATE, DELETE ON audit_log FROM app_user;
```

#### 10.1.14 Tenant Configs

```sql
CREATE TABLE tenant_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  config_key      VARCHAR(100) NOT NULL,
  config_value    JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_tenant_configs_key
  ON tenant_configs(tenant_id, config_key);
```

#### 10.1.15 Embeddings

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE embeddings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  entity_type     VARCHAR(50) NOT NULL,
  entity_id       UUID NOT NULL,
  content_hash    VARCHAR(64) NOT NULL,
  embedding       vector(1536) NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_embeddings_tenant_entity
  ON embeddings(tenant_id, entity_type, entity_id);
CREATE UNIQUE INDEX idx_embeddings_content_hash
  ON embeddings(tenant_id, entity_type, entity_id, content_hash);
CREATE INDEX idx_embeddings_vector
  ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

#### 10.1.16 Task Checklists (FR-2000)

```sql
CREATE TABLE task_checklists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  title           VARCHAR(255) NOT NULL DEFAULT 'Checklist',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_checklists_task
  ON task_checklists(tenant_id, task_id);
```

#### 10.1.17 Checklist Items (FR-2000)

```sql
CREATE TABLE checklist_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id    UUID NOT NULL REFERENCES task_checklists(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  text            TEXT NOT NULL,
  is_completed    BOOLEAN NOT NULL DEFAULT false,
  completed_by    UUID REFERENCES users(id),
  completed_at    TIMESTAMPTZ,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklist_items_checklist
  ON checklist_items(tenant_id, checklist_id);
```

#### 10.1.18 Mentions (FR-2004)

```sql
CREATE TABLE mentions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id      UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES users(id),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mentions_user
  ON mentions(tenant_id, mentioned_user_id);
CREATE INDEX idx_mentions_comment
  ON mentions(tenant_id, comment_id);
```

#### 10.1.19 Custom Field Definitions (FR-2005)

```sql
CREATE TABLE custom_field_definitions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  project_id      UUID REFERENCES projects(id),  -- NULL = tenant-global
  name            VARCHAR(255) NOT NULL,
  field_type      VARCHAR(20) NOT NULL CHECK (field_type IN ('text','number','date','select','multi_select','url','email','checkbox','formula')),
  options         JSONB DEFAULT '[]',  -- for select/multi_select types
  formula_expression TEXT,  -- for formula type (FR-2011)
  is_required     BOOLEAN NOT NULL DEFAULT false,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_custom_field_defs_tenant
  ON custom_field_definitions(tenant_id, project_id);
CREATE UNIQUE INDEX idx_custom_field_defs_name
  ON custom_field_definitions(tenant_id, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid), name);
```

#### 10.1.20 Custom Field Values (FR-2005)

```sql
CREATE TABLE custom_field_values (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_definition_id UUID NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  value_text      TEXT,
  value_number    NUMERIC,
  value_date      TIMESTAMPTZ,
  value_json      JSONB,  -- for multi_select and complex types
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_custom_field_values_unique
  ON custom_field_values(tenant_id, field_definition_id, task_id);
CREATE INDEX idx_custom_field_values_task
  ON custom_field_values(tenant_id, task_id);
```

#### 10.1.21 Saved Views (FR-2003)

```sql
CREATE TABLE saved_views (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  project_id      UUID REFERENCES projects(id),
  name            VARCHAR(255) NOT NULL,
  view_type       VARCHAR(20) NOT NULL CHECK (view_type IN ('list','board','calendar','table','gantt','timeline')),
  config          JSONB NOT NULL DEFAULT '{}',  -- columns, sort, filters, grouping
  is_default      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_saved_views_user
  ON saved_views(tenant_id, user_id);
CREATE INDEX idx_saved_views_project
  ON saved_views(tenant_id, project_id);
```

#### 10.1.22 Goals (FR-2006)

```sql
CREATE TABLE goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  title           VARCHAR(500) NOT NULL,
  description     TEXT,
  goal_type       VARCHAR(20) NOT NULL CHECK (goal_type IN ('goal','objective','key_result')),
  parent_goal_id  UUID REFERENCES goals(id),  -- self-referencing hierarchy
  target_value    NUMERIC,
  current_value   NUMERIC DEFAULT 0,
  unit            VARCHAR(50),  -- e.g., '%', 'count', 'USD'
  status          VARCHAR(20) NOT NULL DEFAULT 'on_track' CHECK (status IN ('on_track','at_risk','behind','completed')),
  owner_id        UUID REFERENCES users(id),
  due_date        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_goals_tenant
  ON goals(tenant_id, status);
CREATE INDEX idx_goals_parent
  ON goals(tenant_id, parent_goal_id);
CREATE INDEX idx_goals_owner
  ON goals(tenant_id, owner_id);
```

#### 10.1.23 Goal-Task Links (FR-2006)

```sql
CREATE TABLE goal_task_links (
  goal_id         UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (goal_id, task_id)
);

CREATE INDEX idx_goal_task_links_task
  ON goal_task_links(tenant_id, task_id);
```

#### 10.1.24 Notifications (FR-2007)

```sql
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  type            VARCHAR(30) NOT NULL CHECK (type IN ('mention','assignment','status_change','comment','ai_action','reminder','escalation','due_soon')),
  title           VARCHAR(500) NOT NULL,
  body            TEXT,
  entity_type     VARCHAR(50),  -- e.g., 'task', 'comment', 'goal'
  entity_id       UUID,
  is_read         BOOLEAN NOT NULL DEFAULT false,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user
  ON notifications(tenant_id, user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_entity
  ON notifications(tenant_id, entity_type, entity_id);
```

#### 10.1.25 Notification Preferences (FR-2007)

```sql
CREATE TABLE notification_preferences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  notification_type VARCHAR(30) NOT NULL,
  channel         VARCHAR(10) NOT NULL CHECK (channel IN ('in_app','email','slack')),
  enabled         BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (user_id, notification_type, channel)
);

CREATE INDEX idx_notification_prefs_user
  ON notification_preferences(tenant_id, user_id);
```

#### 10.1.26 Automation Rules (FR-2009)

```sql
CREATE TABLE automation_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  project_id      UUID REFERENCES projects(id),  -- NULL = tenant-global
  name            VARCHAR(255) NOT NULL,
  trigger_event   VARCHAR(50) NOT NULL,  -- e.g., 'task_status_changed', 'task_assigned'
  trigger_conditions JSONB NOT NULL DEFAULT '{}',
  action_type     VARCHAR(50) NOT NULL,  -- e.g., 'change_status', 'assign_user'
  action_config   JSONB NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  run_count       INTEGER NOT NULL DEFAULT 0,
  last_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_automation_rules_tenant
  ON automation_rules(tenant_id, is_active);
CREATE INDEX idx_automation_rules_trigger
  ON automation_rules(tenant_id, trigger_event, is_active);
```

#### 10.1.27 Forms (FR-2010)

```sql
CREATE TABLE forms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  project_id      UUID REFERENCES projects(id),
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  fields          JSONB NOT NULL DEFAULT '[]',  -- array of field definitions
  target_phase_id UUID REFERENCES phases(id),
  default_assignee_id UUID REFERENCES users(id),
  is_published    BOOLEAN NOT NULL DEFAULT false,
  public_slug     VARCHAR(100) UNIQUE,
  submission_count INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_forms_tenant
  ON forms(tenant_id, project_id);
CREATE UNIQUE INDEX idx_forms_slug
  ON forms(public_slug) WHERE public_slug IS NOT NULL;
```

#### 10.1.28 Documents (FR-2012)

```sql
CREATE TABLE documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  project_id      UUID REFERENCES projects(id),
  title           VARCHAR(500) NOT NULL,
  content         TEXT NOT NULL DEFAULT '',
  author_id       UUID NOT NULL REFERENCES users(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  client_visible  BOOLEAN NOT NULL DEFAULT false,
  search_vector   TSVECTOR,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_documents_tenant
  ON documents(tenant_id, project_id, status);
CREATE INDEX idx_documents_search
  ON documents USING GIN(search_vector);
CREATE INDEX idx_documents_author
  ON documents(tenant_id, author_id);
```

#### 10.1.29 Reminders (FR-2014)

```sql
CREATE TABLE reminders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  remind_at       TIMESTAMPTZ NOT NULL,
  message         TEXT,
  is_sent         BOOLEAN NOT NULL DEFAULT false,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reminders_due
  ON reminders(remind_at, is_sent) WHERE is_sent = false;
CREATE INDEX idx_reminders_user
  ON reminders(tenant_id, user_id);
CREATE INDEX idx_reminders_task
  ON reminders(tenant_id, task_id);
```

#### 10.1.30 Tasks Table Extensions (FR-2001, FR-2008)

> The following columns are added to the existing `tasks` table (10.1.5) for recurring tasks:

```sql
-- Add to tasks table for recurring tasks (FR-2001)
ALTER TABLE tasks ADD COLUMN recurrence_rule TEXT;  -- iCal RRULE format
ALTER TABLE tasks ADD COLUMN recurrence_parent_id UUID REFERENCES tasks(id);
ALTER TABLE tasks ADD COLUMN next_recurrence_at TIMESTAMPTZ;

CREATE INDEX idx_tasks_recurrence
  ON tasks(next_recurrence_at) WHERE next_recurrence_at IS NOT NULL;
CREATE INDEX idx_tasks_recurrence_parent
  ON tasks(tenant_id, recurrence_parent_id) WHERE recurrence_parent_id IS NOT NULL;
```

> The following columns are added to the existing `comments` table (10.1.8) for action items:

```sql
-- Add to comments table for action items (FR-2008)
ALTER TABLE comments ADD COLUMN assigned_to UUID REFERENCES users(id);
ALTER TABLE comments ADD COLUMN is_action_item BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE comments ADD COLUMN action_status VARCHAR(20) CHECK (action_status IN ('pending','completed'));
ALTER TABLE comments ADD COLUMN action_completed_at TIMESTAMPTZ;

CREATE INDEX idx_comments_action_items
  ON comments(tenant_id, assigned_to, action_status) WHERE is_action_item = true;
```

### 10.2 Row-Level Security (RLS) Policies

Every tenant-scoped table has an RLS policy enforced at the database layer.

**RLS policy pattern (applied to all tables with `tenant_id`):**

```sql
-- Enable RLS on all tenant-scoped tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cost_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_task_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Create tenant isolation policy (same pattern for all tables)
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_isolation ON projects
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_isolation ON phases
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_isolation ON tasks
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_isolation ON task_assignments
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_isolation ON task_dependencies
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_isolation ON comments
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_isolation ON tags
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_isolation ON task_tags
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_isolation ON ai_actions
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_isolation ON ai_cost_log
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_isolation ON audit_log
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_isolation ON tenant_configs
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_isolation ON embeddings
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

**Middleware mechanism:**

```typescript
// Fastify preHandler — sets RLS context per request
fastify.addHook('preHandler', async (request) => {
  const tenantId = request.user?.tenant_id;
  if (tenantId) {
    await request.db.execute(
      sql`SET LOCAL app.current_tenant_id = ${tenantId}`
    );
  }
});
```

`SET LOCAL` scopes the setting to the current transaction, ensuring no cross-request leakage in connection pools.

### 10.3 Indexing Strategy

**Principles:**
- `tenant_id` as the first column in every composite index (tenant locality in B-tree scans)
- GIN indexes for `tsvector` full-text search columns
- IVFFlat for pgvector similarity search (R0-R2), evaluate HNSW at R3
- Partial indexes where beneficial (e.g., `WHERE deleted_at IS NULL`, `WHERE ai_generated = true`)

**Key composite indexes:**

```sql
-- Task queries (most frequent)
CREATE INDEX idx_tasks_tenant_project ON tasks(tenant_id, project_id);
CREATE INDEX idx_tasks_tenant_status ON tasks(tenant_id, status);
CREATE INDEX idx_tasks_tenant_priority ON tasks(tenant_id, priority);
CREATE INDEX idx_tasks_tenant_due_date ON tasks(tenant_id, due_date);
CREATE INDEX idx_tasks_tenant_phase ON tasks(tenant_id, phase_id);

-- Assignment lookups (What's Next queries)
CREATE INDEX idx_task_assignments_tenant_user ON task_assignments(tenant_id, user_id);

-- Dependency chain traversal
CREATE INDEX idx_task_deps_tenant_task ON task_dependencies(tenant_id, task_id);
CREATE INDEX idx_task_deps_tenant_blocked ON task_dependencies(tenant_id, blocked_by_task_id);

-- Audit log queries
CREATE INDEX idx_audit_tenant_entity ON audit_log(tenant_id, entity_type, entity_id);
CREATE INDEX idx_audit_tenant_created ON audit_log(tenant_id, created_at);

-- Embedding similarity search
CREATE INDEX idx_embeddings_vector
  ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- AI action queries
CREATE INDEX idx_ai_actions_tenant_capability ON ai_actions(tenant_id, capability);
CREATE INDEX idx_ai_actions_tenant_status ON ai_actions(tenant_id, status);

-- Full-text search
CREATE INDEX idx_tasks_search ON tasks USING GIN(search_vector);
CREATE INDEX idx_comments_search ON comments USING GIN(search_vector);
```

### 10.4 Drizzle ORM Migration Strategy

**Schema-as-code:**
```typescript
// packages/db/schema/tasks.ts
import { pgTable, uuid, varchar, text, decimal, boolean, date, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { projects } from './projects';
import { phases } from './phases';
import { users } from './users';

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  phaseId: uuid('phase_id').references(() => phases.id),
  parentTaskId: uuid('parent_task_id').references((): any => tasks.id),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).notNull().default('created'),
  priority: varchar('priority', { length: 20 }).notNull().default('medium'),
  estimatedEffort: decimal('estimated_effort', { precision: 10, scale: 2 }),
  actualEffort: decimal('actual_effort', { precision: 10, scale: 2 }),
  startDate: date('start_date'),
  dueDate: date('due_date'),
  actualFinishDate: date('actual_finish_date'),
  aiGenerated: boolean('ai_generated').notNull().default(false),
  aiConfidence: decimal('ai_confidence').$type<number>(),
  clientVisible: boolean('client_visible').notNull().default(false),
  metadata: jsonb('metadata').notNull().default({}),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});
```

**Migration workflow:**
```bash
# Generate migration from schema changes
pnpm --filter db drizzle-kit generate:pg

# Run migrations
pnpm --filter db drizzle-kit push:pg

# Migration files stored in packages/db/migrations/
# Migrations are version-controlled and run in order
```

### 10.5 JSONB Patterns

**WBS baseline (`projects.wbs_baseline`):**
```json
{
  "snapshot_date": "2026-03-01T00:00:00Z",
  "ai_action_id": "uuid",
  "phases": [
    {
      "name": "Discovery",
      "tasks": [
        { "title": "Stakeholder interviews", "effort_hours": 16, "priority": "high" },
        { "title": "Requirements gathering", "effort_hours": 24, "priority": "high" }
      ]
    }
  ],
  "total_effort_hours": 320,
  "total_task_count": 42,
  "estimated_duration_weeks": 8
}
```

**AI action metadata (`ai_actions.model_output`):**
```json
{
  "raw_response": "...",
  "parsed_result": { },
  "schema_validation": { "valid": true, "errors": [] },
  "actions": [
    { "type": "create_task", "data": { "title": "...", "phase": "..." } }
  ]
}
```

---

## 11. Tier 7: Integration Gateway

> **Related FRs:** FR-700 (Slack, F-036), FR-701 (Git, F-037), FR-702 (Calendar, F-038)

### 11.1 Adapter Pattern

Each integration is a Fastify plugin with three responsibilities:
1. **Authenticate** the external service (OAuth token management, webhook verification)
2. **Normalize** inbound events to NATS subjects (`pm.integrations.*`)
3. **Format** outbound messages for the external service's API

Adapters share no state with each other. Adding a new integration = adding a new plugin file.

```typescript
// integrations/git/git.adapter.ts
import { FastifyPluginAsync } from 'fastify';

const gitAdapter: FastifyPluginAsync = async (fastify) => {
  // Inbound webhook receiver
  fastify.post('/webhooks/git/:provider', {
    handler: async (request, reply) => {
      const { provider } = request.params;  // github | gitlab | azure-devops
      const verified = verifyWebhookSignature(request, provider);
      if (!verified) return reply.code(401).send();

      const normalizedEvent = normalizeGitEvent(provider, request.body);
      await fastify.nats.publish(normalizedEvent.subject, normalizedEvent.payload);

      return reply.code(200).send({ received: true });
    }
  });
};
```

### 11.2 Git Adapter (FR-701, F-037)

**Release:** R1
**Providers:** GitHub (primary), GitLab (R2), Azure DevOps (R3)

**Inbound signals:**
- Push events: extract commit messages, match task IDs
- PR/MR events: link PR to tasks, track review status
- PR merge events: auto-complete linked tasks (when autonomy policy allows)

**Task linking convention:**
- Branch naming: `feature/TASK-{task_id_short}` or `fix/TASK-{task_id_short}`
- Commit message: `[TASK-{task_id_short}]` prefix or `Closes TASK-{task_id_short}`
- PR body: `Linked tasks: TASK-{task_id_short}, TASK-{task_id_short}`

**Auto-complete on PR merge:**
```
PR merged event received
  → Extract linked task IDs from branch name + PR body
  → For each linked task:
    → Check autonomy policy: is auto-complete allowed?
    → If yes: transition task to 'completed', actor_type = 'integration'
    → Emit: pm.tasks.completed, pm.tasks.status_changed
    → If no: create AI proposal for task completion
```

### 11.3 Slack Adapter (FR-700, F-036)

**Release:** R1
**Authentication:** OAuth 2.0 (Slack App with bot + user tokens)

**Slash commands:**

| Command | Description | Response |
|---------|-------------|----------|
| `/aipm status` | Current project summary | AI-generated status from Summary Engine |
| `/aipm next` | My prioritized tasks | What's Next Engine response for the user |
| `/aipm query <question>` | NL query about projects | Routes to NL Query Engine |
| `/aipm help` | Available commands | Static help text |

**Outbound notifications (via AI PM Agent):**
- Nudge DMs to task owners (overdue, stalled)
- Daily summary posted to project channel
- Risk alerts posted to admin channel
- Escalation notifications

**App Home tab (R1):**
- Project overview for the authenticated user
- Pending AI actions requiring approval
- Quick access to What's Next list

### 11.4 Calendar Adapter (FR-702, F-038)

**Release:** R1
**Protocols:** CalDAV, Google Calendar API (OAuth 2.0), Microsoft Graph API (OAuth 2.0)

**Inbound signals:**
- Team member availability (busy/free blocks)
- PTO/vacation entries

**Outbound actions:**
- Milestone meetings auto-created on project milestones
- Sprint planning sessions scheduled based on team availability

**Data used by:** Resource Optimization Engine (FR-605, F-032) — availability data informs workload balancing.

### 11.5 Webhook System (Outbound) (FR-1500, F-064)

**Release:** R2

**Design:**
- Tenants configure webhook subscriptions via Settings UI or API
- Each subscription specifies: event types to listen for, target URL, optional secret for signature verification

**Security:**
- HMAC-SHA256 signature in `X-Webhook-Signature` header
- Signature computed over the JSON payload using the tenant's webhook secret
- Receiving service verifies signature before processing

**Retry policy:**
- 3 retries with exponential backoff: 10s, 60s, 300s
- After 3 failures: disable the webhook subscription, notify tenant admin
- Webhook delivery log retained for 7 days

### 11.6 Jira Import (FR-1600, F-073)

**Release:** R2

**Migration scope:**
- Projects: name, description, status
- Tasks/issues: title, description, status (mapped to our statuses), priority, assignee, dates
- Dependencies: blocked-by relationships (Jira link types mapped)
- Comments: text, author, timestamps

**Process:**
1. Tenant provides Jira API token + project key
2. Batch import via Jira REST API (paginated, rate-limited)
3. Preview screen: mapping review (status mapping, priority mapping, user matching)
4. Validation: identify unmappable fields, duplicate detection
5. Import execution: create entities with `metadata.imported_from = 'jira'` flag
6. Post-import: generate embeddings for imported content

---

## 12. Tier 8: Security

> **Related FRs:** FR-800 (SSO, F-039), FR-801 (MFA, F-040), FR-802 (session hardening, F-041), NFR-200 (encryption), NFR-201 (tenant isolation), NFR-202 (secrets management), NFR-203 (PII handling), NFR-204 (prompt injection defense), NFR-205 (SOC 2)

### 12.1 Encryption Matrix

| Data State | Method | Key Management |
|------------|--------|---------------|
| At rest — RDS | AES-256 | AWS KMS (automatic key rotation) |
| At rest — S3 | AES-256 (SSE-S3 or SSE-KMS) | AWS KMS |
| At rest — ElastiCache | AES-256 | ElastiCache encryption |
| In transit — ALB to services | TLS 1.3 | ACM-managed certificates |
| In transit — services to RDS | TLS 1.3 | RDS CA certificate |
| In transit — services to ElastiCache | TLS 1.3 | ElastiCache in-transit encryption |
| In transit — services to NATS | TLS 1.3 | Self-signed CA (internal) |
| JWT signing | RS256 | Asymmetric keypair in Secrets Manager |

### 12.2 Three-Layer Tenant Isolation

```
Layer 1: JWT Claims
  → Every request carries tenant_id in JWT
  → Verified at authentication middleware

Layer 2: Application Middleware
  → SET LOCAL app.current_tenant_id = '<tenant_id_from_jwt>'
  → Set before any database query executes

Layer 3: PostgreSQL RLS
  → Every tenant-scoped table has RLS policy
  → USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  → Database physically cannot return rows from other tenants
```

**AI-specific isolation:**
- RAG retrieval: pgvector queries include `WHERE tenant_id = :tenant_id` (not post-filter)
- Embedding queries: tenant filter applied in the vector search query itself
- Context assembly: verified to contain only current tenant's data via assertion checks
- LLM prompts: no raw cross-tenant data in system prompts

### 12.3 Secrets Management

| Secret | Storage | Rotation |
|--------|---------|----------|
| Database credentials | AWS Secrets Manager | Auto-rotation every 30 days |
| JWT signing keys | AWS Secrets Manager | Manual rotation every 90 days |
| Claude API key | AWS Secrets Manager | Manual rotation on demand |
| Slack/Git OAuth tokens | AWS Secrets Manager | Per-tenant, refreshed via OAuth flow |
| Webhook signing secrets | AWS Secrets Manager | Per-tenant, rotatable by tenant admin |

**Access pattern:** Application reads secrets via AWS SDK at startup and caches in memory. Secrets are never stored in environment variables, code, or logs.

### 12.4 PII Handling (R1+)

| Control | Implementation |
|---------|---------------|
| Comment redaction | Comments with `client_visible = false` are excluded from LLM context assembly |
| Email hashing | User emails hashed (SHA-256) in application logs |
| Prompt sanitization | AI prompts are sanitized before archival (PII patterns replaced with placeholders) |
| Configurable regex | Per-project redaction regex patterns (e.g., SSN, credit card numbers) |
| Data minimization | LLM context includes only the minimum data required for the operation |

### 12.5 Prompt Injection Defense (R2+)

| Defense Layer | Implementation |
|---------------|---------------|
| Input sanitization | User input sanitized before inclusion in LLM context (strip control characters, limit length) |
| Structured fields | Tenant data passed in structured fields, not raw user input in system prompts |
| Output validation | LLM output validated against expected JSON schema before execution |
| Action logging | Every AI action logged for forensic review (full chain in `ai_actions` table) |
| Rate limiting | Per-tenant rate limits on AI operations prevent abuse |

### 12.6 SOC 2 Control Mapping

| SOC 2 Criteria | Implementation | Release |
|----------------|---------------|---------|
| **CC6.1** Logical access | RBAC + JWT + RLS | R0 |
| **CC6.2** Authentication | Password + MFA + SSO | R0/R1 |
| **CC6.3** Access provisioning | Admin-managed roles, invitation flow | R0 |
| **CC6.6** System boundaries | VPC, security groups, WAF | R0 |
| **CC6.7** Change management | GitOps, PR approvals, CI/CD gates | R0 |
| **CC7.1** Monitoring | CloudWatch, Sentry, alerting | R0 |
| **CC7.2** Incident response | PagerDuty integration, runbooks | R1 |
| **CC8.1** Data protection | Encryption at rest + in transit | R0 |
| **A1.2** Data recovery | Automated backups, S3 cross-region replication | R0 |
| **PI1.1** Data integrity | FK constraints, immutable audit log | R0 |

---

## 13. Tier 9: Deployment & CI/CD

> **Related FRs:** NFR-300 (infrastructure), NFR-301 (auto-scaling), NFR-302 (CI/CD pipeline), NFR-303 (environments)

### 13.1 AWS Infrastructure

**VPC layout:**

```
VPC: 10.0.0.0/16
├── Public Subnets (2 AZs)
│   ├── 10.0.1.0/24 (AZ-a) — ALB, NAT Gateway
│   └── 10.0.2.0/24 (AZ-b) — ALB, NAT Gateway
├── Private Subnets (2 AZs)
│   ├── 10.0.10.0/24 (AZ-a) — ECS tasks (API, Web, AI Worker, NATS)
│   └── 10.0.20.0/24 (AZ-b) — ECS tasks (replica)
└── Isolated Subnets (2 AZs)
    ├── 10.0.100.0/24 (AZ-a) — RDS primary, ElastiCache
    └── 10.0.200.0/24 (AZ-b) — RDS standby
```

**Security groups:**
- ALB SG: inbound 443 from 0.0.0.0/0, outbound to ECS SG
- ECS SG: inbound from ALB SG only, outbound to RDS SG + ElastiCache SG + NATS SG + internet (for Claude API)
- RDS SG: inbound 5432 from ECS SG only
- ElastiCache SG: inbound 6379 from ECS SG only
- NATS SG: inbound 4222/6222/8222 from ECS SG only

### 13.2 ECS Fargate Services

| Service | R0 Tasks | R1 Tasks | R2 Tasks | R3 Tasks | CPU | Memory |
|---------|----------|----------|----------|----------|-----|--------|
| API | 2 | 2 | 3-4 | 2-8 | 1 vCPU | 2 GB |
| AI Workers | 1 (in-process) | 2 (separate) | 2-4 | 2-6 | 1 vCPU | 4 GB |
| Web (Next.js) | 2 | 2 | 2 | 2-4 | 0.5 vCPU | 1 GB |
| NATS Cluster | 3 | 3 | 3 | 3-5 | 0.5 vCPU | 1 GB |

**Auto-scaling policies:**

| Service | Metric | Target | Min | Max | Cooldown |
|---------|--------|--------|-----|-----|----------|
| API | CPU utilization | 70% | 2 | 8 | 300s |
| AI Workers | BullMQ queue depth | 50 pending | 1 | 4 | 120s |
| Web | CPU utilization | 70% | 2 | 4 | 300s |

### 13.3 CI/CD Pipeline (GitHub Actions)

```
PR Created / Updated
  │
  ├── [Parallel] lint (ESLint + Prettier)
  ├── [Parallel] type-check (tsc --noEmit)
  ├── [Parallel] unit test (Vitest, coverage report)
  │
  └── [Sequential after all parallel pass]
      │
      ├── integration test (testcontainers: PG, Redis, NATS)
      │
      ├── build (Turborepo: apps/api, apps/web, apps/ai-worker)
      │
      ├── Docker build + push to ECR
      │
      ├── Deploy to staging
      │   └── Run smoke tests against staging
      │
      ├── [Manual gate] Approve production deploy
      │
      └── Deploy to production
          ├── Rolling update (zero downtime)
          ├── Health check verification
          └── Rollback on failure (automatic)
```

**GitHub Actions workflow structure:**
```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo lint

  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo type-check

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo test -- --coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/

  integration:
    needs: [lint, type-check, test]
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
      redis:
        image: redis:7
        ports: ['6379:6379']
      nats:
        image: nats:2.10
        ports: ['4222:4222']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo test:integration

  deploy-staging:
    needs: [integration]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
      - run: pnpm turbo build
      - run: docker build -t api ./apps/api
      - run: docker push $ECR_REPO/api:$GITHUB_SHA
      - run: npx cdk deploy --app 'npx ts-node infra/bin/app.ts' --context env=staging

  deploy-production:
    needs: [deploy-staging]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://app.aipm.example.com
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
      - run: npx cdk deploy --app 'npx ts-node infra/bin/app.ts' --context env=production
```

### 13.4 CDK Stack Structure

| Stack | Resources | Dependencies |
|-------|-----------|-------------|
| `VpcStack` | VPC, subnets, NAT gateways, security groups | None |
| `DatabaseStack` | RDS PostgreSQL, ElastiCache Redis, S3 buckets | VpcStack |
| `ComputeStack` | ECS cluster, Fargate services (API, AI Worker, Web, NATS), ALB, target groups, auto-scaling | VpcStack, DatabaseStack |
| `MonitoringStack` | CloudWatch dashboards, alarms, SNS topics, X-Ray | ComputeStack |
| `PipelineStack` | CodePipeline (optional), ECR repositories, IAM roles | All stacks |

**CDK example:**
```typescript
// infra/lib/compute-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';

export class ComputeStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const cluster = new ecs.Cluster(this, 'AiPmCluster', {
      vpc: props.vpc,
      containerInsights: true,
    });

    // API Service
    const apiService = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this, 'ApiService', {
        cluster,
        cpu: 1024,
        memoryLimitMiB: 2048,
        desiredCount: 2,
        taskImageOptions: {
          image: ecs.ContainerImage.fromEcrRepository(props.apiRepo),
          containerPort: 3000,
          environment: {
            NODE_ENV: 'production',
            DATABASE_URL: props.databaseUrl,
          },
          secrets: {
            JWT_PRIVATE_KEY: ecs.Secret.fromSecretsManager(props.jwtSecret),
            ANTHROPIC_API_KEY: ecs.Secret.fromSecretsManager(props.claudeSecret),
          },
        },
        publicLoadBalancer: true,
        certificate: props.certificate,
      }
    );

    // Auto-scaling
    const scaling = apiService.service.autoScaleTaskCount({
      minCapacity: 2,
      maxCapacity: 8,
    });
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(300),
      scaleOutCooldown: cdk.Duration.seconds(300),
    });
  }
}
```

### 13.5 Environments

| Aspect | Dev | Staging | Production |
|--------|-----|---------|------------|
| AZ | Single | Multi-AZ | Multi-AZ |
| RDS | db.t3.medium | db.r6g.large | db.r6g.large (Multi-AZ) |
| ECS tasks | 1 per service | Mirrors prod count | As defined above |
| Encryption | At rest only | Full (matches prod) | Full |
| Monitoring | Basic CloudWatch | Full (matches prod) | Full + PagerDuty |
| Data | Seed data | Anonymized prod subset | Production |
| Domain | dev.aipm.internal | staging.aipm.example.com | app.aipm.example.com |

---

## 14. Tier 10: Monitoring & Observability

> **Related FRs:** FR-400 (AI traceability, F-020), FR-401 (evaluation harness, F-021), FR-402 (runtime monitoring, F-022)

### 14.1 Application Metrics

| Metric | Source | Dashboard |
|--------|--------|-----------|
| Request latency (p50, p95, p99) | Fastify request hooks → CloudWatch EMF | API Performance |
| Error rate (4xx, 5xx) | Fastify error handler → CloudWatch | API Performance |
| Request throughput (req/s) | ALB metrics | API Performance |
| Task creation rate | NATS event counter | Business Metrics |
| Active users (DAU/WAU) | Application logs → CloudWatch Insights | Business Metrics |

### 14.2 Database Metrics

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Connection count | RDS CloudWatch | >80% of max connections |
| Replication lag | RDS CloudWatch (R2+ with read replica) | >5s |
| Query latency (p95) | RDS Performance Insights | >100ms |
| Free storage space | RDS CloudWatch | <20% remaining |
| CPU utilization | RDS CloudWatch | >80% sustained |

### 14.3 AI Metrics

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| AI operation latency (per capability) | `ai_actions.latency_ms` → CloudWatch | p95 > 30s (WBS), p95 > 8s (query) |
| Token usage (input/output) | `ai_cost_log` → CloudWatch | >80% of tenant budget |
| Cost per operation | `ai_cost_log` → CloudWatch | Daily cost > 2x baseline |
| Confidence score distribution | `ai_actions.confidence_score` → CloudWatch | Average < 0.5 |
| Acceptance rate | `ai_actions` (approved / total proposed) | <60% per capability |
| Circuit breaker state | LLM Gateway → CloudWatch | State = OPEN |
| LLM API error rate | LLM Gateway → CloudWatch | >10% of calls |

### 14.4 Structured JSON Logging

All services log structured JSON to stdout, collected by CloudWatch Logs.

```json
{
  "timestamp": "2026-03-01T10:15:30.000Z",
  "level": "info",
  "service": "api",
  "module": "task",
  "method": "POST",
  "path": "/api/v1/tasks",
  "tenant_id": "uuid",
  "user_id": "uuid",
  "request_id": "uuid",
  "duration_ms": 45,
  "status_code": 201,
  "message": "Task created"
}
```

**Log retention:**
- Production: 30 days in CloudWatch Logs, archived to S3 for 1 year
- Staging: 7 days
- Dev: 3 days

### 14.5 X-Ray Distributed Tracing

**Integration points:**
- Fastify middleware: traces every HTTP request
- NATS producer/consumer: traces event publish and processing
- LLM Gateway: traces AI API calls (model, latency, tokens)
- Drizzle queries: traces database calls

**Trace structure for NL→WBS flow:**
```
[API Request] POST /api/v1/projects/generate-wbs (total: 12.5s)
  ├── [Auth] JWT verification (2ms)
  ├── [RLS] Set tenant context (1ms)
  ├── [AI Orchestrator] Trigger (5ms)
  ├── [AI Orchestrator] Autonomy check (3ms)
  ├── [AI Orchestrator] Context assembly (450ms)
  │   ├── [DB] Load project data (25ms)
  │   ├── [pgvector] Similarity search (120ms)
  │   └── [DB] Load event history (35ms)
  ├── [AI Orchestrator] Confidence check (2ms)
  ├── [LLM Gateway] Claude Opus call (11,200ms)
  ├── [AI Orchestrator] Post-processing (50ms)
  │   └── [Validation] Schema check (5ms)
  ├── [AI Orchestrator] Disposition (15ms)
  │   └── [DB] Insert ai_actions (10ms)
  └── [NATS] Publish pm.ai.action_proposed (3ms)
```

### 14.6 Sentry (Frontend Error Tracking)

**Configuration:**
- Source maps uploaded on each deploy
- Release tracking tied to Git SHA
- Breadcrumbs for user actions (navigation, clicks, API calls)
- User context: tenant_id, user_id, role (no PII)
- Error grouping by component and error type

### 14.7 Alerting Rules

| Alert | Condition | Severity | Channel |
|-------|-----------|----------|---------|
| Circuit breaker open | LLM Gateway state = OPEN | Critical | PagerDuty + Slack |
| AI failure rate >10% | Rolling 5min window | High | Slack |
| Per-tenant budget exceeded | Redis counter > budget | Medium | Slack + email to tenant admin |
| NATS consumer lag >1000 | Consumer lag metric | High | Slack |
| RDS connection pool >80% | CloudWatch metric | High | PagerDuty |
| API p95 latency >2s | CloudWatch metric | Medium | Slack |
| 5xx error spike | >5% of requests in 5min | Critical | PagerDuty + Slack |
| DLQ message count >0 | Any DLQ stream | Medium | Slack |
| RDS free storage <20% | CloudWatch metric | High | Slack |
| ECS task crash loop | Task restart >3 in 10min | Critical | PagerDuty |

### 14.8 AI Observability Dashboard

Dedicated CloudWatch dashboard for AI operations:

| Panel | Visualization | Data Source |
|-------|---------------|-------------|
| Per-capability latency | Histogram (p50, p95, p99) | `ai_actions.latency_ms` |
| Per-tenant budget usage | Gauge (% of monthly budget) | Redis counters |
| Acceptance/rejection rates | Time series (7-day rolling) | `ai_actions` status counts |
| Token usage by capability | Stacked bar chart | `ai_cost_log` |
| Circuit breaker state | Status indicator | LLM Gateway metric |
| Shadow mode vs live | Pie chart per capability | `ai_actions.disposition` |
| Confidence distribution | Histogram | `ai_actions.confidence_score` |
| Cost per tenant per day | Time series | `ai_cost_log` aggregated |

---

## 15. Data Flow Diagrams

### 15.1 Pattern 1 — NL to WBS (Core Product Flow)

```
User                   Web App              API Gateway           Fastify API
  │                      │                     │                     │
  │  Describe project    │                     │                     │
  │  in natural lang.    │                     │                     │
  ├─────────────────────>│                     │                     │
  │                      │  POST /api/v1/      │                     │
  │                      │  projects/:id/      │                     │
  │                      │  generate-wbs       │                     │
  │                      ├────────────────────>│                     │
  │                      │                     │  Auth + tenant      │
  │                      │                     │  resolution         │
  │                      │                     ├────────────────────>│
  │                      │                     │                     │
  │                      │                     │      AI Orchestrator
  │                      │                     │           │
  │                      │                     │   1. TRIGGER
  │                      │                     │   2. AUTONOMY CHECK
  │                      │                     │      → mode: propose
  │                      │                     │   3. CONTEXT ASSEMBLY
  │                      │                     │      ├── pgvector: similar projects
  │                      │                     │      ├── Domain template: software_delivery
  │                      │                     │      └── Token budget: 5K
  │                      │                     │   4. CONFIDENCE CHECK
  │                      │                     │      → confidence: 0.82 (proceed)
  │                      │                     │   5. LLM CALL
  │                      │                     │      → Claude Opus 4
  │                      │                     │      → 4.2K input, 2.8K output
  │                      │                     │      → latency: 11.2s
  │                      │                     │   6. POST-PROCESSING
  │                      │                     │      → Parse JSON, validate schema
  │                      │                     │      → Extract: 4 phases, 28 tasks
  │                      │                     │   7. DISPOSITION
  │                      │                     │      → Create ai_action (proposed)
  │                      │                     │      → Emit pm.ai.action_proposed
  │                      │                     │           │
  │                      │   WBS proposal      │<──────────┘
  │                      │<────────────────────│
  │  AI Review screen    │                     │
  │<─────────────────────│                     │
  │                      │                     │
  │  [Approve]           │                     │
  ├─────────────────────>│                     │
  │                      │  POST /api/v1/ai/   │
  │                      │  actions/:id/approve│
  │                      ├────────────────────>│
  │                      │                     ├────────────────────>│
  │                      │                     │  Task Module:       │
  │                      │                     │  bulk create tasks  │
  │                      │                     │  (28 tasks)         │
  │                      │                     │           │
  │                      │                     │  Events emitted:    │
  │                      │                     │  pm.ai.action_approved
  │                      │                     │  pm.tasks.created (x28)
  │                      │                     │  pm.projects.baseline_set
  │                      │                     │           │
  │                      │                     │  Consumers:         │
  │                      │                     │  audit-writer       │
  │                      │                     │  embedding-pipeline │
  │                      │                     │  projection-updater │
  │                      │   Success           │<──────────┘
  │                      │<────────────────────│
  │  Project with WBS    │                     │
  │<─────────────────────│                     │
```

### 15.2 Pattern 2 — AI PM Agent Loop

```
BullMQ Scheduler              AI Worker Service
  │                              │
  │  Every 15 minutes            │
  ├─────────────────────────────>│
  │                              │
  │                   FOR each tenant:
  │                     FOR each active project:
  │                              │
  │                   Query: overdue tasks
  │                   Query: stalled tasks (>48h no update)
  │                   Query: newly unblocked tasks
  │                              │
  │                   FOR each actionable item:
  │                              │
  │                   AI Orchestrator: TRIGGER
  │                   Autonomy Check:
  │                     nudge → execute (if policy allows)
  │                     escalation → propose
  │                              │
  │                   Check quiet hours:
  │                     IF in quiet hours → queue for later
  │                     IF nudge count >= 2/task/day → skip
  │                              │
  │                   Context Assembly:
  │                     task details + assignee + project context
  │                              │
  │                   LLM Call (Sonnet):
  │                     Generate contextual nudge message
  │                              │
  │                   DISPOSITION:
  │                     │
  │                     ├── Nudge (execute mode):
  │                     │     │
  │                     │     └── Slack Adapter:
  │                     │           Send DM to assignee
  │                     │           "Hey @dev, your task 'Build API endpoint'
  │                     │            is 2 days overdue. The frontend team is
  │                     │            blocked waiting on this. Need help?"
  │                     │
  │                     └── Escalation (propose mode):
  │                           Create ai_action (proposed)
  │                           PM sees in AI Review UI
  │                              │
  │                   Emit events:
  │                     pm.ai.action_executed (nudges)
  │                     pm.ai.action_proposed (escalations)
  │                              │
  │                   Log to ai_actions table:
  │                     capability: 'pm_agent'
  │                     model: 'claude-sonnet-4-5'
  │                     latency, tokens, cost
```

### 15.3 Pattern 3 — Client Portal Query

```
Client                Portal UI            API Gateway           Fastify API
  │                     │                     │                     │
  │ "When will Phase    │                     │                     │
  │  2 be done?"        │                     │                     │
  ├────────────────────>│                     │                     │
  │                     │  POST /api/v1/      │                     │
  │                     │  portal/query       │                     │
  │                     ├────────────────────>│                     │
  │                     │                     │  Auth: client JWT   │
  │                     │                     │  Role: client       │
  │                     │                     │  Scope: tenant only │
  │                     │                     ├────────────────────>│
  │                     │                     │                     │
  │                     │                     │  AI Orchestrator:   │
  │                     │                     │  Context Assembly:  │
  │                     │                     │    RAG scoped to:   │
  │                     │                     │    - tenant_id      │
  │                     │                     │    - client_visible │
  │                     │                     │      = true ONLY    │
  │                     │                     │                     │
  │                     │                     │  LLM Call (Sonnet): │
  │                     │                     │    Answer from      │
  │                     │                     │    projected data   │
  │                     │                     │                     │
  │                     │                     │  Post-Processing:   │
  │                     │                     │    Redaction check: │
  │                     │                     │    verify no        │
  │                     │                     │    internal data    │
  │                     │                     │                     │
  │                     │                     │  Confidence > 0.8   │
  │                     │                     │  AND no sensitive?  │
  │                     │                     │    YES → respond    │
  │                     │                     │    NO → flag for PM │
  │                     │                     │                     │
  │                     │  Streaming response │<────────────────────│
  │                     │<────────────────────│                     │
  │ "Phase 2 is on      │                     │                     │
  │  track for March 15. │                    │                     │
  │  3 of 8 milestones  │                     │                     │
  │  complete."         │                     │                     │
  │<────────────────────│                     │                     │
```

### 15.4 Pattern 4 — Git to Task Update Flow

```
Developer              GitHub                Integration Gateway     NATS Bus
  │                      │                        │                    │
  │  Merge PR            │                        │                    │
  │  (branch: feature/   │                        │                    │
  │   TASK-abc123)       │                        │                    │
  ├─────────────────────>│                        │                    │
  │                      │  Webhook: PR merged    │                    │
  │                      ├───────────────────────>│                    │
  │                      │                        │                    │
  │                      │  Git Adapter:          │                    │
  │                      │  1. Verify webhook sig │                    │
  │                      │  2. Parse branch name  │                    │
  │                      │     → task_id: abc123  │                    │
  │                      │  3. Parse PR body      │                    │
  │                      │     → additional links  │                    │
  │                      │                        │                    │
  │                      │  Publish:              │                    │
  │                      │  pm.integrations.      │                    │
  │                      │  git_pr_merged         │                    │
  │                      │                        ├───────────────────>│
  │                      │                        │                    │
  │                      │                        │    Consumers:      │
  │                      │                        │                    │
  │                      │                        │    Task Module:    │
  │                      │                        │    Check autonomy  │
  │                      │                        │    policy for      │
  │                      │                        │    auto-complete   │
  │                      │                        │      │             │
  │                      │                        │    IF allowed:     │
  │                      │                        │    task.status =   │
  │                      │                        │    'completed'     │
  │                      │                        │    actor_type =    │
  │                      │                        │    'integration'   │
  │                      │                        │      │             │
  │                      │                        │    Emit:           │
  │                      │                        │    pm.tasks.       │
  │                      │                        │    completed       │
  │                      │                        │    pm.tasks.       │
  │                      │                        │    status_changed  │
  │                      │                        │                    │
  │                      │                        │    Audit Writer:   │
  │                      │                        │    Log completion  │
  │                      │                        │    with git context│
```

### 15.5 Pattern 5 — Daily Summary Generation

```
BullMQ Scheduler          AI Worker            NATS Bus            Slack Adapter
  │                          │                    │                     │
  │  Daily at 17:00 UTC      │                    │                     │
  ├─────────────────────────>│                    │                     │
  │                          │                    │                     │
  │               FOR each tenant:                │                     │
  │                 FOR each active project:       │                     │
  │                          │                    │                     │
  │               AI Orchestrator:                │                     │
  │                          │                    │                     │
  │               Context Assembly:               │                     │
  │                 - Tasks completed today        │                     │
  │                 - Tasks started today          │                     │
  │                 - Blockers encountered         │                     │
  │                 - Comments added               │                     │
  │                 - AI actions taken             │                     │
  │                 - Risks flagged                │                     │
  │                          │                    │                     │
  │               LLM Call (Sonnet):              │                     │
  │                 "Summarize today's activity    │                     │
  │                  in 4-6 sentences"             │                     │
  │                          │                    │                     │
  │               Autonomy Check:                 │                     │
  │                 daily_summary → execute        │                     │
  │                          │                    │                     │
  │               Store summary in DB             │                     │
  │               Emit: pm.ai.action_executed     │                     │
  │                          ├───────────────────>│                     │
  │                          │                    │                     │
  │                          │              Notification Router:        │
  │                          │                    ├────────────────────>│
  │                          │                    │  Post to project    │
  │                          │                    │  Slack channel:     │
  │                          │                    │  "Daily Summary:    │
  │                          │                    │   3 tasks completed,│
  │                          │                    │   1 new blocker on  │
  │                          │                    │   API integration.  │
  │                          │                    │   Team velocity     │
  │                          │                    │   is on track."     │
```

### 15.6 Pattern 6 — Risk Prediction Flow

```
NATS Event                     AI Worker (Escalation Monitor)
  │                                │
  │ pm.tasks.status_changed        │
  │ (task blocked for 72h+)        │
  ├───────────────────────────────>│
  │                                │
  │                    AI Orchestrator:
  │                                │
  │                    Autonomy Check:
  │                      risk_prediction → shadow (first 2-4 weeks)
  │                                      → propose (after validation)
  │                                │
  │                    Context Assembly:
  │                      - Blocked task details
  │                      - Dependency chain depth
  │                      - Historical blocker resolution times
  │                      - Assignee workload
  │                      - Project timeline impact
  │                      - Similar past incidents (RAG)
  │                                │
  │                    LLM Call (Opus):
  │                      Analyze risk pattern
  │                      Generate severity + mitigations
  │                                │
  │                    Output:
  │                      risk_type: 'blocker'
  │                      severity: 'high'
  │                      confidence: 0.78
  │                      description: "Task 'API Integration' has been
  │                        blocked for 72h. Historical data shows similar
  │                        blockers resolved in 48h average. Downstream
  │                        impact: 4 tasks blocked, milestone at risk."
  │                      mitigations:
  │                        - "Escalate to senior developer"
  │                        - "Consider alternative implementation"
  │                        - "Adjust milestone date by 3 days"
  │                                │
  │                    Disposition:
  │                      shadow → log only (weeks 1-4)
  │                      propose → PM reviews in AI Review UI (week 5+)
  │                                │
  │                    Emit: pm.ai.action_proposed
  │                      (or pm.ai.confidence_low if below threshold)
```

---

## 16. Cost Model

### 16.1 Infrastructure Costs (Monthly, AWS)

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

### 16.2 AI Token Cost Model (Per Tenant Per Month)

| Tier | AI Ops/Month | Estimated Token Cost | Subscription Price | Gross Margin |
|------|-------------|---------------------|--------------------|--------------|
| Starter | ~500 | $8–15 | $29/mo | ~60-75% |
| Pro | ~2,000 | $25–50 | $99/mo | ~70-80% |
| Enterprise | ~5,000+ | $60–120 | $249+/mo | ~55-75% |

**Token cost breakdown per operation type:**

| Operation | Model | Input Tokens | Output Tokens | Estimated Cost |
|-----------|-------|-------------|---------------|----------------|
| NL→WBS generation | Opus 4 | ~5,000 | ~3,000 | $0.12–0.18 |
| NL query | Sonnet 4.5 | ~2,000 | ~1,000 | $0.01–0.02 |
| Daily summary | Sonnet 4.5 | ~3,000 | ~1,000 | $0.01–0.02 |
| Risk prediction | Opus 4 | ~4,000 | ~2,000 | $0.09–0.14 |
| PM Agent nudge | Sonnet 4.5 | ~2,000 | ~500 | $0.008–0.01 |
| Scope creep check | Sonnet 4.5 | ~3,000 | ~1,000 | $0.01–0.02 |
| SOW generation (R3) | Opus 4 | ~8,000 | ~5,000 | $0.20–0.30 |

### 16.3 Unit Economics

**R2 target (3 tenants, Pro tier):**
- Revenue: 3 x $99 = $297/mo (conservative; likely mix of Starter + Pro)
- Infrastructure cost: ~$1,030/mo (shared)
- Per-tenant infrastructure: ~$110/mo amortized
- Per-tenant AI cost: ~$35/mo (Pro tier average)
- Per-tenant total cost: ~$145/mo
- **Gross margin per Pro tenant: ~$99 - $35 AI = ~65% on AI; factoring shared infra amortization: ~78%**

**R3 target (10 tenants):**
- Revenue: ~$5,000/mo (mix of tiers)
- Infrastructure: ~$2,110/mo
- AI costs scale sub-linearly with caching and prompt optimization
- **Target gross margin: ~58%** (improving as tenant count increases and fixed costs amortize)

---

## 17. API Design

### 17.1 Conventions

| Aspect | Convention |
|--------|-----------|
| Base URL | `/api/v1/` |
| Versioning | URL path versioning (`/api/v1/`, `/api/v2/`) |
| Authentication | `Authorization: Bearer <jwt>` header |
| Pagination | Cursor-based: `?cursor=<opaque_string>&limit=50` (max 100) |
| Sorting | `?sort=created_at&order=desc` |
| Filtering | Query params: `?status=in_progress&priority=high&assignee=uuid` |
| Includes | `?include=phases,tasks,dependencies` for composite responses |
| Error format | `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }` |
| Rate limiting | Per-tenant, per-endpoint. Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` |
| Content type | `application/json` (request and response) |
| Timestamps | ISO 8601 with timezone (`2026-03-01T10:15:30.000Z`) |
| IDs | UUID v4 |

### 17.2 Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "title",
        "message": "Title is required",
        "code": "REQUIRED"
      }
    ],
    "request_id": "uuid"
  }
}
```

**Standard error codes:**

| HTTP Status | Error Code | Description |
|-------------|-----------|-------------|
| 400 | `VALIDATION_ERROR` | Request body or params failed validation |
| 400 | `CIRCULAR_DEPENDENCY` | Dependency would create a cycle |
| 400 | `INVALID_TRANSITION` | Task status transition not allowed |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT |
| 403 | `FORBIDDEN` | Role lacks required permission |
| 404 | `NOT_FOUND` | Resource does not exist (in tenant scope) |
| 409 | `CONFLICT` | Duplicate resource (e.g., project name) |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
| 503 | `AI_UNAVAILABLE` | LLM circuit breaker open |

### 17.3 Full Endpoint Catalog

#### Projects

| Method | Path | Description | Auth Role | Rate Limit | FR Ref |
|--------|------|-------------|-----------|------------|--------|
| POST | `/api/v1/projects` | Create project | Admin, PM | 100/h | FR-102 |
| GET | `/api/v1/projects` | List projects (paginated, filtered) | Admin, Dev*, PM* | 120/min | FR-102 |
| GET | `/api/v1/projects/:id` | Get project detail (with includes) | Admin, Dev*, PM* | 120/min | FR-102 |
| PATCH | `/api/v1/projects/:id` | Update project | Admin, PM* | 100/h | FR-102 |
| DELETE | `/api/v1/projects/:id` | Soft-delete project | Admin | 20/h | FR-102 |
| POST | `/api/v1/projects/:id/generate-wbs` | Generate WBS from NL description | Admin, PM | 10/h | FR-200 |
| GET | `/api/v1/projects/:id/baseline` | Get WBS baseline snapshot | Admin, Dev*, PM* | 60/min | FR-607 |
| POST | `/api/v1/projects/:id/phases` | Add phase to project | Admin, PM* | 50/h | FR-102 |
| PATCH | `/api/v1/projects/:id/phases/:phaseId` | Update phase | Admin, PM* | 50/h | FR-102 |
| DELETE | `/api/v1/projects/:id/phases/:phaseId` | Remove phase | Admin, PM* | 20/h | FR-102 |

#### Tasks

| Method | Path | Description | Auth Role | Rate Limit | FR Ref |
|--------|------|-------------|-----------|------------|--------|
| POST | `/api/v1/tasks` | Create task | Admin, Dev*, PM* | 200/h | FR-105 |
| GET | `/api/v1/tasks` | List tasks (filtered by project, status, assignee, etc.) | Admin, Dev*, PM* | 120/min | FR-105 |
| GET | `/api/v1/tasks/:id` | Get task detail (with sub-tasks, deps, comments, audit) | Admin, Dev*, PM* | 120/min | FR-500 |
| PATCH | `/api/v1/tasks/:id` | Update task fields | Admin, Dev*, PM* | 200/h | FR-105 |
| POST | `/api/v1/tasks/:id/transition` | Change task status | Admin, Dev*, PM* | 200/h | FR-105 |
| DELETE | `/api/v1/tasks/:id` | Soft-delete task | Admin, PM* | 50/h | FR-105 |
| POST | `/api/v1/tasks/bulk` | Bulk create tasks (for WBS import) | Admin, PM | 10/h | FR-200 |
| POST | `/api/v1/tasks/import` | Import tasks from CSV/XLSX | Admin, PM | 5/h | FR-1100 |

#### Dependencies

| Method | Path | Description | Auth Role | Rate Limit | FR Ref |
|--------|------|-------------|-----------|------------|--------|
| POST | `/api/v1/tasks/:id/dependencies` | Add dependency | Admin, Dev*, PM* | 100/h | FR-106 |
| GET | `/api/v1/tasks/:id/dependencies` | List dependencies (both directions) | Admin, Dev*, PM* | 120/min | FR-106 |
| DELETE | `/api/v1/tasks/:id/dependencies/:depId` | Remove dependency | Admin, Dev*, PM* | 100/h | FR-106 |

#### Task Assignments

| Method | Path | Description | Auth Role | Rate Limit | FR Ref |
|--------|------|-------------|-----------|------------|--------|
| POST | `/api/v1/tasks/:id/assignments` | Assign user(s) to task | Admin, PM* | 200/h | FR-105 |
| DELETE | `/api/v1/tasks/:id/assignments/:userId` | Remove assignment | Admin, PM* | 200/h | FR-105 |

#### Comments

| Method | Path | Description | Auth Role | Rate Limit | FR Ref |
|--------|------|-------------|-----------|------------|--------|
| POST | `/api/v1/tasks/:id/comments` | Add comment | Admin, Dev*, PM*, Client** | 200/h | FR-503 |
| GET | `/api/v1/tasks/:id/comments` | List comments for task | Admin, Dev*, PM*, Client** | 120/min | FR-503 |
| PATCH | `/api/v1/comments/:id` | Edit comment (own only) | Admin, Dev*, PM*, Client** | 100/h | FR-503 |
| DELETE | `/api/v1/comments/:id` | Soft-delete comment (own only) | Admin, Dev*, PM* | 50/h | FR-503 |

#### Users

| Method | Path | Description | Auth Role | Rate Limit | FR Ref |
|--------|------|-------------|-----------|------------|--------|
| GET | `/api/v1/users/me` | Get current user profile | Any | 120/min | FR-103 |
| GET | `/api/v1/users/me/next` | Get AI-curated prioritized tasks | Any (non-client) | 60/min | FR-201 |
| PATCH | `/api/v1/users/me` | Update own profile | Any | 20/h | FR-103 |
| GET | `/api/v1/users` | List users in tenant | Admin, PM | 60/min | FR-103 |
| POST | `/api/v1/users/invite` | Invite user to tenant | Admin | 50/h | FR-103 |
| PATCH | `/api/v1/users/:id/role` | Change user role | Admin | 20/h | FR-104 |
| DELETE | `/api/v1/users/:id` | Deactivate user | Admin | 20/h | FR-103 |

#### AI Operations

| Method | Path | Description | Auth Role | Rate Limit | FR Ref |
|--------|------|-------------|-----------|------------|--------|
| POST | `/api/v1/query` | NL query about project data | Admin, Dev*, PM* | 30/min | FR-203 |
| GET | `/api/v1/ai/actions` | List AI actions (filtered) | Admin, PM | 60/min | FR-400 |
| GET | `/api/v1/ai/actions/:id` | Get AI action detail | Admin, PM | 60/min | FR-400 |
| POST | `/api/v1/ai/actions/:id/approve` | Approve AI proposal | Admin, PM | 100/h | FR-301 |
| POST | `/api/v1/ai/actions/:id/reject` | Reject AI proposal | Admin, PM | 100/h | FR-301 |
| POST | `/api/v1/ai/actions/:id/rollback` | Rollback executed AI action | Admin, PM | 20/h | FR-304 |
| GET | `/api/v1/ai/costs` | Get AI cost summary for tenant | Admin | 30/min | FR-1000 |
| GET | `/api/v1/ai/policy` | Get current autonomy policy | Admin | 30/min | FR-300 |
| PUT | `/api/v1/ai/policy` | Update autonomy policy | Admin | 10/h | FR-300 |

#### Audit

| Method | Path | Description | Auth Role | Rate Limit | FR Ref |
|--------|------|-------------|-----------|------------|--------|
| GET | `/api/v1/audit` | Query audit log (filtered by entity, actor, date range) | Admin, PM* | 30/min | FR-108 |
| GET | `/api/v1/audit/entity/:type/:id` | Get audit trail for specific entity | Admin, PM*, Dev* | 60/min | FR-108 |

#### Config

| Method | Path | Description | Auth Role | Rate Limit | FR Ref |
|--------|------|-------------|-----------|------------|--------|
| GET | `/api/v1/config` | Get all tenant config values | Admin | 30/min | FR-109 |
| PATCH | `/api/v1/config/:key` | Update config value | Admin | 20/h | FR-109 |

#### Auth

| Method | Path | Description | Auth Role | Rate Limit | FR Ref |
|--------|------|-------------|-----------|------------|--------|
| POST | `/api/v1/auth/login` | Password login | Public | 10/min | FR-103 |
| POST | `/api/v1/auth/refresh` | Refresh access token | Authenticated | 30/min | FR-103 |
| POST | `/api/v1/auth/logout` | Revoke session | Authenticated | 30/min | FR-103 |
| POST | `/api/v1/auth/forgot-password` | Request password reset | Public | 5/min | FR-103 |
| POST | `/api/v1/auth/reset-password` | Reset password with token | Public | 5/min | FR-103 |
| POST | `/api/v1/auth/mfa/setup` | Initialize MFA setup | Authenticated | 5/h | FR-801 |
| POST | `/api/v1/auth/mfa/verify` | Verify MFA code | Authenticated | 10/min | FR-801 |
| POST | `/api/v1/auth/sso/:provider` | Initiate SSO flow | Public | 20/min | FR-800 |
| POST | `/api/v1/auth/sso/:provider/callback` | SSO callback | Public | 20/min | FR-800 |

#### Portal (R2)

| Method | Path | Description | Auth Role | Rate Limit | FR Ref |
|--------|------|-------------|-----------|------------|--------|
| GET | `/api/v1/portal/projects` | List client's projects (projected view) | Client | 60/min | FR-1301 |
| GET | `/api/v1/portal/projects/:id` | Get project detail (projected) | Client | 60/min | FR-1301 |
| GET | `/api/v1/portal/projects/:id/milestones` | Get project milestones | Client | 60/min | FR-1301 |
| GET | `/api/v1/portal/projects/:id/updates` | Get AI-generated narratives | Client | 30/min | FR-1303 |
| POST | `/api/v1/portal/query` | Client NL query (projected data only) | Client | 20/min | FR-1305 |
| POST | `/api/v1/portal/projects/:id/comments` | Add client comment | Client | 50/h | FR-1302 |

#### Admin

| Method | Path | Description | Auth Role | Rate Limit | FR Ref |
|--------|------|-------------|-----------|------------|--------|
| GET | `/api/v1/admin/tenants` | List all tenants (super admin) | Site Admin | 30/min | FR-104 |
| POST | `/api/v1/admin/tenants` | Create tenant | Site Admin | 10/h | FR-1300 |
| GET | `/api/v1/admin/tenants/:id` | Get tenant detail | Site Admin | 30/min | FR-1300 |
| PATCH | `/api/v1/admin/tenants/:id` | Update tenant (plan, settings) | Site Admin | 20/h | FR-1300 |
| GET | `/api/v1/admin/ai/dashboard` | AI observability metrics | Site Admin | 30/min | FR-402 |
| GET | `/api/v1/admin/ai/shadow` | Shadow mode results dashboard | Site Admin | 30/min | FR-302 |

#### Checklists (R0)

| Method | Path | Description | Auth Role | Rate Limit | FR Ref |
|--------|------|-------------|-----------|------------|--------|
| POST | `/api/v1/tasks/:id/checklists` | Create checklist on task | Admin, Dev*, PM* | 100/h | FR-2000 |
| GET | `/api/v1/tasks/:id/checklists` | List checklists for task | Admin, Dev*, PM* | 120/min | FR-2000 |
| PATCH | `/api/v1/checklists/:id` | Update checklist (rename, reorder) | Admin, Dev*, PM* | 100/h | FR-2000 |
| DELETE | `/api/v1/checklists/:id` | Delete checklist | Admin, Dev*, PM* | 50/h | FR-2000 |
| POST | `/api/v1/checklists/:id/items` | Add item to checklist | Admin, Dev*, PM* | 200/h | FR-2000 |
| PATCH | `/api/v1/checklists/:checklistId/items/:itemId` | Update item (text, completion) | Admin, Dev*, PM* | 200/h | FR-2000 |
| DELETE | `/api/v1/checklists/:checklistId/items/:itemId` | Delete checklist item | Admin, Dev*, PM* | 100/h | FR-2000 |

#### Mentions (R0)

| Method | Path | Description | Auth Role | Rate Limit | FR Ref |
|--------|------|-------------|-----------|------------|--------|
| GET | `/api/v1/users/me/mentions` | List mentions for current user | Any (non-client) | 60/min | FR-2004 |

#### Custom Fields (R1)

| Method | Path | Description | Auth Role | Rate Limit | FR Ref |
|--------|------|-------------|-----------|------------|--------|
| POST | `/api/v1/custom-fields` | Create custom field definition | Admin, PM | 50/h | FR-2005 |
| GET | `/api/v1/custom-fields` | List custom field definitions (tenant/project scoped) | Admin, Dev*, PM* | 120/min | FR-2005 |
| PATCH | `/api/v1/custom-fields/:id` | Update field definition | Admin, PM | 50/h | FR-2005 |
| DELETE | `/api/v1/custom-fields/:id` | Delete field definition | Admin | 20/h | FR-2005 |
| PATCH | `/api/v1/tasks/:id/custom-fields` | Set custom field values on task | Admin, Dev*, PM* | 200/h | FR-2005 |

#### Notifications (R1)

| Method | Path | Description | Auth Role | Rate Limit | FR Ref |
|--------|------|-------------|-----------|------------|--------|
| GET | `/api/v1/notifications` | List notifications (paginated, filterable by type) | Any | 120/min | FR-2007 |
| PATCH | `/api/v1/notifications/:id/read` | Mark notification as read | Any | 200/h | FR-2007 |
| PATCH | `/api/v1/notifications/read-all` | Mark all notifications as read | Any | 20/h | FR-2007 |
| GET | `/api/v1/notifications/preferences` | Get notification preferences | Any | 30/min | FR-2007 |
| PUT | `/api/v1/notifications/preferences` | Update notification preferences | Any | 20/h | FR-2007 |

#### Action Items (R1)

| Method | Path | Description | Auth Role | Rate Limit | FR Ref |
|--------|------|-------------|-----------|------------|--------|
| PATCH | `/api/v1/comments/:id/assign` | Assign comment as action item | Admin, Dev*, PM* | 100/h | FR-2008 |
| GET | `/api/v1/users/me/action-items` | List pending action items for current user | Any (non-client) | 60/min | FR-2008 |

#### Reminders (R1)

| Method | Path | Description | Auth Role | Rate Limit | FR Ref |
|--------|------|-------------|-----------|------------|--------|
| POST | `/api/v1/tasks/:id/reminders` | Create reminder on task | Admin, Dev*, PM* | 100/h | FR-2014 |
| GET | `/api/v1/users/me/reminders` | List upcoming reminders for current user | Any (non-client) | 60/min | FR-2014 |
| DELETE | `/api/v1/reminders/:id` | Delete reminder | Any (own only) | 50/h | FR-2014 |

#### Saved Views (R1)

| Method | Path | Description | Auth Role | Rate Limit | FR Ref |
|--------|------|-------------|-----------|------------|--------|
| POST | `/api/v1/views` | Create saved view | Admin, Dev*, PM* | 50/h | FR-2003 |
| GET | `/api/v1/views` | List saved views (user's own + shared) | Admin, Dev*, PM* | 120/min | FR-2003 |
| PATCH | `/api/v1/views/:id` | Update saved view | Any (own only) | 50/h | FR-2003 |
| DELETE | `/api/v1/views/:id` | Delete saved view | Any (own only) | 50/h | FR-2003 |

#### Goals & OKRs (R2)

| Method | Path | Description | Auth Role | Rate Limit | FR Ref |
|--------|------|-------------|-----------|------------|--------|
| POST | `/api/v1/goals` | Create goal/objective/key result | Admin, PM | 50/h | FR-2006 |
| GET | `/api/v1/goals` | List goals (filterable by type, status, owner) | Admin, Dev*, PM* | 120/min | FR-2006 |
| GET | `/api/v1/goals/:id` | Get goal detail with children and linked tasks | Admin, Dev*, PM* | 120/min | FR-2006 |
| PATCH | `/api/v1/goals/:id` | Update goal | Admin, PM | 50/h | FR-2006 |
| DELETE | `/api/v1/goals/:id` | Delete goal | Admin, PM | 20/h | FR-2006 |
| POST | `/api/v1/goals/:id/link` | Link task to goal | Admin, PM* | 100/h | FR-2006 |
| DELETE | `/api/v1/goals/:id/link/:taskId` | Unlink task from goal | Admin, PM* | 100/h | FR-2006 |
| GET | `/api/v1/goals/:id/progress` | Get auto-calculated goal progress | Admin, Dev*, PM* | 60/min | FR-2006 |

#### Automations (R2)

| Method | Path | Description | Auth Role | Rate Limit | FR Ref |
|--------|------|-------------|-----------|------------|--------|
| POST | `/api/v1/automations` | Create automation rule | Admin, PM | 50/h | FR-2009 |
| GET | `/api/v1/automations` | List automation rules | Admin, PM | 120/min | FR-2009 |
| PATCH | `/api/v1/automations/:id` | Update automation rule | Admin, PM | 50/h | FR-2009 |
| DELETE | `/api/v1/automations/:id` | Delete automation rule | Admin, PM | 20/h | FR-2009 |
| GET | `/api/v1/automations/logs` | Get automation execution history | Admin, PM | 60/min | FR-2009 |

#### Forms (R2)

| Method | Path | Description | Auth Role | Rate Limit | FR Ref |
|--------|------|-------------|-----------|------------|--------|
| POST | `/api/v1/forms` | Create form | Admin, PM | 50/h | FR-2010 |
| GET | `/api/v1/forms` | List forms | Admin, PM | 120/min | FR-2010 |
| PATCH | `/api/v1/forms/:id` | Update form | Admin, PM | 50/h | FR-2010 |
| DELETE | `/api/v1/forms/:id` | Delete form | Admin, PM | 20/h | FR-2010 |
| POST | `/api/v1/forms/:slug/submit` | Submit form (public, no auth for published) | Public | 30/min | FR-2010 |
| GET | `/api/v1/forms/:id/submissions` | List form submissions | Admin, PM | 60/min | FR-2010 |

#### Documents (R2)

| Method | Path | Description | Auth Role | Rate Limit | FR Ref |
|--------|------|-------------|-----------|------------|--------|
| POST | `/api/v1/documents` | Create document | Admin, Dev*, PM* | 100/h | FR-2012 |
| GET | `/api/v1/documents` | List documents (filterable by project, status) | Admin, Dev*, PM* | 120/min | FR-2012 |
| GET | `/api/v1/documents/:id` | Get document content | Admin, Dev*, PM*, Client** | 120/min | FR-2012 |
| PATCH | `/api/v1/documents/:id` | Update document | Admin, Dev*, PM* | 100/h | FR-2012 |
| DELETE | `/api/v1/documents/:id` | Soft-delete document | Admin, PM* | 50/h | FR-2012 |

#### AI Writing Assistant (R2)

| Method | Path | Description | Auth Role | Rate Limit | FR Ref |
|--------|------|-------------|-----------|------------|--------|
| POST | `/api/v1/ai/write` | Generate/improve content (streaming) | Admin, Dev*, PM* | 30/min | FR-2013 |

> `*` = scoped to assigned projects. `**` = scoped to client's tenant, client-visible content only.

---

## 18. Appendices

### 18.1 Event Schema Catalog Summary

| Event Subject | Payload Key Fields | Consumers |
|---------------|-------------------|-----------|
| `pm.tasks.created` | task_id, project_id, title, status, priority, ai_generated | audit-writer, ai-adaptive, embedding-pipeline, projection-updater |
| `pm.tasks.updated` | task_id, changed_fields | audit-writer, embedding-pipeline, projection-updater |
| `pm.tasks.status_changed` | task_id, old_status, new_status | audit-writer, ai-adaptive, escalation-monitor, notification-router |
| `pm.tasks.assigned` | task_id, assignee_ids, assigner_id | audit-writer, notification-router |
| `pm.tasks.completed` | task_id, project_id, actual_effort | audit-writer, ai-adaptive, ai-summarizer |
| `pm.tasks.dependency_resolved` | task_id, resolved_dependency_ids | ai-adaptive, notification-router |
| `pm.tasks.dependency_blocked` | task_id, blocking_task_id | escalation-monitor, notification-router |
| `pm.projects.created` | project_id, name, created_by | audit-writer, embedding-pipeline |
| `pm.projects.updated` | project_id, changed_fields | audit-writer, embedding-pipeline |
| `pm.projects.phase_changed` | project_id, phase_id, action (added/removed/reordered) | audit-writer |
| `pm.projects.baseline_set` | project_id, baseline_snapshot_hash | scope-creep-detector |
| `pm.comments.created` | comment_id, task_id, author_id, client_visible | embedding-pipeline, notification-router |
| `pm.comments.updated` | comment_id, old_content_hash | embedding-pipeline |
| `pm.comments.deleted` | comment_id | embedding-pipeline |
| `pm.ai.action_proposed` | ai_action_id, capability, confidence, disposition | cost-tracker, traceability, evaluation-harness |
| `pm.ai.action_approved` | ai_action_id, reviewed_by | audit-writer, traceability |
| `pm.ai.action_rejected` | ai_action_id, reviewed_by, notes | traceability, evaluation-harness |
| `pm.ai.action_executed` | ai_action_id, capability, actions_taken | audit-writer, cost-tracker |
| `pm.ai.confidence_low` | ai_action_id, capability, confidence_score | evaluation-harness |
| `pm.integrations.git_commit` | commit_sha, repository, author, linked_task_ids | ai-adaptive |
| `pm.integrations.git_pr_merged` | pr_number, branch, linked_task_ids | task-module (auto-complete) |
| `pm.integrations.slack_message` | channel, user, content_hash | ai-adaptive |
| `pm.integrations.calendar_updated` | user_id, availability_blocks | resource-optimizer |
| `pm.system.config_changed` | tenant_id, config_key | config-cache-invalidation |
| `pm.system.tenant_created` | tenant_id, name, plan | audit-writer |
| `pm.system.user_invited` | user_id, tenant_id, role | notification-router |
| `pm.tasks.checklist_updated` | task_id, checklist_id, action (item_added/completed/deleted) | audit-writer, notification-generator |
| `pm.tasks.recurrence_triggered` | task_id, recurrence_parent_id, recurrence_rule | recurrence-scheduler |
| `pm.tasks.custom_field_updated` | task_id, field_definition_id, old_value, new_value | audit-writer, automation-engine, embedding-pipeline |
| `pm.comments.mention_created` | comment_id, mentioned_user_id, mentioner_id | notification-generator |
| `pm.comments.action_assigned` | comment_id, assigned_to, assigner_id | notification-generator |
| `pm.notifications.created` | notification_id, user_id, type, entity_type, entity_id | notification-router (delivery) |
| `pm.reminders.due` | reminder_id, task_id, user_id, message | notification-generator |
| `pm.goals.progress_updated` | goal_id, old_progress, new_progress, status | notification-generator, audit-writer |
| `pm.goals.at_risk` | goal_id, reason, linked_task_count | notification-generator |
| `pm.automations.triggered` | rule_id, trigger_event, matched_entity_id | audit-writer |
| `pm.automations.executed` | rule_id, action_type, affected_entity_ids | audit-writer, cost-tracker |
| `pm.forms.submitted` | form_id, created_task_id, submitter_info | notification-generator, audit-writer |
| `pm.documents.created` | document_id, project_id, title, author_id | embedding-pipeline, notification-generator |
| `pm.documents.updated` | document_id, changed_fields | embedding-pipeline |

### 18.2 DDL Reference Summary

| Table | Row Count Estimate (R3) | Partitioned | RLS | Key Indexes |
|-------|------------------------|-------------|-----|-------------|
| tenants | ~10 | No | No (queried by super admin) | slug (unique) |
| users | ~200 | No | Yes | (tenant_id, email), (tenant_id, role) |
| projects | ~100 | No | Yes | (tenant_id, name), (tenant_id, status) |
| phases | ~500 | No | Yes | (tenant_id, project_id, name) |
| tasks | ~100K | No (evaluate at 500K) | Yes | (tenant_id, project_id), (tenant_id, status), (tenant_id, due_date), GIN(search_vector) |
| task_assignments | ~150K | No | Yes | (tenant_id, user_id), (task_id) |
| task_dependencies | ~50K | No | Yes | (tenant_id, task_id), (tenant_id, blocked_by_task_id) |
| comments | ~200K | No | Yes | (tenant_id, task_id), GIN(search_vector) |
| tags | ~500 | No | Yes | (tenant_id, name) |
| task_tags | ~300K | No | Yes | (tenant_id, tag_id) |
| ai_actions | ~50K | No (evaluate at 100K) | Yes | (tenant_id, capability), (tenant_id, status), (tenant_id, created_at) |
| ai_cost_log | ~100K | No | Yes | (tenant_id, month), (tenant_id, capability) |
| audit_log | ~1M+ | Yes (monthly) | Yes | (tenant_id, entity_type, entity_id), (tenant_id, created_at) |
| tenant_configs | ~100 | No | Yes | (tenant_id, config_key) |
| embeddings | ~500K | No | Yes | IVFFlat(embedding), (tenant_id, entity_type, entity_id) |
| task_checklists | ~50K | No | Yes | (tenant_id, task_id) |
| checklist_items | ~200K | No | Yes | (tenant_id, checklist_id) |
| mentions | ~100K | No | Yes | (tenant_id, mentioned_user_id), (tenant_id, comment_id) |
| custom_field_definitions | ~1K | No | Yes | (tenant_id, project_id), unique(tenant_id, project_id, name) |
| custom_field_values | ~500K | No | Yes | unique(tenant_id, field_definition_id, task_id), (tenant_id, task_id) |
| saved_views | ~2K | No | Yes | (tenant_id, user_id), (tenant_id, project_id) |
| goals | ~1K | No | Yes | (tenant_id, status), (tenant_id, parent_goal_id), (tenant_id, owner_id) |
| goal_task_links | ~10K | No | Yes | (tenant_id, task_id) |
| notifications | ~500K | No (evaluate at 1M) | Yes | (tenant_id, user_id, is_read, created_at), (tenant_id, entity_type, entity_id) |
| notification_preferences | ~2K | No | Yes | (tenant_id, user_id), unique(user_id, notification_type, channel) |
| automation_rules | ~500 | No | Yes | (tenant_id, is_active), (tenant_id, trigger_event, is_active) |
| forms | ~200 | No | Yes | (tenant_id, project_id), unique(public_slug) |
| documents | ~10K | No | Yes | (tenant_id, project_id, status), GIN(search_vector), (tenant_id, author_id) |
| reminders | ~20K | No | Yes | (remind_at, is_sent) partial, (tenant_id, user_id), (tenant_id, task_id) |

### 18.3 Prompt Template Example

```yaml
# packages/prompts/wbs-generator/v1.0.yaml
metadata:
  capability: wbs-generator
  version: "1.0"
  model: claude-opus-4
  max_input_tokens: 5000
  max_output_tokens: 3000
  schema: schemas/wbs-output.json
  domain: software_delivery
  author: ai-team
  reviewed_by: tech-lead
  last_updated: "2026-02-15"

system_prompt: |
  You are an expert project manager specializing in software delivery projects.
  Your task is to generate a detailed Work Breakdown Structure (WBS) from a
  natural language project description.

  ## Domain Expertise: Software Delivery
  You understand sprint-based development, agile methodologies, CI/CD pipelines,
  code review workflows, QA processes, and deployment strategies.

  ## Historical Context from This Organization
  {{#if rag_results}}
  Similar past projects in this organization:
  {{#each rag_results}}
  - **{{this.project_name}}**: {{this.summary}}
    - Duration: {{this.actual_duration_weeks}} weeks
    - Team size: {{this.team_size}}
    - Key insight: {{this.key_learning}}
  {{/each}}
  {{/if}}

  ## Estimation Calibration
  {{#if estimation_context}}
  Based on this organization's historical data:
  {{estimation_context}}
  {{else}}
  No historical estimation data available. Use industry standard estimates.
  {{/if}}

  ## Output Requirements
  Return a valid JSON object matching the WBS schema:
  - Phases: logical project phases with clear boundaries
  - Tasks: specific, actionable items within each phase
  - Dependencies: identify task ordering constraints
  - Effort estimates: in hours, realistic based on context
  - Confidence notes: areas of uncertainty or risk

  Be specific, not generic. Reference the project description details.
  If information is insufficient, note gaps in confidence_notes.

user_prompt: |
  ## Project Description
  {{project_description}}

  {{#if additional_context}}
  ## Additional Context
  {{additional_context}}
  {{/if}}

  Generate the WBS now. Return only valid JSON.

output_schema:
  type: object
  required: [project_name, phases, suggested_timeline_weeks, confidence_notes]
  properties:
    project_name:
      type: string
    phases:
      type: array
      items:
        type: object
        required: [name, order, tasks]
        properties:
          name: { type: string }
          order: { type: integer }
          tasks:
            type: array
            items:
              type: object
              required: [title, estimated_effort_hours, priority]
              properties:
                title: { type: string }
                description: { type: string }
                estimated_effort_hours: { type: number, minimum: 0.5 }
                priority: { type: string, enum: [low, medium, high, critical] }
                dependencies: { type: array, items: { type: string } }
                sub_tasks:
                  type: array
                  items:
                    type: object
                    properties:
                      title: { type: string }
                      estimated_effort_hours: { type: number }
    suggested_timeline_weeks: { type: integer, minimum: 1 }
    confidence_notes: { type: array, items: { type: string } }
```

### 18.4 Release-Feature-FR Cross-Reference

| Release | Features | FR Range | Key Deliverables |
|---------|----------|----------|-----------------|
| R0 (Mo 1-3) | F-001 to F-026 | FR-100 to FR-503 | Event bus, tenant model, core schema, auth, RBAC, NL→WBS, What's Next, NL query, shadow mode, autonomy policy, AI traceability, task/project UI |
| R1 (Mo 4-6) | F-027 to F-053 | FR-600 to FR-1202 | Adaptive engine, AI PM agent, risk prediction, scope creep, Git/Slack/Calendar integrations, SSO/MFA, projection layer, SOC 2 prep, tags, search, visualizations |
| R2 (Mo 7-9) | F-054 to F-073 | FR-1300 to FR-1606 | Multi-tenancy live, client portal, client role, billing, API layer, webhooks, SOC 2 Type I, AI guardrails, predictive dating, sprint planning |
| R3 (Mo 10-12) | F-074 to F-088 | FR-1700 to FR-1803 | Per-tenant learning, estimation engine, template intelligence, SOW generator, PM role, SOC 2 Type II, Kanban/Gantt views |

---

*AI-Native PM Tool -- Technical Design Document v1.0 -- February 2026 -- Aligned to Architecture v3.0 and Product Roadmap v2*
