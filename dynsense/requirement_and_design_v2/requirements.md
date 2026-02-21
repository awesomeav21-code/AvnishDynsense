# AI-Native PM Tool — Software Requirements Specification

> **Version:** 1.1
> **Date:** February 10, 2026
> **Status:** Draft
> **Aligned to:** Architecture v3.1 (Feb 2026) · Product Roadmap v2.2 · UI/UX Design v1.0

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | February 9, 2026 | Initial SRS — 103 features (FR-100 through FR-2014), 12 NFRs, 5 personas, traceability matrix |
| v1.1 | February 10, 2026 | Architecture alignment with v3.1 (12 streams, 30 tables, 14 modules, ~85 endpoints). Added UI/UX design cross-refs (21 wireframes W-01 through W-21). Added Document Ecosystem section. Enhanced traceability matrix with architecture tier and UI wireframe mappings. Verified all 103 features. Updated "Aligned to" references. |

---

## Document Ecosystem

All design documents for the AI-Native PM Tool are listed below. Cross-references throughout this SRS use the prefixes defined in Section 1.5.

| Document | File | Version | Purpose |
|----------|------|---------|---------|
| **Software Requirements Specification** | `requirements.md` (this document) | v1.1 | 103 functional requirements (FR-100–FR-2014), 12 NFRs, personas, traceability |
| **System Architecture** | `architecture-v3.1.md` | v3.1 | 10-tier architecture, 12 Mermaid diagrams, 30 DDL tables, 12 NATS streams, 11 consumers, 14 modules, ~85 endpoints, 7 subsystem architectures, 12 ADRs |
| **Technical Design** | `design.md` | v1.0 | Implementable specifications for all 10 tiers, database schemas, API contracts, event flows, deployment configs |
| **Product Roadmap** | `roadmap-v2.md` | v2.2 | 103 in-year features (F-001–F-103), 9 post-12-month features (F-104–F-112), release gates, cut lines |
| **UI/UX & System Design** | `ui-ux-design.md` | v1.0 | 21 ASCII wireframes (W-01–W-21), design tokens, component architecture, interaction patterns, accessibility (WCAG AA), performance budgets |
| **Implementation Plan** | `implementation-plan.md` | v1.0 | 24 sprints across R0–R3, feature-to-sprint mapping, dependency sequencing |

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) defines the complete functional and non-functional requirements for the AI-Native PM Tool. It translates the 103-feature product roadmap (v2.2) and the system architecture (v3.1) into formal, testable requirements that engineering, QA, and product teams use as the single source of truth for implementation.

### 1.2 Scope

The AI-Native PM Tool is an AI-first project management platform where the AI runs the project and the human supervises. The product targets consultancy firms as the first vertical, delivering AI-generated work breakdown structures, autonomous project monitoring, client-safe reporting, and per-tenant intelligence over a 12-month, four-release roadmap (R0 through R3).

This document covers all 103 in-year features (F-001 through F-103), 12 non-functional requirements, data requirements, integration requirements, and traceability back to both the roadmap and architecture documents.

### 1.3 Glossary of Key Terms

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

### 1.4 Document Conventions

- **FR-xxx**: Functional Requirement (numbered by domain group)
- **NFR-xxx**: Non-Functional Requirement
- **F-xxx**: Roadmap feature identifier (F-001 through F-103)
- **AC-n**: Acceptance Criterion within a requirement
- **Release tags**: R0 (months 1-3), R1 (months 4-6), R2 (months 7-9), R3 (months 10-12)
- **Priority**: Cannot Cut / Could Defer / Optional
- **Design references**: Refer to architecture document sections (design.md section numbers)
- **Wireframe references**: Refer to UI/UX design document wireframes (W-xx from ui-ux-design.md)
- **Architecture tier**: Refer to the 10-tier architecture (Tier 1–10 from architecture-v3.1.md)

### 1.5 Cross-Reference Scheme

Every functional requirement maps to exactly one roadmap feature (F-xxx) and references the relevant architecture tier. The enhanced traceability matrix in Section 28 provides the complete mapping including architecture tiers and UI wireframe sections.

| Prefix | Source Document | Example |
|--------|----------------|---------|
| **FR-xxx** | requirements.md (this document) | FR-200 (NL to WBS) |
| **NFR-xxx** | requirements.md (this document) | NFR-001 (Performance) |
| **F-xxx** | roadmap-v2.md | F-011 (NL project setup) |
| **ADR-xxx** | architecture-v3.1.md / design.md | ADR-001 (Hosted Claude API) |
| **W-xxx** | ui-ux-design.md | W-06 (Task Detail wireframe) |
| **Tier N** | architecture-v3.1.md | Tier 4 (AI Engine) |

---

## 2. Product Vision

### 2.1 Problem Statement

Project managers in consultancy firms spend 60%+ of their time on low-value operational overhead: chasing status updates from team members, manually compiling progress reports for clients, shuffling task priorities when blockers emerge, and reconstructing project context for new team members. This administrative burden means PMs spend more time reporting on work than enabling it. Meanwhile, developers waste cognitive cycles figuring out what to work on next, navigating complex dependency chains, and context-switching between communication tools and project trackers.

Existing PM tools (Jira, Asana, Monday.com) digitize the overhead without eliminating it. Their recent AI additions bolt intelligence onto fundamentally manual workflows. The interaction model remains: human operates, tool records.

### 2.2 Vision Statement

**"The AI runs the project. The human supervises."**

The AI-Native PM Tool inverts the traditional PM interaction model. The AI generates project structures from natural language descriptions, tells each developer what to work on and why, autonomously chases stalled work, predicts risks before they materialize, and generates client-ready reports from real delivery data. Humans review, approve, and override — they do not manually operate.

### 2.3 Target Market

**Primary vertical:** Consultancy firms (software delivery, data migration, engineering services). This vertical values audit trails, client-safe reporting, per-engagement intelligence, and SOW generation — all capabilities that the AI engine delivers natively.

**Secondary expansion:** Technology companies with PM-heavy workflows, professional services firms, and agencies managing multiple client engagements simultaneously.

### 2.4 Competitive Context

| Competitor | Position | Our Differentiation |
|------------|----------|-------------------|
| **Motion** | $75M raised, $550M valuation, 10K+ B2B customers. Agentic AI suite for SMBs. | We are consultancy-specific: client portals, projection layers, SOW generation, per-tenant learning. |
| **Monday.com AI** | AI bolted onto massive existing user base. Distribution advantage. | Fundamentally different interaction model — AI-first, not AI-added. |
| **Asana Intelligence** | AI features on enterprise PM platform. | Our AI is structural (event-driven, autonomous), not a feature layer. |
| **ClickUp Brain** | AI assistant across workspace. Broad but shallow. | Deep vertical intelligence beats broad horizontal features. |

**Market size:** AI in project management projected at $5.7B by 2026 (17.3% CAGR).

### 2.5 Business Objectives

| Objective | Target | Measurement |
|-----------|--------|-------------|
| Internal adoption (R0-R1) | 100% internal team using daily by end of R0 | Daily active usage of NL-to-WBS and "What's Next" |
| Pilot client validation (R1) | 1-2 pilot clients with positive feedback | Client NPS, qualitative feedback |
| Paying tenants (R2) | 3+ paying client tenants | Active subscriptions, revenue |
| Scale (R3) | 10+ paying tenants | Active subscriptions, per-tenant AI improvement |
| Retention (R3) | 90%+ client retention rate | Monthly churn rate < 10% |
| AI quality (R1+) | NL-to-WBS acceptance > 60% | Acceptance rate tracking |
| Unit economics (R2) | Positive gross margin per tenant | Revenue vs. infrastructure + AI cost per tenant |

---

## 3. User Personas

### 3.1 Site Admin

| Attribute | Description |
|-----------|-------------|
| **Role** | Site Admin |
| **Goals** | Configure tenant settings, manage users and roles, monitor AI behavior, control autonomy policies, ensure platform security and compliance |
| **Pain Points** | Cannot trust AI without visibility into its decisions; needs to build confidence gradually; must ensure no data leakage across tenants; compliance documentation is manual and error-prone |
| **Key Feature Interactions** | F-010 (configurable values), F-015 (autonomy policy), F-017 (shadow mode), F-020 (traceability), F-022 (monitoring dashboard), F-044 (feature flags), F-046 (cost tracking) |
| **Release Entry** | R0 |

### 3.2 Developer

| Attribute | Description |
|-----------|-------------|
| **Role** | Developer |
| **Goals** | Know what to work on next without context-switching; update task status efficiently; respond to AI nudges via Slack; understand project context quickly |
| **Pain Points** | Wastes time figuring out priorities; dependency chains are opaque; status meetings interrupt flow; onboarding to mid-project engagements is slow |
| **Key Feature Interactions** | F-012 (What's Next), F-014 (NL querying), F-023 (task detail), F-026 (comments), F-028 (AI PM agent nudges), F-036 (Slack integration) |
| **Release Entry** | R0 |

### 3.3 Project Manager (R3)

| Attribute | Description |
|-----------|-------------|
| **Role** | Project Manager |
| **Goals** | Manage projects within designated clients, create and assign tasks, review AI suggestions, generate client reports, plan sprints |
| **Pain Points** | Spends 60%+ time on status chasing and manual reporting; client communication requires sanitizing internal details; estimation is guesswork without historical data |
| **Key Feature Interactions** | F-011 (NL-to-WBS), F-016 (AI review UI), F-029 (status reports), F-030 (risk prediction), F-057 (client reporting), F-067 (predictive dating), F-081 (PM role) |
| **Release Entry** | R3 (uses Admin role in R0-R2) |

### 3.4 Client

| Attribute | Description |
|-----------|-------------|
| **Role** | Client (external user) |
| **Goals** | View project progress without noise, ask natural language questions about delivery, approve deliverables, receive regular status updates |
| **Pain Points** | Status reports are stale by the time they arrive; internal project complexity is confusing; cannot get real-time answers without scheduling a call |
| **Key Feature Interactions** | F-055 (client portal), F-056 (client permissions), F-057 (automated reporting), F-059 (client AI assistant), F-062 (data export) |
| **Release Entry** | R2 |

### 3.5 AI PM Agent (System Actor)

| Attribute | Description |
|-----------|-------------|
| **Role** | AI PM Agent (autonomous system actor) |
| **Goals** | Generate WBS from natural language, prioritize developer work, chase stalled tasks, predict risks, generate summaries, maintain project momentum without human initiation |
| **Pain Points** | Insufficient historical data reduces prediction accuracy; hallucination risk requires guardrails; trust must be earned gradually through shadow mode and transparency |
| **Key Feature Interactions** | F-011 (WBS generation), F-012 (What's Next), F-013 (summaries), F-028 (PM agent), F-030 (risk prediction), F-033 (auto-escalation), F-034 (scope creep detection) |
| **Release Entry** | R0 (rules-based) evolving through R3 (per-tenant learning) |

### 3.6 Persona-Feature Matrix

| Feature Area | Site Admin | Developer | Project Manager | Client | AI PM Agent |
|-------------|-----------|-----------|----------------|--------|-------------|
| Platform Foundation (F-001 to F-010) | Configure, Manage | Use | Use (R3) | — | Consume events |
| AI Core Loop (F-011 to F-014) | Monitor, Configure | Consume | Review, Approve | — | Execute |
| AI Safety (F-015 to F-019) | Configure policies | Observe | Review proposals | — | Governed by |
| AI Observability (F-020 to F-022) | Monitor, Alert | — | View dashboards | — | Logged by |
| Human Surfaces (F-023 to F-026) | Full access | Full access | Full access (R3) | — | Generate content |
| R1 Intelligence (F-027 to F-035) | Monitor, Configure | Consume nudges | Review, Act | — | Execute |
| Integrations (F-036 to F-038) | Configure | Interact via Slack | Use data | — | Deliver via |
| Client Access (F-054 to F-059) | Manage tenants | — | Manage projections | View, Query | Generate narratives |
| Per-Tenant Intelligence (F-074 to F-078) | Monitor | Benefit from | Consume insights | Indirect benefit | Learn, Improve |

---

## 4. System Overview

### 4.1 Context Diagram

The AI-Native PM Tool interacts with the following external systems:

| External System | Integration Type | Data Flow |
|----------------|-----------------|-----------|
| **Claude AI API** | REST API (Anthropic SDK) | Outbound: prompts with project context. Inbound: structured AI responses (WBS, summaries, risk analysis). |
| **Git Providers** (GitHub, GitLab, Azure DevOps) | Inbound webhooks | Commit activity, PR events linked to tasks. Ground truth for progress tracking. |
| **Slack / Microsoft Teams** | OAuth 2.0 + Events API | Bidirectional: AI nudges outbound, slash commands inbound. Primary delivery channel for AI PM Agent. |
| **Calendar** (Google, Outlook) | CalDAV / OAuth 2.0 | Inbound: team availability data for resource optimization. |
| **AWS Services** | Infrastructure | RDS (PostgreSQL), ElastiCache (Redis), S3, ECS Fargate, CloudWatch, Secrets Manager, ALB, WAF, X-Ray. |

### 4.2 Core Interaction Loop

The system operates on a six-stage loop that replaces the traditional PM workflow:

```
Describe --> Generate --> Review --> Execute --> Monitor --> Summarize
```

1. **Describe**: User describes project scope in natural language
2. **Generate**: AI produces WBS with phases, tasks, dependencies, estimates
3. **Review**: Human reviews via high-density approval UI; approves, edits, or rejects
4. **Execute**: Approved tasks enter the system; AI tells developers what to work on next
5. **Monitor**: AI autonomously tracks progress, chases updates, predicts risks, detects scope creep
6. **Summarize**: AI generates daily/weekly summaries and client-ready reports

### 4.3 Release Scope Summary

| Release | Timeframe | Features | Key Capability |
|---------|-----------|----------|---------------|
| **R0** | Months 1-3 | 28 features (F-001 to F-026 + F-089, F-093) | Foundation + Core AI Loop (internal MVP) |
| **R1** | Months 4-6 | 36 features (F-027 to F-053 minus F-048 + promoted/new) | Intelligence Layer + SaaS Prep + Views |
| **R2** | Months 7-9 | 27 features (F-054 to F-073 + promoted/new/deferred) | External Launch + Monetization |
| **R3** | Months 10-12 | 13 features (F-074 to F-086 + F-076 AI-enhanced) | Platform + Per-Tenant Intelligence |

---

## 5. Platform Foundation (FR-100 Series)

### FR-100 — Event-Driven Architecture Spine

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-001 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 5 — Event Bus |
| **Design Ref** | design.md Section 9 (Tier 5: Event Bus); architecture-v3.1.md Section 2.3 |
| **UI/UX Ref** | N/A (infrastructure) |

**Description:** Implement a persistent event bus infrastructure using NATS JetStream that captures all state changes across the system. Every mutation (task created, status changed, assignment changed, comment added, dependency resolved) emits an event. All downstream AI capabilities, audit logging, embedding pipelines, and notification routing consume from this bus.

**User Story:** As the AI PM Agent, I want to receive real-time events for every state change in the system so that I can react autonomously to project developments without polling.

**Acceptance Criteria:**
- **AC-1:** NATS JetStream cluster (3-node) is deployed with persistent storage and 30-day retention.
- **AC-2:** Twelve streams are configured: `pm.tasks`, `pm.projects`, `pm.comments`, `pm.ai`, `pm.integrations`, `pm.system`, `pm.notifications`, `pm.goals`, `pm.automations`, `pm.forms`, `pm.documents`, `pm.reminders` with all documented subjects.
- **AC-3:** All consumers are idempotent (event ID deduplication) with dead letter queue routing after 3 failed retries.
- **AC-4:** Event latency from emission to consumer receipt is under 100ms at p95.

**Data Readiness Gate:** N/A — infrastructure feature.

**Dependencies:** None (F-001 is the foundation).

---

### FR-101 — Tenant-Aware Data Model

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-002 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 6 — Database |
| **Design Ref** | design.md Section 7 (Tier 3: Application Services — Data Layer) |
| **UI/UX Ref** | N/A (infrastructure) |

**Description:** Implement a single-tenant-deployed but multi-tenant-ready data model with `tenant_id` on all tables, Row-Level Security (RLS) policies enforced at the PostgreSQL layer, and per-request tenant context setting from JWT claims. Application code physically cannot query across tenants.

**User Story:** As a Site Admin, I want assurance that tenant data is isolated at the database level so that no cross-tenant data leakage is architecturally possible.

**Acceptance Criteria:**
- **AC-1:** Every table includes a `tenant_id` UUID column as the first column in all composite indexes.
- **AC-2:** RLS policies are active on all tenant-scoped tables (30 tables per architecture-v3.1.md) using `current_setting('app.current_tenant_id')`.
- **AC-3:** API middleware sets the tenant context from the JWT `tenant_id` claim before any query executes.
- **AC-4:** Integration tests verify that queries with an incorrect tenant context return zero rows.

**Data Readiness Gate:** N/A — infrastructure feature.

**Dependencies:** None.

---

### FR-102 — Core Schema with Constraints

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-003 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 6 — Database |
| **Design Ref** | design.md Section 7 (Tier 3: Application Services — Project Module) |
| **UI/UX Ref** | N/A (infrastructure) |

**Description:** Implement the core relational schema for Projects, Phases, Tasks, Users, and Comments with strong foreign key constraints, unique constraints (no duplicate project names per tenant, no duplicate phases per project), cascade rules, soft deletes via `deleted_at` timestamps, and versioned migrations managed by Drizzle ORM.

**User Story:** As a Developer, I want data integrity enforced at the database level so that invalid states (orphaned tasks, duplicate projects) are impossible.

**Acceptance Criteria:**
- **AC-1:** Schema includes Projects, Phases, Tasks, Users, Comments tables with all documented fields and constraints.
- **AC-2:** Unique constraint prevents duplicate project names within a tenant; duplicate phase names within a project.
- **AC-3:** Foreign keys with appropriate cascade rules (e.g., project deletion soft-deletes associated phases and tasks).
- **AC-4:** All entities support soft delete via `deleted_at` timestamp; hard deletes only via background retention jobs.
- **AC-5:** Migrations are versioned and reproducible via Drizzle ORM.

**Data Readiness Gate:** N/A — infrastructure feature.

**Dependencies:** FR-101 (tenant-aware data model).

---

### FR-103 — Authentication

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-004 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 2 — Gateway & Auth |
| **Design Ref** | design.md Section 6 (Tier 2: Gateway & Auth) |
| **UI/UX Ref** | W-11 (Login wireframe) |

**Description:** Implement password-based authentication with bcrypt hashing/salting, password reset flow, session management with RS256 JWT tokens (1-hour access tokens, 30-day refresh tokens with rotation), secure cookies, and session revocation. Sessions stored server-side in Redis for concurrent session tracking and forced logout.

**User Story:** As a user, I want secure authentication with session management so that my account is protected and I can be logged out from all sessions if needed.

**Acceptance Criteria:**
- **AC-1:** Passwords are hashed with bcrypt (cost factor 12+); plaintext passwords never stored or logged.
- **AC-2:** JWT access tokens expire in 1 hour; refresh tokens expire in 30 days with rotation on use.
- **AC-3:** JWT carries `tenant_id`, `user_id`, and `role` claims signed with RS256.
- **AC-4:** Password reset flow sends a time-limited token (15 minutes) via email.
- **AC-5:** Active sessions are tracked in Redis; forced logout invalidates all sessions for a user.

**Data Readiness Gate:** N/A — infrastructure feature.

**Dependencies:** FR-101 (tenant model for JWT claims).

---

### FR-104 — RBAC Engine

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-005 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 2 — Gateway & Auth |
| **Design Ref** | design.md Section 6.5 (RBAC Engine) |
| **UI/UX Ref** | N/A (enforced across all UI views) |

**Description:** Implement Role-Based Access Control with two initial roles: Site Admin and Developer. Enforcement chain per request: authenticate, resolve tenant from JWT, set RLS context, check role, check resource scope. Role assignments managed by admins. The RBAC engine supports staged rollout: +Client (R2), +PM (R3).

**User Story:** As a Site Admin, I want to assign roles to users and have permissions enforced at both the API and UI levels so that users only access what their role permits.

**Acceptance Criteria:**
- **AC-1:** Two roles are enforced in R0: Site Admin (full access) and Developer (scoped to assigned projects and own tasks).
- **AC-2:** Every API endpoint checks role permissions before executing business logic.
- **AC-3:** UI components conditionally render based on the authenticated user's role.
- **AC-4:** Role assignment is admin-only; developers cannot self-elevate.
- **AC-5:** The RBAC schema supports adding Client and PM roles in later releases without migration.

**Data Readiness Gate:** N/A — infrastructure feature.

**Dependencies:** FR-103 (authentication provides JWT with role claims).

---

### FR-105 — Task Data Model

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-006 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 3 — Application Services (Task Module) |
| **Design Ref** | design.md Section 7.3 (Task Module) |
| **UI/UX Ref** | W-06 (Task Detail wireframe), W-07 (Task List wireframe) |

**Description:** Implement the full task data model with all fields: title, description, status (configurable), priority, assignee(s) via junction table (`task_assignments` with roles: assignee, reviewer, approver), start date, due date, created date (auto), last updated (auto), actual finish date (auto on completion), estimated effort, actual effort, phase, parent task (sub-tasks), tags, `ai_generated` boolean, and `ai_confidence` float.

**User Story:** As the AI PM Agent, I want a rich task data model with AI metadata fields so that every AI capability has sufficient structured data to reason about task state, priority, and provenance.

**Acceptance Criteria:**
- **AC-1:** Tasks support multiple assignees via `task_assignments` junction table with role differentiation.
- **AC-2:** `ai_generated` and `ai_confidence` fields are present and populated for all AI-created tasks.
- **AC-3:** Status transitions emit events to the NATS `pm.tasks.status_changed` subject.
- **AC-4:** `created_at` and `updated_at` are auto-managed; `actual_finish_date` is auto-set on completion.
- **AC-5:** Estimated and actual effort fields support decimal values (hours).

**Data Readiness Gate:** N/A — infrastructure feature.

**Dependencies:** FR-102 (core schema), FR-100 (event bus for status change events).

---

### FR-106 — Task Dependencies

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-007 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 3 — Application Services (Dependency Module) |
| **Design Ref** | design.md Section 7.4 (Dependency Module) |
| **UI/UX Ref** | W-06 (Task Detail — dependencies panel), W-18 (Dependency Graph) |

**Description:** Implement finish-to-start task dependency relationships with circular dependency prevention via application-layer DAG traversal, automatic blocked/unblocked status propagation, and dependency notes. When all blocking dependencies are resolved, the blocked task is automatically unblocked and an event is emitted.

**User Story:** As the AI PM Agent, I want task dependencies modeled and enforced so that I can reason about sequencing, identify bottlenecks, and compute critical paths accurately.

**Acceptance Criteria:**
- **AC-1:** Tasks support blocked-by/blocks relationships with referential integrity.
- **AC-2:** Circular dependency creation is rejected at the API level with a clear error message.
- **AC-3:** When all blocking tasks for a given task are completed, the blocked task is automatically unblocked and `pm.tasks.dependency_resolved` is emitted.
- **AC-4:** Dependency notes provide context for why a dependency exists.
- **AC-5:** DAG traversal for circular detection completes in under 50ms for chains up to 100 tasks.

**Data Readiness Gate:** N/A — infrastructure feature.

**Dependencies:** FR-105 (task data model).

---

### FR-107 — Sub-Tasks

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-008 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 3 — Application Services (Task Module) |
| **Design Ref** | design.md Section 7.3 (Task Module) |
| **UI/UX Ref** | W-06 (Task Detail — sub-tasks panel) |

**Description:** Implement single-level sub-task nesting (one level only to avoid complexity traps). Sub-tasks carry all standard task fields. Parent task progress rolls up from sub-task completion. Tasks can be promoted from sub-task to task and demoted from task to sub-task.

**User Story:** As a Developer, I want to break tasks into sub-tasks so that the AI-generated WBS can express hierarchical breakdowns and I can track granular progress.

**Acceptance Criteria:**
- **AC-1:** Sub-tasks are linked to a parent task via `parent_task_id`; only one level of nesting is permitted.
- **AC-2:** Attempting to create a sub-task of a sub-task returns a validation error.
- **AC-3:** Parent task progress (percentage) is automatically calculated from sub-task completion.
- **AC-4:** Promote and demote operations are available and preserve all task data.

**Data Readiness Gate:** N/A — infrastructure feature.

**Dependencies:** FR-105 (task data model).

---

### FR-108 — Audit Trail Infrastructure

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-009 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 3 — Application Services (Audit Module) |
| **Design Ref** | design.md Section 7.6 (Audit Module) |
| **UI/UX Ref** | W-06 (Task Detail — audit history tab) |

**Description:** Implement an immutable audit log table (INSERT only, no UPDATE/DELETE permissions) that captures every change to task status, assignee, dates, priority, and phase with field-level diffs. Each entry records: `entity_type`, `entity_id`, `field_name`, `old_value`, `new_value`, `actor_type` (user/ai/system/integration), `actor_id`, `ai_action_id` FK, and `timestamp`. Partitioned by month at 1M+ rows.

**User Story:** As a Site Admin, I want an immutable audit trail of all changes so that I can investigate AI decisions, satisfy compliance requirements, and provide the AI with historical signal data.

**Acceptance Criteria:**
- **AC-1:** The `audit_log` table permits INSERT only; no UPDATE or DELETE grants exist at the database level.
- **AC-2:** Every mutation to a tracked entity produces an audit log entry with field-level old/new values.
- **AC-3:** Actor type distinguishes between user, AI, system, and integration actions.
- **AC-4:** AI-initiated changes include an `ai_action_id` foreign key linking to the `ai_actions` traceability table.
- **AC-5:** Table supports monthly partitioning and retains records for a minimum of 7 years.

**Data Readiness Gate:** N/A — infrastructure feature.

**Dependencies:** FR-102 (core schema), FR-100 (event bus for change events).

---

### FR-109 — Admin-Configurable Values

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-010 |
| **Release** | R0 |
| **Priority** | Could Defer |
| **Architecture Tier** | Tier 2 — Gateway & Auth (Config Service) |
| **Design Ref** | design.md Section 7.9 (Config Module) |
| **UI/UX Ref** | W-10 (Settings wireframe) |

**Description:** Implement admin-managed configuration for status labels, priority levels, and phase templates via an admin UI. Values are stored in a tenant config table with in-memory caching (5-minute TTL via Redis) and cache invalidation via NATS events. Sensible defaults are provided out of the box.

**User Story:** As a Site Admin, I want to customize status labels, priority levels, and phase templates so that the tool matches our team's workflow vocabulary without code changes.

**Acceptance Criteria:**
- **AC-1:** Status labels, priority levels, and phase templates are stored per-tenant in a config table, not hardcoded.
- **AC-2:** An admin UI allows CRUD operations on configurable values.
- **AC-3:** Config changes are cached in Redis with 5-minute TTL and invalidated immediately via `pm.system.config_changed` NATS event.
- **AC-4:** Default values are seeded on tenant creation and are functional without any admin configuration.

**Data Readiness Gate:** N/A — infrastructure feature.

**Dependencies:** FR-101 (tenant model), FR-100 (event bus for cache invalidation).

---

## 6. AI Core Loop (FR-200 Series)

### FR-200 — NL-to-WBS Generator

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-011 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 4 — AI Engine (Capability: NL-to-WBS Generator) |
| **Design Ref** | design.md Section 8.3 (AI Capabilities — NL-to-WBS) |
| **UI/UX Ref** | W-08 (AI Review Panel), W-05 (Project Detail) |

**Description:** Convert natural language project descriptions into structured Work Breakdown Structures with phases, milestones, task breakdowns, timelines, and suggested assignments. This is the core product capability and should receive 40%+ of R0 AI engineering time. The generation follows a 5-stage sub-pipeline:

1. **Domain Detection** — Classify the project type (software delivery, data migration, consultancy engagement, etc.)
2. **Template Selection** — Load the appropriate domain-specific prompt template from the versioned prompt registry
3. **RAG Enrichment** — Retrieve similar past projects from pgvector (tenant-scoped, cosine similarity, top-k=10) to inform structure and estimates
4. **Opus Generation** — Claude Opus 4 generates the structured WBS (approximately 5K tokens in, 3K tokens out)
5. **Schema Validation** — Validate the output against the expected JSON schema (phases, tasks, dependencies, estimates)

Domain-specific prompt templates must be maintained for software delivery, data migration, and consultancy engagement project types. The AI should feel like it "knows" how the user's kind of work gets done.

**User Story:** As a Project Manager, I want to describe a project in plain English and receive a complete WBS with phases, tasks, dependencies, and time estimates so that I review and approve a project plan instead of building one from scratch.

**Acceptance Criteria:**
- **AC-1:** User submits a natural language project description (minimum 50 characters) and receives a structured WBS within 30 seconds (p95).
- **AC-2:** The generated WBS includes phases, tasks with estimates, sub-tasks, and dependency relationships that validate against the task schema.
- **AC-3:** The 5-stage sub-pipeline executes in sequence: domain detection, template selection, RAG enrichment, Opus generation, schema validation.
- **AC-4:** WBS acceptance rate (approved without major edits) exceeds 60% after the first month of internal use.
- **AC-5:** Each generation is logged in the `ai_actions` table with full traceability (prompt hash, model output, confidence score, disposition).
- **AC-6:** WBS proposals are always presented via the AI review/approve interface (FR-301); never auto-applied.
- **AC-7:** Domain-specific templates exist for at least 3 project types (software delivery, data migration, consultancy engagement).

**Data Readiness Gate:** Uses general PM knowledge plus project description. No historical data needed. Works from day 1.

**Dependencies:** FR-100 (event bus), FR-102 (core schema), FR-105 (task model), FR-106 (dependencies), FR-107 (sub-tasks).

---

### FR-201 — AI-Curated "What's Next" Per Developer

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-012 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 4 — AI Engine (Capability: "What's Next" Engine) |
| **Design Ref** | design.md Section 7.7 (User Module — What's Next); design.md Section 5.4 |
| **UI/UX Ref** | W-03 (Dashboard / What's Next wireframe) |

**Description:** Surface a prioritized list of work items for each developer based on dependencies (resolved first), due dates, blocked status, and assignment. In R0, this is rules-based (no LLM call): dependency resolved > due date > priority. In R1, this upgrades to LLM-ranked with velocity context and natural language explanations via Claude Sonnet (approximately 1K tokens in, 500 tokens out). This replaces the Kanban board as the primary work-finding interface.

**User Story:** As a Developer, I want to open the tool and immediately see what I should work on next and why so that I spend zero time navigating boards or figuring out priorities.

**Acceptance Criteria:**
- **AC-1:** The `/users/me/next` endpoint returns an ordered list of tasks with priority reasoning within 500ms (p95) in R0.
- **AC-2:** R0 prioritization algorithm: unblocked tasks first, then by due date ascending, then by priority descending.
- **AC-3:** Blocked tasks are clearly marked with the blocking dependency identified.
- **AC-4:** The "What's Next" view is the default landing page for Developer role users.
- **AC-5:** R1 upgrade: LLM-ranked results include natural language explanations (e.g., "This task unblocks 3 downstream items").

**Data Readiness Gate:** Rules-based in R0 uses dependency order, due dates, and priority. Works from day 1.

**Dependencies:** FR-105 (task model), FR-106 (dependencies), FR-104 (RBAC for developer role).

---

### FR-202 — AI Daily/Weekly Summary

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-013 |
| **Release** | R0 |
| **Priority** | Could Defer |
| **Architecture Tier** | Tier 4 — AI Engine (Capability: Summary Engine) |
| **Design Ref** | design.md Section 8.3 (AI Capabilities — Summary Engine) |
| **UI/UX Ref** | W-03 (Dashboard — daily summary section) |

**Description:** Generate concise project summaries ("here's what happened on Project X today in 4 sentences") from event bus data. Daily summaries auto-generated; weekly summaries on schedule. Decisions are auto-logged. Replaces notification feeds. Uses Claude Sonnet 4.5 (approximately 3K tokens in, 1K tokens out). Client-facing summaries route through the projection layer with mandatory approval.

**User Story:** As a Site Admin, I want a daily AI-generated summary of project activity so that I understand project status without reading every notification or navigating dashboards.

**Acceptance Criteria:**
- **AC-1:** Daily summaries are generated automatically for each active project by end of business day.
- **AC-2:** Summaries include: tasks completed, tasks started, blockers identified, key decisions made, and upcoming deadlines.
- **AC-3:** Summaries are 4-6 sentences maximum, written in clear professional language.
- **AC-4:** Summaries are accessible via the dashboard and optionally delivered via Slack (R1).
- **AC-5:** Each summary is logged with traceability (AI action ID, model, confidence).

**Data Readiness Gate:** Consumes event bus data. Works from day 1 with whatever activity exists.

**Dependencies:** FR-100 (event bus for activity data), FR-108 (audit trail for decision logging).

---

### FR-203 — AI-Powered NL Querying

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-014 |
| **Release** | R0 |
| **Priority** | Could Defer |
| **Architecture Tier** | Tier 4 — AI Engine (Capability: NL Query Engine) |
| **Design Ref** | design.md Section 5.5 (NL Query Panel); design.md Section 8.3 |
| **UI/UX Ref** | W-09 (NL Query — Slide-Out Panel wireframe) |

**Description:** Allow users to ask natural language questions about project state ("what's blocked right now?", "what did the team ship this week?") and receive direct answers synthesized from project data. Uses RAG retrieval from pgvector, context assembly, and Claude Sonnet 4.5 synthesis (approximately 2K tokens in, 1K tokens out). Interactive, target p95 under 8 seconds.

**User Story:** As a Developer, I want to ask the tool questions in plain English and get direct answers so that I can query project state without navigating filters and dashboards.

**Acceptance Criteria:**
- **AC-1:** Users can submit natural language queries via a dedicated NL query panel in the web app.
- **AC-2:** Query responses are returned within 8 seconds at p95.
- **AC-3:** Responses cite specific tasks, dates, and people rather than giving vague summaries.
- **AC-4:** Queries are scoped to the user's permissions (developers see only their accessible projects).
- **AC-5:** Query and response are logged for traceability and evaluation.

**Data Readiness Gate:** Queries current project data. Works from day 1.

**Dependencies:** FR-102 (core schema for data), FR-104 (RBAC for permission scoping), FR-100 (event bus).

---

## 7. AI Safety and Autonomy (FR-300 Series)

### FR-300 — Autonomy Policy Engine

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-015 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 4 — AI Engine (Autonomy Policy Engine) |
| **Design Ref** | design.md Section 8.2 (Autonomy Policy Engine) |
| **UI/UX Ref** | W-10 (Settings / AI Policy wireframe) |

**Description:** Implement a configuration-driven policy engine that determines, per AI action type and per tenant, whether the AI should operate in shadow mode (log only), propose mode (create proposal for human review), or execute mode (apply changes autonomously). Default posture: propose everything, execute nothing. Supports quiet hours (no nudges during off-hours), nudge limits (maximum 2 per task per day), and per-action-type granularity.

**User Story:** As a Site Admin, I want to configure exactly which AI actions require my approval and which can execute autonomously so that I build trust incrementally without the AI being either toothless or dangerous.

**Acceptance Criteria:**
- **AC-1:** Three operating modes are supported per action type: shadow (log only), propose (human review required), execute (autonomous).
- **AC-2:** Default configuration for all new tenants: all actions set to "propose" mode (safest posture).
- **AC-3:** Quiet hours are configurable per tenant (e.g., no nudges between 8 PM and 8 AM).
- **AC-4:** Nudge limits enforce a maximum of 2 AI-initiated nudges per task per day.
- **AC-5:** Policy changes are logged in the audit trail and take effect immediately.
- **AC-6:** The autonomy check is step 2 of the 7-stage AI orchestration pipeline and cannot be bypassed.

**Data Readiness Gate:** N/A — infrastructure feature.

**Dependencies:** FR-100 (event bus), FR-108 (audit trail).

---

### FR-301 — AI Review/Approve Interface

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-016 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 1 — Client Layer |
| **Design Ref** | design.md Section 5.3 (AI Review UI) |
| **UI/UX Ref** | W-08 (AI Review Panel — Split View wireframe) |

**Description:** Implement a high-density review screen for all AI-proposed actions (WBS generation, reprioritization, summary drafts, escalation proposals). The interface must support scanning 50 AI suggestions in 30 seconds, with bulk approve/reject, individual editing, and clear confidence indicators. This is NOT a chat interface; it is a supervisory dashboard optimized for rapid triage.

**User Story:** As a Site Admin, I want a high-density review interface for AI proposals so that I can supervise the AI efficiently — approving good suggestions in bulk and editing or rejecting problematic ones quickly.

**Acceptance Criteria:**
- **AC-1:** AI proposals are displayed in a scannable list/grid format with confidence scores, action type, and summary visible without clicking into each item.
- **AC-2:** Bulk approve and bulk reject are supported for selected proposals.
- **AC-3:** Individual proposals can be edited before approval (e.g., adjusting a WBS task estimate).
- **AC-4:** A user can review and act on 50 proposals within 30 seconds (measured via usability testing).
- **AC-5:** Approved actions trigger execution; rejected actions are logged with optional rejection reason.
- **AC-6:** All review decisions (approve/edit/reject) are logged in the audit trail with the reviewer's identity.

**Data Readiness Gate:** N/A — UI feature consuming AI action data.

**Dependencies:** FR-300 (autonomy policy generates proposals), FR-200 (WBS generator creates proposals).

---

### FR-302 — AI Shadow Mode

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-017 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 4 — AI Engine |
| **Design Ref** | design.md Section 8.2 (Autonomy Policy Engine — Shadow Mode) |
| **UI/UX Ref** | W-08 (AI Review Panel — shadow mode dashboard tab) |

**Description:** Implement a boolean flag per tenant and per AI capability that, when enabled, causes all AI actions to be logged but not executed or surfaced to end users. Admins review AI accuracy in a dedicated dashboard. Shadow mode is the trust-building mechanism before enabling live mode. All AI capabilities start in shadow mode by default.

**User Story:** As a Site Admin, I want to run the AI in shadow mode so that I can evaluate its accuracy on real project data before enabling it to affect live projects or nudge my team.

**Acceptance Criteria:**
- **AC-1:** Shadow mode is configurable per tenant and per individual AI capability.
- **AC-2:** In shadow mode, AI actions are logged with full traceability but produce no user-visible effects.
- **AC-3:** An admin dashboard shows shadow mode AI actions with their hypothetical outcomes and confidence scores.
- **AC-4:** Transitioning from shadow to propose/execute mode requires explicit admin action and is audit-logged.
- **AC-5:** Shadow mode can be re-enabled at any time to test new AI capabilities or prompt changes.

**Data Readiness Gate:** N/A — infrastructure feature.

**Dependencies:** FR-300 (autonomy policy engine), FR-108 (audit trail).

---

### FR-303 — Confidence Thresholds and Graceful Degradation

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-018 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 4 — AI Engine (7-Stage Pipeline, Step 4) |
| **Design Ref** | design.md Section 8.1 (AI Orchestrator — 7-Stage Pipeline) |
| **UI/UX Ref** | W-08 (AI Review Panel — confidence indicators) |

**Description:** Every AI operation includes a confidence score. When confidence falls below a configurable threshold (default: 0.6), the AI flags uncertainty and requests human input instead of proceeding. Every AI capability defines its own fallback behavior for low-confidence situations. The confidence check is step 4 of the 7-stage orchestration pipeline.

**User Story:** As a Site Admin, I want the AI to recognize when it is not confident and gracefully ask for help instead of producing low-quality or hallucinated output.

**Acceptance Criteria:**
- **AC-1:** Every AI operation returns a confidence score between 0.0 and 1.0.
- **AC-2:** Operations below the confidence threshold (configurable, default 0.6) are flagged and routed to human review regardless of autonomy policy.
- **AC-3:** Each AI capability has a documented fallback behavior (e.g., NL Query returns "I'm not confident enough to answer this — here's what I found" with raw data links).
- **AC-4:** Low-confidence events emit `pm.ai.confidence_low` on the event bus for monitoring.
- **AC-5:** Confidence thresholds are configurable per tenant and per capability.

**Data Readiness Gate:** N/A — infrastructure feature.

**Dependencies:** FR-300 (autonomy policy), FR-100 (event bus).

---

### FR-304 — Rollback/Revert Semantics

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-019 |
| **Release** | R0 |
| **Priority** | Could Defer |
| **Architecture Tier** | Tier 4 — AI Engine (Traceability Pipeline) |
| **Design Ref** | design.md Section 8.4 (Shared AI Infrastructure — Traceability) |
| **UI/UX Ref** | W-08 (AI Review Panel — revert button per action) |

**Description:** Any AI-executed action can be rolled back to its previous state with a single click. The `ai_actions` table stores `rollback_data` (a JSON snapshot of the pre-action state) that enables precise reversion. In R0, this may be limited to "undo last AI action" with full multi-step rollback in R1.

**User Story:** As a Site Admin, I want to undo any AI action with one click so that mistakes are cheap to fix and I feel safe giving the AI more autonomy over time.

**Acceptance Criteria:**
- **AC-1:** Every AI-executed action stores sufficient rollback data to restore the previous state.
- **AC-2:** A "Revert" button is available on each AI action in the review interface and audit log.
- **AC-3:** Revert restores the exact previous state (field values, assignments, status) without manual reconstruction.
- **AC-4:** Revert actions are themselves logged in the audit trail as "ai_revert" actor type.

**Data Readiness Gate:** N/A — requires AI action logging (FR-400).

**Dependencies:** FR-108 (audit trail), FR-300 (autonomy policy).

---

### FR-305 — AI Decision Log

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-035 |
| **Release** | R1 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 4 — AI Engine (Traceability Pipeline) |
| **Design Ref** | design.md Section 8.4 (Shared AI Infrastructure — Traceability) |
| **UI/UX Ref** | W-08 (AI Review Panel — decisions tab) |

**Description:** Every AI action is explainable. "Why did it flag this?" always has a clear answer. Full log of AI decisions, recommendations, and human overrides. Queryable by action type, date, project, confidence level, and disposition. Extends FR-400 traceability with human-readable explanations.

**User Story:** As a Site Admin, I want every AI decision to be explainable in plain language so that I can build trust with my team and clients by always being able to answer "why did the AI do that?"

**Acceptance Criteria:**
- **AC-1:** Every AI action includes a human-readable explanation of the reasoning.
- **AC-2:** The decision log is queryable by action type, date range, project, confidence level, and disposition.
- **AC-3:** Human overrides (approve with edits, reject) are logged alongside the original AI recommendation.
- **AC-4:** The log is accessible to Admin and PM roles; not visible to Developer or Client roles.

**Data Readiness Gate:** N/A — infrastructure feature.

**Dependencies:** FR-400 (traceability pipeline as foundation).

---

## 8. AI Observability (FR-400 Series)

### FR-400 — AI Traceability Pipeline

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-020 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 4 — AI Engine (Traceability Pipeline) |
| **Design Ref** | design.md Section 8.4 (Shared AI Infrastructure — Traceability Pipeline) |
| **UI/UX Ref** | W-08 (AI Review Panel — traceability chain) |

**Description:** Log every AI action with the full chain: `trigger_event` (what initiated the action), `context_assembled` (truncated snapshot of RAG results and prompt context), `prompt_sent` (hash for reproducibility), `model_output` (raw response), `confidence_score`, `disposition` (proposed/executed/rejected), `human_review` (approve/edit/reject with reviewer ID), and `rollback_data`. The full chain must be queryable via admin interface.

**User Story:** As a Site Admin, I want to trace every AI decision from trigger to outcome so that I can understand why the AI did something, diagnose regressions, and satisfy audit requirements.

**Acceptance Criteria:**
- **AC-1:** The `ai_actions` table captures all documented fields for every AI operation.
- **AC-2:** The traceability chain is queryable: given an AI action ID, all pipeline stages are retrievable.
- **AC-3:** Prompt hashes enable reproducibility — the same hash maps to the same prompt template version.
- **AC-4:** An admin interface displays the AI action log with filtering by capability, disposition, confidence range, and date.
- **AC-5:** Context snapshots are truncated to a configurable maximum size to manage storage.

**Data Readiness Gate:** N/A — infrastructure feature.

**Dependencies:** FR-100 (event bus for `pm.ai.*` events), FR-108 (audit trail).

---

### FR-401 — AI Evaluation Harness

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-021 |
| **Release** | R0 |
| **Priority** | Could Defer |
| **Architecture Tier** | Tier 4 — AI Engine (Evaluation Harness) |
| **Design Ref** | design.md Section 8.4 (Shared AI Infrastructure — Evaluation Harness) |
| **UI/UX Ref** | N/A (internal tooling) |

**Description:** Implement golden test sets for WBS generation, prioritization, and status summaries. Automated quality checks run on every prompt version change. Track acceptance rate (below 60% triggers review), override rate (above 40% indicates miscalibration), and hallucination incidents. R0 starts with manual review augmented by golden test sets; R1 adds fully automated CI integration.

**User Story:** As a Site Admin, I want automated quality tracking for AI outputs so that prompt changes are validated against known-good baselines and regressions are caught before they reach users.

**Acceptance Criteria:**
- **AC-1:** Golden test sets exist for NL-to-WBS (minimum 10 test cases), prioritization, and summary generation.
- **AC-2:** Acceptance rate is tracked per AI capability and alerts when it drops below 60%.
- **AC-3:** Override rate (user edits before approving) is tracked and alerts when it exceeds 40%.
- **AC-4:** Hallucination incidents (AI states facts not present in source data) are logged and tracked.
- **AC-5:** R1: Golden tests run automatically in CI on every prompt template change.

**Data Readiness Gate:** N/A — evaluation infrastructure.

**Dependencies:** FR-400 (traceability pipeline provides data), FR-200 (WBS generator as primary evaluation target).

---

### FR-402 — Runtime Monitoring Dashboard

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-022 |
| **Release** | R0 |
| **Priority** | Could Defer |
| **Architecture Tier** | Tier 10 — Monitoring & Observability |
| **Design Ref** | design.md Section 10 (Monitoring — AI Observability Dashboard) |
| **UI/UX Ref** | W-10 (Settings — monitoring subsection) |

**Description:** Implement operational monitoring for AI capabilities: latency per operation, cost per operation, error rate, acceptance rate per AI feature, circuit breaker state, and anomaly alerts. R0 provides basic CloudWatch metrics and alarms. R1 adds a full custom dashboard with per-capability histograms, per-tenant budget gauges, prompt version comparison, and shadow-vs-live mode toggle status.

**User Story:** As a Site Admin, I want a real-time monitoring dashboard for AI operations so that I can identify latency spikes, cost overruns, and quality regressions before they impact users.

**Acceptance Criteria:**
- **AC-1:** R0: CloudWatch metrics capture AI operation latency, error rate, and token usage per capability.
- **AC-2:** R0: Alerts fire when AI failure rate exceeds 10% or circuit breaker opens.
- **AC-3:** R1: Custom dashboard displays per-capability latency histograms and per-tenant budget usage.
- **AC-4:** R1: Acceptance/rejection rate trends are visualized per capability over time.
- **AC-5:** R1: Shadow mode vs. live mode status is visible for each capability per tenant.

**Data Readiness Gate:** N/A — infrastructure feature.

**Dependencies:** FR-400 (traceability pipeline), FR-100 (event bus for `pm.ai.*` events).

---

## 9. Human Surfaces (FR-500 Series)

### FR-500 — Task Detail View

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-023 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 1 — Client Layer |
| **Design Ref** | design.md Section 5 (Tier 1: Client Layer) |
| **UI/UX Ref** | W-06 (Task Detail — 3-Column Layout wireframe) |

**Description:** Implement a single task view showing all fields, sub-tasks, dependencies (both blocking and blocked-by), full audit history, and comments. The primary entry point is from AI recommendations (What's Next, NL query results), not from browsing a board.

**User Story:** As a Developer, I want a comprehensive task detail view so that when the AI recommends a task, I can see all context (dependencies, history, comments) needed to start working immediately.

**Acceptance Criteria:**
- **AC-1:** All task fields (title, description, status, priority, assignees, dates, effort, phase, tags) are displayed.
- **AC-2:** Sub-tasks are listed with progress indicators.
- **AC-3:** Dependencies are shown in both directions (what blocks this task, what this task blocks) with status.
- **AC-4:** Audit history displays a chronological log of all changes with actor and timestamp.
- **AC-5:** Comments are displayed as a threaded conversation below the task details.
- **AC-6:** The view is navigable from AI recommendations via direct links.

**Data Readiness Gate:** N/A — UI feature.

**Dependencies:** FR-105 (task model), FR-106 (dependencies), FR-107 (sub-tasks), FR-108 (audit trail).

---

### FR-501 — Project List and Task List Views

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-024 |
| **Release** | R0 |
| **Priority** | Could Defer |
| **Architecture Tier** | Tier 1 — Client Layer |
| **Design Ref** | design.md Section 5 (Tier 1: Client Layer) |
| **UI/UX Ref** | W-04 (Project List wireframe), W-07 (Task List wireframe) |

**Description:** Simple list views for projects and tasks with filtering (status, priority, assignee, phase, date range) and sorting. These are fallback views, secondary to NL querying and AI recommendations. Accessible but not the primary interaction model.

**User Story:** As a Site Admin, I want list views for projects and tasks so that I can browse and filter when I need an overview beyond what the AI summary provides.

**Acceptance Criteria:**
- **AC-1:** Project list displays all accessible projects with name, status, phase, and key metrics.
- **AC-2:** Task list supports filtering by status, priority, assignee, phase, and date range.
- **AC-3:** Sorting is available by priority, due date, status, and last updated.
- **AC-4:** Pagination handles large task lists (100+ items) without performance degradation.
- **AC-5:** R1: Advanced filtering (F-050) adds tag filters, saved views, and multi-criteria combinations.

**Data Readiness Gate:** N/A — UI feature.

**Dependencies:** FR-102 (core schema), FR-104 (RBAC for permission-scoped results).

---

### FR-502 — Role-Based Sidebar Navigation

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-025 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 1 — Client Layer |
| **Design Ref** | design.md Section 5 (Tier 1: Client Layer) |
| **UI/UX Ref** | W-01 (App Shell wireframe — sidebar) |

**Description:** Implement a minimal sidebar navigation with role-based content: Dashboard (AI summary), Projects, and Settings. Active route highlighting, responsive design, and collapsed state for developer focus mode.

**User Story:** As a user, I want clear, minimal navigation so that I can find the AI dashboard, projects, and settings without visual clutter.

**Acceptance Criteria:**
- **AC-1:** Sidebar shows navigation items appropriate to the user's role (Admin sees all; Developer sees Dashboard, Projects, their tasks).
- **AC-2:** Active route is visually highlighted.
- **AC-3:** Sidebar is responsive: collapsible on desktop, hamburger menu on mobile.
- **AC-4:** Navigation items are limited to essential destinations (maximum 5-7 top-level items).

**Data Readiness Gate:** N/A — UI feature.

**Dependencies:** FR-104 (RBAC for role-based content).

---

### FR-503 — Comment System

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-026 |
| **Release** | R0 |
| **Priority** | Could Defer |
| **Architecture Tier** | Tier 3 — Application Services (Comment Module) |
| **Design Ref** | design.md Section 7.5 (Comment Module) |
| **UI/UX Ref** | W-06 (Task Detail — comments section) |

**Description:** Implement per-task comments with `client_visible` boolean for the projection layer. R0 supports add and view. R1 adds edit/delete with "edited" indicator. Comments feed the embedding pipeline for RAG retrieval and provide signal to the AI.

**User Story:** As a Developer, I want to add comments to tasks so that I can communicate context to team members and provide signal that the AI uses to understand project state.

**Acceptance Criteria:**
- **AC-1:** Users can add comments to any task they have access to.
- **AC-2:** Comments display author, timestamp, and content in chronological order.
- **AC-3:** Each comment has a `client_visible` boolean field (default: false) for projection layer filtering.
- **AC-4:** Comment creation emits `pm.comments.created` to the event bus.
- **AC-5:** R1: Edit and delete with "edited" indicator and `pm.comments.updated`/`pm.comments.deleted` events.

**Data Readiness Gate:** N/A — UI/data feature.

**Dependencies:** FR-105 (task model), FR-100 (event bus).

---

## 10. R1 AI Intelligence (FR-600 Series) — Summary

> Full requirement details for FR-600 through FR-607 are preserved from v1.0 without modification. Summary table below for reference.

| FR | Feature Ref | Title | Release | Priority | Architecture Tier | UI/UX Ref |
|----|-------------|-------|---------|----------|------------------|-----------|
| FR-600 | F-027 | Adaptive Task Engine | R1 | Cannot Cut | Tier 4 — AI Engine | W-03 (Dashboard) |
| FR-601 | F-028 | AI PM Agent | R1 | Cannot Cut | Tier 4 — AI Engine | N/A (Slack delivery) |
| FR-602 | F-029 | Auto-Generated Status Reports | R1 | Cannot Cut | Tier 4 — AI Engine | W-05 (Project Detail) |
| FR-603 | F-030 | Risk Prediction | R1 | Cannot Cut | Tier 4 — AI Engine | W-15 (Timeline), W-16 (Portfolio) |
| FR-604 | F-031 | Cross-Project Dependency Mapping | R1 | Cannot Cut | Tier 4 — AI Engine | W-16 (Portfolio Dashboard) |
| FR-605 | F-032 | Resource Optimization Engine | R1 | Cannot Cut | Tier 4 — AI Engine | W-16 (Portfolio Dashboard) |
| FR-606 | F-033 | Auto-Escalation Workflows | R1 | Cannot Cut | Tier 4 — AI Engine | W-17 (Notification Inbox) |
| FR-607 | F-034 | Scope Creep Detector | R1 | Cannot Cut | Tier 4 — AI Engine | W-05 (Project Detail) |

**Key acceptance criteria highlights (unchanged from v1.0):**
- FR-600: Prioritization incorporates historical velocity data; stalled tasks (48h+, not blocked) auto-flagged
- FR-601: Agent loop runs every 15 minutes; nudges via Slack/Teams DMs; respects quiet hours and 2-per-task-per-day limit
- FR-602: Reports include completion %, velocity trend, blockers, risks, milestones; generated within 30s at p95
- FR-603: Risk predictions flag delays with confidence scores; 70%+ accuracy on flagged items; shadow mode for first 2-4 weeks
- FR-604: Cross-project dependencies surfaced in portfolio view; queryable via NL
- FR-605: Workload calculated per developer; overallocation (>100%) and underallocation (<50%) flagged
- FR-606: Configurable escalation thresholds; full context attached; chain: nudge owner then escalate to admin
- FR-607: Scope drift calculated vs WBS baseline; alert at 15% drift (configurable); delta visualization

---

## 11. R1 Integrations (FR-700 Series) — Summary

| FR | Feature Ref | Title | Release | Priority | Architecture Tier | UI/UX Ref |
|----|-------------|-------|---------|----------|------------------|-----------|
| FR-700 | F-036 | Slack/Teams Integration | R1 | Cannot Cut | Tier 7 — Integration Gateway | N/A (external platform) |
| FR-701 | F-037 | Git Integration | R1 | Cannot Cut | Tier 7 — Integration Gateway | W-06 (Task Detail — git activity) |
| FR-702 | F-038 | Calendar Integration | R1 | Could Defer | Tier 7 — Integration Gateway | W-13 (Calendar View) |

**Key acceptance criteria highlights (unchanged from v1.0):**
- FR-700: Slash commands `/aipm status`, `/aipm next`, `/aipm query`; DM nudges; App Home tab; Teams equivalent
- FR-701: GitHub/GitLab/Azure DevOps webhooks; branch naming convention task linking; PR merge auto-complete (governed by autonomy policy)
- FR-702: Google Calendar / Outlook availability read; meeting creation for sprint planning

---

## 12. R1 Security (FR-800 Series) — Summary

| FR | Feature Ref | Title | Release | Priority | Architecture Tier | UI/UX Ref |
|----|-------------|-------|---------|----------|------------------|-----------|
| FR-800 | F-039 | SSO Integration | R1 | Cannot Cut | Tier 2 — Gateway & Auth | W-11 (Login — SSO option) |
| FR-801 | F-040 | Multi-Factor Authentication | R1 | Cannot Cut | Tier 2 — Gateway & Auth | W-11 (Login — MFA step) |
| FR-802 | F-041 | Session Hardening | R1 | Cannot Cut | Tier 2 — Gateway & Auth | N/A (backend) |

**Key acceptance criteria highlights (unchanged from v1.0):**
- FR-800: SAML 2.0 + OIDC; Google Workspace, Microsoft Entra ID, Okta; per-tenant SSO config; SSO enforceable
- FR-801: TOTP + email OTP; admin-enforceable per role; recovery codes
- FR-802: Configurable token expiry; refresh rotation; concurrent session limits (default 5); forced logout

---

## 13. R1 SaaS Prep (FR-900 Series) — Summary

| FR | Feature Ref | Title | Release | Priority | Architecture Tier | UI/UX Ref |
|----|-------------|-------|---------|----------|------------------|-----------|
| FR-900 | F-042 | Client Projection Data Model | R1 | Cannot Cut | Tier 3 — Application Services (Projection Module) | N/A (data layer) |
| FR-901 | F-043 | Basic Read-Only Client View (Pilot) | R1 | Cannot Cut | Tier 1 — Client Layer | W-19 (Client Portal) |
| FR-902 | F-044 | Tenant Plan + Feature Flags | R1 | Cannot Cut | Tier 2 — Gateway & Auth (Config Service) | W-10 (Settings) |
| FR-903 | F-045 | SOC 2 Prep (Controls) | R1 | Cannot Cut | Tier 8 — Security & AI Safety | N/A (compliance) |
| FR-904 | F-046 | AI Cost Tracking + Rate Controls | R1 | Cannot Cut | Tier 4 — AI Engine (Cost Tracker) | W-10 (Settings — cost dashboard) |

**Key acceptance criteria highlights (unchanged from v1.0):**
- FR-900: Internal/external classification at field level; redaction rules per project/tenant; approval workflow for client-visible content
- FR-901: Read-only view: milestones, completion %, AI summary; scoped to authorized projects; filtered through projection layer
- FR-902: Feature flags per tenant; plan definitions (internal/beta); AI operation usage tracking
- FR-903: AES-256 at rest; TLS 1.3 in transit; data retention policies; incident response procedures documented
- FR-904: Per-tenant per-feature cost tracking; monthly budget caps with pre-flight checks; alerts at 80% and 100%

---

## 14. R1 Enhanced Tasks (FR-1000 Series) — Summary

| FR | Feature Ref | Title | Release | Priority | Architecture Tier | UI/UX Ref |
|----|-------------|-------|---------|----------|------------------|-----------|
| FR-1000 | F-047 | Default + Custom Tags | R1 | Could Defer | Tier 3 — Application Services (Task Module) | W-06, W-07 (tags on tasks) |
| FR-1001 | F-048 | Bulk Task Import | R2 (deferred from R1) | Could Defer | Tier 3 — Application Services (Task Module) | N/A |
| FR-1002 | F-049 | Full-Text Search | R1 | Could Defer | Tier 6 — Database (FTS) | W-01 (App Shell — Cmd+K search) |
| FR-1003 | F-050 | Advanced Filtering + Sorting | R1 | Could Defer | Tier 1 — Client Layer | W-07 (Task List — filter bar) |

**Key acceptance criteria highlights (unchanged from v1.0):**
- FR-1000: Default tags on project creation; custom name/color; scoped to project or tenant; admin CRUD
- FR-1001: CSV/XLSX upload with column mapping; validation with error preview; correction before commit
- FR-1002: PostgreSQL FTS with tsvector/GIN; permission-scoped; results within 500ms for 100K documents
- FR-1003: Multi-criteria filter (status, priority, assignee, phase, date, tags); saveable filter views per user

---

## 15. R1 Visualization (FR-1100 Series) — Summary

| FR | Feature Ref | Title | Release | Priority | Architecture Tier | UI/UX Ref |
|----|-------------|-------|---------|----------|------------------|-----------|
| FR-1100 | F-051 | Dependency Chain Visualization | R1 | Could Defer | Tier 1 — Client Layer | W-18 (Dependency Graph) |
| FR-1101 | F-052 | AI-Annotated Timeline View | R1 | Could Defer | Tier 1 — Client Layer | W-15 (AI-Annotated Timeline) |
| FR-1102 | F-053 | Portfolio Dashboard | R1 | Could Defer | Tier 1 — Client Layer | W-16 (Portfolio Dashboard) |

**Key acceptance criteria highlights (unchanged from v1.0):**
- FR-1100: Upstream/downstream DAG; critical path highlighted; click-through; renders within 2s for 50 tasks
- FR-1101: Tasks on time axis with AI overlays: predicted delays, at-risk milestones, resource conflicts
- FR-1102: Cross-project view: projects at risk, resource conflicts, cross-project deps, delivery confidence scores

---

## 16. R2 Client Access (FR-1200 Series) — Summary

| FR | Feature Ref | Title | Release | Priority | Architecture Tier | UI/UX Ref |
|----|-------------|-------|---------|----------|------------------|-----------|
| FR-1200 | F-054 | Multi-Tenancy Live | R2 | Cannot Cut | Tier 6 — Database (RLS) | N/A (infrastructure) |
| FR-1201 | F-055 | Client Portal (Full) | R2 | Cannot Cut | Tier 1 — Client Layer | W-19 (Client Portal) |
| FR-1202 | F-056 | Client Role + Permissions | R2 | Cannot Cut | Tier 2 — Gateway & Auth (RBAC) | N/A (permission layer) |
| FR-1203 | F-057 | Automated Client Reporting | R2 | Cannot Cut | Tier 4 — AI Engine | W-19 (Client Portal — reports) |
| FR-1204 | F-058 | Self-Service Client Onboarding | R2 | Cannot Cut | Tier 1 — Client Layer | W-19 (Client Portal — onboarding) |
| FR-1205 | F-059 | Client-Facing AI Assistant | R2 | Cannot Cut | Tier 4 — AI Engine (NL Query, Pattern 3) | W-19 (Client Portal — AI chat) |

**Key acceptance criteria highlights (unchanged from v1.0):**
- FR-1200: Tenant provisioning with isolated data; RLS verified by automated tests; admin tenant switching; AI context isolation verified
- FR-1201: White-labeled portal; milestones, summaries, delivery confidence, risk flags; projection-layer sourced; mobile responsive
- FR-1202: Client role: read-only projected data, can comment and approve deliverables, cannot modify tasks
- FR-1203: Scheduled client reports (weekly/biweekly); configurable tone; projection-layer filtered; PM approval before delivery
- FR-1204: Email invite flow; minimal account creation; AI-guided walkthrough; lands on project dashboard
- FR-1205: NL queries from portal; projected data only; risk responses held for PM review; confidence threshold 0.8; redaction check

---

## 17. R2 Monetization (FR-1300 Series) — Summary

| FR | Feature Ref | Title | Release | Priority | Architecture Tier | UI/UX Ref |
|----|-------------|-------|---------|----------|------------------|-----------|
| FR-1300 | F-060 | Tiered Pricing | R2 | Cannot Cut | Tier 2 — Gateway & Auth (Config Service) | W-10 (Settings — billing) |
| FR-1301 | F-061 | AI Cost Management (Live) | R2 | Cannot Cut | Tier 4 — AI Engine (Cost Tracker) | W-10 (Settings — cost dashboard) |
| FR-1302 | F-062 | Data Export | R2 | Could Defer | Tier 1 — Client Layer | N/A |

**Key acceptance criteria highlights (unchanged from v1.0):**
- FR-1300: Starter (limited AI) and Pro (full AI) tiers; feature gating at API layer; usage metering; overage tracking
- FR-1301: Per-tenant cost dashboards by capability; rate limiting per tenant; token budget per operation type; margin tracking
- FR-1302: CSV and JSON export; tenant-scoped; 60s completion for 10K tasks; temporary S3 storage (24h)

---

## 18. R2 Platform Hardening (FR-1400 Series) — Summary

| FR | Feature Ref | Title | Release | Priority | Architecture Tier | UI/UX Ref |
|----|-------------|-------|---------|----------|------------------|-----------|
| FR-1400 | F-063 | API Layer | R2 | Could Defer | Tier 1 — Client Layer (Public REST API) | N/A (API docs) |
| FR-1401 | F-064 | Webhook System | R2 | Could Defer | Tier 7 — Integration Gateway | N/A |
| FR-1402 | F-065 | SOC 2 Type I Audit | R2 | Cannot Cut | Tier 8 — Security & AI Safety | N/A (compliance) |
| FR-1403 | F-066 | AI Guardrails for Multi-Tenant | R2 | Cannot Cut | Tier 8 — Security & AI Safety | N/A (security) |

**Key acceptance criteria highlights (unchanged from v1.0):**
- FR-1400: REST `/api/v1/` for projects, tasks, comments; API key management; cursor pagination; OpenAPI 3.1 docs
- FR-1401: Tenant-configurable webhook subscriptions; retry with exponential backoff; HMAC-SHA256 signatures
- FR-1402: SOC 2 Type I audit initiated; controls documented; automated evidence via AWS Config
- FR-1403: PII redaction from AI prompts; RAG scoped by tenant_id in WHERE; input sanitization; output validation

---

## 19. R2 Enhanced AI (FR-1500 Series) — Summary

| FR | Feature Ref | Title | Release | Priority | Architecture Tier | UI/UX Ref |
|----|-------------|-------|---------|----------|------------------|-----------|
| FR-1500 | F-067 | Predictive Delivery Dating | R2 | Could Defer | Tier 4 — AI Engine | W-15 (Timeline), W-21 (Gantt) |
| FR-1501 | F-068 | AI Meeting Prep + Follow-Up | R2 | Could Defer | Tier 4 — AI Engine | N/A |
| FR-1502 | F-069 | Scenario Planning | R2 | Could Defer | Tier 4 — AI Engine | N/A |
| FR-1503 | F-070 | AI Sprint Planning | R2 | Could Defer | Tier 4 — AI Engine | N/A |
| FR-1504 | F-071 | Custom AI Rules Per Project | R2 | Could Defer | Tier 4 — AI Engine | W-10 (Settings — per-project AI) |
| FR-1505 | F-072 | Smart Time Tracking | R2 | Optional | Tier 4 — AI Engine | W-06 (Task Detail — effort) |
| FR-1506 | F-073 | Additional Integrations | R2 | Could Defer | Tier 7 — Integration Gateway | N/A |

**Key acceptance criteria highlights (unchanged from v1.0):**
- FR-1500: Delivery dates from velocity data; 3 recovery options when trending late; confidence intervals
- FR-1501: Auto-generated meeting agendas; action item extraction from meeting notes; one-click task creation
- FR-1502: What-if scenarios (resource changes, scope additions, dependency delays); comparison view; saved but not applied
- FR-1503: Sprint scope suggestions from velocity + capacity; overcommitment flagged at >20% over historical velocity
- FR-1504: Per-project escalation thresholds, notification preferences, risk sensitivity; overrides tenant defaults
- FR-1505: AI infers effort from git commits, task transitions, comments; confidence >0.7 to surface; developer confirms
- FR-1506: Jira import (one-time migration); expanded Git providers; Confluence/Docs integration

---

## 20. R3 Per-Tenant Intelligence (FR-1600 Series) — Summary

| FR | Feature Ref | Title | Release | Priority | Architecture Tier | UI/UX Ref |
|----|-------------|-------|---------|----------|------------------|-----------|
| FR-1600 | F-074 | Per-Tenant AI Learning | R3 | Cannot Cut | Tier 4 — AI Engine | N/A (backend) |
| FR-1601 | F-075 | AI Estimation Engine | R3 | Cannot Cut | Tier 4 — AI Engine | W-06 (Task Detail — estimates) |
| FR-1602 | F-076 | Template Intelligence | R3 | Could Defer | Tier 4 — AI Engine | N/A |
| FR-1603 | F-077 | AI Coaching Layer | R3 | Could Defer | Tier 4 — AI Engine | N/A |
| FR-1604 | F-078 | AI Retrospective Facilitator | R3 | Could Defer | Tier 4 — AI Engine | N/A |

**Key acceptance criteria highlights (unchanged from v1.0):**
- FR-1600: Tenant-scoped model contexts; WBS incorporates tenant history; never cross-tenant learning; A/B tested
- FR-1601: Estimation from tenant-specific estimated vs actual effort; confidence intervals; available during WBS generation
- FR-1602: AI builds templates from completed projects; includes phases, tasks, dependencies, estimates; used as RAG enrichment
- FR-1603: Coaches PMs on delivery patterns ("you underestimate QA by 30%"); opt-in; delivered at planning moments
- FR-1604: Retrospective from actual data (planned vs actual); systemic pattern identification; per-project at close

---

## 21. R3 Productization (FR-1700 Series) — Summary

| FR | Feature Ref | Title | Release | Priority | Architecture Tier | UI/UX Ref |
|----|-------------|-------|---------|----------|------------------|-----------|
| FR-1700 | F-079 | Full Self-Service Onboarding | R3 | Cannot Cut | Tier 1 — Client Layer | N/A |
| FR-1701 | F-080 | Enterprise Tier | R3 | Could Defer | Tier 6 — Database | N/A |
| FR-1702 | F-081 | Project Manager Role | R3 | Cannot Cut | Tier 2 — Gateway & Auth (RBAC) | N/A |
| FR-1703 | F-082 | SOC 2 Type II | R3 | Cannot Cut | Tier 8 — Security & AI Safety | N/A (compliance) |

**Key acceptance criteria highlights (unchanged from v1.0):**
- FR-1700: Self-service signup under 5 minutes; AI-guided wizard; Jira/Asana/CSV import; zero human intervention
- FR-1701: Enterprise tier with custom AI rules, full API, SSO enforcement, optional schema isolation, configurable SLAs
- FR-1702: PM role: project-scoped management; create tasks, assign work; cannot access undesignated projects or site settings
- FR-1703: Continuous compliance monitoring; 6-month observation period; automated evidence; Type II assessment initiated

---

## 22. R3 Consultancy Moat (FR-1800 Series) — Summary

| FR | Feature Ref | Title | Release | Priority | Architecture Tier | UI/UX Ref |
|----|-------------|-------|---------|----------|------------------|-----------|
| FR-1800 | F-083 | AI-Generated SOWs + Proposals | R3 | Cannot Cut | Tier 4 — AI Engine (SOW Generator) | N/A |
| FR-1801 | F-084 | Knowledge Capture | R3 | Could Defer | Tier 4 — AI Engine | N/A |
| FR-1802 | F-085 | AI Onboarding for New Joiners | R3 | Could Defer | Tier 4 — AI Engine | N/A |
| FR-1803 | F-086 | Embedded Analytics + Benchmarking | R3 | Optional | Tier 1 — Client Layer | N/A |

**Key acceptance criteria highlights (unchanged from v1.0):**
- FR-1800: SOW from historical data via Opus 4 (8K in, 5K out); configurable templates; mandatory review; traceability logged
- FR-1801: AI extracts lessons learned at project close; categorized knowledge base; searchable via NL; surfaced during WBS generation
- FR-1802: AI generates project brief for new joiners (30s); includes decisions, risks, team, blockers, recommended first tasks
- FR-1803: Delivery metrics benchmarked against anonymized platform data; minimum 10 tenants for anonymity

---

## 23. Promoted Visualization (FR-1900 Series) — Summary

| FR | Feature Ref | Title | Release | Priority | Architecture Tier | UI/UX Ref |
|----|-------------|-------|---------|----------|------------------|-----------|
| FR-1900 | F-087 | Read-Only Kanban Board View | R1 (promoted from R3) | Cannot Cut | Tier 1 — Client Layer | W-12 (Kanban Board) |
| FR-1901 | F-088 | Gantt Chart View | R2 (promoted from R3) | Could Defer | Tier 1 — Client Layer | W-21 (Gantt Chart) |

**Key acceptance criteria highlights (unchanged from v1.0):**
- FR-1900: Kanban columns by configurable status; AI annotations (blocked, priority, stalled); read-only R1, drag-and-drop R2; view toggle
- FR-1901: Gantt with dependency lines; AI overlays (predicted delays, critical path, at-risk milestones); zoom day/week/month; view toggle

---

## 23a. ClickUp Gap Features (FR-2000 Series)

> These 15 features close table-stakes gaps identified in a competitive gap analysis against ClickUp's top 50 features. They are distributed across R0, R1, and R2 to maintain timeline feasibility.

### FR-2000 — Task Checklists

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-089 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 3 — Application Services (Task Module) |
| **Design Ref** | design.md Section 7.3 (Task Module — checklists); architecture-v3.1.md (task_checklists, checklist_items tables) |
| **UI/UX Ref** | W-06 (Task Detail — checklist widget) |

**Description:** Simple to-do lists within tasks for micro-steps that don't need full subtasks. Each task can have multiple named checklists, each containing ordered items that can be individually checked off. A progress bar shows X/Y completed. AI can propose checklists during WBS generation (e.g., "Definition of Done" checklist per task type).

**User Story:** As a Developer, I want to add checklists to my tasks so that I can track micro-steps without creating heavyweight subtasks.

**Acceptance Criteria:**
- **AC-1:** Users can create, rename, reorder, and delete checklists within a task.
- **AC-2:** Each checklist contains ordered items with text, completion state, and completed-by attribution.
- **AC-3:** Checklist items can be individually marked complete/incomplete with timestamp and user tracking.
- **AC-4:** A progress bar (X/Y completed) is displayed inline on the task detail view.
- **AC-5:** Checklists are sortable via drag-and-drop within a task.
- **AC-6:** `pm.tasks.checklist_updated` NATS event emitted on checklist modifications.
- **AC-7:** AI WBS generator (FR-200) can optionally include checklists in generated tasks.

**Data Readiness Gate:** N/A — new feature, no historical data required.

**Dependencies:** FR-105 (task data model), FR-500 (task detail view).

---

### FR-2001 — Recurring Tasks

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-090 |
| **Release** | R1 |
| **Priority** | Could Defer (strongly recommended) |
| **Architecture Tier** | Tier 3 — Application Services (Task Module) |
| **Design Ref** | design.md Section 7.3 (Task Module — recurrence); architecture-v3.1.md (tasks table extensions) |
| **UI/UX Ref** | W-06 (Task Detail — recurrence config) |

**Description:** Tasks that auto-recreate on a schedule (daily, weekly, monthly, custom cron). Uses iCal RRULE format for recurrence rules. When `next_recurrence_at` passes, the system clones the task (title, description, assignees, checklist template, phase) and links to the parent via `recurrence_parent_id`. The AI PM Agent (FR-601) can suggest converting repeated manual tasks into recurring tasks.

**User Story:** As a Project Manager, I want to create recurring tasks so that routine work (weekly reviews, monthly reports) auto-generates without manual recreation.

**Acceptance Criteria:**
- **AC-1:** Tasks can be configured with a recurrence rule (daily, weekly, monthly, custom RRULE).
- **AC-2:** Recurring task instances are auto-created when `next_recurrence_at` passes.
- **AC-3:** Each instance is linked to the recurrence parent via `recurrence_parent_id`.
- **AC-4:** Cloned instances inherit title, description, assignees, checklist template, and phase.
- **AC-5:** Recurrence can be paused, resumed, or stopped without affecting existing instances.
- **AC-6:** `pm.tasks.recurrence_triggered` NATS event emitted on each recurrence creation.
- **AC-7:** The `recurrence-scheduler` consumer processes due recurrences within 2 minutes of scheduled time.

**Data Readiness Gate:** N/A — new feature.

**Dependencies:** FR-105 (task data model), FR-2000 (checklists — for checklist template cloning).

---

### FR-2002 — Calendar View

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-091 |
| **Release** | R1 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 1 — Client Layer |
| **Design Ref** | design.md Section 5 (Client Layer); architecture-v3.1.md Section 3 |
| **UI/UX Ref** | W-13 (Calendar View wireframe) |

**Description:** Visualize tasks by due date on a calendar grid with month, week, and day views. Tasks appear as colored chips (by priority or status). Click to open task detail. Drag to reschedule due date. Calendar view is a standard view toggle alongside list, board, table, and timeline.

**User Story:** As a Project Manager, I want a calendar view of tasks so that I can see and manage deadlines in a familiar date-based format.

**Acceptance Criteria:**
- **AC-1:** Calendar view displays tasks on a month grid (default), with week and day modes.
- **AC-2:** Tasks appear as colored chips on their due date, colored by priority or status (configurable).
- **AC-3:** Clicking a task chip opens the task detail view.
- **AC-4:** Dragging a task chip to a different date updates its due date (with undo).
- **AC-5:** Calendar view is accessible via view toggle alongside list, board, and table views.
- **AC-6:** Tasks without due dates are excluded from the calendar view (with a "no date" indicator showing count).

**Data Readiness Gate:** N/A — visualization of existing `tasks.due_date` data.

**Dependencies:** FR-105 (task data model with due_date), FR-501 (task list for view toggle).

---

### FR-2003 — Table View

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-092 |
| **Release** | R1 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 1 — Client Layer |
| **Design Ref** | design.md Section 5 (Client Layer); architecture-v3.1.md (saved_views table) |
| **UI/UX Ref** | W-14 (Table View wireframe) |

**Description:** Spreadsheet-like interface for viewing and inline-editing task data in bulk. Columns include title, status, priority, assignee, phase, due date, estimated effort, actual effort, tags, and AI confidence. Columns can be resized, reordered, and hidden. Sort by any column. Includes a saved views system for persisting view configurations per user.

**User Story:** As a Project Manager, I want a table view so that I can see all task data at a glance and make bulk edits efficiently.

**Acceptance Criteria:**
- **AC-1:** Table view displays tasks in a spreadsheet-like grid with all standard task fields as columns.
- **AC-2:** Cells support inline editing (click to edit status, priority, assignee, due date, effort).
- **AC-3:** Columns can be resized, reordered, and hidden per user preference.
- **AC-4:** Sorting by any column (ascending/descending) is supported.
- **AC-5:** View configurations (visible columns, sort order, filters) can be saved as named views via the `saved_views` table.
- **AC-6:** Saved views are scoped per user per tenant, with an optional `is_default` flag.
- **AC-7:** Table view is accessible via view toggle alongside list, board, and calendar views.

**Data Readiness Gate:** N/A — visualization of existing task data.

**Dependencies:** FR-105 (task data model), FR-501 (task list).

---

### FR-2004 — @Mentions in Comments

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-093 |
| **Release** | R0 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 3 — Application Services (Comment Module) |
| **Design Ref** | design.md Section 7.5 (Comment Module); architecture-v3.1.md (mentions table) |
| **UI/UX Ref** | W-06 (Task Detail — comments with @mention autocomplete) |

**Description:** Users can reference other users with @username in comments, triggering notifications. An @-autocomplete dropdown appears in the comment input when the user types "@". Mentioned users receive a notification via the notification pipeline. Mentions are stored in a `mentions` table linking comment_id to mentioned_user_id.

**User Story:** As a Developer, I want to @mention teammates in comments so that they are notified and can respond to relevant discussions.

**Acceptance Criteria:**
- **AC-1:** Typing "@" in a comment input triggers an autocomplete dropdown showing tenant users.
- **AC-2:** Selecting a user inserts an @mention reference in the comment content.
- **AC-3:** Mentioned users receive a notification (via notification-router).
- **AC-4:** `pm.comments.mention_created` NATS event emitted for each mention.
- **AC-5:** GET `/api/v1/users/me/mentions` returns all mentions for the current user, paginated.
- **AC-6:** @mentions are visually distinct in rendered comment content (highlighted/linked).

**Data Readiness Gate:** N/A — new feature.

**Dependencies:** FR-503 (comment system), FR-103 (user model).

---

### FR-2005 — Custom Fields

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-094 |
| **Release** | R1 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 3 — Application Services (Task Module) |
| **Design Ref** | architecture-v3.1.md (custom_field_definitions, custom_field_values tables) |
| **UI/UX Ref** | W-06 (Task Detail — custom fields section), W-14 (Table View — custom columns) |

**Description:** Tenant/project-scoped custom field definitions with multiple types: text, number, date, select, multi-select, URL, email, checkbox. Field definitions are managed per tenant or per project. Values are stored against tasks. AI can read custom fields as context for WBS generation, prioritization, and NL queries.

**User Story:** As a Site Admin, I want to define custom fields so that my team can track domain-specific data (e.g., client contract value, regulatory requirement ID) on tasks.

**Acceptance Criteria:**
- **AC-1:** Admins can create custom field definitions scoped to tenant (global) or project (local).
- **AC-2:** Supported field types: text, number, date, select, multi-select, URL, email, checkbox.
- **AC-3:** Select/multi-select types support configurable option lists stored in JSONB.
- **AC-4:** Custom field values can be set on any task via PATCH `/api/v1/tasks/:id/custom-fields`.
- **AC-5:** Tasks can be filtered by custom field values via query parameters.
- **AC-6:** Custom fields appear in task detail view, table view, and are included in data exports.
- **AC-7:** `pm.tasks.custom_field_updated` NATS event emitted when custom field values change.
- **AC-8:** AI capabilities (FR-200, FR-203) include custom field values in their context assembly.

**Data Readiness Gate:** N/A — new feature.

**Dependencies:** FR-105 (task data model), FR-101 (tenant isolation).

---

### FR-2006 — Goals & OKRs

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-095 |
| **Release** | R2 |
| **Priority** | Could Defer |
| **Architecture Tier** | Tier 3 — Application Services (Goals Module) |
| **Design Ref** | architecture-v3.1.md (goals, goal_task_links tables) |
| **UI/UX Ref** | W-20 (Goals & OKR Dashboard wireframe) |

**Description:** High-level objectives with measurable key results linked to tasks and projects. Goals support hierarchical nesting (goal -> objectives -> key results via self-referencing `parent_goal_id`). Progress is auto-calculated from linked task completion. AI can suggest which tasks contribute to which goals and flag goals at risk based on linked task status.

**User Story:** As a Project Manager, I want to define goals and OKRs so that I can align day-to-day delivery with strategic business objectives.

**Acceptance Criteria:**
- **AC-1:** CRUD operations on goals with title, description, goal_type (goal/objective/key_result), target/current values, unit, and status.
- **AC-2:** Goals support hierarchical nesting via `parent_goal_id` (self-referencing).
- **AC-3:** Tasks can be linked to goals via `goal_task_links` junction table.
- **AC-4:** Goal progress is auto-calculated from linked task completion percentage.
- **AC-5:** Goal status (on_track, at_risk, behind, completed) is auto-assessed from progress vs timeline.
- **AC-6:** `pm.goals.progress_updated` and `pm.goals.at_risk` NATS events emitted on status changes.
- **AC-7:** AI can suggest task-to-goal linkages based on task content analysis.
- **AC-8:** Goals page accessible as a new sidebar navigation item.

**Data Readiness Gate:** N/A — new feature (value increases with more linked tasks).

**Dependencies:** FR-105 (task data model), FR-502 (sidebar navigation).

---

### FR-2007 — Smart Notification System

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-096 |
| **Release** | R1 |
| **Priority** | Cannot Cut |
| **Architecture Tier** | Tier 3 — Application Services (Notification Module) |
| **Design Ref** | architecture-v3.1.md (notifications, notification_preferences tables); design.md Section 9.3 (notification-generator consumer) |
| **UI/UX Ref** | W-17 (Notification Inbox wireframe), W-01 (App Shell — bell icon) |

**Description:** Centralized notification inbox with filtering, prioritization, and channel preferences. All system events (mentions, assignments, status changes, comments, AI actions, reminders, escalations, due-soon alerts) feed into a `notification-generator` NATS consumer that creates notification records based on user preferences. Users configure which notification types they want and via which channels (in-app, email, Slack).

**User Story:** As a Developer, I want a centralized notification inbox so that I can see all relevant updates in one place and control which notifications I receive.

**Acceptance Criteria:**
- **AC-1:** Bell icon in the application header shows unread notification count badge.
- **AC-2:** Notification dropdown/panel displays notifications with title, body, timestamp, and source entity link.
- **AC-3:** Notifications filterable by type (mention, assignment, status_change, comment, ai_action, reminder, escalation, due_soon).
- **AC-4:** "Mark as read" (individual and bulk) and "Mark all as read" functionality.
- **AC-5:** Click-through navigation: clicking a notification opens the source entity (task, comment, goal, etc.).
- **AC-6:** User preferences: per-notification-type channel selection (in_app, email, slack), enable/disable per type.
- **AC-7:** `notification-generator` consumer creates records from all relevant NATS events.
- **AC-8:** `pm.notifications.created` NATS event emitted for each new notification.

**Data Readiness Gate:** N/A — infrastructure feature.

**Dependencies:** FR-100 (event bus), FR-503 (comments), FR-2004 (@mentions).

---

### FR-2008 — Assigned Comments / Action Items

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-097 |
| **Release** | R1 |
| **Priority** | Could Defer |
| **Architecture Tier** | Tier 3 — Application Services (Comment Module) |
| **Design Ref** | architecture-v3.1.md (comments table extensions) |
| **UI/UX Ref** | W-06 (Task Detail — action item badge on comment) |

**Description:** Turn a comment into a required action item assigned to a specific user. Adds `assigned_to`, `is_action_item`, `action_status`, and `action_completed_at` columns to the comments table. Action items appear in the "What's Next" feed (FR-201) and the notification inbox (FR-2007). The AI PM Agent (FR-601) flags unresolved action items during its daily loops.

**User Story:** As a Project Manager, I want to assign comments as action items so that discussion points are converted into trackable work without creating separate tasks.

**Acceptance Criteria:**
- **AC-1:** "Assign as action item" button on any comment, selecting an assignee.
- **AC-2:** Assigned comments show action status badge (pending/completed).
- **AC-3:** Assigned user sees the action item in their "What's Next" feed.
- **AC-4:** GET `/api/v1/users/me/action-items` returns all pending action items for the current user.
- **AC-5:** Action items can be marked complete (updates `action_status` and `action_completed_at`).
- **AC-6:** `pm.comments.action_assigned` NATS event emitted when a comment is assigned as an action.
- **AC-7:** AI PM Agent includes unresolved action items in its stalled work detection.

**Data Readiness Gate:** N/A — new feature.

**Dependencies:** FR-503 (comment system), FR-201 (What's Next), FR-2007 (notifications).

---

### FR-2009 — Custom Automations

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-098 |
| **Release** | R2 |
| **Priority** | Could Defer |
| **Architecture Tier** | Tier 3 — Application Services (Automation Module) |
| **Design Ref** | architecture-v3.1.md (automation_rules table); design.md Section 9.3 (automation-engine consumer) |
| **UI/UX Ref** | W-10 (Settings > Automations) |

**Description:** User-configurable if-then automation rules that execute deterministic actions in response to system events. Distinct from AI-driven actions (which are probabilistic and governed by the autonomy policy). Trigger types include: task_status_changed, task_assigned, task_due_soon, comment_added, dependency_resolved, custom_field_changed. Action types include: change_status, assign_user, add_tag, send_notification, move_to_phase, set_priority, add_comment, trigger_webhook.

**User Story:** As a Site Admin, I want to create custom automation rules so that routine workflow actions happen automatically without AI involvement.

**Acceptance Criteria:**
- **AC-1:** CRUD operations on automation rules with name, trigger_event, trigger_conditions (JSONB), action_type, action_config (JSONB), and is_active toggle.
- **AC-2:** Rules scoped to tenant (global) or project (local).
- **AC-3:** `automation-engine` NATS consumer evaluates active rules against incoming events.
- **AC-4:** Supported trigger types: task_status_changed, task_assigned, task_due_soon, comment_added, dependency_resolved, custom_field_changed.
- **AC-5:** Supported action types: change_status, assign_user, add_tag, send_notification, move_to_phase, set_priority, add_comment, trigger_webhook.
- **AC-6:** Automation execution history viewable via GET `/api/v1/automations/logs`.
- **AC-7:** `pm.automations.triggered` and `pm.automations.executed` NATS events emitted.
- **AC-8:** Automation builder UI under Settings > Automations with trigger selector -> condition builder -> action selector.

**Data Readiness Gate:** N/A — new feature.

**Dependencies:** FR-100 (event bus), FR-105 (task data model).

---

### FR-2010 — Form View / Task Intake Forms

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-099 |
| **Release** | R2 |
| **Priority** | Could Defer |
| **Architecture Tier** | Tier 3 — Application Services (Forms Module) |
| **Design Ref** | architecture-v3.1.md (forms table) |
| **UI/UX Ref** | N/A (public form URL) |

**Description:** Shareable forms that create tasks on submission. A form builder allows creating forms with configurable fields (task title, description, priority, custom fields). Published forms have a public URL (no auth required for submission). Submissions create tasks in the target project/phase with optional default assignee.

**User Story:** As a Project Manager, I want to create task intake forms so that stakeholders can submit requests without needing PM tool access.

**Acceptance Criteria:**
- **AC-1:** Form builder allows creating forms with title, description, and configurable fields (JSONB array).
- **AC-2:** Forms can be scoped to a target project and optional default phase/assignee.
- **AC-3:** Published forms are accessible via a public URL (`/api/v1/forms/:slug/submit` — no auth required).
- **AC-4:** Form submission creates a task in the target project with submitted field values.
- **AC-5:** Form submission count tracked per form.
- **AC-6:** `pm.forms.submitted` NATS event emitted on each submission.
- **AC-7:** Form owner can view submissions list and their resulting tasks.

**Data Readiness Gate:** N/A — new feature.

**Dependencies:** FR-105 (task data model), FR-102 (project model).

---

### FR-2011 — Formula / Computed Fields

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-100 |
| **Release** | R2 |
| **Priority** | Could Defer |
| **Architecture Tier** | Tier 3 — Application Services (Task Module) |
| **Design Ref** | architecture-v3.1.md (custom_field_definitions extension) |
| **UI/UX Ref** | W-14 (Table View — computed columns) |

**Description:** Calculated fields using task data. Extends the custom field system (FR-2005) with a 'formula' field type. Formulas support basic arithmetic (+, -, *, /), field references (including other custom fields), date differences, conditionals (IF), and aggregations over subtasks (SUM, AVG, COUNT). Formula evaluation happens server-side on read.

**User Story:** As a Project Manager, I want formula fields so that computed values (e.g., cost = hours x rate) are automatically calculated from task data.

**Acceptance Criteria:**
- **AC-1:** Custom field definitions support a 'formula' field_type with a `formula_expression` column.
- **AC-2:** Supported operations: basic arithmetic (+, -, *, /), field references, date diffs, IF conditionals.
- **AC-3:** Aggregations over subtasks: SUM, AVG, COUNT of a field across child tasks.
- **AC-4:** Formulas evaluate server-side on read (not stored as values).
- **AC-5:** Formula errors (division by zero, missing field) return null with an error indicator, not exceptions.
- **AC-6:** Computed values appear in task detail view, table view, and data exports.

**Data Readiness Gate:** N/A — extends FR-2005 (custom fields).

**Dependencies:** FR-2005 (custom fields), FR-107 (sub-tasks for aggregation).

---

### FR-2012 — Docs & Knowledge Base

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-101 |
| **Release** | R2 |
| **Priority** | Could Defer |
| **Architecture Tier** | Tier 3 — Application Services (Documents Module) |
| **Design Ref** | architecture-v3.1.md (documents table) |
| **UI/UX Ref** | W-05 (Project Detail — documents tab) |

**Description:** Collaborative documents linked to projects, searchable, and embeddable in the RAG pipeline. Documents are Markdown-formatted with draft/published/archived statuses. Client-visible flag enables inclusion in the projection layer. Documents are indexed into pgvector embeddings, enriching NL queries (FR-203) and WBS generation (FR-200) with organizational knowledge.

**User Story:** As a Project Manager, I want to create and link documents to projects so that project knowledge is centralized and discoverable by the AI.

**Acceptance Criteria:**
- **AC-1:** CRUD operations on documents with title, Markdown content, project association, author, and status (draft/published/archived).
- **AC-2:** `client_visible` boolean flag for inclusion in client portal projection.
- **AC-3:** Full-text search via `search_vector` TSVECTOR column (integration with FR-1002 search infrastructure).
- **AC-4:** `pm.documents.created` and `pm.documents.updated` NATS events feed the embedding pipeline for RAG.
- **AC-5:** Document embeddings are used in AI context assembly for NL queries and WBS generation.
- **AC-6:** Document list view per project with search, filter by status, and sort by date.

**Data Readiness Gate:** N/A — new feature (value increases as documents are created).

**Dependencies:** FR-102 (project model), FR-1002 (search infrastructure), FR-100 (event bus for embedding pipeline).

---

### FR-2013 — AI Writing Assistant

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-102 |
| **Release** | R2 |
| **Priority** | Could Defer |
| **Architecture Tier** | Tier 4 — AI Engine (AI Writing Assistant capability) |
| **Design Ref** | architecture-v3.1.md Section 6 (AI Engine — 10 capabilities) |
| **UI/UX Ref** | W-06 (Task Detail — AI write button), W-09 (NL Query panel) |

**Description:** AI-powered content generation for task descriptions, comments, reports, and documents. Capabilities include: drafting task descriptions from a title, improving/expanding existing text, generating meeting notes from bullet points, drafting client-facing summaries, and translating technical language to business language. Uses Sonnet 4.5 via the existing 7-stage AI pipeline, governed by the autonomy policy.

**User Story:** As a Developer, I want AI writing assistance so that I can quickly draft task descriptions, improve my comments, and generate clear documentation.

**Acceptance Criteria:**
- **AC-1:** POST `/api/v1/ai/write` accepts `{ context, instruction, tone, max_length }` and streams the AI response.
- **AC-2:** Available writing modes: draft from title, improve/expand, summarize, translate tone (technical -> business).
- **AC-3:** Context-aware: AI receives relevant task/project/document context for generation.
- **AC-4:** Writing assistant is invokable from task description editor, comment input, and document editor.
- **AC-5:** Generated content is clearly labeled as AI-generated.
- **AC-6:** AI cost tracked per tenant via existing cost tracking infrastructure (FR-904).
- **AC-7:** Governed by autonomy policy (FR-300) — respects tenant AI operation limits.

**Data Readiness Gate:** N/A — uses existing AI pipeline.

**Dependencies:** FR-200 (AI engine infrastructure), FR-300 (autonomy policy), FR-904 (cost tracking).

---

### FR-2014 — Task Reminders

| Attribute | Value |
|-----------|-------|
| **Feature Ref** | F-103 |
| **Release** | R1 |
| **Priority** | Could Defer |
| **Architecture Tier** | Tier 3 — Application Services (Notification Module) |
| **Design Ref** | architecture-v3.1.md (reminders table) |
| **UI/UX Ref** | W-06 (Task Detail — reminder button) |

**Description:** Personal reminders on tasks — users set a specific date/time to be reminded about a task. A pg_cron scheduler checks for due reminders every minute (`remind_at <= NOW() AND is_sent = false`). Due reminders emit `pm.reminders.due` NATS events consumed by the notification-router to deliver in-app/email/Slack notifications.

**User Story:** As a Developer, I want to set reminders on tasks so that I'm notified at a specific time to follow up on work.

**Acceptance Criteria:**
- **AC-1:** Users can create reminders on any task with a `remind_at` timestamp and optional message.
- **AC-2:** Users can view and delete their reminders via GET/DELETE `/api/v1/reminders`.
- **AC-3:** pg_cron scheduler processes due reminders within 2 minutes of `remind_at`.
- **AC-4:** Due reminders emit `pm.reminders.due` NATS event consumed by notification-router.
- **AC-5:** Reminder notification delivered via user's preferred channels (in-app, email, Slack).
- **AC-6:** `is_sent` flag prevents duplicate delivery; `sent_at` timestamp records delivery time.
- **AC-7:** GET `/api/v1/users/me/reminders` returns all upcoming reminders for the current user.

**Data Readiness Gate:** N/A — new feature.

**Dependencies:** FR-105 (task data model), FR-2007 (notification system), FR-100 (event bus).

---

## 24. Non-Functional Requirements

### NFR-001 — Performance

| Attribute | Value |
|-----------|-------|
| **Category** | Performance |

**Description:** The system must deliver responsive performance for both standard API operations and AI-powered features. Standard API calls must feel instant, while AI operations (which involve LLM calls) must complete within acceptable interactive timeframes. Performance budgets are defined per operation type.

**Measurable Targets:**
- Standard API endpoints: p95 latency < 500ms
- NL Query (AI): p95 latency < 8 seconds
- NL-to-WBS generation (AI): p95 latency < 30 seconds
- "What's Next" endpoint: p95 latency < 500ms (R0 rules-based), < 3 seconds (R1 AI-ranked)
- AI daily summary generation: p95 latency < 15 seconds
- Full-text search: p95 latency < 500ms for up to 100K documents
- Web app First Contentful Paint: < 1.5 seconds
- Web app Time to Interactive: < 3 seconds

**Verification Method:** Automated load testing with representative workloads; CloudWatch latency metrics with p95 alarms; synthetic monitoring.

**Related FRs:** FR-200, FR-201, FR-203, FR-1002.

---

### NFR-002 — Scalability

| Attribute | Value |
|-----------|-------|
| **Category** | Scalability |

**Description:** The system must scale from a single-tenant internal deployment to a multi-tenant SaaS platform without architectural changes. Scaling is achieved through configuration (ECS task counts, RDS instance sizes) rather than topology changes.

**Measurable Targets:**
- R0: 1 tenant, 10 users, 1K tasks
- R1: 1 tenant, 20 users, 10K tasks
- R2: 3 tenants, 50 users, 50K tasks
- R3: 10+ tenants, 100+ users, 100K+ tasks
- Event bus: handle up to 10K events/day (R0) scaling to 100K events/day (R3)
- AI operations: handle up to 500 operations/month per tenant (R2 Starter tier)

**Verification Method:** Load testing at target scale; auto-scaling policies validated; database performance at target data volumes.

**Related FRs:** FR-100, FR-101, FR-1200.

---

### NFR-003 — Availability

| Attribute | Value |
|-----------|-------|
| **Category** | Availability |

**Description:** The system must maintain high availability with minimal unplanned downtime. Scheduled maintenance windows are excluded from uptime calculations. Critical AI operations degrade gracefully when the LLM provider is unavailable.

**Measurable Targets:**
- 99.9% uptime (excludes scheduled maintenance windows)
- Maximum unplanned downtime: 8.7 hours per year
- LLM Gateway circuit breaker: 5 consecutive failures triggers 60-second open state with cached/fallback responses
- Database: Multi-AZ deployment with automatic failover

**Verification Method:** Uptime monitoring via CloudWatch; incident tracking; failover testing.

**Related FRs:** FR-100, FR-303 (graceful degradation).

---

### NFR-004 — Security

| Attribute | Value |
|-----------|-------|
| **Category** | Security |

**Description:** The system must implement defense-in-depth security covering encryption, authentication, authorization, and protection against common web application vulnerabilities. Security is structural, not aspirational — enforced at infrastructure and database layers.

**Measurable Targets:**
- OWASP Top 10 vulnerability prevention (verified by WAF rules and security scanning)
- TLS 1.3 on all connections (ALB-to-services, services-to-database, services-to-cache, services-to-event bus)
- AES-256 encryption at rest for all data stores (RDS, S3, ElastiCache)
- Zero hardcoded secrets (all secrets in AWS Secrets Manager with automatic rotation)
- Penetration testing annually (starting R2)

**Verification Method:** WAF rule validation; encryption configuration audits; secrets scanning in CI/CD; annual penetration test.

**Related FRs:** FR-103, FR-104, FR-800, FR-801, FR-802, FR-903.

---

### NFR-005 — Compliance

| Attribute | Value |
|-----------|-------|
| **Category** | Compliance |

**Description:** The system must meet compliance requirements for enterprise SaaS customers, including SOC 2 certification and GDPR-compliant data handling for personal information.

**Measurable Targets:**
- SOC 2 Type I audit initiated by end of R2 (month 9)
- SOC 2 Type II observation period started by end of R2
- SOC 2 Type II certification achieved during R3
- GDPR: data subject access requests fulfilled within 30 days
- Data retention policies enforced automatically

**Verification Method:** External audit reports; compliance checklists; data retention policy enforcement logs.

**Related FRs:** FR-903, FR-1402, FR-1703, FR-108.

---

### NFR-006 — AI Quality

| Attribute | Value |
|-----------|-------|
| **Category** | AI Quality |

**Description:** AI-generated outputs must meet quality standards that build and maintain user trust. Quality is measured through acceptance rates, hallucination tracking, and override rates. AI quality is treated as a continuous improvement process with automated evaluation.

**Measurable Targets:**
- NL-to-WBS acceptance rate (approved without major edits): > 60% after first month
- AI hallucination rate (stating facts not present in source data): < 5%
- AI override rate (human edits before approving): < 40% (above 40% indicates miscalibration)
- Risk prediction accuracy: > 70% on flagged items (R1+)
- Client portal AI response accuracy: > 80% (no internal data leakage)

**Verification Method:** Automated tracking via evaluation harness (FR-401); golden test sets; monthly quality reviews.

**Related FRs:** FR-200, FR-401, FR-603, FR-1205.

---

### NFR-007 — Maintainability

| Attribute | Value |
|-----------|-------|
| **Category** | Maintainability |

**Description:** The codebase must be maintainable by a 5-7 engineer team with clear module boundaries, comprehensive test coverage, and TypeScript strict mode enforced throughout. The modular monolith architecture enables future service extraction without rewriting application logic.

**Measurable Targets:**
- Test coverage: minimum 80% across all modules
- TypeScript strict mode enabled; zero `any` types in production code
- Modular monolith with clean module boundaries (each module has own directory, routes, service layer, repository)
- Versioned database migrations with zero-downtime rollback capability
- Prompt templates version-controlled and PR-reviewed like code

**Verification Method:** CI/CD coverage reports; TypeScript compiler checks; architecture fitness functions; code review process.

**Related FRs:** All (cross-cutting concern).

---

### NFR-008 — Usability

| Attribute | Value |
|-----------|-------|
| **Category** | Usability |

**Description:** The system must be immediately usable without extensive training. The AI-first interaction model (NL queries, AI recommendations) must be more efficient than traditional PM tool navigation. The AI review interface must support high-density supervisory workflows.

**Measurable Targets:**
- New user onboarding: productive within 15 minutes without training
- AI review interface: 50 proposals reviewable in 30 seconds
- "What's Next" view: developer identifies next task within 5 seconds of page load
- Client portal: client finds project status within 10 seconds
- Mobile-responsive: all core views functional on 375px+ viewport

**Verification Method:** Usability testing with representative users; time-on-task measurements; responsive design testing.

**Related FRs:** FR-301, FR-201, FR-502, FR-1201.

---

### NFR-009 — Data Integrity

| Attribute | Value |
|-----------|-------|
| **Category** | Data Integrity |

**Description:** The system must maintain data consistency and integrity through database-level constraints, immutable audit logging, and safe deletion practices. Data loss must be architecturally prevented.

**Measurable Targets:**
- Foreign key constraints on all relational references
- Soft deletes on all user-facing entities (hard deletes only via background retention jobs)
- Immutable audit log (INSERT only; no UPDATE/DELETE grants)
- Versioned database migrations with rollback scripts
- Circular dependency prevention validated at API layer

**Verification Method:** Database constraint verification; audit log integrity checks; migration rollback testing.

**Related FRs:** FR-102, FR-106, FR-108.

---

### NFR-010 — Observability

| Attribute | Value |
|-----------|-------|
| **Category** | Observability |

**Description:** The system must provide comprehensive observability for both standard application operations and AI-specific metrics. Operators must be able to diagnose issues, trace requests end-to-end, and monitor AI quality in real-time.

**Measurable Targets:**
- Structured JSON logging from all services (CloudWatch Logs)
- Distributed tracing via AWS X-Ray (end-to-end: API to AI to database)
- AI-specific dashboards: per-capability latency, cost, acceptance rate, confidence distribution
- Alert rules for: circuit breaker open, AI failure rate > 10%, budget exceeded, NATS consumer lag > 1000, p95 API latency > 2 seconds
- Error tracking with source maps and release correlation (Sentry)

**Verification Method:** Dashboard review; alert testing; trace sampling validation.

**Related FRs:** FR-400, FR-402, FR-904.

---

### NFR-011 — Tenant Isolation

| Attribute | Value |
|-----------|-------|
| **Category** | Tenant Isolation |

**Description:** Tenant data isolation must be enforced at the database level via Row-Level Security, not application-trust. Every data access path must be verified to prevent cross-tenant data leakage, including AI operations that assemble context from tenant data.

**Measurable Targets:**
- RLS policies on all tenant-scoped tables (30 tables per architecture-v3.1.md) enforced via `current_setting('app.current_tenant_id')`
- JWT carries `tenant_id` claim; per-request context setting before any query
- RAG retrieval scoped by `tenant_id` in WHERE clause (not post-filter)
- Embedding queries include tenant filter in vector search
- Zero cross-tenant data access incidents (verified by automated isolation tests)

**Verification Method:** Automated cross-tenant access tests; RLS policy review; AI context assembly verification.

**Related FRs:** FR-101, FR-1200, FR-1403.

---

### NFR-012 — Disaster Recovery

| Attribute | Value |
|-----------|-------|
| **Category** | Disaster Recovery |

**Description:** The system must support recovery from catastrophic failures with defined recovery point and recovery time objectives. Backups must be cross-region and regularly tested.

**Measurable Targets:**
- Recovery Point Objective (RPO): < 1 hour (maximum data loss in disaster scenario)
- Recovery Time Objective (RTO): < 4 hours (maximum time to restore service)
- Cross-region database backups (S3 cross-region replication on backups bucket)
- Automated daily database backups with 30-day retention
- Disaster recovery plan tested quarterly

**Verification Method:** Backup restoration testing; DR drill execution; RPO/RTO measurement during drills.

**Related FRs:** FR-102, FR-108.

---

## 25. Data Requirements

### 25.1 Core Entities

The following entities comprise the core data model. All entities include `tenant_id` as the first column in composite indexes. Per architecture-v3.1.md, the full schema includes 30 tables.

| Entity | Description | Key Relationships |
|--------|-------------|------------------|
| **tenants** | Organizational units with isolated data | Parent of all tenant-scoped entities |
| **users** | Authenticated users with role assignments | Belongs to tenant; assigned to tasks |
| **projects** | Top-level project containers with NL descriptions | Belongs to tenant; contains phases and tasks |
| **phases** | Project phases grouping related tasks | Belongs to project; contains tasks |
| **tasks** | Work items with full field set and AI metadata | Belongs to project/phase; has assignments, dependencies, sub-tasks, comments |
| **task_assignments** | Junction table linking users to tasks with roles | Links users to tasks (assignee, reviewer, approver) |
| **task_dependencies** | Finish-to-start dependency relationships | Links blocking task to blocked task |
| **task_checklists** | Named checklists within tasks | Belongs to task; contains checklist_items |
| **checklist_items** | Individual items within a checklist | Belongs to task_checklist |
| **comments** | Per-task discussion with client-visibility flag | Belongs to task; authored by user |
| **mentions** | @mention references in comments | Links comment to mentioned user |
| **tags** | Categorization labels scoped to project/tenant | Many-to-many with tasks |
| **custom_field_definitions** | Tenant/project-scoped field type definitions | Belongs to tenant or project |
| **custom_field_values** | Field values stored against tasks | Links field definition to task |
| **goals** | OKR hierarchy with progress tracking | Self-referencing hierarchy; linked to tasks |
| **goal_task_links** | Junction table linking goals to tasks | Links goals to tasks |
| **notifications** | User notification records | Belongs to user; references source entity |
| **notification_preferences** | Per-user channel preferences | Belongs to user |
| **automation_rules** | If-then automation definitions | Scoped to tenant or project |
| **forms** | Task intake form definitions | Belongs to project |
| **documents** | Markdown knowledge base documents | Belongs to project |
| **saved_views** | Persisted view configurations | Belongs to user within tenant |
| **reminders** | Per-task personal reminders | Belongs to user and task |
| **ai_actions** | Full traceability log for every AI operation | Links to trigger event, audit entries |
| **ai_cost_log** | Per-operation token and cost tracking | Links to ai_action; aggregated per tenant |
| **audit_log** | Immutable change log (INSERT only) | References any entity; partitioned by month |
| **tenant_configs** | Per-tenant settings, feature flags, plan data | Belongs to tenant |
| **embeddings** | Vector representations for RAG retrieval (pgvector) | References source entity (task, comment, project, document) |

### 25.2 Data Retention Policies

| Data Type | Retention Period | Archival Strategy |
|-----------|-----------------|-------------------|
| Audit logs | 7 years (compliance requirement) | Monthly partitioning; S3 Glacier lifecycle after 90 days |
| Task data | Lifetime of tenant | Soft delete with configurable retention before hard delete |
| AI action logs | 2 years | Archived to S3 after 6 months |
| AI cost logs | 2 years | Aggregated monthly summaries retained; raw logs archived |
| Comments | Lifetime of tenant | Soft delete |
| Documents | Lifetime of tenant | Soft delete with status (draft/published/archived) |
| Embeddings | Refreshed on source change | Old embeddings overwritten on re-embedding |
| Database backups | 30 days (daily automated) | Cross-region replication on backup bucket |
| Export files | 24 hours (temporary) | Auto-deleted from S3 after expiry |

### 25.3 Embedding Requirements

| Attribute | Specification |
|-----------|--------------|
| **Model** | text-embedding-3-small (OpenAI) or equivalent |
| **Dimensions** | 1536 |
| **Storage** | pgvector extension co-located in PostgreSQL RDS |
| **Index** | IVFFlat (R0-R2); evaluate HNSW at R3 |
| **Scope** | All embeddings are tenant-scoped; retrieval always filtered by `tenant_id` |
| **Sources** | Task titles/descriptions, comments, project descriptions, audit summaries, documents |
| **Refresh** | Re-embedded on source entity update; batch re-embedding on model change |
| **Performance** | p95 similarity search < 100ms; evaluate dedicated vector store if exceeded at 1M+ embeddings |

---

## 26. Integration Requirements

### 26.1 Claude AI API

| Attribute | Specification |
|-----------|--------------|
| **Provider** | Anthropic (hosted API) |
| **Models** | Claude Opus 4 (generation, risk analysis, SOW); Claude Sonnet 4.5 (queries, summaries, agent actions, writing assistant) |
| **Integration** | Anthropic SDK (TypeScript) wrapped in LLM Gateway module |
| **Retry** | Exponential backoff with fallback (Opus unavailable falls back to Sonnet) |
| **Circuit Breaker** | 5 consecutive failures triggers 60-second open state with cached/fallback responses |
| **Rate Limiting** | Per-tenant rate limits enforced at the LLM Gateway |
| **Cost Control** | Pre-flight budget check; per-operation token tracking; monthly budget caps per tenant |
| **Streaming** | Enabled for interactive NL queries and AI writing assistant |

### 26.2 Git Providers

| Attribute | Specification |
|-----------|--------------|
| **Providers** | GitHub (R1), GitLab (R1), Azure DevOps (R2) |
| **Protocol** | Inbound webhooks (push events, PR merge events) |
| **Task Linking** | Branch naming convention (`feature/TASK-123-desc`) or commit message parsing |
| **Auto-Complete** | PR merge can auto-complete linked task (governed by autonomy policy) |
| **Events** | `pm.integrations.git_commit`, `pm.integrations.git_pr_merged` emitted to NATS |

### 26.3 Slack / Microsoft Teams

| Attribute | Specification |
|-----------|--------------|
| **Slack** | Bolt SDK; OAuth 2.0; Events API; slash commands; App Home tab |
| **Teams** | Bot Framework; equivalent functionality |
| **Direction** | Bidirectional: inbound commands/messages; outbound nudges/summaries/escalations |
| **Commands** | `/aipm status`, `/aipm next`, `/aipm query [question]` |
| **AI PM Agent** | Nudges delivered as DMs; summaries posted to configured channels |

### 26.4 Calendar

| Attribute | Specification |
|-----------|--------------|
| **Providers** | Google Calendar, Microsoft Outlook |
| **Protocol** | CalDAV / OAuth 2.0 |
| **Data** | Team member availability for resource optimization |
| **Actions** | Create/update meetings for sprint planning and standups |

### 26.5 Jira (Migration)

| Attribute | Specification |
|-----------|--------------|
| **Type** | One-time inbound migration |
| **Protocol** | Jira REST API (batch) |
| **Scope** | Projects, tasks (issues), dependencies (links), comments |
| **Release** | R2 |

### 26.6 AWS Services

| Service | Purpose |
|---------|---------|
| **RDS (PostgreSQL 16)** | Primary relational + vector database (pgvector) |
| **ElastiCache (Redis 7)** | Session storage, rate limiting, caching, AI operation queues (BullMQ) |
| **S3** | File uploads, exports, reports, backups (4 buckets) |
| **ECS Fargate** | Container compute for API, AI workers, web app, NATS cluster |
| **ALB + WAF** | Load balancing, TLS termination, OWASP protection |
| **CloudWatch** | Metrics, logging, dashboards, alarms |
| **X-Ray** | Distributed tracing |
| **Secrets Manager** | Database credentials, API keys, JWT signing keys (auto-rotated) |
| **KMS** | Encryption key management for AES-256 at-rest encryption |
| **Route 53 + CloudFront** | DNS management and CDN for static assets |
| **ECR** | Private container registry |

---

## 27. Constraints and Assumptions

### 27.1 Technical Constraints

| Constraint | Detail |
|-----------|--------|
| **Cloud** | AWS single-cloud; all managed services are AWS-native |
| **Runtime** | Node.js 22 LTS + TypeScript strict mode; shared language with Next.js frontend |
| **Database** | PostgreSQL 16 with pgvector; shared schema with RLS (not schema-per-tenant in R0-R2) |
| **Framework** | Fastify 5 (API); Next.js 15 (web app) |
| **Event Bus** | NATS JetStream (not Kafka); sufficient through R3 at current scale projections |
| **AI Provider** | Anthropic Claude API (hosted); no self-hosted or fine-tuned models in year 1 |
| **IaC** | AWS CDK (TypeScript); single `cdk deploy` for full environment |
| **No GraphQL** | REST with composite endpoints; GraphQL deferred unless query patterns demand it |
| **No Mobile App** | Slack bot is the mobile interface in year 1; evaluate React Native at R3 |
| **No Kubernetes** | ECS Fargate; evaluate EKS only if service count exceeds 15 or dedicated platform engineer joins |

### 27.2 Business Constraints

| Constraint | Detail |
|-----------|--------|
| **Team Size** | 5-7 engineers (2 backend, 1-2 AI/ML, 1-2 fullstack, 1 DevOps/infra) |
| **Timeline** | 12-month roadmap across 4 releases (3 months each) |
| **Internal First** | R0-R1 are internal-only; external clients starting R2 |
| **Vertical** | Consultancy firms first; horizontal expansion deferred |
| **Pricing** | Hybrid model: base subscription + AI operations metering; decided by end of R1 |

### 27.3 Assumptions

| Assumption | Impact if Invalid |
|-----------|------------------|
| Claude API remains available and cost-stable | Re-evaluate LLM provider; adjust cost model |
| 5-7 engineer team is sustained through R3 | Extend timelines proportionally |
| Internal team generates sufficient data in R0-R1 for AI learning | AI features degrade to rules-based; extend shadow mode periods |
| Consultancy vertical validates product-market fit | Pivot to broader horizontal market |
| SOC 2 audit can be initiated by R2 | Delay enterprise client onboarding |
| PostgreSQL pgvector performs adequately through R2 | Evaluate dedicated vector store (Pinecone, Weaviate) |

---

## 28. Enhanced Traceability Matrix

### 28.1 Functional Requirements to Roadmap, Architecture, and UI/UX

| FR | F-xxx | Title | Release | Priority | Architecture Tier | UI Wireframe | Design Doc Section | NFR Cross-Refs |
|----|-------|-------|---------|----------|------------------|-------------|-------------------|----------------|
| FR-100 | F-001 | Event-driven architecture spine | R0 | Cannot Cut | Tier 5 — Event Bus | N/A | design.md S9 | NFR-002, NFR-010 |
| FR-101 | F-002 | Tenant-aware data model | R0 | Cannot Cut | Tier 6 — Database | N/A | design.md S7 | NFR-004, NFR-011 |
| FR-102 | F-003 | Core schema with constraints | R0 | Cannot Cut | Tier 6 — Database | N/A | design.md S7 | NFR-009, NFR-012 |
| FR-103 | F-004 | Authentication | R0 | Cannot Cut | Tier 2 — Gateway & Auth | W-11 | design.md S6 | NFR-004 |
| FR-104 | F-005 | RBAC engine | R0 | Cannot Cut | Tier 2 — Gateway & Auth | N/A | design.md S6.5 | NFR-004, NFR-011 |
| FR-105 | F-006 | Task data model | R0 | Cannot Cut | Tier 3 — App Services | W-06, W-07 | design.md S7.3 | NFR-009 |
| FR-106 | F-007 | Task dependencies | R0 | Cannot Cut | Tier 3 — App Services | W-06, W-18 | design.md S7.4 | NFR-001, NFR-009 |
| FR-107 | F-008 | Sub-tasks | R0 | Cannot Cut | Tier 3 — App Services | W-06 | design.md S7.3 | NFR-009 |
| FR-108 | F-009 | Audit trail infrastructure | R0 | Cannot Cut | Tier 3 — App Services | W-06 | design.md S7.6 | NFR-005, NFR-009 |
| FR-109 | F-010 | Admin-configurable values | R0 | Could Defer | Tier 2 — Config Service | W-10 | design.md S7.9 | NFR-008 |
| FR-200 | F-011 | NL-to-WBS generator | R0 | Cannot Cut | Tier 4 — AI Engine | W-05, W-08 | design.md S8.3 | NFR-001, NFR-006 |
| FR-201 | F-012 | AI-curated "What's Next" | R0 | Cannot Cut | Tier 4 — AI Engine | W-03 | design.md S5.4, S7.7 | NFR-001, NFR-008 |
| FR-202 | F-013 | AI daily/weekly summary | R0 | Could Defer | Tier 4 — AI Engine | W-03 | design.md S8.3 | NFR-001, NFR-006 |
| FR-203 | F-014 | AI-powered NL querying | R0 | Could Defer | Tier 4 — AI Engine | W-09 | design.md S5.5, S8.3 | NFR-001, NFR-006 |
| FR-300 | F-015 | Autonomy policy engine | R0 | Cannot Cut | Tier 4 — AI Engine | W-10 | design.md S8.2 | NFR-004 |
| FR-301 | F-016 | AI review/approve interface | R0 | Cannot Cut | Tier 1 — Client Layer | W-08 | design.md S5.3 | NFR-008 |
| FR-302 | F-017 | AI shadow mode | R0 | Cannot Cut | Tier 4 — AI Engine | W-08 | design.md S8.2 | NFR-006 |
| FR-303 | F-018 | Confidence thresholds | R0 | Cannot Cut | Tier 4 — AI Engine | W-08 | design.md S8.1 | NFR-006 |
| FR-304 | F-019 | Rollback/revert semantics | R0 | Could Defer | Tier 4 — AI Engine | W-08 | design.md S8.4 | NFR-009 |
| FR-305 | F-035 | AI decision log | R1 | Cannot Cut | Tier 4 — AI Engine | W-08 | design.md S8.4 | NFR-005, NFR-010 |
| FR-400 | F-020 | AI traceability pipeline | R0 | Cannot Cut | Tier 4 — AI Engine | W-08 | design.md S8.4 | NFR-010, NFR-005 |
| FR-401 | F-021 | AI evaluation harness | R0 | Could Defer | Tier 4 — AI Engine | N/A | design.md S8.4 | NFR-006, NFR-007 |
| FR-402 | F-022 | Runtime monitoring dashboard | R0 | Could Defer | Tier 10 — Monitoring | W-10 | design.md S10 | NFR-010 |
| FR-500 | F-023 | Task detail view | R0 | Cannot Cut | Tier 1 — Client Layer | W-06 | design.md S5 | NFR-008 |
| FR-501 | F-024 | Project/task list views | R0 | Could Defer | Tier 1 — Client Layer | W-04, W-07 | design.md S5 | NFR-001, NFR-008 |
| FR-502 | F-025 | Role-based sidebar navigation | R0 | Cannot Cut | Tier 1 — Client Layer | W-01 | design.md S5 | NFR-008 |
| FR-503 | F-026 | Comment system | R0 | Could Defer | Tier 3 — App Services | W-06 | design.md S7.5 | NFR-009 |
| FR-600 | F-027 | Adaptive task engine | R1 | Cannot Cut | Tier 4 — AI Engine | W-03 | design.md S8.3 | NFR-001, NFR-006 |
| FR-601 | F-028 | AI PM agent | R1 | Cannot Cut | Tier 4 — AI Engine | N/A | design.md S8.3 | NFR-001, NFR-006 |
| FR-602 | F-029 | Auto-generated status reports | R1 | Cannot Cut | Tier 4 — AI Engine | W-05 | design.md S8.3 | NFR-006 |
| FR-603 | F-030 | Risk prediction | R1 | Cannot Cut | Tier 4 — AI Engine | W-15, W-16 | design.md S8.3 | NFR-006 |
| FR-604 | F-031 | Cross-project dependency mapping | R1 | Cannot Cut | Tier 4 — AI Engine | W-16 | design.md S8 | NFR-001 |
| FR-605 | F-032 | Resource optimization engine | R1 | Cannot Cut | Tier 4 — AI Engine | W-16 | design.md S8 | NFR-006 |
| FR-606 | F-033 | Auto-escalation workflows | R1 | Cannot Cut | Tier 4 — AI Engine | W-17 | design.md S8 | NFR-001 |
| FR-607 | F-034 | Scope creep detector | R1 | Cannot Cut | Tier 4 — AI Engine | W-05 | design.md S8.3 | NFR-006 |
| FR-700 | F-036 | Slack/Teams integration | R1 | Cannot Cut | Tier 7 — Integration Gateway | N/A | design.md S7 | NFR-002 |
| FR-701 | F-037 | Git integration | R1 | Cannot Cut | Tier 7 — Integration Gateway | W-06 | design.md S7 | NFR-006 |
| FR-702 | F-038 | Calendar integration | R1 | Could Defer | Tier 7 — Integration Gateway | W-13 | design.md S7 | NFR-002 |
| FR-800 | F-039 | SSO integration | R1 | Cannot Cut | Tier 2 — Gateway & Auth | W-11 | design.md S6 | NFR-004 |
| FR-801 | F-040 | MFA | R1 | Cannot Cut | Tier 2 — Gateway & Auth | W-11 | design.md S6 | NFR-004 |
| FR-802 | F-041 | Session hardening | R1 | Cannot Cut | Tier 2 — Gateway & Auth | N/A | design.md S6 | NFR-004 |
| FR-900 | F-042 | Client projection data model | R1 | Cannot Cut | Tier 3 — App Services | N/A | design.md S7.8 | NFR-011 |
| FR-901 | F-043 | Basic read-only client view | R1 | Cannot Cut | Tier 1 — Client Layer | W-19 | design.md S5 | NFR-008 |
| FR-902 | F-044 | Tenant plan + feature flags | R1 | Cannot Cut | Tier 2 — Config Service | W-10 | design.md S6.6 | NFR-002 |
| FR-903 | F-045 | SOC 2 prep | R1 | Cannot Cut | Tier 8 — Security | N/A | design.md S8 | NFR-005 |
| FR-904 | F-046 | AI cost tracking | R1 | Cannot Cut | Tier 4 — AI Engine | W-10 | design.md S8.4 | NFR-010 |
| FR-1000 | F-047 | Default + custom tags | R1 | Could Defer | Tier 3 — App Services | W-06, W-07 | design.md S7.3 | NFR-009 |
| FR-1001 | F-048 | Bulk task import | R2 | Could Defer | Tier 3 — App Services | N/A | design.md S7.3 | NFR-008 |
| FR-1002 | F-049 | Full-text search | R1 | Could Defer | Tier 6 — Database | W-01 | design.md S6 | NFR-001 |
| FR-1003 | F-050 | Advanced filtering + sorting | R1 | Could Defer | Tier 1 — Client Layer | W-07 | design.md S5 | NFR-008 |
| FR-1100 | F-051 | Dependency chain visualization | R1 | Could Defer | Tier 1 — Client Layer | W-18 | design.md S5 | NFR-008 |
| FR-1101 | F-052 | AI-annotated timeline view | R1 | Could Defer | Tier 1 — Client Layer | W-15 | design.md S5 | NFR-008 |
| FR-1102 | F-053 | Portfolio dashboard | R1 | Could Defer | Tier 1 — Client Layer | W-16 | design.md S5 | NFR-008 |
| FR-1200 | F-054 | Multi-tenancy live | R2 | Cannot Cut | Tier 6 — Database | N/A | design.md S6 | NFR-004, NFR-011 |
| FR-1201 | F-055 | Client portal (full) | R2 | Cannot Cut | Tier 1 — Client Layer | W-19 | design.md S5 | NFR-001, NFR-008 |
| FR-1202 | F-056 | Client role + permissions | R2 | Cannot Cut | Tier 2 — Gateway & Auth | N/A | design.md S6.5 | NFR-004 |
| FR-1203 | F-057 | Automated client reporting | R2 | Cannot Cut | Tier 4 — AI Engine | W-19 | design.md S8.3 | NFR-006 |
| FR-1204 | F-058 | Self-service client onboarding | R2 | Cannot Cut | Tier 1 — Client Layer | W-19 | design.md S5 | NFR-008 |
| FR-1205 | F-059 | Client-facing AI assistant | R2 | Cannot Cut | Tier 4 — AI Engine | W-19 | design.md S8.3 | NFR-006, NFR-011 |
| FR-1300 | F-060 | Tiered pricing | R2 | Cannot Cut | Tier 2 — Config Service | W-10 | design.md S6.6 | NFR-002 |
| FR-1301 | F-061 | AI cost management | R2 | Cannot Cut | Tier 4 — AI Engine | W-10 | design.md S8.4 | NFR-010 |
| FR-1302 | F-062 | Data export | R2 | Could Defer | Tier 1 — Client Layer | N/A | design.md S5 | NFR-005 |
| FR-1400 | F-063 | API layer | R2 | Could Defer | Tier 1 — Client Layer | N/A | design.md S5 | NFR-001, NFR-004 |
| FR-1401 | F-064 | Webhook system | R2 | Could Defer | Tier 7 — Integration Gateway | N/A | design.md S7 | NFR-002 |
| FR-1402 | F-065 | SOC 2 Type I audit | R2 | Cannot Cut | Tier 8 — Security | N/A | design.md S8 | NFR-005 |
| FR-1403 | F-066 | AI guardrails multi-tenant | R2 | Cannot Cut | Tier 8 — Security | N/A | design.md S8 | NFR-004, NFR-011 |
| FR-1500 | F-067 | Predictive delivery dating | R2 | Could Defer | Tier 4 — AI Engine | W-15, W-21 | design.md S8 | NFR-006 |
| FR-1501 | F-068 | AI meeting prep + follow-up | R2 | Could Defer | Tier 4 — AI Engine | N/A | design.md S8 | NFR-006 |
| FR-1502 | F-069 | Scenario planning | R2 | Could Defer | Tier 4 — AI Engine | N/A | design.md S8 | NFR-006 |
| FR-1503 | F-070 | AI sprint planning | R2 | Could Defer | Tier 4 — AI Engine | N/A | design.md S8 | NFR-006 |
| FR-1504 | F-071 | Custom AI rules per project | R2 | Could Defer | Tier 4 — AI Engine | W-10 | design.md S8.2 | NFR-008 |
| FR-1505 | F-072 | Smart time tracking | R2 | Optional | Tier 4 — AI Engine | W-06 | design.md S8 | NFR-006 |
| FR-1506 | F-073 | Additional integrations | R2 | Could Defer | Tier 7 — Integration Gateway | N/A | design.md S7 | NFR-002 |
| FR-1600 | F-074 | Per-tenant AI learning | R3 | Cannot Cut | Tier 4 — AI Engine | N/A | design.md S8 | NFR-006, NFR-011 |
| FR-1601 | F-075 | AI estimation engine | R3 | Cannot Cut | Tier 4 — AI Engine | W-06 | design.md S8 | NFR-006 |
| FR-1602 | F-076 | Template intelligence | R3 | Could Defer | Tier 4 — AI Engine | N/A | design.md S8 | NFR-006 |
| FR-1603 | F-077 | AI coaching layer | R3 | Could Defer | Tier 4 — AI Engine | N/A | design.md S8 | NFR-006, NFR-008 |
| FR-1604 | F-078 | AI retrospective facilitator | R3 | Could Defer | Tier 4 — AI Engine | N/A | design.md S8 | NFR-006 |
| FR-1700 | F-079 | Full self-service onboarding | R3 | Cannot Cut | Tier 1 — Client Layer | N/A | design.md S5 | NFR-008 |
| FR-1701 | F-080 | Enterprise tier | R3 | Could Defer | Tier 6 — Database | N/A | design.md S6 | NFR-004, NFR-011 |
| FR-1702 | F-081 | Project Manager role | R3 | Cannot Cut | Tier 2 — Gateway & Auth | N/A | design.md S6.5 | NFR-004 |
| FR-1703 | F-082 | SOC 2 Type II | R3 | Cannot Cut | Tier 8 — Security | N/A | design.md S8 | NFR-005 |
| FR-1800 | F-083 | AI-generated SOWs | R3 | Cannot Cut | Tier 4 — AI Engine | N/A | design.md S8.3 | NFR-006 |
| FR-1801 | F-084 | Knowledge capture | R3 | Could Defer | Tier 4 — AI Engine | N/A | design.md S8 | NFR-006 |
| FR-1802 | F-085 | AI onboarding for new joiners | R3 | Could Defer | Tier 4 — AI Engine | N/A | design.md S8 | NFR-008 |
| FR-1803 | F-086 | Embedded analytics + benchmarking | R3 | Optional | Tier 1 — Client Layer | N/A | design.md S5 | NFR-011 |
| FR-1900 | F-087 | Read-only Kanban board | R1 | Cannot Cut | Tier 1 — Client Layer | W-12 | design.md S5 | NFR-008 |
| FR-1901 | F-088 | Gantt chart view | R2 | Could Defer | Tier 1 — Client Layer | W-21 | design.md S5 | NFR-008 |
| FR-2000 | F-089 | Task checklists | R0 | Cannot Cut | Tier 3 — App Services | W-06 | design.md S7.3 | NFR-009 |
| FR-2001 | F-090 | Recurring tasks | R1 | Could Defer | Tier 3 — App Services | W-06 | design.md S7.3 | NFR-009 |
| FR-2002 | F-091 | Calendar view | R1 | Cannot Cut | Tier 1 — Client Layer | W-13 | design.md S5 | NFR-008 |
| FR-2003 | F-092 | Table view | R1 | Cannot Cut | Tier 1 — Client Layer | W-14 | design.md S5 | NFR-008 |
| FR-2004 | F-093 | @Mentions in comments | R0 | Cannot Cut | Tier 3 — App Services | W-06 | design.md S7.5 | NFR-008, NFR-009 |
| FR-2005 | F-094 | Custom fields | R1 | Cannot Cut | Tier 3 — App Services | W-06, W-14 | arch-v3.1 DDL | NFR-008, NFR-009 |
| FR-2006 | F-095 | Goals & OKRs | R2 | Could Defer | Tier 3 — App Services | W-20 | arch-v3.1 DDL | NFR-008 |
| FR-2007 | F-096 | Smart notification system | R1 | Cannot Cut | Tier 3 — App Services | W-01, W-17 | arch-v3.1 S9.3 | NFR-008, NFR-002 |
| FR-2008 | F-097 | Assigned comments / action items | R1 | Could Defer | Tier 3 — App Services | W-06 | arch-v3.1 DDL | NFR-009 |
| FR-2009 | F-098 | Custom automations | R2 | Could Defer | Tier 3 — App Services | W-10 | arch-v3.1 S9.3 | NFR-002, NFR-004 |
| FR-2010 | F-099 | Form view / task intake forms | R2 | Could Defer | Tier 3 — App Services | N/A | arch-v3.1 DDL | NFR-008 |
| FR-2011 | F-100 | Formula / computed fields | R2 | Could Defer | Tier 3 — App Services | W-14 | arch-v3.1 DDL | NFR-009 |
| FR-2012 | F-101 | Docs & knowledge base | R2 | Could Defer | Tier 3 — App Services | W-05 | arch-v3.1 DDL | NFR-006, NFR-009 |
| FR-2013 | F-102 | AI writing assistant | R2 | Could Defer | Tier 4 — AI Engine | W-06, W-09 | arch-v3.1 S6 | NFR-006 |
| FR-2014 | F-103 | Task reminders | R1 | Could Defer | Tier 3 — App Services | W-06 | arch-v3.1 DDL | NFR-008 |

### 28.2 NFR Applicability by Domain Group

| NFR | Platform | AI Core | AI Safety | Observability | Human Surfaces | Intelligence | Integrations | Security | SaaS | Client Access | Monetization | ClickUp Gap |
|-----|----------|---------|-----------|---------------|----------------|-------------|-------------|----------|------|--------------|-------------|-------------|
| NFR-001 (Performance) | X | X | | | X | X | | | | X | | |
| NFR-002 (Scalability) | X | | | | | | X | | X | | X | X |
| NFR-003 (Availability) | X | | X | | | | | | | | | |
| NFR-004 (Security) | X | | | | | | | X | | X | | X |
| NFR-005 (Compliance) | X | | | X | | | | X | X | | | |
| NFR-006 (AI Quality) | | X | X | | | X | | | | X | | X |
| NFR-007 (Maintainability) | X | X | X | X | X | X | X | X | X | X | X | X |
| NFR-008 (Usability) | | | | | X | | | | | X | | X |
| NFR-009 (Data Integrity) | X | | | | | | | | | | | X |
| NFR-010 (Observability) | | | | X | | | | | X | | X | |
| NFR-011 (Tenant Isolation) | X | | | | | | | | | X | | |
| NFR-012 (Disaster Recovery) | X | | | | | | | | | | | |

### 28.3 Release Summary

| Release | FR Count | Cannot Cut | Could Defer | Optional |
|---------|----------|-----------|-------------|----------|
| **R0** | 28 | 17 | 11 | 0 |
| **R1** | 36 | 23 | 13 | 0 |
| **R2** | 27 | 11 | 15 | 1 |
| **R3** | 13 | 7 | 5 | 1 |
| **Total** | **103** (unique) | **57** | **43** | **3** |

Note: FR-305 (F-035, AI Decision Log) is listed under Section 7 (AI Safety) for structural coherence but ships in R1.

---

## 29. Appendices

### 29.1 Glossary

| Term | Definition |
|------|-----------|
| **AC** | Acceptance Criterion — a measurable condition that must be satisfied for a requirement to be considered met |
| **AI PM Agent** | Autonomous AI system actor that monitors projects, chases updates, and manages escalations on a 15-minute loop |
| **ALB** | Application Load Balancer — AWS service for HTTP/HTTPS traffic distribution |
| **BullMQ** | Redis-based job queue for Node.js |
| **CDK** | Cloud Development Kit — AWS infrastructure-as-code framework |
| **CQRS** | Command Query Responsibility Segregation |
| **DAG** | Directed Acyclic Graph — used for dependency chain validation |
| **DLQ** | Dead Letter Queue — destination for failed event processing |
| **ECS** | Elastic Container Service — AWS managed container orchestration |
| **FR** | Functional Requirement |
| **Fargate** | Serverless compute engine for ECS (no EC2 instance management) |
| **HNSW** | Hierarchical Navigable Small World — vector index algorithm |
| **IVFFlat** | Inverted File Flat — vector index algorithm (simpler, used in R0-R2) |
| **JWT** | JSON Web Token — compact authentication token carrying claims |
| **KMS** | Key Management Service — AWS encryption key management |
| **LLM** | Large Language Model |
| **MFA** | Multi-Factor Authentication |
| **NATS** | Neural Autonomic Transport System — lightweight messaging system used as event bus |
| **NFR** | Non-Functional Requirement |
| **NL** | Natural Language — plain English user input |
| **OIDC** | OpenID Connect — authentication protocol built on OAuth 2.0 |
| **OWASP** | Open Web Application Security Project — security standards |
| **PII** | Personally Identifiable Information |
| **RAG** | Retrieval-Augmented Generation — enriching LLM prompts with retrieved data |
| **RBAC** | Role-Based Access Control |
| **RDS** | Relational Database Service — AWS managed database |
| **RLS** | Row-Level Security — PostgreSQL feature for row-level access control |
| **RPO** | Recovery Point Objective — maximum acceptable data loss in a disaster |
| **RTO** | Recovery Time Objective — maximum acceptable time to restore service |
| **SAML** | Security Assertion Markup Language — SSO protocol |
| **SOC 2** | Service Organization Control 2 — security compliance framework |
| **SOW** | Statement of Work — formal document defining project scope, deliverables, and timeline |
| **SSO** | Single Sign-On |
| **TOTP** | Time-based One-Time Password — MFA method |
| **WAF** | Web Application Firewall |
| **WBS** | Work Breakdown Structure — hierarchical decomposition of project scope |
| **pgvector** | PostgreSQL extension for vector similarity search |

### 29.2 Post-12-Month Backlog

The following features are identified for year 2+ and are not part of the in-year roadmap:

| Feature | Description | Why Deferred |
|---------|-------------|-------------|
| F-104 | White-label option for resellers | Requires different GTM motion and dedicated product team |
| F-105 | Marketplace for AI playbooks | Needs thousands of active users before a marketplace creates value |
| F-106 | Open plugin SDK | Ecosystem play; premature before product-market fit is locked |
| F-107 | Voice interface | Flashy but niche; validate demand before building |
| F-108 | AI-to-AI handoff (CI/CD auto-updates) | Requires deep integration with client infrastructure |
| F-109 | Vertical-specific editions | Requires market validation of target verticals beyond consultancy |
| F-110 | Sentiment analysis on communications | Requires substantial text corpus and privacy guardrails |
| F-111 | Client satisfaction prediction | Requires many tenants and sufficient churn/retention events |
| F-112 | Competitive benchmarking | Needs enough tenants for meaningful anonymized comparisons |

### 29.3 Open Questions

These questions must be resolved before their respective decision points:

| Question | Recommended Direction | Decision Deadline |
|----------|----------------------|-------------------|
| Pricing model specifics | Hybrid: workspace subscription + AI metering + client portal add-on | End of R1 (month 6) |
| Organizational structure | Spin out as dedicated product team | Before R2 launch |
| First target sub-vertical | High-compliance engineering (fintech, medtech) | R2 planning |
| Legal framework | IP, data isolation guarantees, AI liability terms in contracts | Before R2 launch |
| Team scaling | Evaluate 8-10 engineers for R2-R3 based on R1 velocity | R1 retrospective |

---

*AI-Native PM Tool -- Software Requirements Specification v1.1 -- February 10, 2026 -- Aligned to Architecture v3.1, Product Roadmap v2.2 (103 features), UI/UX Design v1.0*
