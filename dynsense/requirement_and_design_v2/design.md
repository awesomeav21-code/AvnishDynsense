# AI-Native PM Tool — Technical Design Document

> **Version:** 1.1
> **Date:** February 10, 2026
> **Status:** Draft
> **Authors:** Engineering Team
> **Aligned to:** Architecture v3.1, Product Roadmap v2.2, UI/UX Design System (ui-ux-design.md)

---

## Changelog from v1.0

| Change | v1.0 | v1.1 |
|--------|------|------|
| Architecture reference | v3.0 | v3.1 |
| Roadmap reference | v2 | v2.2 |
| Application modules | 8 | 14 (+Notification, Goals, Automation, Forms, Documents, Views) |
| NATS streams | 6 | 12 |
| Durable consumers | 8 | 11 |
| DDL tables | ~16 | 30 (full CREATE TABLE statements) |
| API endpoints | ~35 | ~85 across 15 modules |
| AI capabilities | 9 | 10 (+AI Writing Assistant F-102) |
| Feature count | 88 | 103 (15 ClickUp gap features) |
| UI/UX reference | None | ui-ux-design.md (21 wireframes, design tokens) |
| Feature promotions | — | Kanban R3->R1, Gantt R3->R2, Templates R3->R1 |

---

## 1. Introduction

### 1.1 Purpose

This document provides the comprehensive technical design for the AI-Native PM Tool — a project management platform where the AI runs the project and the human supervises. It translates the system architecture (v3.1) and product roadmap (v2.2, 103 features across R0-R3) into implementable specifications covering all ten architectural tiers, database schemas, API contracts, event flows, and deployment configurations.

### 1.2 References

| Document | Description |
|----------|-------------|
| `requirements.md` | Functional (FR-xxx) and non-functional (NFR-xxx) requirements |
| `architecture-v3.1.md` | System architecture v3.1 — 10-tier design, 12 Mermaid diagrams, 30 tables, 12 streams, 11 consumers, ~85 endpoints, ADRs |
| `roadmap-v2.md` | Product roadmap v2.2 — 103 features (F-001 through F-103), release gates |
| `ui-ux-design.md` | UI/UX system design — 21 ASCII wireframes, 6 Mermaid diagrams, design tokens, component architecture |

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
| FR-1900–FR-1901 | Visualization (Promoted) | F-087 (->R1), F-088 (->R2) |
| FR-2000–FR-2014 | ClickUp Gap Features | F-089 through F-103 |

---

## 2. Architecture Overview

### 2.1 Architecture Principles

Seven principles govern every decision in this design. They resolve all tensions between speed-to-ship and long-term scalability.

| # | Principle | Implication |
|---|-----------|-------------|
| 1 | **AWS-managed over self-managed** | ECS Fargate over Kubernetes. RDS over self-hosted PostgreSQL. ElastiCache over self-managed Redis. A 5-person team cannot operate a Kubernetes cluster and build an AI product simultaneously. |
| 2 | **Monorepo, modular monolith, not microservices** | One deployable API service with well-separated internal modules (14 modules at v3.1). Split into services only when independently scaling AI workers is required (R1+). |
| 3 | **Event-driven from day 1, but start simple** | NATS JetStream for the event bus — lighter than Kafka, persistent with replay. Every state mutation emits an event. Every AI capability consumes events. 12 streams, 11 consumers. |
| 4 | **Single database, stretched intelligently** | PostgreSQL 16 with pgvector for relational + vector in one engine. RLS for tenant isolation. JSONB for flexible fields. 30 tables with full DDL. |
| 5 | **AI is a first-class infrastructure concern** | The AI engine has its own orchestration pipeline, cost tracking, autonomy policies, traceability, evaluation harness, and circuit breakers — all from R0. 10 AI capabilities across R0-R3. |
| 6 | **Security is structural, not aspirational** | `tenant_id` on every table from day 1. RLS enforced at the database layer on all 30 tables. Immutable audit trail. SOC 2 controls built into the architecture. |
| 7 | **Evergreen means building the R3 data model in R0** | The schema, event streams, and AI pipeline support per-tenant learning, client projection, and enterprise isolation from day 1 — even if those features ship in R2-R3. |

### 2.2 10-Tier Architecture Diagram

```
+============================================================================+
|  TIER 1: CLIENT LAYER                                                       |
|  Next.js 15 App Router | (internal) routes | (portal) routes | Slack Bot   |
|  Views: List, Board(R1), Calendar(R1), Table(R1), Gantt(R2), Timeline(R1)  |
|  Notification Inbox(R1) | Goals Dashboard(R2) | Docs/KB(R2)               |
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
|  TIER 3: APPLICATION SERVICES (Fastify Modular Monolith — 14 Modules)      |
|  Project | Task | Dependency | Comment | Audit | User | Projection | Config|
|  + Notification | Goals | Automation | Forms | Documents | Views           |
+============================================================================+
          |                           |
          v                           v
+============================================================================+
|  TIER 4: AI ENGINE                                                          |
|  Orchestrator (7-stage) | 10 Capabilities | Shared Infra (Gateway, RAG)   |
|  + AI Writing Assistant (F-102, R2)                                        |
+============================================================================+
          |                           |
          v                           v
+============================================================================+
|  TIER 5: EVENT BUS                                                          |
|  NATS JetStream (3-node) | 12 Streams | 11 Durable Consumers | DLQ        |
+============================================================================+
          |
          v
+============================================================================+
|  TIER 6: DATABASE                                                           |
|  PostgreSQL 16 + pgvector (30 tables) | Redis 7 (ElastiCache) | S3        |
+============================================================================+
          |
+============================================================================+
|  TIER 7: INTEGRATION GATEWAY                                                |
|  Git Adapter | Slack Adapter | Calendar Adapter | Webhooks | Jira Import   |
+============================================================================+

+============================================================================+
|  TIER 8: SECURITY & AI SAFETY                                               |
|  Encryption (AES-256/TLS 1.3) | RLS (30 tables) | Secrets Mgr | PII      |
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
| 1 | Client Layer | Next.js 15, RSC, Shadcn UI | R0 | FR-500-503, FR-201, FR-203, FR-1900-1901, FR-2002-2003 |
| 2 | Gateway & Auth | ALB + WAF, JWT RS256, RBAC | R0 | FR-103, FR-104, FR-800-802 |
| 3 | Application Services | Fastify 5, Drizzle ORM, 14 modules | R0 | FR-102, FR-105-109, FR-900, FR-2000-2014 |
| 4 | AI Engine | Claude Opus 4 / Sonnet 4.5, 7-stage pipeline | R0 | FR-200-203, FR-300-305, FR-600-607, FR-2013 |
| 5 | Event Bus | NATS JetStream 2.10+, 12 streams, 11 consumers | R0 | FR-100 |
| 6 | Database | PostgreSQL 16, pgvector, 30 tables | R0 | FR-101, FR-102, NFR-100-103 |
| 7 | Integration Gateway | Fastify plugins, OAuth 2.0 | R1 | FR-700-702 |
| 8 | Security & AI Safety | KMS, RLS (30 tables), Secrets Manager | R0 | FR-800-802, NFR-200-205 |
| 9 | Deployment & CI/CD | ECS Fargate, CDK, GitHub Actions | R0 | NFR-300-303 |
| 10 | Monitoring & Observability | CloudWatch, X-Ray, Sentry | R0 | FR-400-402 |

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
| **Rationale** | Kafka is overprovisioned for 11 consumers and <10K events/day (requires ZooKeeper/KRaft, broker tuning, partition rebalancing). Redis Streams lack replay durability. SQS lacks fan-out patterns. NATS JetStream provides persistence, replay, consumer groups, and dead letter queues with dramatically lower operational complexity. |
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

**v1.1 note:** No new ADRs were required. All 15 gap features (F-089 through F-103) are absorbed by existing architectural decisions — they use the same NATS event bus, PostgreSQL storage, RLS isolation, and AI orchestration pipeline. This validates Principle #7 (Evergreen architecture).

---

## 4. Monorepo Structure

### 4.1 Directory Layout

```
ai-pm-tool/
+-- apps/
|   +-- web/                        # Next.js 15 (internal + portal)
|   |   +-- app/
|   |   |   +-- (internal)/         # Internal PM routes
|   |   |   |   +-- dashboard/
|   |   |   |   +-- projects/
|   |   |   |   +-- tasks/
|   |   |   |   +-- ai-review/
|   |   |   |   +-- notifications/  # NEW v1.1: notification inbox
|   |   |   |   +-- goals/          # NEW v1.1: goals & OKR dashboard
|   |   |   |   +-- documents/      # NEW v1.1: docs & knowledge base
|   |   |   |   +-- settings/
|   |   |   +-- (portal)/           # Client portal routes (R2)
|   |   |   |   +-- [tenantSlug]/
|   |   |   |   |   +-- overview/
|   |   |   |   |   +-- milestones/
|   |   |   |   |   +-- queries/
|   |   |   +-- api/                # Next.js API routes (BFF pattern)
|   |   +-- components/
|   |   |   +-- ui/                 # Shadcn UI primitives
|   |   |   +-- ai/                 # AI review, What's Next, NL Query
|   |   |   +-- projects/
|   |   |   +-- tasks/
|   |   |   +-- views/              # NEW v1.1: board, calendar, table, gantt
|   |   |   +-- notifications/      # NEW v1.1: inbox, preferences
|   |   |   +-- goals/              # NEW v1.1: goal tree, progress
|   |   |   +-- documents/          # NEW v1.1: markdown editor, list
|   |   |   +-- forms/              # NEW v1.1: form builder, preview
|   |   |   +-- layout/
|   |   +-- lib/
|   |   +-- styles/
|   +-- api/                        # Fastify API server
|   |   +-- src/
|   |   |   +-- modules/
|   |   |   |   +-- project/        # routes/ services/ repositories/ types/ events/
|   |   |   |   +-- task/
|   |   |   |   +-- dependency/
|   |   |   |   +-- comment/
|   |   |   |   +-- audit/
|   |   |   |   +-- user/
|   |   |   |   +-- projection/
|   |   |   |   +-- config/
|   |   |   |   +-- notification/   # NEW v1.1
|   |   |   |   +-- goals/          # NEW v1.1
|   |   |   |   +-- automation/     # NEW v1.1
|   |   |   |   +-- forms/          # NEW v1.1
|   |   |   |   +-- documents/      # NEW v1.1
|   |   |   |   +-- views/          # NEW v1.1
|   |   |   +-- ai/
|   |   |   |   +-- orchestrator/   # 7-stage pipeline
|   |   |   |   +-- capabilities/
|   |   |   |   |   +-- wbs-generator/
|   |   |   |   |   +-- whats-next/
|   |   |   |   |   +-- nl-query/
|   |   |   |   |   +-- summary/
|   |   |   |   |   +-- risk-predictor/
|   |   |   |   |   +-- pm-agent/
|   |   |   |   |   +-- scope-creep/
|   |   |   |   |   +-- writing-assistant/  # NEW v1.1
|   |   |   |   +-- gateway/        # LLM Gateway + circuit breaker
|   |   |   |   +-- context/        # Context assembly + RAG
|   |   |   |   +-- evaluation/     # Eval harness
|   |   |   |   +-- traceability/   # AI action logging
|   |   |   +-- events/             # NATS producers + consumers
|   |   |   +-- integrations/       # Git, Slack, Calendar adapters
|   |   |   +-- auth/               # Authentication + RBAC
|   |   |   +-- common/             # Middleware, error handling, logging
|   |   +-- Dockerfile
|   |   +-- package.json
|   +-- ai-worker/                  # R1+: Separate ECS service
|       +-- src/
|           +-- agent-loop/         # AI PM Agent 15-min cycle
|           +-- consumers/          # NATS event consumers for AI
|           +-- scheduled/          # Cron-triggered AI jobs
+-- packages/
|   +-- shared/                     # Shared types, validators, constants
|   |   +-- types/                  # TypeScript interfaces
|   |   +-- validators/             # Zod schemas (API + web)
|   |   +-- constants/              # Status labels, priorities, event subjects
|   +-- db/                         # Drizzle schema + migrations (30 tables)
|   |   +-- schema/
|   |   +-- migrations/
|   |   +-- seeds/
|   +-- prompts/                    # Versioned prompt templates
|       +-- wbs-generator/
|       |   +-- v1.0.yaml
|       |   +-- v1.1.yaml
|       +-- nl-query/
|       +-- summary/
|       +-- risk-predictor/
|       +-- writing-assistant/      # NEW v1.1
+-- infra/                          # AWS CDK
|   +-- lib/
|   |   +-- vpc-stack.ts
|   |   +-- database-stack.ts
|   |   +-- compute-stack.ts
|   |   +-- monitoring-stack.ts
|   |   +-- pipeline-stack.ts
|   +-- bin/
|       +-- app.ts
+-- tests/
|   +-- integration/
|   +-- ai-evaluation/              # Golden test sets
|   +-- load/
+-- turbo.json
+-- pnpm-workspace.yaml
+-- docker-compose.yml              # Local dev: PG, Redis, NATS
```

### 4.2 Package Boundaries

Each module in `apps/api/src/modules/` follows a strict internal structure:

```
modules/task/
+-- routes/              # Fastify route handlers (HTTP layer)
|   +-- task.routes.ts
|   +-- task.schemas.ts  # TypeBox request/response schemas
+-- services/            # Business logic (domain layer)
|   +-- task.service.ts
+-- repositories/        # Database access (data layer)
|   +-- task.repository.ts
+-- types/               # Module-specific TypeScript types
|   +-- task.types.ts
+-- events/              # NATS event producers
    +-- task.events.ts
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

> **Related FRs:** FR-500 (task detail view, F-023), FR-501 (project/task lists, F-024), FR-502 (sidebar nav, F-025), FR-503 (comments, F-026), FR-201 (What's Next, F-012), FR-203 (NL query, F-014), FR-301 (AI review UI, F-016), FR-1900 (Kanban, F-087), FR-1901 (Gantt, F-088), FR-2002 (Calendar, F-091), FR-2003 (Table, F-092)

### 5.1 Next.js 15 App Router with Route Groups

The frontend is a single Next.js 15 application using the App Router. Two route groups provide clean separation between the internal PM interface and the client-facing portal:

| Route Group | URL Pattern | Purpose | Release |
|-------------|-------------|---------|---------|
| `(internal)` | `/dashboard`, `/projects/*`, `/tasks/*`, `/ai-review/*`, `/notifications/*`, `/goals/*`, `/documents/*`, `/settings/*` | Primary PM interface for admins and developers | R0 |
| `(portal)` | `/portal/[tenantSlug]/*` | Client-facing portal consuming the projection layer | R2 |
| `api/` | `/api/*` | BFF (Backend for Frontend) routes proxying to Fastify API | R0 |

### 5.2 View Components

| Component | Technology | Release | Purpose | Feature Refs |
|-----------|-----------|---------|---------|-------------|
| **Web Application** | Next.js 15, App Router, RSC, TypeScript 5+ | R0 | Primary PM interface. AI review/approve UI, "What's Next" developer view, NL query panel, project dashboards. | F-016, F-012, F-014, F-023-026 |
| **List View** | React, Shadcn Table | R0 | Filterable/sortable task list with status, priority, assignee, phase columns. | F-024 |
| **Board View (Kanban)** | React, dnd-kit | R1 | Read-only Kanban board with AI annotations (blocked flags, priority). Drag-and-drop in R2. | F-087 (FR-1900) |
| **Calendar View** | React, custom calendar grid | R1 | Month/week/day views, tasks as colored chips by priority/status, drag to reschedule. | F-091 (FR-2002) |
| **Table View** | React, TanStack Table | R1 | Spreadsheet-like bulk editing: inline edit, column resize/reorder/hide, sort, saved views. | F-092 (FR-2003) |
| **Timeline View** | React, SVG-based | R1 | AI-annotated timeline: predicted delays flagged, at-risk milestones, resource conflicts. | F-052 |
| **Gantt Chart** | React, SVG-based | R2 | Full Gantt with AI overlays: critical path, predicted delays, dependency lines. | F-088 (FR-1901) |
| **Notification Inbox** | React, SSE/WebSocket | R1 | Bell icon with unread count, filter by type, click-through to source entity. | F-096 (FR-2007) |
| **Goals Dashboard** | React, Recharts | R2 | OKR tree view, auto-calculated progress from linked tasks, AI risk flags. | F-095 (FR-2006) |
| **Docs & Knowledge Base** | React, Markdown editor | R2 | Collaborative documents linked to projects, searchable, embeddable in RAG. | F-101 (FR-2012) |
| **Client Portal** | Next.js 15, `(portal)` route group | R2 | Client-facing view consuming projection layer. Filtered tasks, AI narratives, scoped NL queries. White-labelable. | F-055, F-059 |
| **Slack / Teams Bot** | Slack Bolt SDK / Teams Bot Framework | R1 | Slash commands, nudge delivery, daily summaries, risk alerts. | F-036 |
| **Public REST API** | Versioned `/api/v1/`, API key auth | R2 | External programmatic access with rate limiting, webhook subscriptions, OpenAPI 3.1. | F-063 |

### 5.3 Server vs Client Component Strategy

| Component Type | Use For | Examples |
|----------------|---------|---------|
| **Server Components** (default) | Data fetching, initial page render, SEO-critical content | Project list page, task detail page, dashboard layout |
| **Client Components** (`'use client'`) | Interactivity, real-time updates, form handling, AI streaming | NL Query panel (streaming), AI Review UI (bulk actions), task board (drag-drop), comment threads |
| **Server Actions** (`'use server'`) | Form submissions, mutations | Create project, approve AI action, update task status |

### 5.4 AI Review UI (FR-301, F-016)

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

### 5.5 What's Next View (FR-201, F-012)

Per-developer prioritized task list. The primary work-finding interface — replaces Kanban board as the default view.

**Design:**
- Ordered list of tasks ranked by: dependency resolution status, due date proximity, priority level
- Each item shows: task title, project name, priority badge, due date, blocking/blocked indicators, AI reasoning for rank position
- R0: pure algorithmic ranking (no LLM). R1: LLM-ranked with natural language explanations
- Quick actions: start task, mark complete, view dependencies, snooze (defer 24h)
- Auto-refreshes when task status changes (via WebSocket in R1, polling in R0)

**API endpoint:** `GET /api/v1/users/me/next` (see Section 17)

### 5.6 NL Query Panel (FR-203, F-014)

Conversational interface for asking questions about project state.

**Design:**
- Slide-out panel accessible from any page via `Cmd/Ctrl+K` shortcut
- Text input with typeahead suggestions for common queries
- Streaming response display (tokens appear as they arrive from Claude Sonnet)
- Response includes: answer text, source references (linked tasks/projects), confidence indicator
- Query history per user (last 20 queries, stored client-side)

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

### 5.7 Shadcn UI + Tailwind Integration

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
| **AWS ALB** | TLS 1.3 termination, HTTPS listener on 443, HTTP->HTTPS redirect on 80. Target groups: `web` (Next.js), `api` (Fastify). Path-based routing: `/api/*` -> API target group, `/*` -> Web target group. | R0 |
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
1. Authenticate    -> Verify JWT signature + expiry
2. Resolve tenant  -> Extract tenant_id from JWT claims
3. Set RLS context -> SET LOCAL app.current_tenant_id = '<tenant_id>'
4. Check role      -> Verify user role against required permission
5. Check scope     -> For project-scoped roles, verify user assignment to project
6. Execute handler -> Business logic runs with tenant-isolated DB context
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

## 7. Tier 3: Application Services (14 Modules)

> **Related FRs:** FR-102 (project CRUD, F-003), FR-105 (task lifecycle, F-006), FR-106 (dependencies, F-007), FR-107 (sub-tasks, F-008), FR-108 (audit trail, F-009), FR-503 (comments, F-026), FR-900 (projection, F-042), FR-2000-FR-2014 (ClickUp gap features)

One deployable Fastify API service with well-separated internal modules. Each module owns its domain logic, database queries, and event emissions. They share a process, a database connection pool, and a NATS client.

### 7.1 Module Architecture Pattern

Each module in the Fastify modular monolith follows a consistent internal structure:

```
module/
+-- routes/           # HTTP handlers — thin layer, delegates to services
|   +-- module.routes.ts    # Fastify route registrations
|   +-- module.schemas.ts   # TypeBox request/response schemas
+-- services/         # Business logic — domain rules, orchestration
|   +-- module.service.ts
+-- repositories/     # Database access — Drizzle queries, SQL
|   +-- module.repository.ts
+-- types/            # Module-specific TypeScript types
|   +-- module.types.ts
+-- events/           # NATS event producers — emits on state changes
    +-- module.events.ts
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

### 7.2 Module Catalog (14 Modules)

| Module | Release | Key Responsibilities | Feature Refs |
|--------|---------|---------------------|-------------|
| **Project** | R0 | Project CRUD, NL description storage, WBS baseline snapshots (JSONB), phase management, composite endpoints. | F-003, F-011 |
| **Task** | R0 | Full task lifecycle: configurable statuses, multiple assignees (junction table), effort tracking, `ai_generated` + `ai_confidence` flags, single-level sub-tasks, checklists (F-089), recurring tasks (F-090). | F-006, F-008, F-089, F-090 |
| **Dependency** | R0 | Finish-to-start relationships, circular dependency prevention via DAG traversal, auto blocked/unblocked propagation. | F-007 |
| **Comment** | R0 | Per-task threads, `client_visible` boolean, edit/delete with "edited" indicator, @mentions (F-093), action items (F-097). Feeds embedding pipeline for RAG. | F-026, F-093, F-097 |
| **Audit** | R0 | Immutable INSERT-only `audit_log`. Field-level diffs: `entity_type`, `entity_id`, `field_name`, `old_value`, `new_value`, `actor_type`, `actor_id`, `ai_action_id`. Partitioned monthly. | F-009 |
| **User** | R0 | Tenant-scoped user management, `/users/me/next` endpoint for AI-curated task prioritization, availability tracking, workload metrics. | F-004, F-012 |
| **Projection** | R0/R2 | Internal truth -> client-safe view transformation. Field-level redaction rules, narrative generation, approval workflow. Data layer, not UI filter. | F-042, F-055 |
| **Config** | R0 | Per-tenant settings: status labels, priority levels, AI confidence thresholds, autonomy policies. Redis-cached with NATS invalidation. | F-010 |
| **Notification** | R1 | Notification generator (from events), notification inbox API, user notification preferences (in-app/email/Slack), delivery routing. | F-096 (FR-2007) |
| **Goals** | R2 | Goal/Objective/Key Result CRUD, self-referencing hierarchy, goal-task links, auto-calculated progress, AI risk flagging. | F-095 (FR-2006) |
| **Automation** | R2 | User-configurable if-then rules. Trigger types: status_changed, assigned, due_soon, dependency_resolved, custom_field_changed. Action types: change_status, assign_user, add_tag, send_notification, trigger_webhook. | F-098 (FR-2009) |
| **Forms** | R2 | Form builder with drag-and-drop fields. Public shareable link (no auth). Submissions create tasks. Field types: text, number, date, select, multi-select, URL, email, checkbox. | F-099 (FR-2010) |
| **Documents** | R2 | Collaborative Markdown documents linked to projects. Draft/published/archived statuses. Indexed into pgvector for RAG. Client-visible flag for projection layer. | F-101 (FR-2012) |
| **Views** | R1 | Saved view configurations (list, board, calendar, table, timeline, gantt). Column configs, sort/filter state, default views per user per project. | F-092 (FR-2003) |

### 7.3 Project Module (FR-102, F-003; FR-200, F-011)

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

### 7.4 Task Module (FR-105, F-006; FR-107, F-008)

**Task lifecycle state machine:**

```
                    +---------------+
                    |   created     |
                    +-------+-------+
                            |
                            v
                    +---------------+
              +-----|  in_progress  |------+
              |     +-------+-------+     |
              |             |             |
              v             v             v
       +----------+ +---------------+ +----------+
       |  blocked  | |  in_review    | | cancelled|
       +----------+ +-------+-------+ +----------+
              |             |
              |             v
              |     +---------------+
              +---->|  completed    |
                    +---------------+

  Valid transitions:
    created     -> in_progress, cancelled
    in_progress -> in_review, blocked, cancelled
    blocked     -> in_progress (when dependency resolves)
    in_review   -> completed, in_progress (returned), cancelled
    completed   -> (terminal state)
    cancelled   -> (terminal state)
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

**Sub-tasks (FR-107, F-008):**
- Single-level nesting only (a sub-task cannot have its own sub-tasks)
- `parent_task_id` FK on the `tasks` table (nullable, self-referential)
- Parent rollup: parent task progress calculated from sub-task completion percentage
- Promote/demote: a sub-task can be promoted to a top-level task and vice versa

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
- `pm.tasks.status_changed` — on status transition
- `pm.tasks.assigned` — on assignment change
- `pm.tasks.completed` — on transition to completed status
- `pm.tasks.dependency_resolved` — when all blocking dependencies are satisfied
- `pm.tasks.dependency_blocked` — when a new blocking dependency is added
- `pm.tasks.checklist_updated` — on checklist item added/completed/deleted
- `pm.tasks.recurrence_triggered` — when recurring task schedule fires
- `pm.tasks.custom_field_updated` — on custom field value change

### 7.5 Dependency Module (FR-106, F-007)

**Relationship type:** Finish-to-start (FS) only in R0. Task B is blocked by Task A — B cannot start until A is completed.

**Circular dependency prevention:**
- Application-layer DAG traversal (not a DB trigger — more testable)
- On dependency creation: traverse the dependency graph from the target task back to the source
- If the source is reachable from the target, the dependency would create a cycle — reject with 400 error

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
- The Task Module consumer listens for `pm.tasks.dependency_resolved` and transitions blocked tasks to `in_progress`

### 7.6 Comment Module (FR-503, F-026)

- Per-task comment threads (comments belong to a task)
- `client_visible: boolean` — determines whether the comment passes through the projection layer to the client portal
- Default: `client_visible = false` (internal comments are private by default)
- Edit/delete with "edited" indicator (`edited_at` timestamp, null if never edited)
- Soft delete: `deleted_at` timestamp, deleted comments show as "[deleted]" in the thread
- @mentions (FR-2004, F-093): reference users with `@username`, stored in `mentions` table, triggers notification
- Action items (FR-2008, F-097): comments can be assigned as action items with `assigned_to` and `action_status`

**RAG pipeline integration:**
- New comments emit `pm.comments.created` event
- The `embedding-pipeline` consumer generates an embedding for the comment text
- Embeddings stored in `embeddings` table with `entity_type = 'comment'`

### 7.7 Audit Module (FR-108, F-009)

**Immutable audit log — INSERT only, no UPDATE or DELETE grants.**

**Field-level diffs:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Tenant scope |
| `entity_type` | VARCHAR(50) | `task`, `project`, `phase`, `comment`, `user`, `config`, `goal`, `automation`, `document` |
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

**Partitioning:** Monthly partitioning when table exceeds 1M rows. Old partitions (>90 days) archived to S3 Glacier.

### 7.8 User Module (FR-103, F-004; FR-201, F-012)

**What's Next endpoint (FR-201, F-012):**

```typescript
// GET /api/v1/users/me/next
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

### 7.9 Projection Module (FR-900, F-042)

**Purpose:** Transform internal truth into client-safe views. This is a data layer, not a UI filter.

**Projection rules:**

| Entity | Internal Fields (hidden) | External Fields (visible) |
|--------|--------------------------|---------------------------|
| Task | `assignee_ids`, `actual_effort`, `ai_confidence`, `ai_generated`, internal comments, internal tags | `title`, `description` (sanitized), `status`, `priority`, `due_date`, `phase`, client-visible comments |
| Project | Resource allocation, internal risk flags, cost data, velocity metrics | `name`, `description`, phases, milestones, completion %, AI narratives |
| Comment | Comments with `client_visible = false` | Comments with `client_visible = true` |

### 7.10 Config Module (FR-109, F-010)

**Per-tenant configurable values:**

| Config Key | Type | Default | Description |
|------------|------|---------|-------------|
| `status_labels` | JSONB | `["created","in_progress","in_review","completed","cancelled","blocked"]` | Custom task status labels |
| `priority_levels` | JSONB | `["low","medium","high","critical"]` | Priority scale |
| `ai_confidence_threshold` | FLOAT | `0.6` | Minimum confidence for AI to proceed |
| `ai_autonomy_mode` | VARCHAR | `propose` | Default: shadow/propose/execute |
| `quiet_hours_start` | TIME | `18:00` | AI PM Agent quiet hours start |
| `quiet_hours_end` | TIME | `09:00` | AI PM Agent quiet hours end |
| `quiet_hours_timezone` | VARCHAR | `UTC` | Timezone for quiet hours |
| `max_nudges_per_task_per_day` | INT | `2` | Rate limit for AI nudges |
| `sso_config` | JSONB | `null` | SSO provider configuration |
| `mfa_required_roles` | JSONB | `[]` | Roles requiring MFA |
| `branding` | JSONB | `{}` | Portal branding (logo URL, colors) |

### 7.11 Notification Module (FR-2007, F-096) — NEW in v1.1

**Responsibilities:**
- Generate notification records from NATS events based on user preferences
- Serve notification inbox API (paginated, filterable by type/read status)
- Manage per-user per-type per-channel notification preferences
- Route notifications to delivery channels (in-app, email, Slack)

**Two-stage pipeline:**
1. **Generation:** `notification-generator` consumer creates notification records from events
2. **Delivery:** `notification-router` consumer pushes to channels (WebSocket/SSE, email, Slack)

**Batch grouping:** Multiple rapid events (e.g., 5 task assignments in 10 seconds) consolidated into a single notification.

### 7.12 Goals Module (FR-2006, F-095) — NEW in v1.1

**Responsibilities:**
- Goal/Objective/Key Result CRUD with self-referencing hierarchy
- Goal-to-task links via `goal_task_links` junction table
- Auto-calculated progress: `current_value = SUM(linked_completed) / SUM(linked_total) * target_value`
- AI integration: AI PM Agent flags goals at risk based on linked task velocity

**Events emitted:**
- `pm.goals.progress_updated` — when linked task completion changes goal progress
- `pm.goals.at_risk` — when AI determines goal is behind schedule

### 7.13 Automation Module (FR-2009, F-098) — NEW in v1.1

**Responsibilities:**
- CRUD for user-configurable if-then automation rules
- `automation-engine` consumer evaluates rules against incoming NATS events
- Execute matched actions (change status, assign user, add tag, send notification, trigger webhook)
- Log all executions for audit trail

**Trigger types:** `task_status_changed`, `task_assigned`, `task_due_soon`, `dependency_resolved`, `custom_field_changed`

**Action types:** `change_status`, `assign_user`, `add_tag`, `send_notification`, `set_priority`, `trigger_webhook`

### 7.14 Forms Module (FR-2010, F-099) — NEW in v1.1

**Responsibilities:**
- Form builder (field definitions stored as JSONB array)
- Public shareable link generation (`/forms/{public_slug}`, no auth required)
- Submissions create tasks in target project/phase with field mapping
- Notification sent to configured assignee on submission

**Field types:** text, number, date, select, multi-select, URL, email, checkbox

### 7.15 Documents Module (FR-2012, F-101) — NEW in v1.1

**Responsibilities:**
- Collaborative Markdown documents linked to projects
- Draft/published/archived lifecycle
- `client_visible` flag for projection layer
- Indexed into pgvector for RAG (AI can reference organizational knowledge)

**RAG integration:**
1. Document created/updated -> `pm.documents.created/updated` event
2. `embedding-pipeline` consumer generates embedding
3. NL Query Engine and WBS Generator retrieve relevant document content during context assembly

### 7.16 Views Module (FR-2003, F-092) — NEW in v1.1

**Responsibilities:**
- CRUD for saved view configurations
- View types: list, board, calendar, table, timeline, gantt
- Per-user per-project default views
- Configuration stored as JSONB: columns, sort order, filters, grouping rules

---

## 8. Tier 4: AI Engine

> **Related FRs:** FR-200 (NL to WBS, F-011), FR-201 (What's Next, F-012), FR-202 (summaries, F-013), FR-203 (NL query, F-014), FR-300 (autonomy policy, F-015), FR-301 (AI review UI, F-016), FR-302 (shadow mode, F-017), FR-303 (confidence thresholds, F-018), FR-304 (rollback, F-019), FR-305 (decision log, F-035), FR-400 (traceability, F-020), FR-401 (evaluation harness, F-021), FR-402 (runtime monitoring, F-022), FR-600–FR-607 (AI proactive ops), FR-2013 (AI writing assistant, F-102)

This is the product. Every other tier exists to feed data into and execute actions from this tier.

### 8.1 AI Orchestrator — 7-Stage Pipeline

All AI operations flow through a single orchestration pipeline. No AI capability calls the LLM directly.

```
1. TRIGGER        -> Event from NATS, user request from API, or scheduled job
2. AUTONOMY CHECK -> Policy engine determines: shadow, propose, or execute (F-015)
3. CONTEXT ASSEMBLY -> RAG retrieval + event history + domain template + token budget
                       + custom field data + document content (v1.1: expanded context)
4. CONFIDENCE CHECK -> Pre-flight: is context sufficient? Below threshold -> graceful degradation (F-018)
5. LLM CALL       -> Routed through LLM Gateway (model selection, retry, streaming)
6. POST-PROCESSING -> Parse structured output, validate against schema, extract actions
7. DISPOSITION     -> Shadow: log only. Propose: create proposal. Execute: apply + log.
```

**Stage details:**

| Stage | Input | Output | Key Logic |
|-------|-------|--------|-----------|
| 1. TRIGGER | NATS event, API request, or scheduled job | `{ trigger_id, capability, context_requirements }` | Parse incoming source, determine capability, generate unique trigger_id |
| 2. AUTONOMY CHECK | `{ trigger_id, capability, action_type, tenant_id }` | `{ disposition: 'shadow' / 'propose' / 'execute' }` | Load tenant policy, match action type, return disposition mode |
| 3. CONTEXT ASSEMBLY | `{ trigger_id, capability, context_requirements }` | `{ assembled_context, token_count, rag_results[], domain_template }` | RAG retrieval (pgvector, tenant-scoped, cosine similarity, top-k=10), event history, template selection, token budget enforcement |
| 4. CONFIDENCE CHECK | `{ assembled_context, capability_thresholds }` | `{ confidence_score, proceed: boolean, degradation_strategy? }` | Evaluate RAG quality, context completeness, data freshness. Threshold: 0.6 default. |
| 5. LLM CALL | `{ prompt, model, assembled_context, streaming }` | `{ raw_response, model_used, input_tokens, output_tokens, latency_ms }` | Model routing (Opus/Sonnet), retry with backoff (3 attempts), fallback chain, streaming for interactive |
| 6. POST-PROCESSING | `{ raw_response, expected_schema }` | `{ parsed_result, validation_status, actions[] }` | Parse JSON, validate schema, extract mutations. Retry once on validation failure. |
| 7. DISPOSITION | `{ parsed_result, actions[], disposition_mode }` | `{ ai_action_id, status }` | Shadow: log only. Propose: create proposal. Execute: apply + store rollback data. |

**v1.1 context assembly updates:**
- Custom field values (F-094) included in context for WBS generation, prioritization, NL queries
- Document content (F-101) embedded and retrievable via RAG
- Checklist data (F-089) included in task context for summary generation
- Goal/OKR data (F-095) available for portfolio-level AI operations

### 8.2 AI Capabilities (10)

| # | Capability | Model | Release | Token Profile | Feature Ref | Purpose |
|---|-----------|-------|---------|---------------|-------------|---------|
| 1 | **NL->WBS Generator** | Claude Opus 4 | R0 | ~5K in / ~3K out | F-011 (FR-200) | 5-stage sub-pipeline: domain detection -> template selection -> RAG enrichment -> Opus generation -> schema validation. **40%+ of R0 AI engineering time.** |
| 2 | **"What's Next" Engine** | Rules-based (R0) / Sonnet (R1) | R0 | ~1K in / ~500 out | F-012 (FR-201) | Per-developer task prioritization. R0: rules. R1: LLM-ranked with velocity context. |
| 3 | **NL Query Engine** | Claude Sonnet 4.5 | R0 | ~2K in / ~1K out | F-014 (FR-203) | Natural language questions about project state. Streaming SSE, p95 <8s. |
| 4 | **Summary Engine** | Claude Sonnet 4.5 | R0/R1 | ~3K in / ~1K out | F-013 (FR-202) | Daily summaries (R0), weekly status reports (R1), client narratives (R2). |
| 5 | **Risk Predictor** | Claude Opus 4 | R1 | ~4K in / ~2K out | F-030 (FR-603) | Pattern analysis: blockers, stalled tasks, dependency chain growth. Shadow mode first 2-4 weeks. |
| 6 | **AI PM Agent** | Claude Sonnet 4.5 | R1 | ~2K in / ~500 out/action | F-028 (FR-601) | Autonomous 15-min loop. Chases overdue updates via Slack DMs. Quiet hours + max 2 nudges/task/day. |
| 7 | **Scope Creep Detector** | Claude Sonnet 4.5 | R1 | ~3K in / ~1K out | F-034 (FR-607) | Monitors task additions vs original WBS baseline. Alerts when scope drifts >15%. |
| 8 | **SOW Generator** | Claude Opus 4 | R3 | ~8K in / ~5K out | F-083 (FR-1800) | Revenue-generating: generates SOW from historical delivery data. The consultancy killer feature. |
| 9 | **Per-Tenant Learning** | RAG enrichment | R3 | Variable | F-074 (FR-1700) | Tenant-scoped model contexts improving from delivery history. The moat. |
| 10 | **AI Writing Assistant** | Claude Sonnet 4.5 | R2 | ~2K in / ~1K out | F-102 (FR-2013) | Content generation: draft task descriptions from title, improve/expand text, generate meeting notes, translate technical -> business language. **New in v1.1.** |

**Model routing table:**

| Capability | Primary Model | Fallback | Justification |
|------------|--------------|----------|---------------|
| NL->WBS Generator | Claude Opus 4 | Claude Sonnet 4.5 | Generation quality critical |
| What's Next Engine | Rules-based (R0) / Sonnet (R1) | Rules-based | Latency sensitive |
| NL Query Engine | Claude Sonnet 4.5 | Cached response | Interactive, p95 <8s |
| Summary Engine | Claude Sonnet 4.5 | Template-based | High volume, cost sensitive |
| Risk Predictor | Claude Opus 4 | Log + skip | Accuracy critical |
| AI PM Agent | Claude Sonnet 4.5 | Log + skip | High frequency (15-min loop) |
| Scope Creep Detector | Claude Sonnet 4.5 | Percentage-based diff | Numeric comparison fallback |
| SOW Generator (R3) | Claude Opus 4 | None (queue + retry) | Revenue-critical |
| AI Writing Assistant | Claude Sonnet 4.5 | Template-based | Interactive, streaming |

### 8.3 Autonomy Policy Engine (FR-300, F-015)

**Three modes:**

| Mode | Data Modified? | User Visible? | Human Approval? | Use Case |
|------|---------------|---------------|-----------------|----------|
| `shadow` | No | Admin-only dashboard | No | Trust-building phase. AI runs but nothing happens. |
| `propose` | No (until approved) | AI Review UI | Yes, mandatory | Default for most actions. Human supervises. |
| `execute` | Yes, immediately | Post-hoc in activity feed | No (but logged) | Low-risk, high-confidence, tenant opted-in |

**Default:** Propose everything, execute nothing. Tenants opt into `execute` mode per action type as trust builds.

### 8.4 Shared AI Infrastructure

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Context Assembly Layer** | TypeScript module | Loads tenant data, pgvector similarity searches (cosine, top-k=10), event aggregation, domain template selection, token budget enforcement. **v1.1:** expanded to include custom fields, documents, checklists, goals. |
| **LLM Gateway** | TypeScript wrapping Anthropic SDK | Model routing, retry with exponential backoff (3 attempts: 1s, 2s, 4s), fallback chain (Opus -> Sonnet), streaming, per-tenant rate limiting. **Circuit breaker:** 5 failures -> 60s open -> cached/fallback. |
| **Prompt Registry** | Versioned YAML in `/prompts/` | Central prompt templates with Handlebars context injection. Schema validation. Version-pinned per capability. PR-reviewed like code. |
| **Evaluation Harness** | Golden test sets + CI | Automated quality checks on prompt version change. Tracks: acceptance rate (<60% triggers review), override rate (>40% = miscalibration), hallucination incidents. |
| **Traceability Pipeline** | `ai_actions` table + logs | Every AI action logged: trigger_event -> context_assembled -> prompt_hash -> model_output -> confidence_score -> disposition -> human_review -> rollback_data. |
| **Cost Tracker** | Redis counters + `ai_cost_log` table | Per-operation: tokens, USD cost, model, capability, tenant_id. Per-tenant monthly budget caps. Alerts at 80% and 100%. |

---

## 9. Tier 5: Event Bus (12 Streams, 11 Consumers)

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
| `pm.tasks` | `.created`, `.updated`, `.status_changed`, `.assigned`, `.completed`, `.dependency_resolved`, `.dependency_blocked`, `.checklist_updated`, `.recurrence_triggered`, `.custom_field_updated` | Task Module, Recurrence Scheduler | AI Adaptive, Audit Writer, Embedding Pipeline, Notification Generator, Projection Updater, Automation Engine |
| `pm.projects` | `.created`, `.updated`, `.phase_changed`, `.baseline_set` | Project Module | AI Summarizer, Embedding Pipeline, Scope Creep Detector |
| `pm.comments` | `.created`, `.updated`, `.deleted`, `.mention_created`, `.action_assigned` | Comment Module | Embedding Pipeline, Notification Generator, Automation Engine |
| `pm.ai` | `.action_proposed`, `.action_approved`, `.action_rejected`, `.action_executed`, `.confidence_low` | AI Orchestrator | Traceability Pipeline, Cost Tracker, Evaluation Harness |
| `pm.integrations` | `.git_commit`, `.git_pr_merged`, `.slack_message`, `.calendar_updated` | Integration Adapters | AI Adaptive, Task Module (auto-complete) |
| `pm.notifications` | `.created` | Notification Generator | Notification Router (delivery) |
| `pm.reminders` | `.due` | Reminder Scheduler | Notification Generator |
| `pm.goals` | `.progress_updated`, `.at_risk` | Goals Module | Notification Generator, AI Adaptive |
| `pm.automations` | `.triggered`, `.executed` | Automation Engine | Audit Writer, Cost Tracker |
| `pm.forms` | `.submitted` | Forms Module (public endpoint) | Task Module (creates task), Notification Generator |
| `pm.documents` | `.created`, `.updated` | Documents Module | Embedding Pipeline (RAG), Notification Generator |
| `pm.system` | `.config_changed`, `.tenant_created`, `.user_invited` | Config, User Modules | Config Cache Invalidation, Notification Router |

### 9.3 Durable Consumers (11)

| Consumer | Subscribes To | Purpose | Release |
|----------|--------------|---------|---------|
| `audit-writer` | `pm.tasks.*`, `pm.projects.*`, `pm.comments.*`, `pm.ai.*`, `pm.automations.*` | Writes immutable audit log entries for every state change | R0 |
| `ai-adaptive` | `pm.tasks.*`, `pm.integrations.*`, `pm.goals.*` | Feeds task state changes and git activity to adaptive engine | R0 (rules) / R1 (AI) |
| `ai-summarizer` | `pm.tasks.*`, `pm.projects.*`, `pm.comments.*` | Aggregates activity for daily/weekly summary generation | R0 |
| `embedding-pipeline` | `pm.tasks.created/updated`, `pm.comments.created`, `pm.projects.created`, `pm.documents.*` | Generates embeddings, stores in pgvector | R0 |
| `projection-updater` | `pm.tasks.*`, `pm.projects.*`, `pm.comments.*` | Updates client-facing projection views | R0 (model) / R2 (active) |
| `notification-router` | `pm.notifications.created`, `pm.system.*` | Routes notifications to channels (in-app, email, Slack) | R0 (in-app) / R1 (Slack) |
| `cost-tracker` | `pm.ai.*`, `pm.automations.*` | Tracks AI operation costs per tenant, updates Redis counters | R0 |
| `escalation-monitor` | `pm.tasks.status_changed`, `pm.tasks.dependency_blocked` | Monitors for escalation conditions (blocked >48h, overdue) | R1 |
| `notification-generator` | `pm.tasks.*`, `pm.comments.*`, `pm.ai.*`, `pm.reminders.*`, `pm.goals.*`, `pm.forms.*`, `pm.documents.*` | Creates notification records based on user preferences | R1 |
| `recurrence-scheduler` | `pm.tasks.recurrence_triggered` | Clones recurring tasks when schedule fires (iCal RRULE) | R1 |
| `automation-engine` | `pm.tasks.*`, `pm.comments.*` | Evaluates and executes user-defined automation rules | R2 |

### 9.4 TypeScript Event Schema

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
    affected_entities: { type: string; id: string }[];
    model_used: string;
    input_tokens: number;
    output_tokens: number;
    latency_ms: number;
  };
}
```

### 9.5 Dead Letter Queue (DLQ) Strategy

| Aspect | Configuration |
|--------|---------------|
| **Retry policy** | 3 retries with exponential backoff: 1s, 5s, 25s |
| **DLQ per consumer** | Each durable consumer has a dedicated DLQ stream (e.g., `dlq.audit-writer`) |
| **DLQ retention** | 7 days |
| **DLQ monitoring** | CloudWatch alarm on DLQ message count > 0 |
| **DLQ replay** | Manual replay via admin CLI tool |

### 9.6 Idempotency

All consumers implement idempotency using the event `id` field:

```typescript
async function processEvent(event: BaseEvent): Promise<void> {
  const key = `processed:${consumerName}:${event.id}`;
  const alreadyProcessed = await redis.get(key);
  if (alreadyProcessed) return; // skip duplicate

  await handleEvent(event);

  // Mark as processed (TTL: 7 days)
  await redis.set(key, '1', 'EX', 7 * 24 * 60 * 60);
}
```

---

## 10. Tier 6: Database (30 Tables)

> **Related FRs:** FR-101 (tenant-aware data model, F-002), FR-102 (core schema, F-003), FR-105 (task data model, F-006), FR-106 (dependencies, F-007), FR-108 (audit trail, F-009), NFR-100 (query performance), NFR-200 (tenant isolation)

### 10.1 Data Layer Components

| Component | AWS Service | Configuration | Purpose |
|-----------|-------------|---------------|---------|
| **PostgreSQL 16** | RDS (Multi-AZ) | R0: `db.r6g.large` (2 vCPU, 16 GB). R2: `db.r6g.xlarge` + read replica. | Primary relational store. 30 tables. `tenant_id` on every table. Strong FK constraints. JSONB for WBS baselines, AI metadata. Drizzle ORM. |
| **pgvector** | Co-located in RDS | `text-embedding-3-small` (1536 dimensions). IVFFlat index R0-R2, evaluate HNSW at R3. | Embeddings for tasks, comments, projects, documents. Co-located = SQL JOINs in RAG queries. |
| **Redis 7** | ElastiCache Serverless | AOF persistence + hourly snapshots. | Sessions, rate limiting, AI queues (BullMQ), presence, config cache, AI response cache. |
| **S3** | S3 Standard + Glacier | 4 buckets: `uploads`, `exports`, `reports`, `backups`. Versioning. Glacier >90 days. | File attachments, exports, report PDFs, DB backups. |
| **Full-Text Search** | PostgreSQL FTS | `tsvector` on tasks, projects, comments, documents. GIN indexes. | Search. Evaluate Elasticsearch at R3 if >500K documents. |

### 10.2 Complete Table Catalog (30 Tables)

| # | Table | FR Ref | Release | Key Purpose | Rows Estimate (R3) |
|---|-------|--------|---------|-------------|-------------------|
| 1 | `tenants` | FR-101 | R0 | Tenant definitions, plan, AI budget | ~10 |
| 2 | `users` | FR-103 | R0 | User accounts, roles, MFA, preferences | ~500 |
| 3 | `projects` | FR-102 | R0 | Projects, NL description, WBS baseline | ~200 |
| 4 | `phases` | FR-102 | R0 | Project phases, ordering | ~1,000 |
| 5 | `tasks` | FR-105 | R0 | Full task data model, AI metadata, recurrence | ~100,000 |
| 6 | `task_assignments` | FR-105 | R0 | Multi-assignee junction | ~150,000 |
| 7 | `task_dependencies` | FR-106 | R0 | Finish-to-start relationships | ~50,000 |
| 8 | `comments` | FR-503 | R0 | Task comments, client_visible, action items | ~200,000 |
| 9 | `tags` | FR-1000 | R1 | Default + custom tags per project/tenant | ~2,000 |
| 10 | `task_tags` | FR-1000 | R1 | Task-to-tag junction | ~300,000 |
| 11 | `ai_actions` | FR-400 | R0 | Full AI traceability chain | ~50,000 |
| 12 | `ai_cost_log` | FR-1000 | R0 | Per-operation token + cost tracking | ~100,000 |
| 13 | `audit_log` | FR-108 | R0 | Immutable, INSERT-only, monthly partitioned | ~2,000,000 |
| 14 | `tenant_configs` | FR-109 | R0 | Per-tenant key-value configuration | ~200 |
| 15 | `embeddings` | FR-200 | R0 | pgvector 1536-dim, IVFFlat indexed | ~500,000 |
| 16 | `task_checklists` | FR-2000 | R0 | Checklists within tasks | ~50,000 |
| 17 | `checklist_items` | FR-2000 | R0 | Individual checklist items | ~200,000 |
| 18 | `mentions` | FR-2004 | R0 | @mentions in comments | ~100,000 |
| 19 | `custom_field_definitions` | FR-2005 | R1 | Field schemas (text/number/date/select/formula) | ~500 |
| 20 | `custom_field_values` | FR-2005 | R1 | Polymorphic field values per task | ~500,000 |
| 21 | `saved_views` | FR-2003 | R1 | View configs (list/board/calendar/table/gantt/timeline) | ~2,000 |
| 22 | `goals` | FR-2006 | R2 | OKR hierarchy (goal/objective/key_result) | ~1,000 |
| 23 | `goal_task_links` | FR-2006 | R2 | Goal-to-task association | ~10,000 |
| 24 | `notifications` | FR-2007 | R1 | User notification records | ~1,000,000 |
| 25 | `notification_preferences` | FR-2007 | R1 | Per-user per-type per-channel preferences | ~5,000 |
| 26 | `automation_rules` | FR-2009 | R2 | If-then automation rule definitions | ~500 |
| 27 | `forms` | FR-2010 | R2 | Form definitions, public slugs, field schemas | ~200 |
| 28 | `documents` | FR-2012 | R2 | Markdown docs, draft/published/archived | ~5,000 |
| 29 | `reminders` | FR-2014 | R1 | Personal task reminders | ~20,000 |
| 30 | `tasks` (extended) | FR-2001/2008 | R1 | Added: `recurrence_rule`, `recurrence_parent_id`, `next_recurrence_at` | -- |

### 10.3 Complete DDL

#### 10.3.1 Tenants

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

#### 10.3.2 Users

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
CREATE UNIQUE INDEX idx_users_tenant_email ON users(tenant_id, email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_tenant_role ON users(tenant_id, role);
```

#### 10.3.3 Projects

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
CREATE UNIQUE INDEX idx_projects_tenant_name ON projects(tenant_id, name) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_tenant_status ON projects(tenant_id, status);
```

#### 10.3.4 Phases

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
CREATE UNIQUE INDEX idx_phases_tenant_project_name ON phases(tenant_id, project_id, name) WHERE deleted_at IS NULL;
CREATE INDEX idx_phases_tenant_project_order ON phases(tenant_id, project_id, sort_order);
```

#### 10.3.5 Tasks

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
  recurrence_rule   TEXT,                                    -- iCal RRULE (FR-2001)
  recurrence_parent_id UUID REFERENCES tasks(id),            -- (FR-2001)
  next_recurrence_at TIMESTAMPTZ,                            -- (FR-2001)
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
CREATE INDEX idx_tasks_recurrence ON tasks(next_recurrence_at) WHERE next_recurrence_at IS NOT NULL;
CREATE INDEX idx_tasks_recurrence_parent ON tasks(tenant_id, recurrence_parent_id) WHERE recurrence_parent_id IS NOT NULL;
```

#### 10.3.6 Task Assignments

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
CREATE UNIQUE INDEX idx_task_assignments_unique ON task_assignments(tenant_id, task_id, user_id, role);
CREATE INDEX idx_task_assignments_tenant_user ON task_assignments(tenant_id, user_id);
CREATE INDEX idx_task_assignments_task ON task_assignments(task_id);
```

#### 10.3.7 Task Dependencies

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
CREATE UNIQUE INDEX idx_task_deps_unique ON task_dependencies(tenant_id, task_id, blocked_by_task_id);
CREATE INDEX idx_task_deps_blocked_by ON task_dependencies(tenant_id, blocked_by_task_id);
```

#### 10.3.8 Comments

```sql
CREATE TABLE comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES users(id),
  content         TEXT NOT NULL,
  client_visible  BOOLEAN NOT NULL DEFAULT false,
  edited_at       TIMESTAMPTZ,
  assigned_to     UUID REFERENCES users(id),                 -- action items (FR-2008)
  is_action_item  BOOLEAN NOT NULL DEFAULT false,            -- (FR-2008)
  action_status   VARCHAR(20) CHECK (action_status IN ('pending','completed')),
  action_completed_at TIMESTAMPTZ,
  search_vector   TSVECTOR,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_comments_tenant_task ON comments(tenant_id, task_id);
CREATE INDEX idx_comments_search ON comments USING GIN(search_vector);
CREATE INDEX idx_comments_action_items ON comments(tenant_id, assigned_to, action_status) WHERE is_action_item = true;
```

#### 10.3.9 Tags

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
CREATE UNIQUE INDEX idx_tags_tenant_name ON tags(tenant_id, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'), name) WHERE deleted_at IS NULL;
```

#### 10.3.10 Task Tags

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

#### 10.3.11 AI Actions

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
  CONSTRAINT valid_status CHECK (status IN ('pending', 'shadow_logged', 'proposed', 'approved', 'rejected', 'executed', 'rolled_back', 'failed'))
);
CREATE INDEX idx_ai_actions_tenant_capability ON ai_actions(tenant_id, capability);
CREATE INDEX idx_ai_actions_tenant_status ON ai_actions(tenant_id, status);
CREATE INDEX idx_ai_actions_tenant_created ON ai_actions(tenant_id, created_at);
```

#### 10.3.12 AI Cost Log

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
CREATE INDEX idx_ai_cost_log_tenant_month ON ai_cost_log(tenant_id, date_trunc('month', created_at));
CREATE INDEX idx_ai_cost_log_tenant_capability ON ai_cost_log(tenant_id, capability);
```

#### 10.3.13 Audit Log

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
  -- NO updated_at — INSERT-only
  -- NO deleted_at — never deleted
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_log_2026_02 PARTITION OF audit_log FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE audit_log_2026_03 PARTITION OF audit_log FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE INDEX idx_audit_tenant_entity ON audit_log(tenant_id, entity_type, entity_id);
CREATE INDEX idx_audit_tenant_created ON audit_log(tenant_id, created_at);
CREATE INDEX idx_audit_actor ON audit_log(tenant_id, actor_type, actor_id);
CREATE INDEX idx_audit_ai_action ON audit_log(ai_action_id) WHERE ai_action_id IS NOT NULL;

REVOKE UPDATE, DELETE ON audit_log FROM app_user;
```

#### 10.3.14 Tenant Configs

```sql
CREATE TABLE tenant_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  config_key      VARCHAR(100) NOT NULL,
  config_value    JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_tenant_configs_key ON tenant_configs(tenant_id, config_key);
```

#### 10.3.15 Embeddings

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
CREATE INDEX idx_embeddings_tenant_entity ON embeddings(tenant_id, entity_type, entity_id);
CREATE UNIQUE INDEX idx_embeddings_content_hash ON embeddings(tenant_id, entity_type, entity_id, content_hash);
CREATE INDEX idx_embeddings_vector ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

#### 10.3.16 Task Checklists (FR-2000)

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
CREATE INDEX idx_task_checklists_task ON task_checklists(tenant_id, task_id);
```

#### 10.3.17 Checklist Items (FR-2000)

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
CREATE INDEX idx_checklist_items_checklist ON checklist_items(tenant_id, checklist_id);
```

#### 10.3.18 Mentions (FR-2004)

```sql
CREATE TABLE mentions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id      UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES users(id),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mentions_user ON mentions(tenant_id, mentioned_user_id);
CREATE INDEX idx_mentions_comment ON mentions(tenant_id, comment_id);
```

#### 10.3.19 Custom Field Definitions (FR-2005)

```sql
CREATE TABLE custom_field_definitions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  project_id      UUID REFERENCES projects(id),
  name            VARCHAR(255) NOT NULL,
  field_type      VARCHAR(20) NOT NULL CHECK (field_type IN ('text','number','date','select','multi_select','url','email','checkbox','formula')),
  options         JSONB DEFAULT '[]',
  formula_expression TEXT,
  is_required     BOOLEAN NOT NULL DEFAULT false,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_custom_field_defs_tenant ON custom_field_definitions(tenant_id, project_id);
CREATE UNIQUE INDEX idx_custom_field_defs_name ON custom_field_definitions(tenant_id, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid), name);
```

#### 10.3.20 Custom Field Values (FR-2005)

```sql
CREATE TABLE custom_field_values (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_definition_id UUID NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  value_text      TEXT,
  value_number    NUMERIC,
  value_date      TIMESTAMPTZ,
  value_json      JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_custom_field_values_unique ON custom_field_values(tenant_id, field_definition_id, task_id);
CREATE INDEX idx_custom_field_values_task ON custom_field_values(tenant_id, task_id);
```

#### 10.3.21 Saved Views (FR-2003)

```sql
CREATE TABLE saved_views (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  project_id      UUID REFERENCES projects(id),
  name            VARCHAR(255) NOT NULL,
  view_type       VARCHAR(20) NOT NULL CHECK (view_type IN ('list','board','calendar','table','gantt','timeline')),
  config          JSONB NOT NULL DEFAULT '{}',
  is_default      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_saved_views_user ON saved_views(tenant_id, user_id);
CREATE INDEX idx_saved_views_project ON saved_views(tenant_id, project_id);
```

#### 10.3.22 Goals (FR-2006)

```sql
CREATE TABLE goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  title           VARCHAR(500) NOT NULL,
  description     TEXT,
  goal_type       VARCHAR(20) NOT NULL CHECK (goal_type IN ('goal','objective','key_result')),
  parent_goal_id  UUID REFERENCES goals(id),
  target_value    NUMERIC,
  current_value   NUMERIC DEFAULT 0,
  unit            VARCHAR(50),
  status          VARCHAR(20) NOT NULL DEFAULT 'on_track' CHECK (status IN ('on_track','at_risk','behind','completed')),
  owner_id        UUID REFERENCES users(id),
  due_date        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_goals_tenant ON goals(tenant_id, status);
CREATE INDEX idx_goals_parent ON goals(tenant_id, parent_goal_id);
CREATE INDEX idx_goals_owner ON goals(tenant_id, owner_id);
```

#### 10.3.23 Goal-Task Links (FR-2006)

```sql
CREATE TABLE goal_task_links (
  goal_id         UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (goal_id, task_id)
);
CREATE INDEX idx_goal_task_links_task ON goal_task_links(tenant_id, task_id);
```

#### 10.3.24 Notifications (FR-2007)

```sql
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  type            VARCHAR(30) NOT NULL CHECK (type IN ('mention','assignment','status_change','comment','ai_action','reminder','escalation','due_soon')),
  title           VARCHAR(500) NOT NULL,
  body            TEXT,
  entity_type     VARCHAR(50),
  entity_id       UUID,
  is_read         BOOLEAN NOT NULL DEFAULT false,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(tenant_id, user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_entity ON notifications(tenant_id, entity_type, entity_id);
```

#### 10.3.25 Notification Preferences (FR-2007)

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
CREATE INDEX idx_notification_prefs_user ON notification_preferences(tenant_id, user_id);
```

#### 10.3.26 Automation Rules (FR-2009)

```sql
CREATE TABLE automation_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  project_id      UUID REFERENCES projects(id),
  name            VARCHAR(255) NOT NULL,
  trigger_event   VARCHAR(50) NOT NULL,
  trigger_conditions JSONB NOT NULL DEFAULT '{}',
  action_type     VARCHAR(50) NOT NULL,
  action_config   JSONB NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  run_count       INTEGER NOT NULL DEFAULT 0,
  last_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_automation_rules_tenant ON automation_rules(tenant_id, is_active);
CREATE INDEX idx_automation_rules_trigger ON automation_rules(tenant_id, trigger_event, is_active);
```

#### 10.3.27 Forms (FR-2010)

```sql
CREATE TABLE forms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  project_id      UUID REFERENCES projects(id),
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  fields          JSONB NOT NULL DEFAULT '[]',
  target_phase_id UUID REFERENCES phases(id),
  default_assignee_id UUID REFERENCES users(id),
  is_published    BOOLEAN NOT NULL DEFAULT false,
  public_slug     VARCHAR(100) UNIQUE,
  submission_count INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_forms_tenant ON forms(tenant_id, project_id);
CREATE UNIQUE INDEX idx_forms_slug ON forms(public_slug) WHERE public_slug IS NOT NULL;
```

#### 10.3.28 Documents (FR-2012)

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
CREATE INDEX idx_documents_tenant ON documents(tenant_id, project_id, status);
CREATE INDEX idx_documents_search ON documents USING GIN(search_vector);
CREATE INDEX idx_documents_author ON documents(tenant_id, author_id);
```

#### 10.3.29 Reminders (FR-2014)

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
CREATE INDEX idx_reminders_due ON reminders(remind_at, is_sent) WHERE is_sent = false;
CREATE INDEX idx_reminders_user ON reminders(tenant_id, user_id);
CREATE INDEX idx_reminders_task ON reminders(tenant_id, task_id);
```

### 10.4 Row-Level Security (RLS) Policies

All 29 tenant-scoped tables (all except `tenants` itself) have RLS policies:

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
-- Example:
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
-- Repeat for all 29 tables above
```

**Middleware:** `SET LOCAL app.current_tenant_id = '<tenant_id>'` per request from JWT claim. `SET LOCAL` scopes to current transaction.

### 10.5 Indexing Strategy

- `tenant_id` as first column in every composite index (tenant locality in B-tree)
- GIN indexes for `tsvector` full-text search
- IVFFlat for pgvector (R0-R2), evaluate HNSW at R3
- Partial indexes: `WHERE deleted_at IS NULL`, `WHERE ai_generated = true`, `WHERE is_sent = false`
- `audit_log` partitioned by month via `created_at`

### 10.6 Drizzle ORM Migration Strategy

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

### 10.7 JSONB Patterns

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
  -> Extract linked task IDs from branch name + PR body
  -> For each linked task:
    -> Check autonomy policy: is auto-complete allowed?
    -> If yes: transition task to 'completed', actor_type = 'integration'
    -> Emit: pm.tasks.completed, pm.tasks.status_changed
    -> If no: create AI proposal for task completion
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

**Data used by:** Resource Optimization Engine (FR-605, F-032) -- availability data informs workload balancing.

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
| At rest -- RDS | AES-256 | AWS KMS (automatic key rotation) |
| At rest -- S3 | AES-256 (SSE-S3 or SSE-KMS) | AWS KMS |
| At rest -- ElastiCache | AES-256 | ElastiCache encryption |
| In transit -- ALB to services | TLS 1.3 | ACM-managed certificates |
| In transit -- services to RDS | TLS 1.3 | RDS CA certificate |
| In transit -- services to ElastiCache | TLS 1.3 | ElastiCache in-transit encryption |
| In transit -- services to NATS | TLS 1.3 | Self-signed CA (internal) |
| JWT signing | RS256 | Asymmetric keypair in Secrets Manager |

### 12.2 Three-Layer Tenant Isolation

```
Layer 1: JWT Claims
  -> Every request carries tenant_id in JWT
  -> Verified at authentication middleware

Layer 2: Application Middleware
  -> SET LOCAL app.current_tenant_id = '<tenant_id_from_jwt>'
  -> Set before any database query executes

Layer 3: PostgreSQL RLS
  -> Every tenant-scoped table has RLS policy
  -> USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  -> Database physically cannot return rows from other tenants
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
+-- Public Subnets (2 AZs)
|   +-- 10.0.1.0/24 (AZ-a) -- ALB, NAT Gateway
|   +-- 10.0.2.0/24 (AZ-b) -- ALB, NAT Gateway
+-- Private Subnets (2 AZs)
|   +-- 10.0.10.0/24 (AZ-a) -- ECS tasks (API, Web, AI Worker, NATS)
|   +-- 10.0.20.0/24 (AZ-b) -- ECS tasks (replica)
+-- Isolated Subnets (2 AZs)
    +-- 10.0.100.0/24 (AZ-a) -- RDS primary, ElastiCache
    +-- 10.0.200.0/24 (AZ-b) -- RDS standby
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
  |
  +-- [Parallel] lint (ESLint + Prettier)
  +-- [Parallel] type-check (tsc --noEmit)
  +-- [Parallel] unit test (Vitest, coverage report)
  |
  +-- [Sequential after all parallel pass]
      |
      +-- integration test (testcontainers: PG, Redis, NATS)
      |
      +-- build (Turborepo: apps/api, apps/web, apps/ai-worker)
      |
      +-- Docker build + push to ECR
      |
      +-- Deploy to staging
      |   +-- Run smoke tests against staging
      |
      +-- [Manual gate] Approve production deploy
      |
      +-- Deploy to production
          +-- Rolling update (zero downtime)
          +-- Health check verification
          +-- Rollback on failure (automatic)
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
| Request latency (p50, p95, p99) | Fastify request hooks -> CloudWatch EMF | API Performance |
| Error rate (4xx, 5xx) | Fastify error handler -> CloudWatch | API Performance |
| Request throughput (req/s) | ALB metrics | API Performance |
| Task creation rate | NATS event counter | Business Metrics |
| Active users (DAU/WAU) | Application logs -> CloudWatch Insights | Business Metrics |

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
| AI operation latency (per capability) | `ai_actions.latency_ms` -> CloudWatch | p95 > 30s (WBS), p95 > 8s (query) |
| Token usage (input/output) | `ai_cost_log` -> CloudWatch | >80% of tenant budget |
| Cost per operation | `ai_cost_log` -> CloudWatch | Daily cost > 2x baseline |
| Confidence score distribution | `ai_actions.confidence_score` -> CloudWatch | Average < 0.5 |
| Acceptance rate | `ai_actions` (approved / total proposed) | <60% per capability |
| Circuit breaker state | LLM Gateway -> CloudWatch | State = OPEN |
| LLM API error rate | LLM Gateway -> CloudWatch | >10% of calls |

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

**Trace structure for NL-to-WBS flow:**
```
[API Request] POST /api/v1/projects/generate-wbs (total: 12.5s)
  +-- [Auth] JWT verification (2ms)
  +-- [RLS] Set tenant context (1ms)
  +-- [AI Orchestrator] Trigger (5ms)
  +-- [AI Orchestrator] Autonomy check (3ms)
  +-- [AI Orchestrator] Context assembly (450ms)
  |   +-- [DB] Load project data (25ms)
  |   +-- [pgvector] Similarity search (120ms)
  |   +-- [DB] Load event history (35ms)
  +-- [AI Orchestrator] Confidence check (2ms)
  +-- [LLM Gateway] Claude Opus call (11,200ms)
  +-- [AI Orchestrator] Post-processing (50ms)
  |   +-- [Validation] Schema check (5ms)
  +-- [AI Orchestrator] Disposition (15ms)
  |   +-- [DB] Insert ai_actions (10ms)
  +-- [NATS] Publish pm.ai.action_proposed (3ms)
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

### 15.1 Pattern 1 -- NL to WBS (Core Product Flow)

```
User                   Web App              API Gateway           Fastify API
  |                      |                     |                     |
  |  Describe project    |                     |                     |
  |  in natural lang.    |                     |                     |
  +--------------------->|                     |                     |
  |                      |  POST /api/v1/      |                     |
  |                      |  projects/:id/      |                     |
  |                      |  generate-wbs       |                     |
  |                      +------------------->|                     |
  |                      |                     |  Auth + tenant      |
  |                      |                     |  resolution         |
  |                      |                     +------------------->|
  |                      |                     |                     |
  |                      |                     |      AI Orchestrator
  |                      |                     |           |
  |                      |                     |   1. TRIGGER
  |                      |                     |   2. AUTONOMY CHECK
  |                      |                     |      -> mode: propose
  |                      |                     |   3. CONTEXT ASSEMBLY
  |                      |                     |      +-- pgvector: similar projects
  |                      |                     |      +-- Domain template: software_delivery
  |                      |                     |      +-- Token budget: 5K
  |                      |                     |   4. CONFIDENCE CHECK
  |                      |                     |      -> confidence: 0.82 (proceed)
  |                      |                     |   5. LLM CALL
  |                      |                     |      -> Claude Opus 4
  |                      |                     |      -> 4.2K input, 2.8K output
  |                      |                     |      -> latency: 11.2s
  |                      |                     |   6. POST-PROCESSING
  |                      |                     |      -> Parse JSON, validate schema
  |                      |                     |      -> Extract: 4 phases, 28 tasks
  |                      |                     |   7. DISPOSITION
  |                      |                     |      -> Create ai_action (proposed)
  |                      |                     |      -> Emit pm.ai.action_proposed
  |                      |                     |           |
  |                      |   WBS proposal      |<----------+
  |                      |<--------------------|
  |  AI Review screen    |                     |
  |<---------------------|                     |
  |                      |                     |
  |  [Approve]           |                     |
  +--------------------->|                     |
  |                      |  POST /api/v1/ai/   |
  |                      |  actions/:id/approve|
  |                      +------------------->|
  |                      |                     +------------------->|
  |                      |                     |  Task Module:       |
  |                      |                     |  bulk create tasks  |
  |                      |                     |  (28 tasks)         |
  |                      |                     |           |
  |                      |                     |  Events emitted:    |
  |                      |                     |  pm.ai.action_approved
  |                      |                     |  pm.tasks.created (x28)
  |                      |                     |  pm.projects.baseline_set
  |                      |                     |           |
  |                      |                     |  Consumers:         |
  |                      |                     |  audit-writer       |
  |                      |                     |  embedding-pipeline |
  |                      |                     |  projection-updater |
  |                      |   Success           |<----------+
  |                      |<--------------------|
  |  Project with WBS    |                     |
  |<---------------------|                     |
```

### 15.2 Pattern 2 -- AI PM Agent Loop

```
BullMQ Scheduler              AI Worker Service
  |                              |
  |  Every 15 minutes            |
  +----------------------------->|
  |                              |
  |                   FOR each tenant:
  |                     FOR each active project:
  |                              |
  |                   Query: overdue tasks
  |                   Query: stalled tasks (>48h no update)
  |                   Query: newly unblocked tasks
  |                              |
  |                   FOR each actionable item:
  |                              |
  |                   AI Orchestrator: TRIGGER
  |                   Autonomy Check:
  |                     nudge -> execute (if policy allows)
  |                     escalation -> propose
  |                              |
  |                   Check quiet hours:
  |                     IF in quiet hours -> queue for later
  |                     IF nudge count >= 2/task/day -> skip
  |                              |
  |                   Context Assembly:
  |                     task details + assignee + project context
  |                              |
  |                   LLM Call (Sonnet):
  |                     Generate contextual nudge message
  |                              |
  |                   DISPOSITION:
  |                     |
  |                     +-- Nudge (execute mode):
  |                     |     |
  |                     |     +-- Slack Adapter:
  |                     |           Send DM to assignee
  |                     |           "Hey @dev, your task 'Build API endpoint'
  |                     |            is 2 days overdue. The frontend team is
  |                     |            blocked waiting on this. Need help?"
  |                     |
  |                     +-- Escalation (propose mode):
  |                           Create ai_action (proposed)
  |                           PM sees in AI Review UI
  |                              |
  |                   Emit events:
  |                     pm.ai.action_executed (nudges)
  |                     pm.ai.action_proposed (escalations)
  |                              |
  |                   Log to ai_actions table:
  |                     capability: 'pm_agent'
  |                     model: 'claude-sonnet-4-5'
  |                     latency, tokens, cost
```

### 15.3 Pattern 3 -- Client Portal Query

```
Client                Portal UI            API Gateway           Fastify API
  |                     |                     |                     |
  | "When will Phase    |                     |                     |
  |  2 be done?"        |                     |                     |
  +------------------->|                     |                     |
  |                     |  POST /api/v1/      |                     |
  |                     |  portal/query       |                     |
  |                     +------------------->|                     |
  |                     |                     |  Auth: client JWT   |
  |                     |                     |  Role: client       |
  |                     |                     |  Scope: tenant only |
  |                     |                     +------------------->|
  |                     |                     |                     |
  |                     |                     |  AI Orchestrator:   |
  |                     |                     |  Context Assembly:  |
  |                     |                     |    RAG scoped to:   |
  |                     |                     |    - tenant_id      |
  |                     |                     |    - client_visible |
  |                     |                     |      = true ONLY    |
  |                     |                     |                     |
  |                     |                     |  LLM Call (Sonnet): |
  |                     |                     |    Answer from      |
  |                     |                     |    projected data   |
  |                     |                     |                     |
  |                     |                     |  Post-Processing:   |
  |                     |                     |    Redaction check: |
  |                     |                     |    verify no        |
  |                     |                     |    internal data    |
  |                     |                     |                     |
  |                     |                     |  Confidence > 0.8   |
  |                     |                     |  AND no sensitive?  |
  |                     |                     |    YES -> respond   |
  |                     |                     |    NO -> flag for PM|
  |                     |                     |                     |
  |                     |  Streaming response |<--------------------|
  |                     |<--------------------|                     |
  | "Phase 2 is on      |                     |                     |
  |  track for March 15.|                     |                     |
  |  3 of 8 milestones  |                     |                     |
  |  complete."         |                     |                     |
  |<--------------------|                     |                     |
```

### 15.4 Pattern 4 -- Git to Task Update Flow

```
Developer              GitHub                Integration Gateway     NATS Bus
  |                      |                        |                    |
  |  Merge PR            |                        |                    |
  |  (branch: feature/   |                        |                    |
  |   TASK-abc123)       |                        |                    |
  +--------------------->|                        |                    |
  |                      |  Webhook: PR merged    |                    |
  |                      +----------------------->|                    |
  |                      |                        |                    |
  |                      |  Git Adapter:          |                    |
  |                      |  1. Verify webhook sig |                    |
  |                      |  2. Parse branch name  |                    |
  |                      |     -> task_id: abc123 |                    |
  |                      |  3. Parse PR body      |                    |
  |                      |     -> additional links |                    |
  |                      |                        |                    |
  |                      |  Publish:              |                    |
  |                      |  pm.integrations.      |                    |
  |                      |  git_pr_merged         |                    |
  |                      |                        +------------------->|
  |                      |                        |                    |
  |                      |                        |    Consumers:      |
  |                      |                        |                    |
  |                      |                        |    Task Module:    |
  |                      |                        |    Check autonomy  |
  |                      |                        |    policy for      |
  |                      |                        |    auto-complete   |
  |                      |                        |      |             |
  |                      |                        |    IF allowed:     |
  |                      |                        |    task.status =   |
  |                      |                        |    'completed'     |
  |                      |                        |    actor_type =    |
  |                      |                        |    'integration'   |
  |                      |                        |      |             |
  |                      |                        |    Emit:           |
  |                      |                        |    pm.tasks.       |
  |                      |                        |    completed       |
  |                      |                        |    pm.tasks.       |
  |                      |                        |    status_changed  |
  |                      |                        |                    |
  |                      |                        |    Audit Writer:   |
  |                      |                        |    Log completion  |
  |                      |                        |    with git context|
```

### 15.5 Pattern 5 -- Daily Summary Generation

```
BullMQ Scheduler          AI Worker            NATS Bus            Slack Adapter
  |                          |                    |                     |
  |  Daily at 17:00 UTC      |                    |                     |
  +------------------------->|                    |                     |
  |                          |                    |                     |
  |               FOR each tenant:                |                     |
  |                 FOR each active project:       |                     |
  |                          |                    |                     |
  |               AI Orchestrator:                |                     |
  |                          |                    |                     |
  |               Context Assembly:               |                     |
  |                 - Tasks completed today        |                     |
  |                 - Tasks started today          |                     |
  |                 - Blockers encountered         |                     |
  |                 - Comments added               |                     |
  |                 - AI actions taken             |                     |
  |                 - Risks flagged                |                     |
  |                          |                    |                     |
  |               LLM Call (Sonnet):              |                     |
  |                 "Summarize today's activity    |                     |
  |                  in 4-6 sentences"             |                     |
  |                          |                    |                     |
  |               Autonomy Check:                 |                     |
  |                 daily_summary -> execute       |                     |
  |                          |                    |                     |
  |               Store summary in DB             |                     |
  |               Emit: pm.ai.action_executed     |                     |
  |                          +------------------>|                     |
  |                          |                    |                     |
  |                          |              Notification Router:        |
  |                          |                    +------------------->|
  |                          |                    |  Post to project    |
  |                          |                    |  Slack channel:     |
  |                          |                    |  "Daily Summary:    |
  |                          |                    |   3 tasks completed,|
  |                          |                    |   1 new blocker on  |
  |                          |                    |   API integration.  |
  |                          |                    |   Team velocity     |
  |                          |                    |   is on track."     |
```

### 15.6 Pattern 6 -- Risk Prediction Flow

```
NATS Event                     AI Worker (Escalation Monitor)
  |                                |
  | pm.tasks.status_changed        |
  | (task blocked for 72h+)        |
  +------------------------------->|
  |                                |
  |                    AI Orchestrator:
  |                                |
  |                    Autonomy Check:
  |                      risk_prediction -> shadow (first 2-4 weeks)
  |                                      -> propose (after validation)
  |                                |
  |                    Context Assembly:
  |                      - Blocked task details
  |                      - Dependency chain depth
  |                      - Historical blocker resolution times
  |                      - Assignee workload
  |                      - Project timeline impact
  |                      - Similar past incidents (RAG)
  |                                |
  |                    LLM Call (Opus):
  |                      Analyze risk pattern
  |                      Generate severity + mitigations
  |                                |
  |                    Output:
  |                      risk_type: 'blocker'
  |                      severity: 'high'
  |                      confidence: 0.78
  |                      description: "Task 'API Integration' has been
  |                        blocked for 72h. Historical data shows similar
  |                        blockers resolved in 48h average. Downstream
  |                        impact: 4 tasks blocked, milestone at risk."
  |                      mitigations:
  |                        - "Escalate to senior developer"
  |                        - "Consider alternative implementation"
  |                        - "Adjust milestone date by 3 days"
  |                                |
  |                    Disposition:
  |                      shadow -> log only (weeks 1-4)
  |                      propose -> PM reviews in AI Review UI (week 5+)
  |                                |
  |                    Emit: pm.ai.action_proposed
  |                      (or pm.ai.confidence_low if below threshold)
```

### 15.7 Pattern 7 -- Notification Pipeline (NEW in v1.1)

```
Task Module               NATS JetStream          notification-generator
  |                            |                          |
  | pm.tasks.assigned          |                          |
  +--------------------------->|                          |
  |                            |  pm.notifications stream |
  |                            +------------------------->|
  |                            |                          |
  |                            |  1. Load user prefs from DB
  |                            |  2. Check user wants in_app?
  |                            |     -> INSERT notifications row
  |                            |  3. Emit pm.notifications.created
  |                            |                          |
  |                            |                   notification-router
  |                            |                          |
  |                            |  Consume notification.created
  |                            |                          |
  |                            |  Route by channel:       |
  |                            |    in_app -> WebSocket push to client
  |                            |    email  -> SES send    |
  |                            |    slack  -> Slack API DM|
```

### 15.8 Pattern 8 -- Automation Execution (NEW in v1.1)

```
Any Module                NATS JetStream          automation-executor
  |                            |                          |
  | pm.tasks.status_changed    |                          |
  +--------------------------->|                          |
  |                            |  pm.automations stream   |
  |                            +------------------------->|
  |                            |                          |
  |                            |  1. Query automation_rules
  |                            |     WHERE trigger_event = 'task_status_changed'
  |                            |     AND is_active = true
  |                            |     AND tenant_id matches
  |                            |                          |
  |                            |  2. Evaluate trigger_conditions
  |                            |     (e.g., old_status='in_progress'
  |                            |      AND new_status='review')
  |                            |                          |
  |                            |  3. Execute action:
  |                            |     action_type='assign_user'
  |                            |     -> assign reviewer to task
  |                            |                          |
  |                            |  4. Update rule.run_count++
  |                            |  5. Emit pm.automations.executed
  |                            |  6. Log to audit trail
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

> **v1.1 note:** New consumers and modules (Notification, Goals, Automation, Forms, Documents, Views) add negligible compute cost since they run within existing ECS tasks. The primary cost increase comes from the AI Writing Assistant (F-102/FR-2013) token usage, estimated at $5-15/tenant/month additional.

### 16.2 AI Token Cost Model (Per Tenant Per Month)

| Tier | AI Ops/Month | Estimated Token Cost | Subscription Price | Gross Margin |
|------|-------------|---------------------|--------------------|--------------|
| Starter | ~500 | $8-15 | $29/mo | ~60-75% |
| Pro | ~2,000 | $25-50 | $99/mo | ~70-80% |
| Enterprise | ~5,000+ | $60-120 | $249+/mo | ~55-75% |

**Token cost breakdown per operation type:**

| Operation | Model | Input Tokens | Output Tokens | Estimated Cost |
|-----------|-------|-------------|---------------|----------------|
| NL-to-WBS generation | Opus 4 | ~5,000 | ~3,000 | $0.12-0.18 |
| NL query | Sonnet 4.5 | ~2,000 | ~1,000 | $0.01-0.02 |
| Daily summary | Sonnet 4.5 | ~3,000 | ~1,000 | $0.01-0.02 |
| Risk prediction | Opus 4 | ~4,000 | ~2,000 | $0.09-0.14 |
| PM Agent nudge | Sonnet 4.5 | ~2,000 | ~500 | $0.008-0.01 |
| Scope creep check | Sonnet 4.5 | ~3,000 | ~1,000 | $0.01-0.02 |
| AI Writing Assistant (NEW) | Sonnet 4.5 | ~2,000 | ~1,500 | $0.01-0.02 |
| SOW generation (R3) | Opus 4 | ~8,000 | ~5,000 | $0.20-0.30 |

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

### 17.3 Full Endpoint Catalog (~85 Endpoints)

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

> `*` = scoped to assigned projects. `**` = scoped to client's tenant, client-visible content only.

---

## 18. Appendices

### 18.1 Event Schema Catalog Summary (~40 Events)

| Event Subject | Payload Key Fields | Consumers |
|---------------|-------------------|-----------|
| `pm.tasks.created` | task_id, project_id, title, status, priority, ai_generated | audit-writer, ai-adaptive, embedding-pipeline, projection-updater |
| `pm.tasks.updated` | task_id, changed_fields | audit-writer, embedding-pipeline, projection-updater |
| `pm.tasks.status_changed` | task_id, old_status, new_status | audit-writer, ai-adaptive, escalation-monitor, notification-router, automation-executor |
| `pm.tasks.assigned` | task_id, assignee_ids, assigner_id | audit-writer, notification-router |
| `pm.tasks.completed` | task_id, project_id, actual_effort | audit-writer, ai-adaptive, ai-summarizer |
| `pm.tasks.dependency_resolved` | task_id, resolved_dependency_ids | ai-adaptive, notification-router |
| `pm.tasks.dependency_blocked` | task_id, blocking_task_id | escalation-monitor, notification-router |
| `pm.tasks.checklist_updated` | task_id, checklist_id, action (item_added/completed/deleted) | audit-writer, notification-generator |
| `pm.tasks.recurrence_triggered` | task_id, recurrence_parent_id, recurrence_rule | reminder-scheduler |
| `pm.tasks.custom_field_updated` | task_id, field_definition_id, old_value, new_value | audit-writer, automation-executor, embedding-pipeline |
| `pm.projects.created` | project_id, name, created_by | audit-writer, embedding-pipeline |
| `pm.projects.updated` | project_id, changed_fields | audit-writer, embedding-pipeline |
| `pm.projects.phase_changed` | project_id, phase_id, action (added/removed/reordered) | audit-writer |
| `pm.projects.baseline_set` | project_id, baseline_snapshot_hash | scope-creep-detector |
| `pm.comments.created` | comment_id, task_id, author_id, client_visible | embedding-pipeline, notification-router |
| `pm.comments.updated` | comment_id, old_content_hash | embedding-pipeline |
| `pm.comments.deleted` | comment_id | embedding-pipeline |
| `pm.comments.mention_created` | comment_id, mentioned_user_id, mentioner_id | notification-generator |
| `pm.comments.action_assigned` | comment_id, assigned_to, assigner_id | notification-generator |
| `pm.ai.action_proposed` | ai_action_id, capability, confidence, disposition | cost-tracker, traceability, evaluation-harness |
| `pm.ai.action_approved` | ai_action_id, reviewed_by | audit-writer, traceability |
| `pm.ai.action_rejected` | ai_action_id, reviewed_by, notes | traceability, evaluation-harness |
| `pm.ai.action_executed` | ai_action_id, capability, actions_taken | audit-writer, cost-tracker |
| `pm.ai.confidence_low` | ai_action_id, capability, confidence_score | evaluation-harness |
| `pm.notifications.created` | notification_id, user_id, type, entity_type, entity_id | notification-router (delivery) |
| `pm.reminders.due` | reminder_id, task_id, user_id, message | notification-generator |
| `pm.goals.progress_updated` | goal_id, old_progress, new_progress, status | notification-generator, audit-writer |
| `pm.goals.at_risk` | goal_id, reason, linked_task_count | notification-generator |
| `pm.automations.triggered` | rule_id, trigger_event, matched_entity_id | audit-writer |
| `pm.automations.executed` | rule_id, action_type, affected_entity_ids | audit-writer, cost-tracker |
| `pm.forms.submitted` | form_id, created_task_id, submitter_info | notification-generator, audit-writer |
| `pm.documents.created` | document_id, project_id, title, author_id | embedding-pipeline, notification-generator, document-indexer |
| `pm.documents.updated` | document_id, changed_fields | embedding-pipeline, document-indexer |
| `pm.integrations.git_commit` | commit_sha, repository, author, linked_task_ids | ai-adaptive |
| `pm.integrations.git_pr_merged` | pr_number, branch, linked_task_ids | task-module (auto-complete) |
| `pm.integrations.slack_message` | channel, user, content_hash | ai-adaptive |
| `pm.integrations.calendar_updated` | user_id, availability_blocks | resource-optimizer |
| `pm.system.config_changed` | tenant_id, config_key | config-cache-invalidation |
| `pm.system.tenant_created` | tenant_id, name, plan | audit-writer |
| `pm.system.user_invited` | user_id, tenant_id, role | notification-router |

### 18.2 DDL Reference Summary (30 Tables)

| # | Table | Row Count Estimate (R3) | Partitioned | RLS | Key Indexes |
|---|-------|------------------------|-------------|-----|-------------|
| 1 | tenants | ~10 | No | No (queried by super admin) | slug (unique) |
| 2 | users | ~200 | No | Yes | (tenant_id, email), (tenant_id, role) |
| 3 | projects | ~100 | No | Yes | (tenant_id, name), (tenant_id, status) |
| 4 | phases | ~500 | No | Yes | (tenant_id, project_id, name) |
| 5 | tasks | ~100K | No (evaluate at 500K) | Yes | (tenant_id, project_id), (tenant_id, status), (tenant_id, due_date), GIN(search_vector) |
| 6 | task_assignments | ~150K | No | Yes | (tenant_id, user_id), (task_id) |
| 7 | task_dependencies | ~50K | No | Yes | (tenant_id, task_id), (tenant_id, blocked_by_task_id) |
| 8 | comments | ~200K | No | Yes | (tenant_id, task_id), GIN(search_vector) |
| 9 | tags | ~500 | No | Yes | (tenant_id, name) |
| 10 | task_tags | ~300K | No | Yes | (tenant_id, tag_id) |
| 11 | ai_actions | ~50K | No (evaluate at 100K) | Yes | (tenant_id, capability), (tenant_id, status), (tenant_id, created_at) |
| 12 | ai_cost_log | ~100K | No | Yes | (tenant_id, month), (tenant_id, capability) |
| 13 | audit_log | ~1M+ | Yes (monthly) | Yes | (tenant_id, entity_type, entity_id), (tenant_id, created_at) |
| 14 | tenant_configs | ~100 | No | Yes | (tenant_id, config_key) |
| 15 | embeddings | ~500K | No | Yes | IVFFlat(embedding), (tenant_id, entity_type, entity_id) |
| 16 | task_checklists | ~50K | No | Yes | (tenant_id, task_id) |
| 17 | checklist_items | ~200K | No | Yes | (tenant_id, checklist_id) |
| 18 | mentions | ~100K | No | Yes | (tenant_id, mentioned_user_id), (tenant_id, comment_id) |
| 19 | custom_field_definitions | ~1K | No | Yes | (tenant_id, project_id), unique(tenant_id, project_id, name) |
| 20 | custom_field_values | ~500K | No | Yes | unique(tenant_id, field_definition_id, task_id), (tenant_id, task_id) |
| 21 | saved_views | ~2K | No | Yes | (tenant_id, user_id), (tenant_id, project_id) |
| 22 | goals | ~1K | No | Yes | (tenant_id, status), (tenant_id, parent_goal_id), (tenant_id, owner_id) |
| 23 | goal_task_links | ~10K | No | Yes | (tenant_id, task_id) |
| 24 | notifications | ~500K | No (evaluate at 1M) | Yes | (tenant_id, user_id, is_read, created_at), (tenant_id, entity_type, entity_id) |
| 25 | notification_preferences | ~2K | No | Yes | (tenant_id, user_id), unique(user_id, notification_type, channel) |
| 26 | automation_rules | ~500 | No | Yes | (tenant_id, is_active), (tenant_id, trigger_event, is_active) |
| 27 | forms | ~200 | No | Yes | (tenant_id, project_id), unique(public_slug) |
| 28 | documents | ~10K | No | Yes | (tenant_id, project_id, status), GIN(search_vector), (tenant_id, author_id) |
| 29 | reminders | ~20K | No | Yes | (remind_at, is_sent) partial, (tenant_id, user_id), (tenant_id, task_id) |
| 30 | tasks (extensions) | -- | -- | -- | (next_recurrence_at) partial, (tenant_id, recurrence_parent_id) partial; comments: (tenant_id, assigned_to, action_status) partial |

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
| R0 (Mo 1-3) | F-001 to F-026 | FR-100 to FR-503 | Event bus, tenant model, core schema (18 tables), auth, RBAC, NL-to-WBS, What's Next, NL query, shadow mode, autonomy policy, AI traceability, task/project UI, checklists, mentions |
| R1 (Mo 4-6) | F-027 to F-053 | FR-600 to FR-1202, FR-2003/2005/2007/2008/2014 | Adaptive engine, AI PM agent, risk prediction, scope creep, Git/Slack/Calendar integrations, SSO/MFA, projection layer, SOC 2 prep, tags, search, visualizations, notifications, saved views, custom fields, action items, reminders (+12 tables = 30 total) |
| R2 (Mo 7-9) | F-054 to F-073 | FR-1300 to FR-1606, FR-2006/2009/2010/2012/2013 | Multi-tenancy live, client portal, client role, billing, API layer, webhooks, SOC 2 Type I, AI guardrails, predictive dating, sprint planning, goals/OKRs, automations, forms, documents, AI writing assistant |
| R3 (Mo 10-12) | F-074 to F-088 | FR-1700 to FR-1803 | Per-tenant learning, estimation engine, template intelligence, SOW generator, PM role, SOC 2 Type II, Kanban/Gantt views |

### 18.5 Release-Architecture Alignment Matrix (NEW in v1.1)

| Tier | R0 (Months 1-3) | R1 (Months 4-6) | R2 (Months 7-9) | R3 (Months 10-12) |
|------|------------------|------------------|------------------|---------------------|
| **Client** | Web app (list view), AI review UI | + Board, Calendar, Table, Timeline views, Notification inbox, Slack bot | + Client portal, Gantt view, Goals dashboard, Docs/KB, Public API | Optional: enhanced views |
| **Gateway** | ALB + WAF, password auth, RBAC (Admin+Dev) | + SSO, MFA, WebSocket | + Client role | + PM role |
| **Application** | 8 modules (Project-Config) | + Notification, Views, Custom Fields (14 total) | + Goals, Automation, Forms, Documents | + Enterprise config |
| **AI Engine** | NL-to-WBS, What's Next (rules), NL Query, Shadow mode, Autonomy, Traceability | + Adaptive engine, AI PM Agent, Risk predictor, Scope creep, Summary (full) | + AI Writing Assistant, AI guardrails, Cost dashboard | + Per-tenant learning, SOW generator |
| **Event Bus** | 6 core streams, 8 consumers | + 6 new streams (12 total), + 3 new consumers (11 total) | No stream changes needed | Evaluate 5-node NATS |
| **Data** | 18 tables, PG 16 + pgvector, Redis, S3 | + 12 tables (30 total) | + Read replica | Evaluate schema isolation |
| **Integrations** | None | + Git, Slack/Teams | + Calendar, Webhooks, Jira import | + Additional providers |
| **Security** | RLS, encryption, audit trail | + SOC 2 controls | + PII scanning, prompt injection, SOC 2 Type I | + SOC 2 Type II |
| **Deployment** | ECS Fargate (2 tasks), CDK, CI/CD | + AI Worker separate service | + Auto-scaling | + Performance tuning |
| **Monitoring** | CloudWatch basics, Sentry | + X-Ray, AI dashboard | + Custom alerting | + Tenant-level monitoring |

### 18.6 Evergreen Architecture Validation (NEW in v1.1)

The ClickUp gap analysis (v1.0 to v1.1) added 15 features, 14 tables, 6 streams, and 3 consumers -- yet required **zero architectural changes**:

1. **New modules** (Notification, Goals, Automation, Forms, Documents, Views) follow the identical module pattern as the original 8. No new patterns invented.

2. **New NATS streams** (6) use the same JetStream configuration, DLQ strategy, and idempotency patterns. No new infrastructure components.

3. **New tables** (14) follow existing conventions: `tenant_id` first column, RLS policies, soft deletes, Drizzle ORM schema. No schema design pattern changes.

4. **New consumers** (3) -- `reminder-scheduler`, `automation-executor`, `document-indexer` -- plug into the existing consumer framework.

5. **AI Writing Assistant** (F-102/FR-2013) is a new capability that plugs into the existing AI Orchestrator 7-stage pipeline with its own prompt templates and context requirements.

6. **Custom fields** (F-094/FR-2005) use a polymorphic storage pattern that the existing JSONB infrastructure already supports.

This validates Architecture Principle #7: **the R0 schema supports R3 features**. The gap features are absorbed, not architecturally accommodated. The event bus decouples everything. Adding a new module or consumer requires zero changes to existing producers.

---

*AI-Native PM Tool -- Technical Design Document v1.1 -- February 10, 2026 -- Aligned to Architecture v3.1 and Product Roadmap v2.2*
