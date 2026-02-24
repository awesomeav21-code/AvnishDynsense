# Dynsense — System Design Document

**Version:** 4.1 (Updated to reflect current implementation)
**Date:** February 24, 2026
**Status:** In Progress
**Last Updated By:** Engineering Team

---

## 1. Executive Summary

Dynsense is an AI-native project management platform targeting consultancy firms. The core thesis: **"The AI runs the project. The human supervises."** The system combines a full-featured PM tool (tasks, dependencies, checklists, comments, audit trails) with an AI orchestration engine that generates work breakdown structures, prioritizes tasks, predicts risks, nudges team members, and generates reports — all under configurable human oversight.

**Current State:** R0 and R1 are built and functional. The monorepo, database schema (32 tables), authentication with multi-workspace support, 28 API route modules, and 26 frontend pages are implemented and working. R1 additions include notifications with send-to-team functionality, four view modes (kanban, calendar, table, timeline), saved views, recurring tasks, and reminders. AI capabilities (orchestrator, sessions, hooks) are scaffolded with backend routes and schema in place. Integration routes (GitHub, Slack, SSO) are scaffolded but not yet connected.

---

## 2. Build Status

### 2.1 Sprint Status

| Sprint | Scope | Status |
|--------|-------|--------|
| **R0-1** | Infrastructure + Schema | COMPLETE |
| **R0-2** | Auth + RBAC + Core API | COMPLETE |
| **R0-3** | Agent SDK Foundation | SCAFFOLDED (routes + schema exist, orchestrator wired) |
| **R0-4** | AI Core Capabilities | SCAFFOLDED (review UI exists, sessions table live) |
| **R0-5** | Frontend Core (all pages) | COMPLETE |
| **R0-6** | Polish, notifications, audit | COMPLETE |
| **R1-1** | Notifications + Send Notification | COMPLETE |
| **R1-2** | Views (Kanban, Calendar, Table, Timeline) | COMPLETE |
| **R1-3** | Saved Views + Recurring Tasks + Reminders | COMPLETE |
| **R1-4** | Integration routes (GitHub, Slack, SSO) | SCAFFOLDED |

### 2.2 What Is Built (Current State)

**Infrastructure (COMPLETE):**
- Turborepo monorepo with pnpm workspaces
- 4 packages: `apps/api`, `apps/web`, `packages/db`, `packages/shared`
- Plus `packages/agents` for AI orchestration
- PostgreSQL 16 via Drizzle ORM (32 tables, 4 migrations applied)
- Node >=20.0.0, pnpm@9.15.4

**Auth & Core API (COMPLETE):**
- Fastify 5 REST API on port 3001 with JWT auth (@fastify/jwt)
- Multi-workspace login: global accounts table + per-tenant user memberships
- Login flow: email/password + workspace name -> JWT (access + refresh tokens)
- RBAC: site_admin, pm, developer, client
- 28 API route modules fully implemented
- Field-level audit trail with actor tracking (human vs AI)
- DAG dependency detection with BFS circular check

**Frontend (COMPLETE):**
- Next.js 15 App Router on port 3000
- 26 pages across auth, main nav, views, settings, and AI
- Tailwind CSS styling, Inter font, text-xs baseline
- API client class with token management and auto-refresh

**AI (SCAFFOLDED):**
- Database tables: ai_actions, ai_sessions, ai_agent_configs, ai_cost_log, ai_hook_log, ai_mcp_servers
- API routes: POST /ai/execute, POST /ai/:id/review, GET /ai/sessions/:id
- AI review UI page with approval/rejection flow
- NL query panel component (Cmd+K)
- Notifications for AI action proposals

---

## 3. System Architecture

### 3.1 High-Level Architecture (As Built)

```
                        CLIENT LAYER
     Next.js 15 (App Router) + Tailwind CSS
     26 pages: Dashboard, Projects, Tasks, Audit, Settings, etc.
     Port 3000
                            |
                       HTTPS (fetch)
                            |
                      REST API LAYER
     Fastify 5 + TypeScript + @fastify/jwt + Zod validation
     28 route modules under /api/v1/*
     Port 3001
                            |
              ┌─────────────┼─────────────┐
         MIDDLEWARE      DATABASE      AI ENGINE
         - auth.ts       PostgreSQL    - ai.ts routes
         - rbac.ts       16 via        - orchestrator
         - feature-      Drizzle ORM   - sessions
           flags.ts      32 tables     - hooks (scaffolded)
         - error-
           handler.ts
```

### 3.2 Monorepo Structure

```
implementation_version4/
├── apps/
│   ├── api/                    # Fastify REST API (port 3001)
│   │   ├── src/
│   │   │   ├── routes/         # 28 route files
│   │   │   ├── middleware/     # auth, rbac, feature-flags, error-handler
│   │   │   ├── config/         # env.ts
│   │   │   ├── utils/          # errors.ts
│   │   │   ├── db.ts           # Drizzle DB connection
│   │   │   └── app.ts          # Fastify app factory
│   │   └── package.json
│   └── web/                    # Next.js frontend (port 3000)
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/     # Login, Register
│       │   │   └── (internal)/ # All authenticated pages
│       │   ├── components/     # NL query panel, workspace switcher
│       │   └── lib/
│       │       └── api.ts      # API client class
│       └── package.json
├── packages/
│   ├── db/                     # Drizzle schema + migrations
│   │   ├── src/schema/         # 32 table definitions
│   │   ├── migrations/         # 4 SQL migrations
│   │   └── src/seed.ts         # Demo data seeder
│   ├── shared/                 # Types, schemas, constants
│   │   └── src/
│   │       ├── types/          # auth, task, project, ai, events
│   │       ├── schemas/        # Zod validation schemas
│   │       └── constants/      # roles, permissions, ai-capabilities
│   └── agents/                 # AI orchestration package
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### 3.3 Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| fastify | 5.2.0 | REST API framework |
| @fastify/jwt | latest | JWT authentication |
| @fastify/cors | latest | CORS handling |
| next | 15.1.0 | Frontend framework |
| react | 19.0.0 | UI library |
| drizzle-orm | 0.36.0 | Database ORM |
| postgres | 3.4.8 | PostgreSQL driver |
| bcrypt | 5.1.0 | Password hashing |
| zod | latest | Schema validation |
| nats | 2.28.0 | Event streaming (scaffolded) |
| ioredis | 5.4.0 | Caching (scaffolded) |
| recharts | 3.7.0 | Dashboard charts |

---

## 4. Frontend Pages (26 Total)

### 4.1 Authentication Pages

| Route | Page | Description |
|-------|------|-------------|
| `/login` | Login | Email + password + workspace name field (workspace on top) |
| `/register` | Register | Create new workspace or join existing |

### 4.2 Main Navigation (Active in Sidebar)

| Route | Page | Description |
|-------|------|-------------|
| `/dashboard` | Dashboard | Project overview, key metrics, charts |
| `/projects` | Projects | Project list with status indicators |
| `/projects/[id]` | Project Detail | Individual project with tasks, phases |
| `/my-tasks` | My Tasks | Personal task list with filters, task creation form |
| `/dependencies` | Dependencies | Task dependency visualization and management |
| `/portfolio` | Portfolio | Cross-project portfolio overview |
| `/notifications` | Notifications | Notification inbox with send notification form |
| `/team` | Team | Team member list, roles, invite |
| `/audit` | Audit Log | Activity trail with entity filters (task, project, user, phase) |

### 4.3 View Pages

| Route | Page | Description |
|-------|------|-------------|
| `/kanban` | Kanban Board | Drag-drop board view |
| `/calendar` | Calendar | Calendar/timeline view |
| `/table-view` | Table View | Spreadsheet-style task table |
| `/timeline` | Timeline | Gantt-style timeline |

### 4.4 Settings Pages

| Route | Page | Description |
|-------|------|-------------|
| `/settings` | General | Workspace settings |
| `/settings/priorities` | Priorities | Priority level configuration |
| `/settings/tags` | Tags | Tag and label management with colors |
| `/settings/custom-fields` | Custom Fields | Custom field definitions |
| `/settings/recurring-tasks` | Recurring Tasks | Recurring task schedules |

### 4.5 AI Pages (Hidden from Nav — Kept as Backup)

| Route | Page | Status |
|-------|------|--------|
| `/ai-review` | AI Review | Built, hidden from sidebar |
| `/ai-review/[id]` | AI Action Detail | Built, hidden from sidebar |
| `/ai-sessions` | AI Sessions | Built, hidden from sidebar |
| `/integrations` | Integrations | Built, hidden from sidebar |

### 4.6 Sidebar Navigation Order

Active items in the sidebar (top to bottom):
1. Dashboard
2. Projects
3. My Tasks
4. Dependencies
5. Portfolio
6. Notifications
7. Team
8. Audit Log
9. **Settings section:** General, Priorities, Tags, Custom Fields, Recurring Tasks

---

## 5. API Routes (28 Modules)

All routes are under the `/api/v1/` prefix on port 3001.

### 5.1 Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create new workspace + account |
| POST | `/auth/login/identify` | Verify credentials, return workspace list |
| POST | `/auth/login/select` | Select workspace, get JWT tokens |
| POST | `/auth/login` | Direct login with workspace name/slug |
| POST | `/auth/switch-workspace` | Switch workspace, get new tokens |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/auth/me` | Current user profile + workspace list |
| POST | `/auth/logout` | Clear refresh token |

### 5.2 Core Resources

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | List tenant users |
| GET | `/users/:id` | Get user by ID |
| PATCH | `/users/:id/role` | Update role (admin/pm only) |
| POST | `/users/invite` | Invite user to tenant |
| DELETE | `/users/:id` | Deactivate user |
| GET | `/projects` | List projects |
| POST | `/projects` | Create project |
| GET | `/projects/:id` | Get project detail |
| PATCH | `/projects/:id` | Update project |
| GET | `/tasks` | List tasks (filterable) |
| GET | `/tasks/whats-next` | Prioritized task list |
| POST | `/tasks` | Create task |
| GET | `/tasks/:id` | Get task detail |
| PATCH | `/tasks/:id` | Update task |
| DELETE | `/tasks/:id` | Soft delete task |
| PATCH | `/tasks/:id/status` | Change status with validation |
| GET | `/tasks/:id/timeline` | Task timeline events |
| POST | `/tasks/:id/complete` | Mark complete |
| GET | `/phases` | List phases (by projectId) |
| POST | `/phases` | Create phase |
| PATCH | `/phases/:id` | Update phase |
| DELETE | `/phases/:id` | Delete phase |

### 5.3 Related Resources

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dependencies/task/:taskId` | List task dependencies |
| POST | `/dependencies` | Add dependency (with cycle detection) |
| DELETE | `/dependencies` | Remove dependency |
| GET | `/comments/task/:taskId` | List task comments |
| POST | `/comments` | Create comment (@mention extraction) |
| PATCH | `/comments/:id` | Update comment |
| DELETE | `/comments/:id` | Delete comment |
| GET | `/checklists/task/:taskId` | Get task checklists |
| POST | `/checklists` | Create checklist |
| POST | `/checklists/:id/items` | Add checklist item |
| PATCH | `/checklists/:id/items/:itemId` | Toggle item |
| GET | `/assignments/task/:taskId` | List assignments |
| POST | `/assignments/task/:taskId` | Assign user |
| DELETE | `/assignments/task/:taskId/:userId` | Remove assignment |
| GET | `/tags` | List tags |
| POST | `/tags` | Create tag |
| PATCH | `/tags/:id` | Update tag |
| DELETE | `/tags/:id` | Archive tag |
| POST | `/tags/:id/tasks/:taskId` | Tag a task |
| DELETE | `/tags/:id/tasks/:taskId` | Untag a task |

### 5.4 Configuration & Settings

| Method | Path | Description |
|--------|------|-------------|
| GET | `/config` | Get tenant config |
| PUT | `/config` | Upsert config key |
| GET | `/custom-fields` | List custom field definitions |
| POST | `/custom-fields` | Create custom field |
| PATCH | `/custom-fields/:id` | Update field definition |
| GET | `/feature-flags` | List feature flags |
| PATCH | `/feature-flags/:name` | Toggle flag |
| GET | `/views` | List saved views |
| POST | `/views` | Create saved view |
| DELETE | `/views/:id` | Delete saved view |
| GET | `/recurring-tasks` | List recurring task configs |
| POST | `/recurring-tasks` | Create recurring config |
| PATCH | `/recurring-tasks/:id` | Update config |
| DELETE | `/recurring-tasks/:id` | Delete config |

### 5.5 Notifications & Audit

| Method | Path | Description |
|--------|------|-------------|
| GET | `/notifications` | List user notifications (filterable, paginated) |
| POST | `/notifications` | Send in-app notification to team member |
| POST | `/notifications/:id/read` | Mark notification as read |
| POST | `/notifications/read-all` | Mark all as read |
| GET | `/audit` | Audit log entries (admin/pm, with entity name resolution) |

### 5.6 AI Routes (Scaffolded)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ai/execute` | Trigger AI capability |
| POST | `/ai/:id/review` | Approve/reject AI action |
| GET | `/ai/sessions/:sessionId` | Get AI session state |
| POST | `/ai-eval/evaluate` | AI confidence evaluation |

### 5.7 Integration Routes (Scaffolded)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/integrations` | List integrations |
| PATCH | `/integrations/:provider/config` | Update config |
| POST | `/integrations/:provider/connect` | OAuth flow |
| POST | `/github/webhook` | GitHub webhook receiver |
| POST | `/slack/webhook` | Slack event receiver |
| POST | `/sso/saml/init` | SAML login init |
| GET | `/search` | Full-text search |
| GET | `/sse/subscribe` | Server-sent events stream |

---

## 6. Database Schema (32 Tables)

### 6.1 Identity & Multi-Tenancy

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `tenants` | id, name, slug, settings, planTier | Workspace definition |
| `accounts` | id, email, passwordHash, name | Global identity (multi-workspace) |
| `users` | id, tenantId, accountId, email, passwordHash, name, role, status, refreshToken | Per-workspace membership |

### 6.2 Core Project Management

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `projects` | id, tenantId, name, description, status, startDate, endDate, wbsBaseline, deletedAt | Projects with soft delete |
| `phases` | id, tenantId, projectId, name, position | Project phases |
| `tasks` | id, tenantId, projectId, phaseId, parentTaskId, title, description, status, priority, assigneeId, reportedBy, startDate, dueDate, completedAt, position, deletedAt | Core tasks with sub-task support |
| `task_assignments` | taskId, userId | Multi-assignee support |
| `task_dependencies` | id, tenantId, blockerTaskId, blockedTaskId, type | DAG with cycle detection |

### 6.3 Collaboration

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `comments` | id, tenantId, taskId, authorId, body, clientVisible | Task comments |
| `mentions` | commentId, userId | @mentions |
| `task_checklists` | id, tenantId, taskId, title, position | Checklist groups |
| `checklist_items` | id, checklistId, label, completed, position | Checklist items |

### 6.4 Tagging & Metadata

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `tags` | id, tenantId, name, color, archived, isDefault | Tags with colors |
| `task_tags` | taskId, tagId | Task-tag mapping |
| `custom_field_definitions` | id, tenantId, projectId, name, fieldType, config | Custom field schemas |
| `custom_field_values` | id, taskId, fieldId, value | Custom field data |

### 6.5 Workflow & Scheduling

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `recurring_task_configs` | id, tenantId, projectId, title, schedule, cronExpression, enabled, nextRunAt | Recurring tasks |
| `task_reminders` | id, tenantId, taskId, userId, remindAt, channel, sentAt | Reminders |
| `notifications` | id, tenantId, userId, type, title, body, data, readAt | In-app notifications |
| `saved_views` | id, tenantId, name, filters | Saved filters |

### 6.6 Audit & Config

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `audit_log` | id, tenantId, entityType, entityId, action, actorId, actorType, diff, aiActionId | Immutable audit trail |
| `tenant_configs` | id, tenantId, key, value | Tenant settings |

### 6.7 AI Tables

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `ai_actions` | id, tenantId, capability, status, disposition, input, output, confidence, sessionId | AI execution log |
| `ai_sessions` | id, tenantId, userId, capability, parentSessionId, turnCount, state, status | Resumable AI sessions |
| `ai_agent_configs` | id, tenantId, capability, modelOverride, maxTurns, permissionMode, enabled | Per-capability config |
| `ai_cost_log` | id, tenantId, aiActionId, model, inputTokens, outputTokens, costUsd | Token cost tracking |
| `ai_hook_log` | id, tenantId, hookName, phase, decision, reason, aiActionId | Hook audit |
| `ai_mcp_servers` | id, name, status, transport, tools, config | MCP server registry |
| `embeddings` | id, tenantId, sourceId, sourceType, embedding, createdAt | Vector embeddings |

### 6.8 Integrations

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `integrations` | id, tenantId, provider, enabled, config, credentials | External services |
| `integration_events` | id, tenantId, integrationId, eventType, payload | Integration event log |

### 6.9 Applied Migrations

1. `0000_giant_supernaut.sql` — Initial schema (all tables + indexes)
2. `0001_add_tags_archived_default.sql` — Tags: archived, isDefault columns
3. `0002_add_tasks_startdate_reportedby.sql` — Tasks: startDate, reportedBy columns
4. `0003_add_accounts_multi_workspace.sql` — Accounts table for multi-workspace

---

## 7. Authentication Flow

### 7.1 Multi-Workspace Model

```
accounts (global identity)
    |
    ├── users (tenant: Acme Consulting) → role: site_admin
    ├── users (tenant: Other Workspace) → role: developer
    └── ...
```

### 7.2 Login Flow

1. User enters: workspace name, email, password
2. `POST /auth/login` — validates credentials, matches workspace by slug or name (case-insensitive)
3. Returns: accessToken (JWT with sub, accountId, tenantId, role) + refreshToken
4. Frontend stores tokens, attaches Authorization header on all requests
5. Workspace switch: `POST /auth/switch-workspace` re-issues tokens for different tenant

### 7.3 JWT Claims

```json
{
  "sub": "user-uuid",
  "accountId": "account-uuid",
  "tenantId": "tenant-uuid",
  "role": "site_admin | pm | developer | client"
}
```

---

## 8. Key Features (Working)

### 8.1 Task Management
- Create, update, delete tasks with project/phase assignment
- Status workflow: created → ready → in_progress → review → completed (+ blocked)
- Priority levels: critical, high, medium, low
- Sub-tasks (single-level via parentTaskId)
- Multi-assignee support
- Tags with colors
- Custom fields (text, number, date, select)
- Checklists with items
- Comments with @mentions
- Reported-by tracking

### 8.2 Project Management
- Project CRUD with status tracking
- Phases per project (ordered by position)
- WBS baseline storage
- Task counts and progress metrics

### 8.3 Dependencies
- Blocker/blocked relationships between tasks
- BFS-based circular dependency detection
- Visual dependency management page

### 8.4 Notifications
- In-app notification inbox with unread count
- Filter by all/unread
- Mark individual or all as read
- Send notifications to team members regarding tasks
- Notification types: ai_nudge, ai_action_proposed, ai_action_executed, mention

### 8.5 Audit Log
- Immutable activity trail for all mutations
- Human-readable format: `Task "Name" created by Person`
- Filter by entity type: task, project, user, phase
- Search and date range filtering
- CSV export
- Pagination with load more

### 8.6 Team Management
- User list with roles
- Invite new users
- Role management (admin/pm only)
- User deactivation

### 8.7 Settings
- Priority level configuration
- Tag management (create, edit, archive, colors)
- Custom field definitions
- Recurring task schedules (cron-based)
- Saved views (filter presets)

---

## 9. Seed Data (Demo)

### 9.1 Users

| Email | Name | Role |
|-------|------|------|
| admin@acme.com | Acme Consulting Admin | site_admin |
| pm@acme.com | Acme Consulting PM | pm |
| dev1@acme.com | Dev One | developer |
| dev2@acme.com | Dev Two | developer |
| client@acme.com | Acme Consulting Client | client |

Password for all: `password123`
Workspace: `Acme Consulting` (slug: `acme`)

### 9.2 Projects

| Project | Tasks | Description |
|---------|-------|-------------|
| Platform Rebuild | 25 | Next.js + Fastify rewrite |
| Mobile App MVP | 15 | React Native companion app |
| Client Portal | 10 | Client-facing dashboard |

Each project has 4 phases, varied task statuses, dependencies, comments, checklists, and assignments.

### 9.3 Additional Seed Data
- 6 tags (frontend, backend, urgent, bug, feature, devops)
- 3 recurring task configs
- 6 reminders
- 40 notifications across all users
- 130+ audit log entries (backfilled for all existing entities)

---

## 10. API Middleware

| File | Purpose |
|------|---------|
| `auth.ts` | JWT verification, extracts { sub, accountId, tenantId, role } |
| `rbac.ts` | Role-based access control checks |
| `feature-flags.ts` | Per-tenant feature flag checking |
| `error-handler.ts` | Global error handling with AppError utility |

---

## 11. What's Not Yet Active (Scaffolded / Hidden)

These features have backend routes and/or frontend pages but are not wired into the active navigation or fully operational:

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| AI Review | Routes exist | Page exists | Hidden from nav |
| AI Sessions | Routes exist | Page exists | Hidden from nav |
| Integrations (GitHub, Slack) | Routes exist | Page exists | Hidden from nav |
| SSO/SAML | Routes exist | — | Scaffolded |
| Server-Sent Events | Route exists | — | Scaffolded |
| Full-text Search | Route exists | — | Scaffolded |
| NATS Event Streaming | Package imported | — | Not connected |
| Redis Caching | Package imported | — | Not connected |
| Pinecone Vectors | Schema exists | — | Not connected |

---

## 12. Architecture Decision Records

| ADR | Decision | Over | Rationale |
|-----|----------|------|-----------|
| 001 | Hosted Claude API | Self-hosted LLM | No GPU ops for small team |
| 002 | PostgreSQL 16 + Drizzle ORM | Prisma / raw SQL | Type-safe queries, migration tooling |
| 003 | Fastify 5 (separate API) | Next.js API routes | Better performance, cleaner separation |
| 004 | Shared schema + tenant_id filtering | Schema-per-tenant | Simpler ops, app-layer isolation |
| 005 | pnpm + Turborepo monorepo | Separate repos | Shared types/schemas, atomic deploys |
| 006 | JWT (access + refresh) | Session cookies | Stateless API, multi-client support |
| 007 | Multi-workspace via accounts table | Single-tenant users | Users can belong to multiple workspaces |
| 008 | Tailwind CSS (no Shadcn) | Shadcn UI | Lighter weight, custom styling |
| 009 | Zod for all validation | io-ts / Yup | Shared between frontend and backend |
| 010 | Modular monolith | Microservices | Ship fast, extract later |
