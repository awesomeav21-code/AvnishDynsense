# DynSense — System Architecture v1.0

> **Version:** 1.0
> **Date:** March 2026
> **Status:** Approved for Implementation
> **Cost Target:** $119-147/month (61-69% reduction from original plan)

---

## Executive Summary

DynSense is an AI-native project management platform designed for internal use at DynPro. The system supports 3 teams (~25 users) with AI-powered features including natural language project setup, intelligent task prioritization, and natural language querying.

This architecture optimizes for:
- **Cost efficiency:** 60%+ infrastructure cost reduction
- **SOC 2 compliance:** Security and audit controls from day 1
- **Scalability:** Architecture supports future growth to external clients
- **Developer experience:** Simple, maintainable stack

### Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Deployment** | Single ECS Fargate container | 25 users don't need multi-container complexity |
| **Database** | Single-AZ RDS PostgreSQL 16 | Cost savings with automated backups, sufficient for internal use |
| **Event Bus** | PostgreSQL LISTEN/NOTIFY | Saves $60/mo, eliminates NATS operational overhead |
| **AI Provider** | AWS Bedrock (Opus + Sonnet) | SOC 2 compliance (data stays in AWS), integrated monitoring |
| **AI Architecture** | Claude Agent SDK + MCP servers | Standardized multi-agent orchestration |
| **Caching** | Redis Serverless | Auto-scales, pay-per-use model |
| **Frontend Hosting** | S3 + CloudFront (static) | Lower cost than container-based hosting |

---

## 1. Infrastructure Overview

### 1.1 AWS Services

| Service | Configuration | Purpose | Monthly Cost |
|---------|---------------|---------|--------------|
| **ECS Fargate** | 1 task (1 vCPU, 2GB RAM) | API + AI Engine container | $40-50 |
| **RDS PostgreSQL** | db.t4g.small, Single-AZ, 20GB GP3 | Primary database | $25-35 |
| **ElastiCache Redis** | Serverless | Session cache, rate limiting | $10-15 |
| **S3** | Standard storage | Uploads, static assets, session transcripts | $5 |
| **CloudFront** | Standard distribution | Frontend CDN | $5 |
| **ALB** | Application Load Balancer | HTTPS termination, routing | $20 |
| **Secrets Manager** | 5-10 secrets | Credentials management | $5-10 |
| **CloudWatch** | Logs + Metrics | Monitoring and logging | $15 |
| **Bedrock** | Opus + Sonnet API calls | AI operations | $9-12 |
| **TOTAL** | | | **$119-147** |

### 1.2 Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Users (Browser / Slack)                                          │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTPS
                     ▼
┌────────────────────────────────────────────────────────────────┐
│ AWS ALB (Application Load Balancer)                             │
│ - TLS 1.3 termination                                           │
│ - WAF rules (OWASP Top 10)                                      │
│ - Path routing: /api/* → ECS, /* → CloudFront                  │
└────────┬───────────────────────────────────┬───────────────────┘
         │                                   │
         ▼                                   ▼
┌────────────────────────┐       ┌──────────────────────────────┐
│ CloudFront + S3        │       │ ECS Fargate (Single Task)    │
│ Next.js static assets  │       │ - Fastify API (15 modules)   │
└────────────────────────┘       │ - Agent SDK Orchestrator     │
                                 │ - 4 AI Subagents             │
                                 │ - 5 MCP Servers              │
                                 └────────┬─────────────────────┘
                                          │
                     ┌────────────────────┼────────────────────┐
                     ▼                    ▼                    ▼
         ┌───────────────────┐  ┌─────────────────┐  ┌────────────────┐
         │ RDS PostgreSQL 16 │  │ Redis Serverless│  │ AWS Bedrock    │
         │ - 22-24 tables    │  │ - Sessions      │  │ - Claude Opus  │
         │ - pgvector        │  │ - Rate limits   │  │ - Claude Sonnet│
         │ - LISTEN/NOTIFY   │  └─────────────────┘  └────────────────┘
         └───────────────────┘
                     │
                     ▼
         ┌───────────────────────────────────────────┐
         │ External Integrations (via MCP)           │
         │ - GitHub API                              │
         │ - Microsoft 365 (Outlook, Calendar)       │
         │ - Fireflies.ai API                        │
         │ - Otter.ai API                            │
         │ - Slack API (R1)                          │
         └───────────────────────────────────────────┘
```

---

## 2. Application Architecture

### 2.1 10-Tier Architecture Model

| Tier | Name | Technology | Purpose |
|------|------|------------|---------|
| **1** | Client Layer | Next.js 15, React 19 | Web UI, static site |
| **2** | Gateway & Auth | ALB + WAF, JWT | Authentication, routing |
| **3** | Application Services | Fastify 5 (15 modules) | Business logic |
| **4** | AI Engine | Agent SDK, Bedrock | AI orchestration |
| **5** | Event Bus | Postgres LISTEN/NOTIFY | Event-driven updates |
| **6** | Data Layer | PostgreSQL 16, Redis, S3 | Persistent storage |
| **7** | Integration Gateway | MCP Servers | External API integrations |
| **8** | Security & Safety | KMS, RLS, Secrets Manager | Security controls |
| **9** | Deployment | ECS Fargate, CDK | Infrastructure as code |
| **10** | Observability | CloudWatch, X-Ray | Monitoring, tracing |

### 2.2 Application Modules (Tier 3)

**15 Fastify modules in single container:**

1. **Project** — Project CRUD, WBS baselines
2. **Task** — Full task lifecycle management
3. **Dependency** — Task dependency graphs
4. **Comment** — Task comments with @mentions
5. **Audit** — Immutable audit trail
6. **User** — User management, authentication
7. **Projection** — Client-safe data views (R2)
8. **Config** — Tenant configuration management
9. **Notification** — Notification system (R1)
10. **Goals** — Goals and OKRs (R2)
11. **Automation** — Rule-based automation (R2)
12. **Forms** — Form builder (R2)
13. **Documents** — Collaborative docs (R2)
14. **Views** — Saved views (R1)
15. **Agent** — AI agent management

---

## 3. AI Engine Architecture

### 3.1 Claude Agent SDK Implementation

**Orchestrator Pattern:**
- Single `query()` entry point for all AI operations
- Routes to appropriate subagent based on operation type
- Manages session state for multi-turn conversations
- Enforces safety via 8 hook types

### 3.2 AI Subagents (R0)

| Subagent | Model | Purpose | Token Budget |
|----------|-------|---------|--------------|
| **wbs-generator** | Opus 4.6 | NL → WBS generation | 8K input, 3K output |
| **whats-next** | Sonnet 4.5 | Developer task prioritization | 2K input, 1K output |
| **nl-query** | Sonnet 4.5 | Natural language queries | 2K input, 1K output |
| **summary-writer** | Sonnet 4.5 | Daily/weekly summaries | 3K input, 1K output |

**R1+ Subagents (deferred):**
- risk-predictor (Opus)
- ai-pm-agent (Sonnet)
- scope-detector (Sonnet)
- adaptive-engine (Sonnet)

### 3.3 MCP Servers (R0)

| MCP Server | Type | Purpose | Authentication |
|------------|------|---------|----------------|
| **pm-db** | In-process | Database queries (Drizzle ORM) | N/A (internal) |
| **github** | stdio | Git repos, PRs, commits | GitHub App token |
| **m365** | HTTP/SSE | Outlook, Calendar, Teams | OAuth 2.0 |
| **fireflies** | HTTP | Meeting transcriptions | API key |
| **otter** | HTTP | Meeting transcriptions | API key |

**R1 Additions:**
- slack (stdio)
- pgvector (in-process) for RAG

### 3.4 Hooks (Safety & Observability)

| Hook | Type | Purpose | R0 Config |
|------|------|---------|-----------|
| **tenant-isolator** | PreToolUse | Scope all queries to tenant_id | Always active |
| **autonomy-enforcer** | PreToolUse | Check if AI can execute vs propose | "Always propose" mode |
| **rate-limiter** | PreToolUse | Prevent abuse | 100 ops/hour/tenant |
| **cost-tracker** | PostToolUse | Log token spend | Always active |
| **audit-writer** | PostToolUse | Log all AI actions | Always active |
| **traceability** | PostToolUse | Full prompt/response chain | Always active |
| **notification-hook** | PostToolUse | Trigger notifications | No-op (R1: active) |
| **session-manager** | Stop | Persist session state | Always active |

### 3.5 AI Token Cost Model

**Monthly estimates (25 users, 3 teams):**

| Operation | Model | Frequency | Cost/Op | Monthly Cost |
|-----------|-------|-----------|---------|--------------|
| WBS generation | Opus 4.6 | 30/month | $0.15 | $4.50 |
| "What's Next" queries | Sonnet 4.5 | 150/month | $0.015 | $2.25 |
| NL queries | Sonnet 4.5 | 100/month | $0.015 | $1.50 |
| Daily summaries | Sonnet 4.5 | 20/month | $0.015 | $0.30 |
| **TOTAL** | | | | **$8.55** |

*10% Bedrock premium → ~$9-10/month*

---

## 4. Data Architecture

### 4.1 Database Schema (PostgreSQL 16)

**22-24 tables organized by category:**

#### Core Tables (R0) — 17 tables
- tenants, users, projects, phases, tasks
- task_assignments, task_dependencies, comments, mentions
- task_checklists, checklist_items, tags, task_tags
- audit_log, tenant_configs, priorities, task_statuses

#### AI Tables (R0) — 5 tables
- ai_sessions (multi-turn conversation context)
- ai_cost_log (token spend tracking)
- ai_agent_configs (per-tenant agent settings)
- ai_hook_log (hook evaluation audit)
- ai_session_events (session lifecycle events)

#### Integration Tables (R0) — 2 tables
- integrations (GitHub, M365, Fireflies, Otter connections)
- integration_configs (per-tenant integration settings)

#### Deferred Tables
- embeddings (pgvector, R1)
- notifications (3 tables, R1)
- goals (2 tables, R2)
- automation, forms, documents (R2+)

### 4.2 Event Bus (Postgres LISTEN/NOTIFY)

**Replaces NATS JetStream** — saves $60/month

**Event Channels:**
- `pm_tasks_created`
- `pm_tasks_updated`
- `pm_tasks_completed`
- `pm_projects_created`
- `pm_comments_added`
- `pm_ai_actions`

**Consumer Pattern:**
```javascript
// Fastify plugin subscribes to Postgres NOTIFY
db.query('LISTEN pm_tasks_created');
db.on('notification', (msg) => {
  const payload = JSON.parse(msg.payload);
  // Route to appropriate handler
  await handleTaskCreated(payload);
});
```

---

## 5. Security Architecture

### 5.1 SOC 2 Controls

| Control | Implementation | Status |
|---------|----------------|--------|
| **Encryption at Rest** | RDS encryption (KMS CMK), Redis encryption | ✅ R0 |
| **Encryption in Transit** | TLS 1.3 everywhere (ALB, internal) | ✅ R0 |
| **Access Control** | RBAC (Admin, Developer roles), RLS on DB | ✅ R0 |
| **Audit Logging** | Immutable audit_log table, ai_hook_log | ✅ R0 |
| **Secrets Management** | AWS Secrets Manager, no hardcoded creds | ✅ R0 |
| **Data Residency** | Bedrock (data stays in AWS region) | ✅ R0 |
| **Backup & Recovery** | Automated daily backups, 7-day retention | ✅ R0 |
| **Monitoring** | CloudWatch logs, metrics, alarms | ✅ R0 |

### 5.2 Authentication & Authorization

**Authentication (R0):**
- JWT RS256 tokens (1h expiry)
- Refresh tokens (30-day, rotation on use)
- Password auth with bcrypt (12 rounds)
- Session storage in Redis

**RBAC Roles (R0):**
- **Admin:** Full system access, user management, config
- **Developer:** Task CRUD, comments, "What's Next" view

**Row-Level Security (RLS):**
- All queries automatically scoped to `tenant_id`
- PostgreSQL RLS policies enforce isolation at DB layer

---

## 6. Deployment Architecture

### 6.1 Infrastructure as Code

**AWS CDK (TypeScript)**

**Stacks:**
1. **NetworkStack** — VPC, subnets, security groups
2. **DataStack** — RDS, Redis, S3 buckets
3. **ComputeStack** — ECS cluster, task definition, ALB
4. **FrontendStack** — S3 bucket, CloudFront distribution
5. **SecurityStack** — Secrets Manager, KMS keys
6. **MonitoringStack** — CloudWatch dashboards, alarms

### 6.2 CI/CD Pipeline (GitHub Actions)

**Workflow:**
```
Push to main → Run tests → Build images → Push to ECR →
Update ECS task → Run smoke tests → Notify team
```

**Environments:**
- **dev:** Feature branch deploys
- **uat:** Main branch deploys
- **prod:** Tagged releases only

---

## 7. Monitoring & Observability

### 7.1 CloudWatch Metrics

**Infrastructure:**
- ECS CPU/Memory utilization
- RDS connections, IOPS, storage
- Redis cache hit rate
- ALB request count, latency (p50, p95, p99)

**Application:**
- API endpoint latency by route
- Error rate by module
- AI operation latency by subagent
- Token cost per operation

### 7.2 Alarms

| Alarm | Threshold | Action |
|-------|-----------|--------|
| ECS CPU > 80% | 5 min sustained | Scale up / alert |
| RDS connections > 90% | 5 min sustained | Alert team |
| API p95 latency > 500ms | 10 min sustained | Alert team |
| Daily AI cost > $20 | Daily check | Alert team |
| Error rate > 5% | 5 min sustained | Alert team |

---

## 8. Scalability & Future State

### 8.1 Current Capacity (R0)

- **Users:** 25 (3 teams)
- **Projects:** 10-20 concurrent
- **Tasks:** 1,000-5,000
- **API throughput:** 100 req/sec
- **Database size:** < 10 GB

### 8.2 Scaling Triggers

**When to scale UP:**
- ECS task CPU > 70% sustained → Add 2nd task
- RDS storage > 80% → Increase storage
- Redis memory > 80% → Increase cache size

**When to scale OUT:**
- Users > 100 → Upgrade RDS instance class
- Tasks > 50K → Consider read replicas
- External clients added → Multi-AZ RDS, separate tenants

### 8.3 R3 Target State

**At 10 tenants, 100+ users:**
- ECS: 3-4 tasks with auto-scaling
- RDS: Multi-AZ, db.t4g.large
- Redis: Cluster mode
- Separate AI worker pool (background processing)
- CDN: Multi-region CloudFront
- Cost: $2,000-2,500/month

---

## 9. Key Architectural Risks

| Risk | Mitigation | Status |
|------|------------|--------|
| **Single-AZ RDS outage** | Automated backups, 5-min RTO | Accepted (internal use) |
| **Single container SPOF** | Health checks, auto-restart | Accepted (add 2nd task if needed) |
| **AI cost overruns** | Rate limiting, cost tracking, alerts | Mitigated (hooks) |
| **M365 integration complexity** | MCP server abstraction, OAuth | To be addressed |
| **Event bus at scale** | Postgres NOTIFY works to 10K events/min | Monitor, add NATS if needed |

---

## 10. Document References

| Document | Path | Purpose |
|----------|------|---------|
| Architecture Diagrams | `docs/ARCHITECTURE_DIAGRAMS.md` | ASCII, Mermaid diagrams |
| PRD | `docs/PRD.md` | Product requirements |
| Tech Stack | `docs/TECH_STACK.md` | Complete technology list |
| Infrastructure Spec | `docs/INFRASTRUCTURE_SPEC.md` | AWS service configurations |
| Implementation Plan | `plans/IMPLEMENTATION_PLAN.md` | Sprint breakdown |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | March 1, 2026 | Initial approved architecture |

---

**Approved by:** DynPro Engineering
**Next Review:** Post-R0 (Month 3)
