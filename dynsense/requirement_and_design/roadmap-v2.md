# AI-Native PM Tool — Product Roadmap v2

> **Philosophy:** The AI runs the project. The human supervises. Every feature answers: "Can the AI do this without being asked?"
>
> **First 6 months:** Internal use. **Month 6+:** SaaS product.
>
> **Team assumption:** 5–7 engineers (2 backend, 1–2 AI/ML, 1–2 fullstack, 1 DevOps/infra). Adjust timelines proportionally if smaller.
>
> **Last Updated:** February 10, 2026

---

## Pre-R0: Architecture Decisions (Week 0 — Decide Before Building)

These are not R0 features. These are decisions that shape every feature from F-001 onward. Resolve before writing code.

| Decision | Options | Recommendation | Why Now |
|----------|---------|----------------|---------|
| **AI model strategy** | Hosted API (Claude/GPT) vs self-hosted/fine-tuned | Start with hosted API (Claude). Lower ops burden, faster iteration. Evaluate fine-tuning in R2 when you have tenant-specific data. | Cost structure, latency, data privacy story, and feasibility of F-009 through F-013 all depend on this. Can't defer. |
| **AI data access pattern** | RAG over tenant data vs prompt engineering with context injection vs fine-tuning | RAG with vector storage. Prompt engineering alone won't scale past a single project. | If RAG-based, you need vector storage infrastructure in R0. This is a day-1 architectural dependency. |
| **Event-driven architecture** | Event bus (Kafka/NATS/Redis Streams) vs polling vs webhooks | Event bus from day 1. Every AI capability (adaptive engine, auto-escalation, scope creep detection, risk prediction) depends on reacting to events in real-time. | This is foundational infrastructure, not a "nice to have." The AI is only as smart as the signals it receives in real-time. |
| **LLM cost model** | Model per AI feature. Estimated cost per user/month for AI operations. Token budget per operation type. | Model it now. NL→WBS generation, status reports, NL queries, activity summarization — each has a different token profile. Estimate at internal scale AND at 50-tenant scale. | Early-stage AI SaaS founders burn 40–60% of revenue on compute. If unit economics don't work, you find out now, not in R2 when you have paying clients. |
| **Tenant isolation model** | Shared schema with tenant_id vs schema-per-tenant vs DB-per-tenant | Shared schema with tenant_id. Fast to ship, manageable at low tenant counts. Evaluate schema isolation for enterprise tier in R3. | Correct starting point. Design tenant_id into every table from day 1. |
| **Pricing model direction** | Per seat vs per project vs usage-based vs hybrid | Hybrid: base subscription (per workspace) + AI operations metering (generous included tier, overage billing) + client portal seats as add-on. | AI-heavy tools with pure per-seat pricing erode margins on heavy users. Usage component aligns cost with value. Model this before building so F-059 isn't a surprise. |

---

## R0 — Foundation + Core AI Loop (Months 1–3, Internal MVP)

**Goal:** One workflow loop works end-to-end and creates daily habit. The AI sets up projects and tells developers what to work on. Everything else is secondary until that loop is sticky.

**R0 success gate:** Is the internal team using NL project setup daily? Does the AI-generated WBS save measurable time vs manual creation? Are developers checking "what's next" from the AI instead of a spreadsheet?

### The Daily Use Loop (Thin Slice)

```
Describe project in NL → AI generates WBS → Human reviews/approves
→ AI tells each developer "here's what to work on next and why"
→ AI generates daily summary → Repeat
```

Everything in R0 exists to make this loop work. Nothing else ships until this loop is sticky.

### Platform Foundation

| # | Feature | Why Now | Cut line |
|---|---------|---------|----------|
| F-001 | **Event-driven architecture spine** — event bus infrastructure for all state changes (task created, status changed, assignment changed, comment added, dependency resolved). Every downstream AI feature consumes from this bus. | This is F-001, not a deferred decision. The AI's intelligence depends entirely on reacting to events in real-time. | 🔴 Cannot cut |
| F-002 | **Tenant-aware data model** — single tenant deployed, but schema supports tenant isolation (tenant_id on all tables, foreign keys, indexes). | Retrofitting multi-tenancy later is a rewrite. Design it in, deploy it single. | 🔴 Cannot cut |
| F-003 | **Core schema with constraints** — Projects, Phases, Tasks, Users, Comments. Unique constraints (no duplicate project names per tenant, no duplicate phases per project). Foreign keys with cascade rules. Soft deletes. Versioned migrations. | Data integrity from the start. | 🔴 Cannot cut |
| F-004 | **Authentication** — password auth with hashing/salting, password reset flow, session management (token expiry, secure cookies, session revocation). | Non-negotiable for any usable system. SSO/MFA deferred to R1. | 🔴 Cannot cut |
| F-005 | **RBAC engine** — Site Admin, Developer roles enforced at API + UI level. Client role deferred to R2. Role assignments managed by admins. | Security foundation. Everything downstream depends on "who can see/do what." | 🔴 Cannot cut |
| F-006 | **Task data model — full field set** — title, description, status, priority, assignee(s), start date, due date, created date (auto), last updated (auto), actual finish date (auto on completion), estimated effort, actual effort, phase, parent task (sub-tasks), tags. | Build the complete data model once. Every AI capability depends on rich task data. | 🔴 Cannot cut |
| F-007 | **Task dependencies** — blocked-by / blocks relationships, circular dependency prevention (validated at API level), dependency notes, automatic blocked indicator when dependencies unresolved, auto-clear when resolved. | Critical for AI to reason about sequencing, bottlenecks, and critical path. | 🔴 Cannot cut |
| F-008 | **Sub-tasks** — one level of nesting only (resist going deeper — multi-level nesting is a complexity trap). Parent progress rollup, all standard fields on sub-tasks, promote/demote between task and sub-task. | Needed for WBS generation (AI creates hierarchical breakdowns). | 🔴 Cannot cut |
| F-009 | **Audit trail infrastructure** — every change to status, assignee, dates, priority, phase logged with field changed, old/new value, user, timestamp. Immutable records. | AI needs signal history to learn patterns. Also: compliance for SaaS later. | 🔴 Cannot cut |
| F-010 | **Admin-configurable values** — status labels, priority levels, phase templates managed via admin UI, not hardcoded. Sensible defaults. | Eliminates hardcoded values before they calcify. Required for multi-tenant SaaS. | 🟡 Could defer to R1 (use sensible hardcoded defaults and migrate later) |

### AI Engine — The Core Loop

| # | Feature | Why Now | Cut line | Data readiness |
|---|---------|---------|----------|----------------|
| F-011 | **Natural language project setup** — describe project in plain English, AI generates WBS with phases, milestones, task breakdown, timeline, and suggested assignments. Human reviews/approves/edits, doesn't build from scratch. | **This is the product. This is the magic moment.** If this fails or produces generic output, users lose interest immediately. Allocate 40%+ of R0 AI engineering time here. | 🔴 Cannot cut — this IS the product | Uses general PM knowledge + project description. No historical data needed. Works from day 1. |
| F-012 | **AI-curated "what's next" per developer** — AI surfaces prioritized work for each developer based on dependencies, due dates, blocked status, and assignment. "Here's what to work on and why." Replaces Kanban board as primary work-finding interface. | This is the other half of the daily loop. Developers open the tool and immediately see what matters. | 🔴 Cannot cut — this is how devs use the tool daily | Rules-based in R0 (dependency order, due dates, priority). Becomes adaptive with velocity data in R1. |
| F-013 | **AI daily/weekly summary** — "here's what happened on Project X today in 4 sentences." Decisions auto-logged. Replaces notification feeds. | Completes the daily loop. Stakeholders get value without navigating dashboards. | 🟡 Could defer 2–3 weeks but ship before R0 ends | Consumes event bus data. Works from day 1 with whatever activity exists. |
| F-014 | **AI-powered NL querying** — ask "what's blocked right now?" or "what did the team ship this week?" and get a direct answer from project data. | This is the interaction model. Users talk to the tool, not navigate dashboards. | 🟡 Could be basic in R0, enhanced in R1 | Queries current project data. Works from day 1. |

### AI Safety + Autonomy Controls

| # | Feature | Why Now | Cut line |
|---|---------|---------|----------|
| F-015 | **Autonomy policy engine** — defines which actions the AI may execute without approval vs must propose for human review. Configurable per action type. Default: AI proposes everything, executes nothing without approval. | "AI runs the project" becomes scary the moment it's wrong. This is the trust layer. Without it, either the AI is toothless (always asks) or dangerous (sometimes wrong). | 🔴 Cannot cut — trust is the product |
| F-016 | **AI review/approve interface** — when AI generates a WBS, reprioritizes, or drafts a summary, the human gets a high-density review screen: approve, edit, reject. NOT a chat box. Must support scanning 50 AI suggestions in 30 seconds. Bulk approve/reject. | The core UI pattern for an AI-operated tool. Human supervises, doesn't operate. Must be high-density, not conversational. | 🔴 Cannot cut |
| F-017 | **AI shadow mode** — AI makes suggestions privately to admins before touching live projects or nudging developers. All AI actions logged but not executed. Admins can review accuracy and build confidence before enabling live mode. | Safety valve for R0/R1. Lets you validate AI quality without risk. Builds internal trust before you put it in front of clients. | 🔴 Cannot cut for R0 launch |
| F-018 | **Confidence thresholds + graceful degradation** — AI operations include a confidence score. Below threshold: AI flags uncertainty and asks for human input instead of guessing. Every AI feature has a defined fallback for when the AI isn't confident. | NL→WBS will sometimes produce garbage. Risk prediction will sometimes be wrong. The tool must degrade gracefully, not fail silently. | 🔴 Cannot cut |
| F-019 | **Rollback / revert semantics** — any AI-executed action can be rolled back to its previous state. Revert is one click, not a manual reconstruction. | Mistakes must be cheap to fix. Without this, users won't trust the AI to act. | 🟡 Could ship as "undo last AI action" in R0, full rollback in R1 |

### AI Observability + Evaluation

| # | Feature | Why Now | Cut line |
|---|---------|---------|----------|
| F-020 | **AI traceability pipeline** — for every AI action: user intent → prompt/inputs assembled → model output → action taken/proposed. Full chain logged and queryable. | You cannot improve what you cannot measure. When the WBS generator regresses, you need to know why. When costs spike, you need to trace which operations caused it. | 🔴 Cannot cut |
| F-021 | **AI evaluation harness** — golden test sets for WBS generation, prioritization, and status summaries. Automated quality checks run on every model change or prompt update. Tracks acceptance rate, override rate, and hallucination incidents. | Non-deterministic AI outputs need structured testing. You can't ship AI features on vibes. | 🟡 Can start with manual review in R0, automate in R1 |
| F-022 | **Runtime monitoring dashboard** — latency, cost per operation, error rate, acceptance rate per AI feature. Alerts on anomalies. | Operational visibility from day 1. Especially important once you're running LLM calls at any scale. | 🟡 Basic metrics in R0, full dashboard in R1 |

### Minimal Human Surfaces

| # | Feature | Why Now | Cut line |
|---|---------|---------|----------|
| F-023 | **Task detail view** — single task view showing all fields, sub-tasks, dependencies (both directions), audit history, comments. Arrive here from AI recommendations, not from browsing a board. | You still need to see task details. But the entry point is AI-driven, not navigation-driven. | 🔴 Cannot cut |
| F-024 | **Project list + task list views** — simple list views with filtering (status, priority, assignee, phase, date range) and sorting. Accessible but secondary to NL querying. | Fallback for when you want to browse. Keep it minimal. | 🟡 Basic version in R0, advanced filtering in R1 |
| F-025 | **Role-based sidebar navigation** — minimal nav: Dashboard (AI summary), Projects, Settings. Active route highlighting. Responsive. | You need navigation. Keep it minimal. | 🔴 Cannot cut |
| F-026 | **Comment system** — add comments on tasks. Edit/delete own comments (with "edited" indicator). | Collaboration essential. AI reads comments as signal too. | 🟡 Basic add/view in R0, edit/delete in R1 |

### ClickUp Gap Features (R0)

| # | Feature | Why Now | Cut line |
|---|---------|---------|----------|
| F-089 | **Task checklists** — simple to-do lists within tasks for micro-steps that don't need full subtasks. Inline widget in task detail with progress bar (X/Y completed). AI can propose checklists during WBS generation (e.g., "Definition of Done" checklist per task type). | Lightweight, high-value. Natural extension of the task data model (F-006). Every PM tool ships this from day 1. | 🔴 Cannot cut |
| F-093 | **@Mentions in comments** — reference users with @username in comments, triggering notifications. @-autocomplete dropdown in comment input. Mentioned users see notification badge. | Natural extension of the comment system (F-026). Table-stakes collaboration feature that feeds into the notification pipeline. | 🔴 Cannot cut |

**R0 Total: 28 features (F-001 through F-026 + F-089, F-093). The critical path is 17 (all 🔴 items). The 🟡 items can ship in reduced form.**

**R0 cut line: If behind schedule at month 2, cut F-010 (use hardcoded defaults), F-013 (manual summaries), F-014 (defer NL querying to R1), F-019 (manual rollback only), F-021 (manual eval only), F-022 (basic logging only), F-024 (minimal list only), F-026 (add-only comments). Protect F-011, F-012, F-015, F-016, F-017, F-018, F-020, F-089, F-093 at all costs.**

**Technical risk — F-011 (NL→WBS):** This is the make-or-break feature. If the AI produces generic WBS output, the product thesis fails. Mitigation: build a library of domain-specific prompt templates (software delivery, data migration, consultancy engagement) and test against real past projects from your own delivery history. The AI should feel like it "knows" how your kind of work gets done.

---

## R1 — Intelligence Layer + SaaS Prep (Months 4–6, Internal)

**Goal:** The AI stops assisting and starts operating. Cross-project intelligence. Integrations bring passive signal. SaaS infrastructure is ready for external users.

**R1 success gate:** AI PM agent is actively chasing updates and developers respond to it. Risk predictions have >70% accuracy on flagged items. Cross-project dependencies are surfaced before meetings. At least one status report per week is generated and sent without human editing.

**R1 prerequisite:** R0 daily use loop is sticky. Team is using NL project setup for real projects. "What's next" is the primary way developers find work.

### AI Capabilities — Proactive Operations

| # | Feature | Why Now | Data readiness gate |
|---|---------|---------|---------------------|
| F-027 | **Adaptive task engine (full)** — AI reprioritizes based on blockers, dependencies, velocity, and due dates. Auto-flags stalled work with suggested resolution. Upgrades F-012 from rules-based to data-driven. | 3 months of velocity data from internal use. Enough to start learning patterns. | Minimum: 50+ completed tasks with actual duration data. If not met, stay rules-based and flag. |
| F-028 | **AI PM agent** — chases updates from overdue owners, nudges stalled work with context, drafts standup summaries, prepares meeting agendas from project state. Operates via Slack/Teams (F-036), not just in-tool notifications. You supervise, it executes. | Phase 2 of the vision. The AI becomes a team member. Critical: nudges must have context and be via Slack/Teams — in-tool-only nudges get ignored. | Minimum: active Slack/Teams integration. Without it, the agent has no delivery channel. |
| F-029 | **Auto-generated status reports (full)** — generated from real task data (completion rates, velocity, blockers, risks). RAG status calculated, not self-reported. Available on demand and on schedule. | Extends F-013 daily summaries into formal stakeholder reports. | Minimum: 2+ active projects with regular task updates. |
| F-030 | **Risk prediction** — AI spots patterns that precede delays (scope creep signals, slow review cycles, resource crunches, dependency chain growth). Alerts before anyone escalates. Explains reasoning via decision log. | 3 months of internal data gives initial signal. Be honest about confidence — early predictions will be low-confidence. Use shadow mode (F-017) for the first 2–4 weeks. | Minimum: 100+ task state transitions logged. If thin, label predictions as "early signal" not "prediction." |
| F-031 | **Cross-project dependency mapping** — AI identifies where Project A is blocking Project B across the portfolio. Surfaces in dashboards and NL queries. | Portfolio intelligence. Critical once you have multiple internal projects running. | Minimum: 2+ concurrent projects with cross-references. |
| F-032 | **Resource optimization engine** — AI balances workload across projects. Flags burnout risk (overallocation), suggests reallocation, accounts for availability. | 3 months of assignment and velocity data. | Minimum: 3+ active developers with tracked assignments across projects. |
| F-033 | **Auto-escalation workflows** — blocker not resolved in X hours? System chases with full context attached. Configurable thresholds per project. | Removes "I didn't know it was stuck" as a failure mode. | Consumes event bus. Works immediately once thresholds are configured. |
| F-034 | **Scope creep detector** — monitors task additions vs original WBS baseline. Alerts when scope drifts before it hits the timeline. Shows delta clearly. | 3 months of baselines (from NL→WBS) to compare against. | Minimum: 2+ projects with original AI-generated WBS preserved as baseline. |
| F-035 | **AI decision log (full)** — every AI action is explainable. "Why did it flag this?" always has a clear answer. Full log of AI decisions, recommendations, and human overrides. Queryable. | Trust = adoption. Non-negotiable before external release. If the team can't understand why the AI did something, clients never will. | N/A — infrastructure feature. |

### Integrations — Signal Collection

| # | Feature | Why Now | Dependency |
|---|---------|---------|------------|
| F-036 | **Slack/Teams integration** — AI posts summaries, receives commands, forwards escalations. Bidirectional: updates in Slack reflect in the tool and vice versa. AI PM agent (F-028) nudges delivered here. | The AI needs to operate where the team communicates. Also: the AI PM agent needs a delivery channel outside the tool. | Required for F-028 to be effective. |
| F-037 | **Git integration** — link commits/PRs to tasks, auto-update task status on merge, surface development activity in task detail and AI summaries. | **This is your most important signal source.** Git provides "ground truth" that prevents the AI from hallucinating progress based on stale task data. If developers stop updating tasks, Git activity still shows what's actually happening. | Required for adaptive task engine accuracy. |
| F-038 | **Calendar integration** — AI reads availability for resource optimization, creates/updates meetings for sprint planning and standups. | Resource optimization (F-032) needs availability data. | Required for F-032 accuracy. |

### Security + Identity (SaaS Prep)

| # | Feature | Why Now |
|---|---------|---------|
| F-039 | **SSO integration** — Google Workspace, Microsoft Entra ID, or Okta via SAML/OIDC. | Enterprise clients require this. Build before R2, test internally. |
| F-040 | **Multi-factor authentication** — TOTP (authenticator app) and email-based OTP. Optional per user, admin-enforceable per role. | Security hardening before external access. |
| F-041 | **Session hardening** — configurable token expiry, refresh token rotation, concurrent session limits, forced logout capability. | Production security posture for SaaS. |

### Client-Safe Projection Layer (R2 Prep)

| # | Feature | Why Now |
|---|---------|---------|
| F-042 | **Client projection data model** — formal separation between internal truth and client-facing narrative. Not just a UI filter — a structural layer with: internal vs external task/workstream classification, field-level redaction rules (which fields, comments, and tags are client-visible), "client-facing narrative objects" generated from internal data, approval workflow for what becomes shareable. | You plan to launch the client portal in R2. "No internal noise leaks through" is a hard requirement that needs a data model, not just a UI skin. Build the model now, build the UI in R2. |
| F-043 | **Basic read-only client view (pilot)** — minimal client-facing page showing project milestones, completion percentage, and AI-generated summary. Scoped to 1–2 internal projects shared with a trusted client contact. | 6 months without external validation is too long. Even a static "here's your project status" page generates real client feedback faster than internal dogfooding alone. |

### SaaS Infrastructure

| # | Feature | Why Now |
|---|---------|---------|
| F-044 | **Tenant plan + feature flags** — infrastructure for tenant-level feature gating. Basic plan definitions (even if only "internal" and "beta" for now). Usage tracking for AI operations (queries, generations, reports). | You plan paying users by R2 month 9. Feature gating and usage metering must exist before you can charge. Even manual invoicing needs usage data. |
| F-045 | **SOC 2 prep — controls implementation** — audit logging, access controls, encryption at rest and in transit, data retention policies, incident response procedures. Start the formal compliance process. | SOC 2 certification takes 3–6 months after controls are implemented. Enterprise clients won't touch you without it. If you start in R2, you won't have certification until month 12+. Start now. |
| F-046 | **AI cost tracking + rate controls** — per-tenant, per-feature AI cost tracking. Basic rate limiting per tenant. Cost alerts when a tenant exceeds expected AI usage. | At SaaS scale, AI inference costs can dwarf infrastructure costs. You need visibility before you have external tenants, not after. |

### Enhanced Task Management

| # | Feature | Why Now |
|---|---------|---------|
| F-047 | **Default + custom tags** — default tags on project creation, custom tags with name/color scoped to project or tenant. Admin management (create, rename, merge, archive, delete). | Organization building block. AI uses tags for categorization and pattern recognition. |
| F-049 | **Full-text search across updates and comments** — search within a project or across projects (permission-scoped). Results show matching text in context with links. | Essential at scale. Also needed for AI to retrieve historical context. |
| F-050 | **Advanced filtering + sorting** — filter tasks by any combination of status, priority, assignee, phase, date range, tags, creation date. Sort by priority, due date, status, recently updated. Saveable filter views. | Power user need as task volume grows. |

### ClickUp Gap Features — Promoted & New (R1)

| # | Feature | Why Now | Cut line |
|---|---------|---------|----------|
| F-087 | **Read-only Kanban board view** — (promoted from R3 Optional → R1 required). AI-annotated: blocked tasks flagged, priority surfaced. Available as a view toggle. Read-only in R1 (drag-and-drop deferred to R2). | Every PM tool has Kanban. This is table-stakes. | 🔴 Cannot cut |
| F-076a | **Task/project templates (basic)** — (promoted from R3 → R1 basic CRUD). Manual template creation, editing, deletion. Create project from template. AI-enhanced template generation remains in R3 (F-076). | Competitors ship templates as basics. Manual CRUD is simple to implement and unblocks user workflows. | 🟡 Could defer |
| F-090 | **Recurring tasks** — tasks that auto-recreate on a schedule (daily, weekly, monthly, custom cron via iCal RRULE). Clones title, description, assignees, checklist template, phase. Links via `recurrence_parent_id`. AI PM Agent can suggest converting repeated manual tasks into recurring tasks. | Common productivity feature. Reduces manual task creation for routine work. | 🟡 Could defer (strongly recommended) |
| F-091 | **Calendar view** — visualize tasks by due date on a calendar grid (month/week/day views). Tasks as colored chips by priority/status. Click to open task detail. Drag to reschedule due date. | Consultancy clients manage deadlines by calendar. Visual scheduling is expected. | 🔴 Cannot cut |
| F-092 | **Table view** — spreadsheet-like interface for viewing and inline-editing task data in bulk. Columns: title, status, priority, assignee, phase, due date, effort, tags, AI confidence. Column resize/reorder/hide. Sort by any column. Includes saved views system. | Power users need bulk data manipulation. Standard in every PM tool. | 🔴 Cannot cut |
| F-094 | **Custom fields** — tenant/project-scoped custom field definitions with multiple types (text, number, date, select, multi-select, URL, email, checkbox). AI can read custom fields as context for WBS generation, prioritization, and NL queries. | Every consultancy has domain-specific data. Custom fields make the tool adaptable without code changes. | 🔴 Cannot cut |
| F-096 | **Smart notification system** — centralized notification inbox with filtering, prioritization, and channel preferences (in-app, email, Slack). Bell icon with unread count badge. Filter by type. Click-through to source entity. All events feed into a notification-generator consumer that creates records based on user preferences. | Table-stakes. Without centralized notifications, users miss critical updates. | 🔴 Cannot cut |
| F-097 | **Assigned comments / action items** — turn a comment into a required action item assigned to a specific user. Action items appear in "What's Next" feed and notification inbox. AI PM Agent flags unresolved action items during daily loops. | Bridges the gap between conversation and execution. Common in Slack/ClickUp. | 🟡 Could defer |
| F-103 | **Task reminders** — personal reminders on tasks: notify at a specific date/time. pg_cron scheduler checks due reminders every minute. Feeds into notification pipeline. | Simple, high-value quality-of-life feature. Reduces missed deadlines. | 🟡 Could defer |

### Visualization (AI-Informed)

| # | Feature | Why Now |
|---|---------|---------|
| F-051 | **Dependency chain visualization** — from any task, see upstream (what blocks it) and downstream (what it blocks) as a graph. Critical path highlighted. Click-through navigation. | Visual dependency reasoning. The AI identifies bottlenecks; this lets humans see the full picture when they need to. |
| F-052 | **AI-annotated timeline view** — tasks on a time axis with AI overlays: predicted delays flagged, at-risk milestones highlighted, resource conflicts marked. Not a passive Gantt chart — an AI-interpreted timeline. | If you're going to show a timeline, make the AI the one interpreting it. |
| F-053 | **Portfolio dashboard** — cross-project view for admins. AI-curated: projects at risk, resource conflicts, blocked cross-project dependencies, delivery confidence scores. | Internal admins need portfolio visibility before you offer it to clients. |

**R1 Total: 36 features (F-027 through F-053 minus F-048 deferred + F-087 promoted + F-076a promoted + F-090, F-091, F-092, F-094, F-096, F-097, F-103 new).**

**R1 trade-offs:**
- F-048 (Bulk CSV Import) deferred to R2 — not needed until external onboarding. Manual task creation sufficient for R1.
- F-038 (Calendar Integration) deferred to R2 — Calendar *view* ships R1 (F-091), but external calendar *sync* (Google/Outlook) moves to R2.

**R1 cut line: If behind schedule, protect F-027–F-035 (AI operations core), F-036–F-037 (critical signal integrations), F-042–F-043 (client projection layer), F-044–F-046 (SaaS infrastructure), F-087 (Kanban), F-091 (Calendar view), F-092 (Table view), F-094 (Custom fields), F-096 (Notifications). Cut F-047 (tags), F-049 (search), F-050 (advanced filtering), F-051–F-053 (visualizations), F-090 (recurring), F-097 (action items), F-103 (reminders) to R2.**

**By end of R1:** The AI is running operations internally. You have a client projection data model, a pilot client view getting real feedback, usage metering, SOC 2 controls in place, feature flags ready, multiple view types (list, board, calendar, table, timeline), custom fields, and centralized notifications. You are ready for external users.

---

## R2 — External Launch (Months 7–9, Internal + Client-Facing)

**Goal:** Clients access the product. Multi-tenancy is live. The AI curates what clients see. You have paying users.

**R2 success gate:** At least 3 paying client tenants active. Client NPS >40. Client portal questions answered by AI >60% of the time without human intervention. AI inference cost per tenant per month is within modeled budget. SOC 2 Type I audit initiated.

### Multi-Tenancy + Client Access

| # | Feature | Why Now |
|---|---------|---------|
| F-054 | **Multi-tenancy live** — each client gets isolated data, their own projects, their own AI context. Tenant switching for internal admins who manage multiple clients. Data never bleeds across tenants. | The SaaS foundation. Everything external depends on this. |
| F-055 | **Client portal (full)** — white-labeled, AI-curated progress view consuming the client projection layer (F-042). Clients see: milestone progress, AI-generated summaries, delivery confidence, risk flags (framed appropriately). Internal noise filtered at the data layer, not the UI layer. | This is the product clients experience. Built on the projection model, not a UI skin over internal data. |
| F-056 | **Client role + permissions** — clients scoped to their own portal. Can view project status, roadmaps, AI-generated updates. Can comment and approve deliverables. Cannot modify tasks, assignments, or project structure. | RBAC extension for external users. |
| F-057 | **Automated client reporting** — AI generates client-ready progress updates on a schedule (weekly, biweekly). Internal PM reviews and sends, doesn't write. Configurable tone and detail level per client. Consumes client projection layer. | The client-facing version of auto-generated status reports. |
| F-058 | **Self-service client onboarding (basic)** — client receives invite, creates account, lands in their portal. AI provides guided walkthrough. | Reduces onboarding cost per client. |
| F-059 | **Client-facing AI assistant** — clients ask NL questions about their project: "When will Phase 2 be done?" "What's at risk?" AI answers from project data, scoped to client permissions. **Human-in-the-loop filter:** AI cannot tell a client a project is "at risk" before the internal team has reviewed and approved that framing. | The product differentiator. But needs guardrails — you don't want the AI surprising a client with bad news before the PM knows. |

### Monetization Infrastructure

| # | Feature | Why Now |
|---|---------|---------|
| F-060 | **Tiered pricing (v1)** — Starter (basic tracking, limited AI) and Pro (full AI operations). Feature gating enforced via F-044. Usage metering for AI operations with included tier and overage tracking. | You have paying users. You need to bill them. Even if manual at first, the metering and gating must be automated. |
| F-061 | **AI cost management (live)** — per-tenant cost dashboards, rate limiting enforced, cost alerts, token budget allocation per operation type. Margin tracking per tenant. | At multi-tenant scale, AI inference costs can exceed infrastructure costs. You need to know your unit economics are positive per tenant. |
| F-062 | **Data export** — clients export their project data (tasks, history, reports) in CSV/JSON. Full data portability. | Trust signal. Compliance requirement for some clients. Reduces lock-in anxiety during sales. |

### Platform Hardening

| # | Feature | Why Now |
|---|---------|---------|
| F-063 | **API layer (v1)** — RESTful API for core operations (projects, tasks, status, comments). API key management. Rate limiting. Versioned endpoints. Documentation. | Clients and partners want programmatic access. Enables custom integrations. |
| F-064 | **Webhook system** — configurable webhooks for key events (task completed, status changed, milestone reached, risk flagged). | Clients integrate the tool into their own workflows. |
| F-065 | **SOC 2 Type I audit** — formal audit initiated. Controls documentation complete. Evidence collection automated. | Enterprise clients require this. If you started controls in R1, you're on track for Type I by end of R2 or early R3. |
| F-066 | **AI guardrails for multi-tenant** — PII handling, redaction, prompt injection protection (especially important once ingesting Slack/Docs from multiple tenants), tenant data isolation verification in AI context assembly. | Security-critical once you have external tenants whose data flows through AI pipelines. |

### Enhanced AI Capabilities

| # | Feature | Why Now |
|---|---------|---------|
| F-067 | **Predictive delivery dating** — "You're trending 8 days late on this milestone, here are 3 recovery options." Visible to internal team; client-facing version filtered through projection layer with appropriate framing. | High-value insight. Builds trust by being transparent about delivery risk. |
| F-068 | **AI meeting prep + follow-up** — auto-agenda from project state before client meetings. After meetings, AI extracts action items from notes and creates/updates tasks. | Reduces PM overhead. Client meetings are the highest-frequency PM activity. |
| F-069 | **Scenario planning** — "What if we lose a developer for 2 weeks?" AI models timeline impact and shows recovery options. | Powerful internal tool that improves quality of client-facing commitments. |
| F-070 | **AI sprint planning** — AI suggests sprint scope from velocity + capacity data. Flags overcommitment before the sprint starts. Human reviews and adjusts. | Natural extension of adaptive task engine with 6+ months of velocity data. |
| F-071 | **Custom AI rules per project** — teams set their own escalation thresholds, notification preferences, risk sensitivity per project. | Different clients have different urgency profiles. One-size-fits-all AI rules break trust. |
| F-072 | **Smart time tracking** — AI infers effort from activity (commits, task transitions, comment patterns). Human confirms, doesn't log. Confidence threshold: only surface when accuracy is high. Inaccurate time inference is worse than no time tracking. | 6+ months of activity data. But accuracy requirements are extremely high — gate on confidence. |
| F-073 | **Additional integrations** — Jira import (migration path for prospects), GitHub/GitLab/Azure DevOps, Confluence/Docs. | Prospects have existing tools. Migration must be painless or they won't switch. |

### ClickUp Gap Features — Promoted & New (R2)

| # | Feature | Why Now | Cut line |
|---|---------|---------|----------|
| F-088 | **Gantt chart view** — (promoted from R3 Optional → R2 required). AI overlays (predicted delays, critical path, at-risk milestones). AI-annotated Gantt is the differentiator — not a static chart. | Consultancy clients expect timeline views. Competitors all have this. | 🟡 Could defer |
| F-048 | **Bulk task import** — (deferred from R1 to R2). CSV/XLSX upload with column mapping, validation, error preview, and correction before commit. | Essential for client onboarding. Now ships when external users arrive. | 🟡 Could defer |
| F-038 | **Calendar integration** — (deferred from R1 to R2). CalDAV/OAuth 2.0 external calendar sync (Google/Outlook). | Calendar *view* shipped in R1. External sync adds team availability data for resource optimization. | 🟡 Could defer |
| F-095 | **Goals & OKRs** — high-level objectives with measurable key results linked to tasks/projects. Goal tree view. Auto-calculated progress from linked tasks. AI suggests which tasks contribute to which goals; flags goals at risk. | Strategic alignment feature. Consultancy clients need to map delivery to business objectives. | 🟡 Could defer |
| F-098 | **Custom automations** — user-configurable if-then automation rules (beyond AI-driven actions). Trigger types: status changed, assigned, due soon, dependency resolved, custom field changed. Action types: change status, assign user, add tag, send notification, set priority, trigger webhook. | Power users expect workflow automation. Distinct from AI autonomy — these are deterministic rules. | 🟡 Could defer |
| F-099 | **Form view / task intake forms** — shareable forms that create tasks on submission. Form builder with drag-and-drop field types. Public shareable link (no auth required for published forms). | Streamlines task intake from non-PM users and external stakeholders. | 🟡 Could defer |
| F-100 | **Formula / computed fields** — calculated fields using task data (e.g., cost = hours × rate). Basic arithmetic, field references, date diffs, conditionals, aggregations over subtasks. Extends custom field system. | Natural extension of custom fields (F-094). Consultancies need computed metrics. | 🟡 Could defer |
| F-101 | **Docs & knowledge base** — collaborative documents linked to projects, searchable, embeddable in RAG. Markdown content, draft/published/archived statuses. Indexed into pgvector embeddings for NL queries and WBS generation. | Enriches AI context with organizational knowledge. Competitive table-stakes. | 🟡 Could defer |
| F-102 | **AI writing assistant** — AI-powered content generation for task descriptions, comments, reports, and documents. Draft from title, improve/expand text, generate meeting notes, draft client-facing summaries, translate technical → business language. | High-value productivity feature. Leverages existing AI pipeline infrastructure. | 🟡 Could defer |

**R2 Total: 27 features (F-054 through F-073 + F-088 promoted + F-048, F-038 deferred from R1 + F-095, F-098, F-099, F-100, F-101, F-102 new).**

**R2 cut line: Protect F-054–F-059 (client access — this is the launch), F-060–F-061 (monetization), and F-065–F-066 (security). Cut F-062 (data export), F-063–F-064 (API/webhooks), F-068–F-073 (enhanced AI), F-088 (Gantt), F-095–F-102 (gap features) to R3 if behind. You can launch with fewer features but you cannot launch without billing, client access, and security.**

---

## R3 — Platform + Scale (Months 10–12, Full Product)

**Goal:** The tool becomes a platform. Per-tenant AI learning. Self-service at scale. Consultancy-specific moat features.

**R3 success gate:** 10+ paying tenants. Per-tenant AI accuracy measurably improves with tenant-specific data. SOC 2 Type I certified. AI-generated SOWs used in at least one real client proposal. Client retention >90%.

### Per-Tenant Intelligence

| # | Feature | Why Now | Data readiness gate |
|---|---------|---------|---------------------|
| F-074 | **Per-tenant AI learning** — each client's AI gets smarter from their own delivery data. "Your frontend tasks typically take 1.4x your estimates" is their insight, not a generic benchmark. | The moat. Competitor tools give generic intelligence. Yours gets smarter per client. | Minimum per tenant: 2+ completed projects with full lifecycle data (estimates vs actuals). |
| F-075 | **AI estimation engine** — feed in scope, AI estimates effort from historical data. Gets smarter with every closed project. Per-tenant calibration. | High-value for sales. "Our tool tells you how long things will take based on your own history." | Minimum: 50+ completed tasks with estimated vs actual effort data per tenant. |
| F-076 | **Template intelligence** — AI builds project templates from completed projects. "Projects like your last 3 data migrations looked like this." | 6–9 months of completed project data makes this valuable. | Minimum: 3+ completed projects of similar type. |
| F-077 | **AI coaching layer** — coaches PMs based on their delivery patterns. "You tend to underestimate QA cycles by 30%, here's how your top-performing projects handled it." | No competitor does this. Requires enough tenant-specific data to be credible. | Minimum: 5+ completed projects per PM being coached. |
| F-078 | **AI retrospective facilitator** — analyses actual delivery data to surface what caused delays vs what the team thinks caused them. Data-driven retros, not vibes. | 6+ months of rich delivery data. Retros improve delivery quality. | Minimum: completed project with full audit trail. |

### Productization

| # | Feature | Why Now |
|---|---------|---------|
| F-079 | **Full self-service onboarding** — new client signs up, AI walks through setup, imports existing projects from Jira/Asana/spreadsheets, suggests project structure, configures settings. Zero human intervention. | Scale. You can't hand-hold every new client. |
| F-080 | **Enterprise tier** — custom AI rules, API access, dedicated support, SSO enforcement, schema isolation option. | Enterprise clients need differentiated service level. |
| F-081 | **Project Manager role** — manages projects, creates tasks, assigns work within designated clients. No site-wide admin privileges. | Needed when clients' own PMs use the tool. |
| F-082 | **SOC 2 Type II** — continuous compliance monitoring, automated evidence collection. | Enterprise requirement. Type I was R2; Type II is the ongoing commitment. |

### Consultancy-Specific Moat

| # | Feature | Why Now |
|---|---------|---------|
| F-083 | **AI-generated SOWs and proposals** — based on historical delivery data, AI drafts scope documents for new engagements. "Projects like this typically take X weeks with Y resources, and here are the risk areas." | Consultancy gold. Directly generates revenue-enabling artifacts. The killer feature for your vertical. |
| F-084 | **Knowledge capture** — AI extracts lessons learned at project close, builds an org knowledge base that grows. Searchable, referenceable in future project setup. | Institutional memory. Especially valuable for consultancies with staff turnover. |
| F-085 | **AI onboarding for new joiners** — someone joins mid-project, AI gives them the full brief: decisions made, current risks, who owns what, what's next. | Reduces ramp-up time. High value for consultancies staffing new people onto engagements. |
| F-086 | **Embedded analytics + benchmarking** — clients see how their delivery metrics compare to anonymized benchmarks across your platform. | Sticky feature. Hard to replicate, hard to leave. |

### AI-Enhanced Templates (Originally F-076, Basic CRUD Shipped in R1)

| # | Feature | Why Now |
|---|---------|---------|
| F-076 | **Template intelligence (AI-enhanced)** — AI builds project templates from completed projects. "Projects like your last 3 data migrations looked like this." Requires historical data to be valuable. Basic manual template CRUD shipped in R1 (F-076a). | 6–9 months of completed project data makes AI-generated templates valuable. Cannot build useful templates without history. |

**R3 Total: 13 features (F-074 through F-086 minus F-087 Kanban promoted to R1 and F-088 Gantt promoted to R2, plus F-076 AI-enhanced templates stays).**

**R3 cut line: Protect F-074–F-078 (per-tenant intelligence — this is the moat), F-079 (self-service), and F-083 (SOW generation — consultancy killer feature). Cut F-080 (enterprise tier — do manually), F-081 (PM role — use admin role), F-086 (analytics) to post-12-month.**

---

## Post-12-Month Backlog (Vision, Unprioritized)

These features are valuable but premature for year 1. They require either platform scale (thousands of users), organizational maturity (separate product team), or market validation (target vertical identified).

| # | Feature | Why Deferred |
|---|---------|-------------|
| F-104 | **White-label option** — consultancies resell under their brand | Platform play requiring different GTM motion than direct sales. Needs dedicated product team. |
| F-105 | **Marketplace for AI playbooks** — teams create and share automation recipes | Needs thousands of active users before a marketplace creates value. |
| F-106 | **Open plugin SDK** — third-party developers build on the platform | Ecosystem play. Long-term defensibility but premature before product-market fit is locked. |
| F-107 | **Voice interface** — ask questions in standups, get spoken answers | Flashy but niche. Validate demand before building. |
| F-108 | **AI-to-AI handoff** — client CI/CD auto-updates task status, support tickets auto-create tasks | Zero human bridging. Powerful but requires deep integration with client infrastructure. |
| F-109 | **Vertical-specific editions** — data consultancy, software delivery, marketing agency | Same core, different intelligence. Requires market validation of target verticals. |
| F-110 | **Sentiment analysis on communications** — early warning if tone trends negative | Requires substantial text corpus and careful privacy guardrails. |
| F-111 | **Client satisfaction prediction** — correlates project health with retention patterns | Requires many tenants and enough churn/retention events to model. |
| F-112 | **Competitive benchmarking** — anonymized delivery metrics across clients | Needs enough tenants for meaningful anonymized comparison. |

---

## Release Summary

| Release | Timeframe | Focus | Features | Users | Success Gate |
|---------|-----------|-------|----------|-------|-------------|
| **R0** | Months 1–3 | Foundation + core AI loop | 28 (F-001→F-026 + F-089, F-093) | Internal team | Team uses NL→WBS and "what's next" daily |
| **R1** | Months 4–6 | Intelligence + SaaS prep + views | 36 (F-027→F-053 − F-048 + F-076a, F-087, F-090–F-092, F-094, F-096–F-097, F-103) | Internal + pilot client | AI PM agent active, >70% risk prediction accuracy, multiple view types |
| **R2** | Months 7–9 | External launch + monetization | 27 (F-054→F-073 + F-038, F-048, F-088, F-095, F-098–F-102) | Internal + paying clients | 3+ paying tenants, positive unit economics |
| **R3** | Months 10–12 | Platform + per-tenant intelligence | 13 (F-074→F-086 + F-076 AI-enhanced) | Scaled clients + channel | 10+ tenants, per-tenant AI measurably improving |
| | | **Total in-year** | **103 features** (88 original + 15 new) | | |
| Post-12mo | Year 2+ | Ecosystem + platform plays | 9 (F-104 → F-112) | | |

---

## What We're NOT Building (And Why)

| Legacy Pattern / ClickUp Feature | Our Approach / Skip Rationale |
|----------------------------------|-------------------------------|
| Manual task creation forms with 12 fields | AI generates tasks from NL description; human reviews |
| Static Kanban boards as primary view | AI tells you what to work on next; Kanban in R1 as supplementary view |
| Passive Gantt charts | AI-annotated timeline with predicted delays and critical path (R2) |
| Dashboard walls of charts | AI summaries: "here's what needs attention" with drill-down |
| Notification feeds (47 items) | Smart notification inbox with filtering + AI summary (R1) |
| Manual status reports | Auto-generated from real data, calculated not self-reported |
| Self-reported time tracking | AI-inferred from activity, human confirms |
| Manual sprint planning | AI suggests scope from velocity + capacity, human adjusts |
| AI that acts without explanation | Every AI action has a decision log. "Why?" always has an answer. |
| AI that can't be wrong | Confidence thresholds, shadow mode, graceful degradation, one-click rollback |
| Mind Maps | Low usage, niche. Our AI generates structure — users don't need to manually brainstorm. |
| Map View | Location-based tasks are irrelevant for consultancy PM. |
| Box View | Portfolio Dashboard (F-053) covers "who's doing what" better. |
| Whiteboards | Outside core PM scope. Users have Miro/FigJam. |
| Email in app | Slack integration covers async communication. Email integration is complex for low ROI. |
| Screen Recording | Users have Loom/OBS. Not core PM. |
| Proofing / Annotations | Not relevant for consultancy PM vertical. |

---

## Competitive Context

The AI PM tool market is moving fast. Key competitors to track:

- **Motion** — Y Combinator, $75M raised, $550M valuation, 10K+ B2B customers, eight-figure ARR. Building an "agentic AI suite" for SMBs. Bundling multiple AI agents (PM, sales, executive assistance).
- **Monday.com AI, Asana Intelligence, ClickUp Brain** — bolting AI onto massive existing user bases. They have distribution; we have a fundamentally different interaction model.
- **Market size** — AI in project management projected at $5.7B by 2026 (17.3% CAGR).

**Our wedge:** consultancy-specific moat (AI-generated SOWs, sanitized client portals, per-tenant learning from delivery data). We don't win by being a better general-purpose PM tool — we win by being the PM tool that understands consultancy delivery.

---

## Open Questions (Decide Before R2)

| Question | Recommended Direction | Decide By |
|----------|----------------------|-----------|
| **Pricing model** | Hybrid: workspace subscription + AI operations metering + client portal add-on | End of R1 (month 6) |
| **Org structure** | Spin out as dedicated product team. This vision is too disruptive for a service-based consultancy to manage as a side project. | Before R2 launch |
| **First target vertical** | High-compliance engineering (fintech, medtech) — they value audit trails, risk prediction, and explainability | R2 planning |
| **Legal: IP, data isolation, AI liability** | Assign legal workstream owner. Data isolation guarantees and AI liability terms needed in client contracts. | Before R2 launch |
| **Team sizing** | 5–7 engineers for R0–R1. Evaluate scaling to 8–10 for R2–R3 based on velocity. | R1 retrospective |
