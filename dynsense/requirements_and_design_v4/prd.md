# Dynsense — Product Requirements Document (PRD)

**Version:** 4.0
**Date:** February 18, 2026
**Status:** Draft for Review
**Methodology:** Produced using swarm parallel agent research (3 concurrent agents)

---

## 1. Product Vision & Strategy

### 1.1 Vision Statement

Dynsense is an AI-native project management platform purpose-built for consultancy firms. The platform replaces manual PM overhead with autonomous AI subagents that generate work breakdown structures, prioritize tasks, predict risks, nudge teams, and produce reports — all under configurable human oversight.

### 1.2 Core Thesis

> "The AI runs the project. The human supervises."

Dynsense inverts the traditional PM paradigm: instead of humans doing PM work with software as a tool, AI agents perform the PM work while humans supervise, review, and course-correct. This thesis guides every product decision — from the three-tier autonomy model (shadow → propose → execute) to the AI Review page as a primary UI surface.

### 1.3 Strategic Differentiators

| Differentiator | Description | Competitive Advantage |
|---------------|-------------|----------------------|
| **AI-First Architecture** | Every feature designed around AI orchestration, not bolted on | Unlike legacy PM tools (Jira, Asana) adding AI as a feature — Dynsense is built for it |
| **Consultancy Focus** | Purpose-built for multi-project, multi-client consultancy workflows | Vertical specialization vs. horizontal PM tools |
| **Configurable Autonomy** | Three-tier autonomy (shadow/propose/execute) per capability | Trust-building path from observation to full automation |
| **Full Traceability** | Every AI decision logged, explainable, and reversible | Enterprise-grade accountability for AI-driven decisions |
| **Swarm Parallel Development** | Concurrent AI agent development methodology | Faster delivery, bounded module ownership, explicit contracts |

### 1.4 Swarm Parallel Agent Strategy

The product is developed using a swarm parallel pattern where independent feature domains are built concurrently by specialized agent swarms:

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
- Max 4 concurrent implementation agents per sprint to prevent merge conflicts

---

## 2. Target Market & User Personas

### 2.1 Target Market

**Primary:** Small-to-mid consultancy firms (10-100 employees) managing multiple client engagements simultaneously. These firms suffer from PM overhead that doesn't scale — a single PM managing 3-5 projects spends 40%+ of their time on status updates, task creation, and reporting rather than strategic work.

**Secondary:** Technology consultancies, digital agencies, and managed service providers with project-based delivery models.

**TAM:** ~150,000 consultancy firms in US/EU with 10-100 employees
**SAM:** ~30,000 firms actively seeking PM tooling improvements
**SOM (Year 1):** 50-100 paying tenants

### 2.2 User Personas

#### Persona 1: Consultancy PM (Primary)

| Attribute | Detail |
|-----------|--------|
| **Role** | pm |
| **Goals** | Reduce time spent on administrative PM tasks by 60%; deliver projects on-time and on-budget |
| **Pain Points** | Manual WBS creation (2-4 hours per project), status report writing (1-2 hours weekly), missed dependencies, scope creep undetected until late |
| **Key Features** | AI-generated WBS, daily summaries, risk prediction, scope creep detection, AI Review page |
| **Success Metrics** | WBS creation time < 5 min (vs 2-4 hours), weekly report generation automated, risk flagged 1+ week before deadline miss |
| **Autonomy Preference** | Propose mode (review before apply); gradually moving to execute for summaries and low-risk nudges |

#### Persona 2: Developer

| Attribute | Detail |
|-----------|--------|
| **Role** | developer |
| **Goals** | Know exactly what to work on next; minimize context switching; update task status efficiently |
| **Pain Points** | Unclear priorities, too many Slack messages asking for updates, dependency blocking discovered late |
| **Key Features** | What's Next dashboard, task detail view, dependency visualization, AI nudges via Slack |
| **Success Metrics** | Time to find next task < 30 seconds, status update via single click, zero "what are you working on?" Slack messages |
| **Autonomy Preference** | Propose mode for AI suggestions; execute mode for priority ranking |

#### Persona 3: Firm Administrator

| Attribute | Detail |
|-----------|--------|
| **Role** | site_admin |
| **Goals** | Control AI behavior, manage costs, ensure compliance, onboard clients |
| **Pain Points** | No visibility into AI decisions, unpredictable AI costs, compliance concerns with autonomous AI |
| **Key Features** | Autonomy policy configuration, cost dashboard, AI action audit trail, tenant management |
| **Success Metrics** | Full visibility into every AI decision, AI costs predictable and within budget, SOC 2 compliance |
| **Autonomy Preference** | Shadow mode initially; gradual elevation as trust builds |

#### Persona 4: Client Stakeholder

| Attribute | Detail |
|-----------|--------|
| **Role** | client |
| **Goals** | Real-time project visibility without pestering the PM; ask questions and get instant answers |
| **Pain Points** | Weekly status emails are stale, can't get answers between meetings, no self-service visibility |
| **Key Features** | Client portal with milestone view, scoped AI Q&A, feedback submission |
| **Success Metrics** | Self-service project status < 2 clicks, AI answers 60%+ of questions without PM escalation |
| **Autonomy Preference** | Execute mode — AI answers questions directly (scoped to projected data) |

---

## 3. Product Roadmap

### 3.1 Release Overview

| Release | Timeline | Theme | Feature Count | Key Milestone |
|---------|----------|-------|---------------|---------------|
| **R0** | Months 1-3 (Sprints 1-6) | Foundation | 35 | Core PM + AI WBS + Dashboard |
| **R1** | Months 4-6 (Sprints 7-12) | Intelligence | 39 | Risk Prediction + Integrations + AI PM Agent |
| **R2** | Months 7-9 (Sprints 13-18) | Growth | 28 | Client Portal + Billing + SOC 2 Type I |
| **R3** | Months 10-12 (Sprints 19-24) | Platform | 13 | Per-Tenant Learning + SOW Generator + Enterprise |

**Total:** 115 features across 24 sprints (12 months)

### 3.2 R0 — Foundation (Months 1-3)

**Objective:** Deliver a working PM platform with AI-generated WBS, What's Next prioritization, NL Query, and daily summaries. Developers can use it as their daily work hub.

| Feature Group | Features | Priority | Status |
|---------------|----------|----------|--------|
| **Authentication** | Email/password registration, JWT auth, refresh rotation, RBAC (4 roles) | P0 | DONE (R0-2) |
| **Project Management** | CRUD projects, phases, WBS baseline storage, soft delete | P0 | DONE (R0-2) |
| **Task Management** | CRUD tasks, status transitions, assignments, sub-tasks, dependencies (DAG), checklists, comments, @mentions | P0 | DONE (R0-2) |
| **Audit Trail** | Field-level audit, actor tracking (human/AI), immutable log | P0 | DONE (R0-2) |
| **Agent SDK** | AIOrchestrator, 4 subagents, 3 MCP servers, 8 hooks, session management | P0 | DONE (R0-3) |
| **AI: WBS Generator** | NL-to-WBS with domain templates (software, data migration, consultancy) | P0 | R0-4 |
| **AI: What's Next** | Rules-based task prioritization (deps → due date → priority) | P0 | R0-5 |
| **AI: NL Query** | Natural language questions about project state | P0 | R0-6 |
| **AI: Summary Writer** | Auto-generated daily/weekly status reports | P0 | R0-5 |
| **AI: Autonomy** | Shadow/propose/execute modes, confidence thresholds, rollback | P0 | R0-4, R0-6 |
| **Frontend** | Dashboard, task detail, AI review, NL query panel, auth pages, navigation | P0 | R0-4 to R0-6 |
| **Infrastructure** | Docker Compose, CI/CD, monitoring (CloudWatch + Sentry) | P0 | DONE (R0-1) + R0-6 |

**R0 Key Metrics:**
- WBS acceptance rate: >60%
- What's Next daily usage: >80% of developers
- API p95 latency: <500ms
- WBS generation p95: <30s
- Test coverage: 80%+

### 3.3 R1 — Intelligence (Months 4-6)

**Objective:** AI becomes proactive — predicting risks, nudging teams, and integrating with existing workflows (Slack, Git). Platform ready for SaaS operation.

| Feature Group | Features | Priority |
|---------------|----------|----------|
| **AI: Risk Predictor** | Delay pattern analysis, blocker duration tracking, proactive risk flagging | P1 |
| **AI: AI PM Agent** | 15-minute autonomous loop, overdue nudges, stalled work detection, escalation proposals | P1 |
| **AI: Scope Creep Detector** | WBS baseline delta monitoring, task addition tracking | P1 |
| **Slack Integration** | OAuth 2.0 app, nudge delivery via DM, daily summary push, `/dynsense` slash command | P1 |
| **Git Integration** | GitHub/GitLab webhooks, commit-to-task linking, PR status sync, branch name suggestions | P1 |
| **Views** | Kanban board, Calendar view, Table view, Saved views | P1 |
| **Custom Fields** | Per-project field definitions (text, number, date, select) | P1 |
| **Notifications** | In-app inbox, type filtering, preferences | P1 |
| **Security** | SSO (SAML 2.0/OIDC), MFA (TOTP), session hardening | P1 |
| **Feature Flags** | Tenant-level capability gating by plan tier | P1 |
| **Resource Optimization** | Workload balancing, burnout detection | P1 |

**R1 Key Metrics:**
- AI PM agent nudges delivered: >90% on time
- Risk prediction accuracy: >70%
- Slack integration adoption: >50% of users
- Status reports accepted without editing: >80%

### 3.4 R2 — Growth (Months 7-9)

**Objective:** Multi-tenant SaaS operational with paying clients. Client portal live. Monetization active. SOC 2 Type I initiated.

| Feature Group | Features | Priority |
|---------------|----------|----------|
| **Client Portal** | Read-only milestone view, scoped AI Q&A, client onboarding, feedback submission | P1 |
| **Billing** | Three-tier pricing (Starter/Pro/Enterprise), Stripe integration, cost dashboard, budget alerts | P1 |
| **Goals & OKRs** | Goal hierarchy, auto-progress calculation, AI risk flagging | P2 |
| **Automation Rules** | If-then rules, 10+ triggers, audit logged | P2 |
| **Documents & KB** | Markdown editor, draft/published, RAG-indexed | P2 |
| **AI Writing Assistant** | Draft, improve, summarize, translate tone | P2 |
| **Calendar Integration** | Google Calendar + Outlook sync, two-way task sync | P2 |
| **Webhooks** | Outbound subscriptions, HMAC-SHA256, retry, delivery log | P2 |
| **Gantt Chart** | Dependency visualization, timeline view | P2 |
| **Compliance** | SOC 2 Type I audit preparation, evidence collection | P1 |

**R2 Key Metrics:**
- Paying tenants: 3+
- Client NPS: >40
- Client AI self-service rate: >60%
- AI cost within 10% of per-tenant revenue
- SOC 2 Type I audit initiated

### 3.5 R3 — Platform (Months 10-12)

**Objective:** Consultancy moat features — per-tenant AI learning, SOW generation, enterprise tier. Platform differentiation that competitors cannot replicate without org-specific data.

| Feature Group | Features | Priority |
|---------------|----------|----------|
| **Per-Tenant AI Learning** | Tenant-scoped RAG, accuracy improvement from org delivery history | P2 |
| **AI Estimation Engine** | Historical data → effort predictions per tenant | P2 |
| **SOW Generator** | AI-generated statements of work from project history | P2 |
| **Template Intelligence** | Auto-build project templates from completed projects | P2 |
| **Knowledge Capture** | Lessons learned, best practices extraction | P2 |
| **Enterprise Tier** | Schema isolation evaluation, dedicated resources, custom limits | P1 |
| **AI Coaching** | PM delivery pattern feedback, retrospective facilitator | P2 |
| **Compliance** | SOC 2 Type I certification, Type II evidence collection | P1 |

**R3 Key Metrics:**
- Paying tenants: 10+
- Per-tenant AI accuracy measurably improved
- AI-generated SOWs used in real proposals
- Client retention: >90%
- SOC 2 Type I certified

---

## 4. Feature Specifications

### 4.1 AI-Powered WBS Generation (FR-201)

**User Story:** As a Consultancy PM, I want to describe a project in natural language and have the AI generate a structured work breakdown so that I can reduce WBS creation from 2-4 hours to under 5 minutes.

**Swarm Agent:** orchestrator-agent (AI Engine Swarm)

**Acceptance Criteria:**

| # | Criterion | Verification |
|---|----------|-------------|
| 1 | PM enters NL project description (min 50 characters) | Input validation |
| 2 | AI generates valid WBS with 3-7 phases and 10-50 tasks | Schema validation (Zod) |
| 3 | Each task includes: title, description, estimated effort, suggested priority, suggested dependencies | Output schema check |
| 4 | WBS generated in <30s (p95) | Performance test |
| 5 | Confidence score displayed (green >0.8, yellow 0.6-0.8, red <0.6) | UI rendering test |
| 6 | PM can approve, reject, or edit WBS before applying | E2E test |
| 7 | Approved WBS creates real tasks and dependencies in project | Integration test |
| 8 | WBS baseline stored as JSONB snapshot for scope creep comparison | DB verification |
| 9 | Domain-specific templates applied (software, data migration, consultancy) | Golden test set |
| 10 | Full audit trail: ai_action + ai_cost_log + ai_hook_log records created | Audit verification |

**Technical Specification:**

| Aspect | Detail |
|--------|--------|
| Model | Claude Opus |
| Token Profile | ~5K input / ~3K output |
| Permission Mode | acceptEdits (can create tasks) |
| MCP Tools | pm-db (R/W), pgvector (R), pm-nats (W) |
| Max Turns | 15 |
| Autonomy Default | Propose (human reviews before apply) |

### 4.2 What's Next Engine (FR-202)

**User Story:** As a Developer, I want to see a prioritized list of what I should work on next so that I can start my day without searching through task lists or waiting for PM direction.

**Swarm Agent:** orchestrator-agent (AI Engine Swarm)

**Acceptance Criteria:**

| # | Criterion | Verification |
|---|----------|-------------|
| 1 | Dashboard displays personalized What's Next list for logged-in developer | UI test |
| 2 | Priority algorithm: (1) unblocked (deps resolved), (2) overdue first, (3) due date ascending, (4) priority descending | Unit test |
| 3 | Blocked tasks excluded with "blocked by [TASK-xxx]" indicator | UI rendering |
| 4 | Tasks from all assigned projects aggregated | Cross-project query test |
| 5 | R0: Rules-based ranking; R1+: LLM-enhanced with velocity context | Feature flag gated |
| 6 | List refreshes on task status change (real-time via NATS in R1+) | Integration test |
| 7 | Click on task navigates to task detail view | E2E test |

**Technical Specification:**

| Aspect | Detail |
|--------|--------|
| Model | Rules engine (R0), Claude Sonnet (R1+) |
| Token Profile | ~1K input / ~500 output |
| Permission Mode | default (read-only) |
| MCP Tools | pm-db (R), pgvector (R) |
| Max Turns | 5 |
| Data Readiness | LLM upgrade requires 50+ completed tasks per tenant |

### 4.3 NL Query Engine (FR-203)

**User Story:** As a PM, I want to ask natural language questions about my projects ("what's blocked?", "who's overdue?", "how many tasks are in QA?") and get instant, accurate answers so that I don't have to manually filter and count.

**Swarm Agent:** orchestrator-agent (AI Engine Swarm)

**Acceptance Criteria:**

| # | Criterion | Verification |
|---|----------|-------------|
| 1 | Cmd+K opens NL query panel | E2E test |
| 2 | User types question in natural language | Input handling test |
| 3 | Response streams in real-time (not batch) | Streaming verification |
| 4 | Response includes data references (task links, counts) — no hallucinated entities | Golden test set |
| 5 | Suggested follow-up queries displayed | UI test |
| 6 | Response generated in <8s (p95) | Performance test |
| 7 | R0: Single-shot queries; R0-6: Multi-turn conversational (FR-3011) | Feature progression |
| 8 | Results scoped to user's tenant only (cross-tenant query impossible) | Security test |

**Technical Specification:**

| Aspect | Detail |
|--------|--------|
| Model | Claude Sonnet |
| Token Profile | ~2K input / ~1K output |
| Permission Mode | default (read-only) |
| MCP Tools | pm-db (R), pgvector (R) |
| Max Turns | 10 |

### 4.4 Daily Summary Writer (FR-204)

**User Story:** As a Consultancy PM, I want the AI to automatically generate daily and weekly status reports so that I can review and distribute them instead of writing them from scratch.

**Swarm Agent:** orchestrator-agent (AI Engine Swarm)

**Acceptance Criteria:**

| # | Criterion | Verification |
|---|----------|-------------|
| 1 | Daily summary auto-generates via scheduled job (configurable time) | Cron verification |
| 2 | Summary includes: tasks completed, tasks started, blockers, upcoming deadlines, key events | Golden test set |
| 3 | Narrative is coherent, <500 words | Output validation |
| 4 | Correct task counts (no hallucinated numbers) | Data reconciliation test |
| 5 | Summary appears on dashboard AI summary card | UI test |
| 6 | PM can edit before distribution | E2E test |
| 7 | In R1+: auto-push to configured Slack channel | Integration test |

**Technical Specification:**

| Aspect | Detail |
|--------|--------|
| Model | Claude Sonnet |
| Token Profile | ~3K input / ~1K output |
| Permission Mode | default (read-only) |
| MCP Tools | pm-db (R), pgvector (R) |
| Max Turns | 5 |
| Autonomy Default | Propose (R0), Execute (R1+ for low-risk) |

### 4.5 Three-Tier Autonomy Model (FR-300 series)

**User Story:** As a Firm Administrator, I want to control how much autonomy the AI has — from logging-only (shadow) to full automation (execute) — so that I can build trust incrementally while maintaining oversight.

**Swarm Agent:** policy-agent (AI Engine Swarm)

**Acceptance Criteria:**

| # | Criterion | Verification |
|---|----------|-------------|
| 1 | Three modes configurable per tenant: shadow, propose, execute | Config API test |
| 2 | Shadow mode: AI runs full pipeline, logs result, no mutations visible to non-admins | Integration test |
| 3 | Propose mode: AI generates proposal, human approves/rejects/edits via AI Review page | E2E test |
| 4 | Execute mode: AI applies changes directly, logged with full audit trail | Integration test |
| 5 | Per-capability overrides (e.g., summary-writer always execute, WBS always propose) | Config test (R1) |
| 6 | Confidence threshold (default 0.6): low confidence routes to human regardless of mode | Unit test |
| 7 | Quiet hours: block nudges outside configured hours | Midnight-wrapping test |
| 8 | Nudge limits: max 2 per task per day | Rate limit test |
| 9 | Daily AI cost cap per tenant with Redis tracking | Budget enforcement test |
| 10 | One-click rollback of any AI mutation via stored pre-action snapshot | Rollback E2E test |

### 4.6 Client Portal (FR-700 series)

**User Story:** As a Client Stakeholder, I want to log into a portal and see my project's progress with milestones and completion percentages, and ask the AI questions about the project, so that I don't have to wait for weekly status emails.

**Swarm Agent:** portal-agent (Platform Swarm)

**Acceptance Criteria:**

| # | Criterion | Verification |
|---|----------|-------------|
| 1 | Client-specific login page with tenant branding | UI test |
| 2 | Milestone view shows projected tasks (PM-selected, client-visible) | Projection layer test |
| 3 | Completion percentage calculated from visible tasks only | Calculation test |
| 4 | AI Q&A scoped to projected data — never exposes internal tasks, costs, or team discussions | Security test |
| 5 | Client can submit structured feedback on deliverables | E2E test |
| 6 | Separate route group `/client/*` with simplified navigation | Route test |
| 7 | Full audit trail on client actions | Audit test |

### 4.7 Integrations (FR-400, FR-420 series)

**User Story:** As a Consultancy PM, I want Dynsense to connect to our Slack workspace and GitHub repos so that the AI PM Agent can nudge developers where they already work and auto-update tasks from code activity.

**Swarm Agent:** comms-agent, git-agent (Integration Swarm)

**Acceptance Criteria — Slack:**

| # | Criterion | Verification |
|---|----------|-------------|
| 1 | OAuth 2.0 Slack app installation per tenant | OAuth flow test |
| 2 | AI nudges delivered to assigned user's Slack DM | Message delivery test |
| 3 | Daily summary posted to configured channel | Scheduled delivery test |
| 4 | `/dynsense` slash command triggers NL Query | Command handling test |
| 5 | Channel mapping: project → Slack channel configurable | Config test |
| 6 | Per-user notification preferences (opt-in/out) | Preference test |

**Acceptance Criteria — Git:**

| # | Criterion | Verification |
|---|----------|-------------|
| 1 | GitHub App installation with repository permissions | OAuth flow test |
| 2 | Commit-to-task linking via `[TASK-xxx]` in commit messages | Webhook parsing test |
| 3 | Auto-transition task to `review` on PR open, `completed` on merge | Status sync test |
| 4 | Branch name suggestion from task title | AI suggestion test |
| 5 | CI pipeline status displayed on task sidebar | UI rendering test |

---

## 5. Non-Functional Product Requirements

### 5.1 Performance Requirements

| Requirement | Target (R0) | Target (R3) | User Impact |
|-------------|-------------|-------------|-------------|
| API CRUD p95 latency | <500ms | <500ms | Instant-feeling task operations |
| WBS generation p95 | <30s | <20s | PM doesn't lose context waiting |
| NL Query p95 | <8s | <5s | Conversational feel for Q&A |
| Vector search p95 | <100ms | <100ms | RAG context retrieval invisible |
| Dashboard load time | <2s | <1s | Developers check daily without friction |
| Concurrent users | 50 | 1,000 | Scales from pilot to enterprise |

### 5.2 Reliability Requirements

| Requirement | Target | User Impact |
|-------------|--------|-------------|
| System availability | 99.9% uptime | Platform always accessible |
| Health check interval | 30s | Fast failure detection |
| AI failure graceful degradation | Template fallback, ask_human | AI outage doesn't block work |
| Zero data loss | WAL replication, NATS persistence | No lost tasks or comments ever |

### 5.3 Security Requirements

| Requirement | Priority | Release | User Impact |
|-------------|----------|---------|-------------|
| Three-layer tenant isolation | P0 | R0 | Data absolutely private per client |
| Prompt injection defense | P0 | R0 | AI cannot be manipulated by malicious input |
| SOC 2 Type I | P1 | R2-R3 | Enterprise procurement requirement met |
| SSO + MFA | P1 | R1 | Meets corporate security policies |
| Encryption at rest + in transit | P0 | R0-R1 | Data protected at all layers |

### 5.4 AI Quality Requirements

| Requirement | Target | Alert Threshold | User Impact |
|-------------|--------|----------------|-------------|
| WBS acceptance rate | >60% | <60% triggers review | Useful WBS more often than not |
| AI override rate | <40% | >40% triggers recalibration | AI suggestions mostly correct |
| Hallucination incidents | Zero | Any occurrence → P0 | Trust in AI outputs |
| Confidence accuracy | Mean >0.6 | <0.6 triggers review | Confidence scores are meaningful |

---

## 6. User Experience Specifications

### 6.1 Key UI Surfaces

| Surface | Persona | Purpose | Release |
|---------|---------|---------|---------|
| **Dashboard** | Developer, PM | What's Next list, AI summary card, project overview, confidence gauges | R0 |
| **Task Detail** | Developer, PM | Three-column: details + sidebar + activity. Primary work surface. | R0 |
| **AI Review** | PM, Admin | High-density proposal list. Approve/reject/edit. Confidence badges. Bulk actions. | R0 |
| **NL Query** | PM, Developer | Cmd+K slide-out panel. Streaming response. Suggested queries. Task links. | R0 |
| **Task List** | Developer, PM | Filterable, sortable task list. Quick status update. | R0 |
| **Kanban Board** | Developer, PM | Column-based task view. AI-annotated blocked flags. | R1 |
| **Calendar View** | PM | Month/week/day. Task chips colored by priority/status. | R1 |
| **Table View** | PM | Spreadsheet-style. Inline edit. Bulk operations. | R1 |
| **Client Portal** | Client | Milestones, completion %, AI assistant. Simplified navigation. | R2 |
| **Settings** | Admin | AI policy config, integration setup, user management, cost dashboard. | R0-R2 |

### 6.2 Design System

| Element | Specification |
|---------|---------------|
| **Typography** | Inter, text-xs (12px) baseline |
| **AI Color** | Violet-600 (#7C3AED) — all AI-initiated elements |
| **Confidence** | Green (>0.8), Yellow (0.6-0.8), Red (<0.6) |
| **Priority** | Red (critical), Orange (high), Yellow (medium), Blue (low) |
| **Status** | Created (gray), Ready (blue), In Progress (yellow), Review (purple), Completed (green), Blocked (red), Cancelled (gray strikethrough) |
| **Grid** | 4px base, Tailwind spacing |
| **Animations** | 300ms spring, prefers-reduced-motion respected |
| **Responsive** | Desktop-first, functional at 768px+ |

### 6.3 Information Architecture

```
app/
├── (internal)/                    # PM interface (authenticated)
│   ├── dashboard/                 # What's Next + AI summary + projects
│   ├── projects/
│   │   └── [id]/                  # Project detail
│   │       ├── tasks/             # Task list, kanban, calendar, table views
│   │       ├── settings/          # Project-level settings
│   │       └── reports/           # AI-generated reports
│   ├── ai-review/                 # Pending AI proposals
│   ├── notifications/             # Inbox (R1)
│   ├── goals/                     # OKRs (R2)
│   ├── documents/                 # Knowledge base (R2)
│   └── settings/                  # Profile, AI policy, integrations, users
├── (portal)/                      # Client-facing (R2)
│   └── [tenantSlug]/
│       ├── overview/              # Milestone dashboard
│       ├── deliverables/          # Client-visible tasks
│       └── ask/                   # AI Q&A (scoped)
└── (auth)/                        # Login, register, SSO
    ├── login/
    ├── register/
    └── sso/
```

---

## 7. Data Model (Product Perspective)

### 7.1 Core Entities

| Entity | Description | Key Relationships |
|--------|-------------|-------------------|
| **Tenant** | An organization (consultancy firm) | Has many Users, Projects, Configs |
| **User** | A person within a tenant | Belongs to Tenant, has Role, assigned Tasks |
| **Project** | A client engagement or internal initiative | Belongs to Tenant, has Phases, Tasks, WBS baseline |
| **Phase** | A stage within a project (e.g., Discovery, Build, Deliver) | Belongs to Project, contains Tasks |
| **Task** | A unit of work | Belongs to Project/Phase, has Assignees, Dependencies, Checklists, Comments |
| **Dependency** | A blocking relationship between tasks (DAG) | Links two Tasks (blocker → blocked) |
| **Comment** | A note on a task | Belongs to Task, has @mentions, client_visible flag |
| **AI Action** | A record of an AI operation | Links to Capability, Session, Cost, Hooks |
| **AI Session** | A multi-turn AI conversation | Belongs to User/Tenant, has Turns, can be Forked |

### 7.2 Database Scale Targets

| Metric | R0 | R1 | R2 | R3 |
|--------|-----|-----|-----|-----|
| Tenants | 1 (internal) | 3 (pilot) | 20 (paying) | 100+ |
| Users per tenant | 5-10 | 10-25 | 25-50 | 100+ |
| Projects per tenant | 3-5 | 5-15 | 15-30 | 50+ |
| Tasks total | 1,000 | 10,000 | 50,000 | 100,000+ |
| AI actions/month | 500 | 5,000 | 25,000 | 100,000+ |
| Embeddings (1536-dim) | 5,000 | 50,000 | 200,000 | 1,000,000+ |

---

## 8. Monetization Strategy

### 8.1 Pricing Tiers

| Tier | Price | Users | Projects | AI Features | Target |
|------|-------|-------|----------|-------------|--------|
| **Starter** | $29/month | Up to 5 | Up to 3 | WBS, What's Next, NL Query, Summaries | Solo consultants, small teams |
| **Pro** | $99/month | Up to 25 | Unlimited | All Starter + Risk Predictor, AI PM Agent, Integrations, Client Portal | Growing consultancies |
| **Enterprise** | $249+/month | Custom | Unlimited | All Pro + Per-Tenant Learning, SOW Generator, SSO/MFA, Dedicated Support | Large firms, compliance-focused |

### 8.2 AI Usage Economics

| Capability | Avg Tokens/Call | Avg Cost/Call | Monthly Volume (Pro) | Monthly AI Cost |
|------------|----------------|---------------|---------------------|-----------------|
| WBS Generator | 8,000 | $0.24 | 10 | $2.40 |
| What's Next | 1,500 | $0.01 | 200 | $2.00 |
| NL Query | 3,000 | $0.02 | 150 | $3.00 |
| Summary Writer | 4,000 | $0.02 | 30 | $0.60 |
| AI PM Agent | 2,500 | $0.02 | 720 | $14.40 |
| Risk Predictor | 6,000 | $0.18 | 30 | $5.40 |
| **Total** | | | | **~$28/month** |

**Unit Economics (Pro tier):** $99 revenue - $28 AI cost - $15 infrastructure = **$56 gross margin (57%)**

### 8.3 Budget Controls

| Control | Implementation | User Impact |
|---------|---------------|-------------|
| Daily cost cap | Redis tracking per tenant | Prevents runaway AI spend |
| Budget alerts | Notification at 80% and 100% | Admin awareness |
| Pre-flight budget check | Verify budget before LLM call | Graceful denial, not surprise charges |
| Usage-based overage | Per-token billing beyond plan allowance (R3) | Scale without plan upgrades |

---

## 9. Success Metrics & KPIs

### 9.1 Product KPIs

| KPI | R0 Target | R1 Target | R2 Target | R3 Target |
|-----|-----------|-----------|-----------|-----------|
| WBS creation time (vs manual) | 5 min (vs 2-4 hrs) | 3 min | 2 min | 1 min |
| Weekly PM admin time saved | 4 hours | 8 hours | 12 hours | 15+ hours |
| Developer "time to next task" | <30s | <15s | <10s | <5s |
| AI suggestion acceptance rate | >60% | >70% | >75% | >80% |
| Daily active users (per tenant) | >50% | >60% | >70% | >80% |
| Client self-service rate | — | — | >60% | >80% |

### 9.2 Business KPIs

| KPI | R0 Target | R1 Target | R2 Target | R3 Target |
|-----|-----------|-----------|-----------|-----------|
| Paying tenants | 0 (internal) | 3 (pilot) | 20 | 100 |
| MRR | $0 | $297 | $1,980 | $9,900+ |
| Client NPS | — | — | >40 | >50 |
| Client retention (monthly) | — | — | >90% | >95% |
| AI cost as % of revenue | — | — | <30% | <25% |

### 9.3 Technical KPIs

| KPI | Target | Measurement |
|-----|--------|-------------|
| API availability | 99.9% | CloudWatch uptime |
| Deploy frequency | 2+ per week | CI/CD pipeline |
| Mean time to recovery (MTTR) | <1 hour | Incident tracking |
| Test coverage | 80%+ | CI coverage report |
| Security vulnerabilities (high/critical) | Zero | OWASP ZAP + Trivy |

---

## 10. Constraints & Assumptions

### 10.1 Constraints

| Constraint | Detail |
|-----------|--------|
| **Team size** | 5-7 engineers — architecture must minimize operational overhead |
| **AI provider** | Claude API (Anthropic) — no self-hosted LLM (ADR-001) |
| **Cloud provider** | AWS — ECS Fargate, RDS, ElastiCache, S3 (ADR-008, ADR-009) |
| **Language** | English-only for R0-R3 |
| **Platform** | Web-responsive only — no native mobile apps |
| **Budget (R0)** | ~$380/month infrastructure |
| **Swarm parallelism** | Max 4 concurrent agents per sprint (NFR-050) |

### 10.2 Assumptions

| Assumption | Risk If Wrong |
|-----------|---------------|
| Consultancy PMs will trust AI-generated WBS | Low adoption → pivot to propose-only mode |
| Claude API reliability sufficient for production | Need circuit breaker + template fallbacks |
| 50+ completed tasks provides enough signal for LLM ranking | Delay What's Next LLM upgrade, extend rules-based |
| Firms will pay $99-249/month for AI PM | Price sensitivity → adjust tiers |
| SOC 2 is sufficient for enterprise procurement | May need additional certifications (ISO 27001, HIPAA) |

### 10.3 Out of Scope

| Item | Rationale |
|------|-----------|
| Native mobile applications | Web-responsive sufficient for v1; mobile app in future |
| On-premise deployment | Cloud-only SaaS reduces operational complexity |
| Non-English language support | Focus on English-speaking consultancies first |
| Custom LLM fine-tuning | Prompt engineering + RAG provides sufficient quality |
| Real-time collaborative editing | Single-user edit model; collaborative editing is a separate product |
| Video/voice features | PM tools don't need built-in conferencing |

---

## 11. Dependencies & Risks

### 11.1 External Dependencies

| Dependency | Provider | Risk | Mitigation |
|-----------|----------|------|------------|
| Claude API | Anthropic | API downtime blocks AI features | Circuit breaker, graceful degradation, template fallbacks |
| Slack API | Salesforce | Breaking changes, rate limits | Version-pinned SDK, webhook fallback |
| GitHub API | Microsoft | Token permission changes | GitHub App model (stable), version-pinned API |
| Stripe API | Stripe | Payment processing changes | Stripe SDK with webhook-driven flow |
| PostgreSQL pgvector | Open source | Extension compatibility with RDS | Pin extension version, test on upgrades |

### 11.2 Product Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| WBS quality too generic for niche domains | Medium | High | Domain-specific templates, golden test sets, continuous PM feedback |
| AI costs exceed per-tenant revenue | Medium | High | Pre-flight budget checks, cost caps, tiered AI allowances |
| Low trust in AI decisions | Medium | High | Shadow mode trust-building period, full transparency, one-click rollback |
| Scope creep on R0 | High | Medium | Strict feature lock, only WBS + What's Next + NL Query + Summary in R0 |
| Slow frontend velocity | Medium | Medium | Shadcn pre-built components, design system, component library |
| Client portal adoption | Medium | Medium | Early pilot with internal projects, iterate on feedback |
| Competitor feature parity | Low | Medium | AI-native architecture is structural advantage, not a feature checkbox |

### 11.3 Data Readiness Dependencies

| Feature | Min Data Required | Blocks | Earliest Available |
|---------|-------------------|--------|-------------------|
| What's Next (LLM upgrade) | 50+ completed tasks per tenant | Enhanced ranking in R1 | Mid-R1 |
| Risk Predictor | 100+ task status transitions | Risk model accuracy | Early R1 |
| Per-Tenant Learning | 2+ completed projects per tenant | Org-specific intelligence | Early R3 |
| AI Estimation Engine | 200+ tasks with estimate vs actual effort | Effort predictions | Mid-R3 |

---

## 12. Swarm Parallel Implementation Strategy

### 12.1 Feature-to-Swarm Mapping

| Feature Domain | Primary Swarm | Concurrent Agents | Max Parallelism |
|----------------|--------------|-------------------|-----------------|
| Authentication | Backend API Swarm | auth-agent | 1 |
| Project/Task CRUD | Backend API Swarm | project-agent, task-agent | 2 (parallel) |
| AI Orchestration | AI Engine Swarm | orchestrator-agent, sdk-agent | 2 (parallel) |
| MCP Servers | AI Engine Swarm | mcp-agent | 1 |
| Lifecycle Hooks | AI Engine Swarm | hooks-agent | 1 |
| Frontend UI | Frontend Swarm | frontend-agent | 1 |
| Slack/Teams | Integration Swarm | comms-agent | 1 |
| Git Providers | Integration Swarm | git-agent | 1 (parallel with comms) |
| Calendar | Integration Swarm | calendar-agent | 1 (parallel with comms + git) |
| Client Portal | Platform Swarm | portal-agent | 1 |
| Billing | Platform Swarm | billing-agent | 1 (parallel with portal) |
| Database Schema | Data Swarm | core-schema-agent, ai-schema-agent | 2 (parallel) |
| Infrastructure | Infrastructure Swarm | compute-agent, data-agent, cicd-agent | 3 (2 parallel + 1 sequential) |

### 12.2 Sprint Parallelism Example (R0-4)

```
Week 7-8 Parallel Execution:

  orchestrator-agent ──────────────────────►  WBS prompt templates + context assembler
  policy-agent ────────────────────────────►  Shadow mode + autonomy config
  frontend-agent ──────────────────────────►  AI Review page + autonomy settings UI
  qa-agent ────────────────────────────────►  Integration tests for WBS cycle

                                           │
                                    SYNC BARRIER
                                           │
                                           ▼
                              Integration test suite runs
                              All agents merge if passing
```

### 12.3 Parallelism Constraints

| Constraint | Rationale | Enforcement |
|-----------|-----------|-------------|
| Max 4 concurrent implementation agents per sprint | Prevent merge conflict explosion | Sprint planning review |
| Shared type changes require sync barrier | `@dynsense/shared` is cross-agent contract | CI gate blocks merge until barrier clears |
| Each agent passes module-level tests before merge | Gate quality at agent boundary | CI required status checks |
| Integration test suite runs after all agents merge | Catch cross-module regressions | Post-merge CI pipeline |
| DB migrations numbered sequentially | Prevent migration ordering conflicts | Shared counter file |

---

## 13. PRD Traceability Matrix

### 13.1 PRD Section → Requirements Mapping

| PRD Section | Requirements Covered | Design Doc Section | QA Plan Section |
|-------------|---------------------|-------------------|-----------------|
| §4.1 WBS Generator | FR-200, FR-201 | §4.1, §4.2 | §2.3 WBS golden tests |
| §4.2 What's Next | FR-202 | §4.2 | §2.3 What's Next golden tests |
| §4.3 NL Query | FR-203, FR-3011 | §4.2 | §2.3 NL Query golden tests |
| §4.4 Summary Writer | FR-204 | §4.2 | §2.3 Summary golden tests |
| §4.5 Autonomy Model | FR-300 to FR-308 | §4.3 | §2.3 Autonomy mode tests |
| §4.6 Client Portal | FR-700 to FR-705 | §7.2, §7.3 | §2.6 Client portal E2E |
| §4.7 Integrations | FR-400 to FR-426 | §7.1 | §2.6 Integration flow E2E |
| §5.1 Performance | NFR-001 to NFR-007 | §10 | §2.5 Load tests |
| §5.2 Reliability | NFR-020 to NFR-024 | §9 | §2.5 Stress tests |
| §5.3 Security | NFR-010 to NFR-017 | §8 | §2.4 Security tests |
| §5.4 AI Quality | NFR-040 to NFR-044 | §4.2 | §2.3 AI quality metrics |
| §8 Monetization | FR-720 to FR-726 | §3.2 | §2.6 Billing E2E |

### 13.2 Persona → Feature Mapping

| Persona | Primary Features | Key Metrics |
|---------|-----------------|-------------|
| **Consultancy PM** | WBS Generator, Summary Writer, Risk Predictor, AI Review, Scope Creep Detector, NL Query | WBS creation time, weekly hours saved, risk detection lead time |
| **Developer** | What's Next, Task Detail, Dependency Visualization, AI Nudges (Slack) | Time to next task, status update friction, zero "what are you working on?" messages |
| **Firm Admin** | Autonomy Config, Cost Dashboard, Audit Trail, User Management, Feature Flags | AI cost predictability, full decision visibility, compliance status |
| **Client Stakeholder** | Client Portal, Scoped AI Q&A, Milestone View, Feedback Submission | Self-service rate, AI answer quality, satisfaction score |

---

## 14. Approval & Review

### 14.1 Document Review Cycle

| Reviewer | Focus Area | Status |
|----------|-----------|--------|
| Product Owner | Vision, priorities, personas, success metrics | Pending |
| Engineering Lead | Technical feasibility, swarm parallelism, constraints | Pending |
| AI/ML Lead | AI capabilities, quality metrics, model selection | Pending |
| Security Lead | Security requirements, compliance timeline, audit controls | Pending |
| Design Lead | UX specifications, information architecture, design system | Pending |

### 14.2 Change Control

All changes to this PRD after approval must follow:

1. Change request submitted with rationale and impact analysis
2. Impact assessment on related documents (design-doc, implementation-plan, qa-plan, audit-doc)
3. Review by affected swarm agent owners
4. Approval by Product Owner
5. All affected documents updated atomically
6. Traceability matrix updated to reflect changes
