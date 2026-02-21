# Dynsense — Implementation Plan

**Version:** 4.0
**Date:** February 18, 2026
**Status:** Draft for Review
**Methodology:** Produced using swarm parallel agent research (3 concurrent agents)

---

## 1. Current Status

### 1.1 Sprint Overview — All Not Started (Fresh Build)

| Sprint | Scope | Features | Status |
|--------|-------|----------|--------|
| R0-1 | Infrastructure + Schema | Monorepo, @vercel/postgres, 19 Drizzle tables, CI/CD | NOT STARTED |
| R0-2 | Auth + RBAC + Core API | Auth.js v5+, 4 roles, 9 Next.js API route modules, deps, checklists, @mentions | NOT STARTED |
| R0-3 | Agent SDK Foundation | Orchestrator, 4 subagents, 3 MCP servers, 8 hooks, sessions, 64+ tests | NOT STARTED |
| R0-4 | AI Core Capabilities | WBS generator end-to-end, AI review UI, shadow mode | NOT STARTED |
| R0-5 | What's Next + Summary + Frontend Core | Dashboard, task detail, auth pages, API client wiring | NOT STARTED |
| R0-6 | Confidence, Evaluation, Monitoring, Polish | AI guardrails, golden tests, monitoring, NL query panel | NOT STARTED |

### 1.2 Full Scope

| Release | Sprints | Features | Focus |
|---------|---------|----------|-------|
| R0 | R0-1 through R0-6 | 28 features | Foundation, schema, auth, AI engine, frontend core |
| R1 | R1-1 through R1-6 | 36 features | Intelligence, integrations, SaaS prep |
| R2 | R2-1 through R2-6 | 27 features | Client launch, monetization |
| R3 | R3-1 through R3-6 | 13 features | Platform, per-tenant AI |

---

## 2. R0 Full Implementation (Sprints R0-1 through R0-6)

### Sprint R0-1: Infrastructure + Schema (Weeks 1-2)

**Goal:** Turborepo monorepo operational, 19 Drizzle tables in @vercel/postgres, CI/CD green on every push.

| Task | Owner | Effort | Feature Req |
|------|-------|--------|-------------|
| Initialize Turborepo + pnpm workspaces (apps/web, packages/db, packages/shared, packages/agents) | DevOps | 4h | FR-102 |
| Configure Next.js 14+ App Router with TypeScript strict mode in apps/web | Frontend | 4h | FR-102 |
| Set up Tailwind CSS + Shadcn UI foundation in apps/web | Frontend | 4h | FR-500 |
| Define 19 Drizzle ORM schemas in packages/db: tenants, users, projects, phases, tasks, task_assignments, task_dependencies, comments, mentions, task_checklists, checklist_items, audit_log, tenant_configs, ai_actions, ai_cost_log, ai_agent_configs, ai_sessions, ai_hook_log, ai_mcp_servers | Backend | 16h | FR-102 |
| Write immutability trigger SQL on audit_log (BEFORE UPDATE/DELETE raises exception) | Backend | 4h | FR-141 |
| Configure @vercel/postgres connection + Drizzle client in packages/db/src/index.ts | Backend | 4h | FR-102 |
| Configure @vercel/kv client + kv-channels constants in packages/shared/src/constants/kv-channels.ts | Backend | 4h | FR-100 |
| Set up packages/shared: base Zod schemas, TypeScript types, RBAC role constants, permission matrix | Backend | 8h | FR-101 |
| Write seed script: 3 tenants × 5 users × 3 projects × 20 tasks with realistic data | Backend | 8h | — |
| Configure .env.example (POSTGRES_URL, KV_URL, BLOB_READ_WRITE_TOKEN, EDGE_CONFIG, AUTH_SECRET, ANTHROPIC_API_KEY, PINECONE_API_KEY) | DevOps | 2h | — |
| Configure docker-compose.yml for local Postgres dev (mirroring Vercel Postgres schema) | DevOps | 4h | — |
| Set up GitHub Actions CI/CD (lint, type-check, build, test on every PR + push to main) | DevOps | 6h | — |
| Configure turbo.json pipeline with proper task dependencies and remote caching | DevOps | 2h | — |

**Exit Criteria:**
- `turbo build` passes all 4 packages with zero type errors
- All 19 tables created in Vercel Postgres with FK constraints, indexes, and RLS policies
- Seed script populates test data cleanly with no FK violations
- GitHub Actions CI green on main branch

---

### Sprint R0-2: Auth + RBAC + Core API (Weeks 3-4)f

**Goal:** Auth.js v5+ credentials provider working, RBAC enforced via middleware, all 9 Next.js API route modules returning correct responses with tenant isolation.

| Task | Owner | Effort | Feature Req |
|------|-------|--------|-------------|
| Configure Auth.js v5+ credentials provider with bcrypt (cost 12) in src/lib/auth.ts | Backend | 8h | FR-103 |
| Implement NextAuth JWT session strategy with tenant_id, role, user_id claims | Backend | 6h | FR-103 |
| Build src/middleware.ts: tenant isolation (SET LOCAL app.current_tenant_id) + RBAC route guards + rate limiting via @vercel/kv | Backend | 8h | FR-104 |
| POST /api/v1/auth/register (bcrypt hash, tenant assignment, audit log entry) | Backend | 4h | FR-103 |
| POST /api/v1/auth/login (credentials verify, session create) | Backend | 4h | FR-103 |
| GET /api/v1/auth/me + POST /api/v1/auth/logout | Backend | 3h | FR-103 |
| Projects CRUD: POST/GET /api/v1/projects, GET/PATCH/DELETE /api/v1/projects/[id], POST /api/v1/projects/[id]/phases | Backend | 12h | FR-110 |
| Tasks CRUD: full field set (title, description, status, priority, phase_id, assignee_id, due_date, estimated_hours, parent_task_id) with filtering by project/phase/status/priority/assignee | Backend | 16h | FR-120 |
| Task status transitions: PATCH /api/v1/tasks/[id]/status with auto-set completed_at on → done | Backend | 4h | FR-121 |
| Task assignments: POST/DELETE /api/v1/tasks/[id]/assignments | Backend | 4h | FR-122 |
| Task dependencies (DAG): POST/DELETE /api/v1/tasks/[id]/dependencies with BFS circular dependency detection | Backend | 8h | FR-124 |
| Sub-tasks: parent_task_id nesting + POST /api/v1/tasks/[id]/promote + /demote endpoints | Backend | 6h | FR-125 |
| Comments with @mentions: POST/GET /api/v1/tasks/[id]/comments, UUID mention extraction, mentions table insert | Backend | 8h | FR-2004 |
| GET /api/v1/users/me/mentions (paginated, unread filter) | Backend | 2h | FR-2004 |
| Task checklists: POST/GET /api/v1/tasks/[id]/checklists, checklist items CRUD, completion percentage calculation | Backend | 8h | FR-2000 |
| Tenant config: GET/PUT /api/v1/config (per-tenant key-value, site_admin + pm only) | Backend | 4h | FR-109 |
| User management: GET /api/v1/users, GET /api/v1/users/[id], PATCH /api/v1/users/[id]/role (sanitized output, no password hash) | Backend | 4h | FR-104 |
| Audit trail: field-level diff logging on all mutations, async non-blocking, tenant-scoped | Backend | 8h | FR-140 |
| GET /api/v1/audit (paginated, tenant-scoped, admin-only) | Backend | 4h | FR-141 |
| Zod input validation on all route handlers + global error response format | Backend | 6h | — |

**Exit Criteria:**
- Auth flow (register → login → session → me → logout) working end-to-end
- All 9 API modules (auth, users, projects, tasks, dependencies, comments, checklists, audit, config) returning correct responses
- RBAC blocks unauthorized role access with 403 responses
- Circular dependency detection prevents invalid DAG insertions
- Audit trail logging all mutations with field-level diffs
- All inputs validated with Zod, malformed requests return structured 400 errors

---

### Sprint R0-3: Agent SDK Foundation (Weeks 5-6)

**Goal:** AIOrchestrator with 7-stage pipeline, 4 subagent definitions, 3 MCP servers, 8 hooks in deterministic order, permission chain, autonomy policy engine, and session management. 64+ tests passing.

| Task | Owner | Effort | Feature Req |
|------|-------|--------|-------------|
| Implement AIOrchestrator class with 7-stage pipeline (trigger → autonomy check → context assembly → confidence check → LLM call → post-processing → disposition) in packages/agents/src/orchestrator.ts | AI/ML | 24h | FR-200, FR-3000 |
| Define 4 subagent configs with tool restrictions: wbs-generator (Opus, pm-db+pinecone), whats-next (Sonnet, pm-db), nl-query (Sonnet, pm-db+pinecone), summary-writer (Sonnet, pm-db) | AI/ML | 8h | FR-3001 |
| Configure Pinecone SDK client in apps/web/src/lib/pinecone.ts (index: dynsense-embeddings, 1536-dim) | AI/ML | 4h | FR-3002 |
| Build MCP server pm-db: query, mutate, get_by_id tools with tenant_id injection in packages/agents/src/mcp/servers/pm-db.ts | Backend | 8h | FR-320, FR-3002 |
| Build MCP server pinecone: search (cosine, top-k=10), search_by_text tools in packages/agents/src/mcp/servers/pinecone.ts | AI/ML | 6h | FR-320, FR-3002 |
| Build MCP server pm-events: publish and subscribe tools using @vercel/kv in packages/agents/src/mcp/servers/pm-events.ts | Backend | 6h | FR-320, FR-3002 |
| Implement 3 PreToolUse hooks (sequential): tenant-isolator (block cross-tenant, inject tenant_id), autonomy-enforcer (shadow/propose/execute), rate-limiter (@vercel/kv sliding window + daily cost cap) | AI/ML | 12h | FR-340, FR-3004 |
| Implement 4 PostToolUse hooks (parallel): cost-tracker (token/cost to DB + @vercel/kv), audit-writer (hook decision trail), traceability (link tool calls to ai_actions), notification-hook (user notifications on mutations) | AI/ML | 8h | FR-340, FR-3004 |
| Implement 1 Stop hook (sequential): session-manager (persist session state to @vercel/kv) | Backend | 4h | FR-340, FR-3004 |
| Implement 4-step permission chain in packages/agents/src/permissions/permission-chain.ts (tenant check → role check → autonomy check → tool restriction check) | Backend | 8h | FR-3005 |
| Implement autonomy policy engine (shadow: log only, propose: create ai_action for review, execute: apply + log) | Backend | 8h | FR-300 |
| Implement session service (create, resume, fork, expire) backed by @vercel/kv in packages/agents/src/sessions/session-service.ts | Backend | 8h | FR-3003 |
| Write unit + integration test suite: orchestrator pipeline stages, hook chain order, permission chain, session lifecycle (target: 64+ tests) | QA | 16h | — |

**Exit Criteria:**
- 64+ tests passing (37 integration, 27+ unit)
- All 8 hooks fire in correct deterministic order (3 PreToolUse sequential → 4 PostToolUse parallel → 1 Stop sequential)
- Permission chain blocks cross-tenant tool calls at step 1
- Sessions persist to @vercel/kv and resume correctly with full context
- Autonomy policy correctly routes to shadow/propose/execute based on tenant config

### Sprint R0-4: AI Core Capabilities (Weeks 7-8)

**Goal:** NL-to-WBS generator working end-to-end, AI review interface, shadow mode.

| Task | Owner | Effort | Feature Req |
|------|-------|--------|-------------|
| Wire AIOrchestrator.execute() to POST /ai/execute endpoint | Backend | 4h | FR-200 |
| Implement WBS generator prompt templates (YAML, 3 domains: software, data migration, consultancy) | AI/ML | 12h | FR-200 |
| Implement context assembler: RAG retrieval + domain templates + token budget enforcement | AI/ML | 16h | FR-200 |
| Build AI Review page: pending proposals list, detail panel, approve/reject/edit actions | Frontend | 24h | FR-301 |
| Implement shadow mode: _shadow flag on mutations, admin-only log view | Backend | 8h | FR-302 |
| Wire autonomy policy config to tenant settings UI | Frontend | 8h | FR-300 |
| Integration tests: WBS generation → review → approve → apply cycle | QA | 8h | — |

**Exit Criteria:**
- WBS generated from NL description in <30s p95
- Review/approve workflow functional
- Shadow mode logging verified

### Sprint R0-5: What's Next + Summary + Frontend Core (Weeks 9-10)

**Goal:** Developers have a daily landing page. AI generates daily summaries. Core UI functional.

| Task | Owner | Effort | Feature Req |
|------|-------|--------|-------------|
| Build Dashboard page: What's Next list, AI summary card, projects overview | Frontend | 24h | FR-201, FR-500 |
| Implement What's Next rules engine (dependency resolved → due date → priority) | Backend | 8h | FR-201 |
| Build Task Detail page: three-column layout (details, sidebar, activity) | Frontend | 24h | FR-500 |
| Implement Summary Writer scheduling (daily cron via Vercel Cron Jobs + @vercel/kv) | Backend | 8h | FR-202 |
| Build Project List and Task List views with filtering + sorting | Frontend | 16h | FR-501 |
| Build sidebar navigation (role-based, collapsible, responsive) | Frontend | 8h | FR-502 |
| Build auth pages: login, register, token management | Frontend | 12h | FR-103 |
| Wire frontend API client (TanStack Query v5) to all backend endpoints | Frontend | 16h | — |

**Exit Criteria:**
- Dashboard shows prioritized tasks per developer
- Daily summary auto-generates via scheduled job
- Task detail fully functional with all fields

### Sprint R0-6: Confidence, Evaluation, Monitoring, Polish (Weeks 11-12)

**Goal:** AI quality guardrails operational. Monitoring live. R0 release-ready.

| Task | Owner | Effort | Feature Req |
|------|-------|--------|-------------|
| Implement confidence threshold checks in pipeline stage 4 | AI/ML | 8h | FR-303 |
| Build graceful degradation strategies (ask_human, reduce_scope, use_template, skip) | AI/ML | 8h | FR-303 |
| Implement rollback: store pre-action snapshot in rollback_data, one-click revert | Backend | 12h | FR-304 |
| Create golden test sets for WBS, What's Next, NL Query, Summary | AI/ML | 16h | FR-401 |
| Set up CloudWatch dashboards: AI latency, error rate, token usage per capability | DevOps | 8h | FR-402 |
| Set up Sentry for frontend + backend error tracking | DevOps | 4h | FR-402 |
| Build NL Query slide-out panel (Cmd+K trigger, streaming response, suggested queries) | Frontend | 16h | FR-203 |
| Build Comment UI on task detail page | Frontend | 8h | FR-503 |
| End-to-end QA pass on all 28 R0 features | QA | 16h | — |

**Exit Criteria:**
- Confidence checks operational, low-confidence routes to human
- Golden test sets defined for all 4 capabilities
- CloudWatch + Sentry monitoring live
- All R0 features passing QA

**R0 Release Gate:**
- [ ] 28 features shipped with Definition of Done
- [ ] NL-to-WBS acceptance rate >60%
- [ ] Developers using What's Next as primary work finder (>80%)
- [ ] AI traceability end-to-end (trigger → output → log queryable)
- [ ] Zero cross-tenant data leakage verified
- [ ] 80%+ test coverage
- [ ] Staging stable 1 week

---

## 3. R1 Implementation (Months 4-6, 36 Features)

### Sprint R1-1: AI Worker Extraction + Risk Predictor (Weeks 13-14)

**Goal:** Separate AI processing from API server. First proactive AI capability.

| Task | Owner | Effort | Feature Req |
|------|-------|--------|-------------|
| Configure AI orchestrator as Vercel Cron Job background worker (packages/agents) | Backend + DevOps | 24h | ADR-010 |
| Set up @vercel/kv job queue channels between API routes and AI worker functions | Backend | 8h | — |
| Implement Risk Predictor agent (Opus, shadow mode first 2-4 weeks) | AI/ML | 16h | FR-603 |
| Risk pattern analysis: blocker duration, stalled tasks, dependency chain growth, scope drift | AI/ML | 12h | FR-603 |
| Implement AI Decision Log: queryable via API, full explanation chain | Backend | 8h | FR-608 |
| Build risk prediction UI panel on project dashboard | Frontend | 12h | FR-603 |

### Sprint R1-2: Integrations — Git + Slack/Teams (Weeks 15-16)

**Goal:** External signal sources connected. AI PM Agent has a delivery channel.

| Task | Owner | Effort | Feature Req |
|------|-------|--------|-------------|
| GitHub webhook adapter: receive commits/PRs, link to tasks via branch naming | Backend | 16h | FR-701 |
| Auto-update task status on PR merge (task → completed) | Backend | 8h | FR-701 |
| Slack integration: OAuth 2.0 flow, bot setup, bidirectional messaging | Backend | 20h | FR-700 |
| Microsoft Teams integration: OAuth flow, bot framework, messaging | Backend | 20h | FR-700 |
| AI PM Agent nudge delivery via Slack/Teams DMs | AI/ML | 8h | FR-601 |
| Integration settings page in frontend | Frontend | 8h | FR-700 |

### Sprint R1-3: AI PM Agent + Adaptive Engine (Weeks 17-18)

**Goal:** AI operates autonomously on projects, chasing updates and nudging.

| Task | Owner | Effort | Feature Req |
|------|-------|--------|-------------|
| AI PM Agent: 15-min recurring Vercel Cron Job per active project using @vercel/kv pub/sub | AI/ML | 20h | FR-601 |
| Nudge logic: overdue tasks (due_date < now), stalled work (no update >48h, not blocked) | AI/ML | 12h | FR-601 |
| Escalation proposals: create for PM review when threshold exceeded | AI/ML | 8h | FR-606 |
| Upgrade What's Next from rules-based to LLM-ranked with velocity context | AI/ML | 12h | FR-600 |
| Scope Creep Detector: compare WBS baseline JSONB vs current task additions | AI/ML | 12h | FR-607 |
| Auto-generated status reports: weekly schedule, reviewable before distribution | AI/ML | 8h | FR-602 |
| Cross-project dependency mapping: surface Project A blocking Project B | Backend | 12h | FR-604 |

### Sprint R1-4: Views + Custom Fields + Notifications (Weeks 19-20)

**Goal:** Feature parity with basic PM tools. Users can visualize and customize.

| Task | Owner | Effort | Feature Req |
|------|-------|--------|-------------|
| Kanban Board view: read-only columns, AI-annotated (blocked flags, priority) | Frontend | 20h | FR-1900 |
| Calendar View: month/week/day, task chips colored by priority/status | Frontend | 16h | FR-2002 |
| Table View: spreadsheet-like, inline edit, sort by any column | Frontend | 20h | FR-2003 |
| Custom Fields: definition schema + polymorphic value storage + UI rendering | Full-stack | 16h | FR-2005 |
| Notification system: centralized inbox, bell badge, type filtering, preferences | Full-stack | 16h | FR-2007 |
| Saved Views: column configs, sort/filter state persistence per user | Frontend | 8h | — |

### Sprint R1-5: Security + SaaS Preparation (Weeks 21-22)

**Goal:** Production-ready security. Multi-tenancy infrastructure for R2 launch.

| Task | Owner | Effort | Feature Req |
|------|-------|--------|-------------|
| SSO integration: SAML 2.0 (Okta, Azure AD) + OIDC (Google, Microsoft) | Backend | 20h | FR-800 |
| MFA: TOTP with recovery codes, enrollment flow | Backend | 12h | FR-801 |
| Session hardening: concurrent session limits, device fingerprinting | Backend | 8h | FR-802 |
| Client projection data model: internal vs external classification, redaction rules | Backend | 12h | FR-900 |
| Basic read-only client view (pilot with 1-2 internal projects) | Frontend | 12h | FR-901 |
| Feature flag infrastructure: tenant-level gating for post-R0 features | Backend | 8h | FR-902 |
| AI cost tracking dashboard: per-tenant, per-capability breakdown | Frontend | 8h | FR-904 |

### Sprint R1-6: Resource Optimization + Hardening (Weeks 23-24)

**Goal:** All 36 R1 features complete and QA'd.

| Task | Owner | Effort | Feature Req |
|------|-------|--------|-------------|
| Resource optimization engine: workload balancing, burnout detection, reallocation | AI/ML | 16h | FR-605 |
| SOC 2 controls: access controls, encryption verification, retention policies | DevOps | 16h | FR-903 |
| Tags: default + custom per project, UI management | Backend + Frontend | 8h | FR-1000 |
| Full-text search across tasks (GIN index) | Backend | 8h | FR-1002 |
| Advanced filtering + sorting in all views | Frontend | 8h | FR-1003 |
| Recurring tasks: daily/weekly/monthly/cron schedule, auto-clone | Backend | 12h | FR-2001 |
| Task reminders: personal per-user, scheduled delivery | Backend | 8h | FR-2014 |
| Assigned comments / action items in comment threads | Full-stack | 8h | FR-2008 |
| R1 end-to-end QA pass (all 36 features) | QA | 24h | — |
| Performance/load testing | QA | 12h | — |

**R1 Release Gate:**
- [ ] All 36 features shipped
- [ ] AI PM agent running 15-min loops, nudges delivered via Slack
- [ ] Risk predictions >70% accuracy on flagged items
- [ ] Git + Slack integrations active and signaling
- [ ] Status reports >80% acceptable without editing
- [ ] SSO/MFA working
- [ ] Feature flags operational
- [ ] Pilot client using portal with positive feedback

---

## 4. R2 Implementation (Months 7-9, 27 Features)

### Sprint R2-1: Multi-Tenancy + Client Portal (Weeks 25-26)

| Task | Owner | Effort | Feature Req |
|------|-------|--------|-------------|
| Multi-tenancy activation: per-tenant isolation verified end-to-end | Backend + DevOps | 16h | FR-1200 |
| Client portal (full): overview, milestones, AI assistant | Frontend | 24h | FR-1201 |
| Client role + permissions enforcement across all endpoints | Backend | 12h | FR-1202 |
| Self-service client onboarding flow | Full-stack | 16h | FR-1204 |

### Sprint R2-2: Monetization + Client AI (Weeks 27-28)

| Task | Owner | Effort | Feature Req |
|------|-------|--------|-------------|
| Tiered pricing: Starter ($29), Pro ($99), Enterprise ($249+) with metering | Backend | 16h | FR-1300 |
| AI cost management live: budgets, alerts at 80%/100%, dashboard | Backend + Frontend | 16h | FR-1301 |
| Client-facing AI assistant (scoped to projection layer) | AI/ML | 16h | FR-1205 |
| Automated client reporting: scheduled generation, reviewable before send | AI/ML | 12h | FR-1203 |

### Sprint R2-3: Goals + Automation (Weeks 29-30)

| Task | Owner | Effort | Feature Req |
|------|-------|--------|-------------|
| Goals & OKRs: hierarchy, auto-progress calculation, AI risk flagging | Full-stack | 20h | FR-2006 |
| Custom automations: if-then rules, 10+ triggers, audit logged | Full-stack | 20h | FR-2009 |
| Form view / task intake: drag-drop builder, public links, submissions create tasks | Full-stack | 16h | FR-2010 |

### Sprint R2-4: Docs + Advanced Views (Weeks 31-32)

| Task | Owner | Effort | Feature Req |
|------|-------|--------|-------------|
| Documents & knowledge base: markdown editor, draft/published, RAG indexed | Full-stack | 20h | FR-2012 |
| AI Writing Assistant: draft, improve, summarize, translate tone | AI/ML | 12h | FR-2013 |
| Gantt Chart view with dependency visualization | Frontend | 16h | FR-1901 |
| Formula / computed fields | Backend + Frontend | 12h | FR-2011 |

### Sprint R2-5: Security + Compliance + Import/Export (Weeks 33-34)

| Task | Owner | Effort | Feature Req |
|------|-------|--------|-------------|
| SOC 2 Type I audit preparation: evidence collection, auditor engagement | DevOps | 20h | FR-1402 |
| AI guardrails multi-tenant: cross-tenant prompt isolation, PII redaction | AI/ML + Backend | 16h | FR-1403 |
| Bulk task import (CSV, Jira migration) | Backend | 12h | FR-1001 |
| Data export (CSV, JSON) | Backend | 8h | FR-1302 |
| Public API documentation (OpenAPI/Swagger) | Backend | 8h | FR-1400 |
| Webhook system: outbound subscriptions, HMAC-SHA256 verification | Backend | 12h | FR-1401 |

### Sprint R2-6: Enhanced AI + Release (Weeks 35-36)

| Task | Owner | Effort | Feature Req |
|------|-------|--------|-------------|
| Predictive delivery dating from historical velocity | AI/ML | 12h | FR-1500 |
| AI meeting prep + follow-up | AI/ML | 12h | FR-1501 |
| Scenario planning ("what if we drop this feature?") | AI/ML | 12h | FR-1502 |
| AI sprint planning assistant | AI/ML | 12h | FR-1503 |
| Custom AI rules per project | Backend | 8h | FR-1504 |
| Calendar integration: Google Calendar + Outlook via OAuth | Backend | 12h | FR-702 |
| R2 end-to-end QA pass | QA | 24h | — |
| Load testing: 100 tenants simulation | QA | 16h | — |

**R2 Release Gate:**
- [ ] 3+ paying client tenants active
- [ ] Client NPS >40
- [ ] Client portal AI answers >60% without human escalation
- [ ] AI cost within 10% of per-tenant revenue
- [ ] SOC 2 Type I audit initiated
- [ ] Billing operational

---

## 5. R3 Implementation (Months 10-12, 13 Features)

### Sprint R3-1: Per-Tenant Intelligence (Weeks 37-38)

| Task | Owner | Effort | Feature Req |
|------|-------|--------|-------------|
| Per-tenant AI learning: tenant-scoped RAG that improves from org delivery history | AI/ML | 24h | FR-1600 |
| AI estimation engine: historical data → effort predictions per tenant | AI/ML | 16h | FR-1601 |

### Sprint R3-2: Consultancy Moat Features (Weeks 39-40)

| Task | Owner | Effort | Feature Req |
|------|-------|--------|-------------|
| AI-generated SOWs and proposals from delivery history (Opus, long-context) | AI/ML | 24h | FR-1800 |
| Template intelligence: auto-build project templates from completed projects | AI/ML | 12h | FR-1602 |
| Knowledge capture: lessons learned, best practices extraction | AI/ML | 12h | FR-1801 |

### Sprint R3-3: Enterprise + PM Role (Weeks 41-42)

| Task | Owner | Effort | Feature Req |
|------|-------|--------|-------------|
| Enterprise tier: schema isolation evaluation, dedicated resources | Backend + DevOps | 20h | FR-1701 |
| Project Manager role with full permissions | Backend | 12h | FR-1702 |
| Full self-service onboarding (no-touch provisioning) | Full-stack | 16h | FR-1700 |

### Sprint R3-4: AI Coaching + Analytics (Weeks 43-44)

| Task | Owner | Effort | Feature Req |
|------|-------|--------|-------------|
| AI coaching: PM delivery pattern feedback ("you underestimate QA by 30%") | AI/ML | 16h | FR-1603 |
| AI retrospective facilitator: data-driven retros | AI/ML | 12h | FR-1604 |
| AI onboarding for new team joiners | AI/ML | 12h | FR-1802 |
| Embedded analytics + cross-tenant benchmarking | Full-stack | 16h | FR-1803 |

### Sprint R3-5: SOC 2 + Performance (Weeks 45-46)

| Task | Owner | Effort | Feature Req |
|------|-------|--------|-------------|
| SOC 2 Type II sustained evidence collection | DevOps | 20h | FR-1703 |
| Performance: HNSW index migration, query optimization | Backend | 12h | — |
| Scale testing: 10 tenants, 100K tasks | QA | 12h | — |

### Sprint R3-6: Polish + Launch (Weeks 47-48)

| Task | Owner | Effort | Feature Req |
|------|-------|--------|-------------|
| Final end-to-end QA | QA | 20h | — |
| Documentation: API, admin, client guides | All | 16h | — |

**R3 Release Gate:**
- [ ] 10+ paying tenants
- [ ] Per-tenant AI accuracy measurably improved
- [ ] AI-generated SOWs used in at least 1 real proposal
- [ ] Client retention >90%
- [ ] SOC 2 Type I certified

---

## 6. Team Allocation

| Role | Count | Primary Focus |
|------|-------|--------------|
| Backend Engineer | 2 | Next.js API Routes, @vercel/postgres, Drizzle ORM, @vercel/kv, integrations |
| AI/ML Engineer | 1-2 | Claude API, Pinecone RAG, prompts, evaluation, agent orchestrator |
| Fullstack Engineer | 1-2 | Next.js 14+ App Router, React, Shadcn UI, client portal |
| DevOps Engineer | 1 | Vercel deployments, CI/CD, monitoring, compliance |

### Effort Distribution

| Domain | R0 (all 6 sprints) | R1 | R2 | R3 |
|--------|-------------------|-----|-----|-----|
| Backend API | 20% | 25% | 20% | 15% |
| AI/ML | 25% | 30% | 25% | 40% |
| Frontend | 35% | 25% | 30% | 20% |
| DevOps | 5% | 10% | 15% | 15% |
| QA | 15% | 10% | 10% | 10% |

---

## 7. Critical Path & Dependencies

```
R0:  Schema → Auth → Tasks → Orchestrator → WBS → Dashboard UI
R1:  AI Worker → Git → AI PM Agent → Notifications → SSO/MFA
R2:  Feature Flags → Multi-Tenancy → Client Portal → Billing → SOC 2
R3:  Historical Data → Per-Tenant Learning → SOW Generator → Enterprise
```

### Data Readiness Gates

| Capability | Min Data Required | Sprint |
|------------|-------------------|--------|
| What's Next (LLM upgrade) | 50+ completed tasks | R1-3 |
| Risk Predictor | 100+ task transitions | R1-1 |
| Resource Optimization | 3+ devs, 2+ projects | R1-6 |
| Per-Tenant Learning | 2+ completed projects/tenant | R3-1 |
| AI Estimation | 50+ tasks with estimate vs actual | R3-1 |

---

## 8. Risk Register

| Risk | Impact | Mitigation |
|------|--------|-----------|
| WBS quality too generic | High | Domain templates, golden tests, early feedback |
| Claude API rate limits | Medium | Circuit breaker, budgets, Opus→Sonnet fallback |
| Cross-tenant data leak | Critical | RLS + app checks + integration tests |
| AI cost exceeds revenue | Critical | Pre-flight budget checks, per-tenant metering |
| Scope creep on R0 AI | High | Only WBS + What's Next in R0, strict lock |
| Frontend velocity | Medium | Shadcn pre-built components |
| Integration partner delays | Medium | Sandbox/mock APIs first |

---

## 9. Definition of Done (All Sprints)

- [ ] Code reviewed with 1+ approval
- [ ] 80%+ test coverage on new/modified code
- [ ] TypeScript strict mode (no `any`)
- [ ] Zod validation on all API inputs
- [ ] tenant_id scoping verified
- [ ] Deployed to staging
- [ ] Security scan clean
- [ ] Feature flag gated (if incomplete)
