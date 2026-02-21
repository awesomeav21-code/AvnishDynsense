# Gap Analysis: Current Design (v1.0) vs Updated Design (v1.1/v3.1)

> **Date:** February 10, 2026
> **Purpose:** Comprehensive comparison between the original design documents (`requirement_and_design/`) and the updated documents (`requirement_and_design_v2/`) to identify all gaps, additions, promotions, deferrals, and net-new content.

---

## 1. Document Inventory Comparison

| Document | Old Version | Lines | New Version | Lines | Delta |
|----------|------------|-------|-------------|-------|-------|
| `architecture-v3.1.md` (was `FINAL_...v3_Definitive.md`) | v3.0 | 527 | v3.1 | 1,363 | **+836 lines (+159%)** |
| `ui-ux-design.md` | **DID NOT EXIST** | 0 | v1.0 | 2,040 | **+2,040 lines (NEW)** |
| `design.md` | v1.0 | ~3,200 | v1.1 | 3,753 | **+553 lines (+17%)** |
| `requirements.md` | v1.0 | ~2,800 | v1.1 | 2,368 | Restructured with enhanced traceability |
| `implementation-plan.md` | v1.0 | ~1,800 | v1.1 | 2,126 | **+326 lines (+18%)** |
| `roadmap-v2.md` | v2.1 | ~393 | v2.2 | 461 | **+68 lines (+17%)** |
| **TOTAL** | | ~8,718 | | **12,111** | **+3,393 lines (+39%)** |

---

## 2. Architecture Gaps (v3.0 → v3.1)

### 2.1 Visual Architecture — Zero → 12 Mermaid Diagrams

| # | Diagram | Type | Gap Status |
|---|---------|------|------------|
| 1 | System Context (C4 L1) | graph TD | **NEW** — v3.0 had no visual diagrams |
| 2 | Container Diagram (C4 L2) | graph TD | **NEW** |
| 3 | API Server Components (C4 L3) | graph TD | **NEW** |
| 4 | Event Flow (producers→streams→consumers) | flowchart LR | **NEW** |
| 5 | Entity-Relationship (core tables) | erDiagram | **NEW** |
| 6 | Notification Pipeline | flowchart TD | **NEW** |
| 7 | Automation Rule Pipeline | flowchart LR | **NEW** |
| 8 | 3-Layer Tenant Isolation | flowchart TD | **NEW** |
| 9 | AWS Deployment Topology | flowchart TD | **NEW** |
| 10 | NL-to-WBS Sequence | sequenceDiagram | **NEW** |
| 11 | AI PM Agent Sequence | sequenceDiagram | **NEW** |
| 12 | Notification Sequence | sequenceDiagram | **NEW** |

**Impact:** v3.0 was text-only. v3.1 is now visually navigable — critical for onboarding new engineers and stakeholder reviews.

### 2.2 Application Modules — 8 → 14

| Module | v3.0 | v3.1 | Gap |
|--------|------|------|-----|
| Project | Yes | Yes | — |
| Task | Yes | Yes | — |
| Dependency | Yes | Yes | — |
| Comment | Yes | Yes | — |
| Audit | Yes | Yes | — |
| User | Yes | Yes | — |
| Projection | Yes | Yes | — |
| Config | Yes | Yes | — |
| **Notification** | No | Yes | **NEW** — FR-2007/F-096 |
| **Goals** | No | Yes | **NEW** — FR-2006/F-095 |
| **Automation** | No | Yes | **NEW** — FR-2009/F-098 |
| **Forms** | No | Yes | **NEW** — FR-2010/F-099 |
| **Documents** | No | Yes | **NEW** — FR-2012/F-101 |
| **Views** | No | Yes | **NEW** — FR-1900-1901/F-087,F-088 |

### 2.3 NATS Event Bus — 6 → 12 Streams

| Stream | v3.0 | v3.1 | Gap |
|--------|------|------|-----|
| `pm.tasks` | Yes | Yes | — |
| `pm.projects` | Yes | Yes | — |
| `pm.comments` | Yes | Yes | — |
| `pm.ai` | Yes | Yes | — |
| `pm.integrations` | Yes | Yes | — |
| `pm.system` | Yes | Yes | — |
| **`pm.notifications`** | No | Yes | **NEW** — notification dispatch events |
| **`pm.reminders`** | No | Yes | **NEW** — reminder scheduling events |
| **`pm.goals`** | No | Yes | **NEW** — goal/OKR progress events |
| **`pm.automations`** | No | Yes | **NEW** — automation trigger/execution events |
| **`pm.forms`** | No | Yes | **NEW** — form submission events |
| **`pm.documents`** | No | Yes | **NEW** — document CRUD + indexing events |

### 2.4 Consumers — 8 → 11

| Consumer | v3.0 | v3.1 | Gap |
|----------|------|------|-----|
| audit-writer | Yes | Yes | — |
| ai-adaptive | Yes | Yes | — |
| ai-summarizer | Yes | Yes | — |
| embedding-pipeline | Yes | Yes | — |
| projection-updater | Yes | Yes | — |
| notification-router | Yes | Yes | — |
| cost-tracker | Yes | Yes | — |
| escalation-monitor | Yes | Yes | — |
| **notification-generator** | No | Yes | **NEW** — generates notification records from events |
| **recurrence-scheduler** | No | Yes | **NEW** — handles recurring task creation |
| **automation-engine** | No | Yes | **NEW** — evaluates and executes automation rules |

### 2.5 Database Tables — ~16 → 30

| Table | v3.0 | v3.1 | Feature Ref |
|-------|------|------|-------------|
| tenants | Yes | Yes | F-002 |
| users | Yes | Yes | F-004 |
| projects | Yes | Yes | F-003 |
| phases | Yes | Yes | F-003 |
| tasks | Yes | Yes | F-006 |
| task_assignments | Yes | Yes | F-006 |
| task_dependencies | Yes | Yes | F-007 |
| comments | Yes | Yes | F-026 |
| audit_log | Yes | Yes | F-009 |
| ai_actions | Yes | Yes | F-020 |
| ai_cost_log | Yes | Yes | F-046 |
| embeddings | Yes | Yes | F-014 |
| tenant_config | Yes | Yes | F-010 |
| task_checklists | Yes | Yes | F-089 |
| checklist_items | Yes | Yes | F-089 |
| mentions | Yes | Yes | F-093 |
| **notifications** | No | Yes | **F-096** |
| **notification_preferences** | No | Yes | **F-096** |
| **goals** | No | Yes | **F-095** |
| **key_results** | No | Yes | **F-095** |
| **goal_task_links** | No | Yes | **F-095** |
| **automation_rules** | No | Yes | **F-098** |
| **automation_actions** | No | Yes | **F-098** |
| **automation_logs** | No | Yes | **F-098** |
| **recurring_task_configs** | No | Yes | **F-090** |
| **custom_field_definitions** | No | Yes | **F-094** |
| **custom_field_values** | No | Yes | **F-094** |
| **forms / form_fields / form_submissions** | No | Yes | **F-099** |
| **documents / document_versions** | No | Yes | **F-101** |
| **reminders** | No | Yes | **F-103** |

### 2.6 API Endpoints — ~35 → ~85

**50 new endpoints** across 6 new modules + expansions to existing modules:

| Module | v3.0 Endpoints | v3.1 Endpoints | New |
|--------|---------------|----------------|-----|
| Project | ~6 | ~8 | +2 |
| Task | ~8 | ~12 | +4 |
| Notification | 0 | ~8 | **+8** |
| Goals | 0 | ~10 | **+10** |
| Automation | 0 | ~8 | **+8** |
| Forms | 0 | ~8 | **+8** |
| Documents | 0 | ~8 | **+8** |
| Views | 0 | ~6 | **+6** |
| Custom Fields | 0 | ~6 | **+6** |
| Recurring Tasks | 0 | ~4 | **+4** |
| Other expansions | ~21 | ~7 | +7 |

### 2.7 AI Capabilities — 9 → 10

| Capability | v3.0 | v3.1 | Gap |
|------------|------|------|-----|
| NL→WBS Generator | Yes | Yes | — |
| "What's Next" Engine | Yes | Yes | — |
| NL Query Engine | Yes | Yes | — |
| Summary Engine | Yes | Yes | — |
| Risk Predictor | Yes | Yes | — |
| AI PM Agent | Yes | Yes | — |
| Scope Creep Detector | Yes | Yes | — |
| SOW Generator | Yes | Yes | — |
| Per-Tenant Learning | Yes | Yes | — |
| **AI Writing Assistant** | No | Yes | **NEW** — F-102, Claude Sonnet, ~1K in/~2K out |

### 2.8 New Subsystem Architectures — 0 → 7

v3.0 had NO subsystem-level architecture descriptions. v3.1 adds detailed architecture for:

1. **Notification Pipeline** — 2-stage: event → preference filter → multi-channel dispatch (in-app, email, Slack)
2. **Automation Engine** — rule evaluation pipeline with trigger → condition → action pattern
3. **Recurring Task Scheduler** — iCal RRULE-based with `pg_cron` trigger
4. **Custom Fields** — polymorphic storage pattern (EAV with type safety)
5. **Goals/OKR** — self-referencing hierarchy with auto-calculated progress
6. **Documents/KB** — markdown storage with pgvector RAG integration
7. **Form Intake** — public submission flow with auth-free endpoint

---

## 3. UI/UX Design Gaps (0 → Complete System)

**This is the single largest gap.** The old design had ZERO UI/UX documentation. The new `ui-ux-design.md` (2,040 lines) fills this entirely.

### 3.1 What Was Missing

| Gap Area | Old Design | New Design |
|----------|-----------|------------|
| Design tokens (colors, typography, spacing) | None | 14 semantic + 6 AI + 4 priority + status tokens |
| Typography system | None | 5-level scale, Inter font, text-xs baseline |
| Page wireframes | None | **21 ASCII wireframes** across R0-R3 |
| Component architecture | None | 15+ shared components, 12 hooks, hierarchy diagram |
| State management strategy | None | TanStack Query + RHF + URL state + Context + Zustand |
| AI-specific UI patterns | None | Confidence badges, streaming display, decision log viewer |
| Interaction patterns | None | Loading/empty/error states, optimistic updates, keyboard shortcuts |
| Data visualization specs | None | Dashboard charts, dependency graphs, timeline specs |
| Client-side data flow | None | Cache key conventions, mutation patterns, WebSocket integration |
| Responsive breakpoints | None | 5 breakpoints, per-page responsive table |
| Accessibility (WCAG AA) | None | ARIA landmarks, keyboard nav, focus management, contrast |
| Performance budgets | None | FCP <1.5s, TTI <3s, CLS <0.1, bundle <200KB |
| Mermaid diagrams | None | 6 diagrams (sitemap, routes, component tree, state flow, data flow, optimistic update FSM) |

### 3.2 Wireframe Coverage by Release

| Release | Wireframes | Pages Covered |
|---------|-----------|---------------|
| R0 | 9 | Dashboard, Project List, Project Detail, Task Detail, Task List, AI Review, NL Query, Settings, Login |
| R1 | 7 | Kanban, Calendar View, Table View, Timeline, Portfolio, Notification Inbox, Dependency Graph |
| R2-R3 | 3+ | Client Portal, Goals/OKR, Gantt Chart |
| **Total** | **19-21** | All user-facing screens |

---

## 4. Feature Promotion & Deferral Gaps

### 4.1 Features Promoted (moved earlier)

| Feature | Original Release | New Release | Impact |
|---------|-----------------|-------------|--------|
| F-087 Kanban Board | R3 (Optional) | **R1** (Required) | New `views` module, Kanban wireframe needed in R1 |
| F-088 Gantt Chart | R3 (Optional) | **R2** (Required) | SVG-based Gantt with AI overlays |
| F-076a Templates (basic) | R3 | **R1** (basic CRUD) | Manual template creation; AI-enhanced stays R3 |

### 4.2 Features Deferred (moved later)

| Feature | Original Release | New Release | Reason |
|---------|-----------------|-------------|--------|
| F-048 Bulk CSV Import | R1 | **R2** | Not needed until external client onboarding |
| F-038 Calendar Integration | R1 | **R2** | Calendar *view* ships R1; external *sync* deferred |

### 4.3 15 Net-New Features (ClickUp Gap)

| ID | Feature | Release | New Infrastructure Required |
|----|---------|---------|---------------------------|
| F-089 | Task Checklists | R0 | `task_checklists`, `checklist_items` tables |
| F-090 | Recurring Tasks | R1 | `recurring_task_configs` table, `recurrence-scheduler` consumer |
| F-091 | Calendar View | R1 | Views module, calendar wireframe |
| F-092 | Table View | R1 | Views module, spreadsheet wireframe |
| F-093 | @Mentions | R0 | `mentions` table, mention events |
| F-094 | Custom Fields | R1 | `custom_field_definitions`, `custom_field_values` tables (EAV) |
| F-095 | Goals & OKRs | R2 | `goals`, `key_results`, `goal_task_links` tables, `pm.goals` stream |
| F-096 | Smart Notifications | R1 | `notifications`, `notification_preferences` tables, `pm.notifications` stream, `notification-generator` consumer |
| F-097 | Action Items | R1 | Extension of comments + What's Next feed |
| F-098 | Custom Automations | R2 | `automation_rules`, `automation_actions`, `automation_logs` tables, `pm.automations` stream, `automation-engine` consumer |
| F-099 | Form View / Intake | R2 | `forms`, `form_fields`, `form_submissions` tables, `pm.forms` stream |
| F-100 | Formula Fields | R2 | Extension of custom fields system |
| F-101 | Docs & KB | R2 | `documents`, `document_versions` tables, `pm.documents` stream, `document-indexer` consumer |
| F-102 | AI Writing Assistant | R2 | New AI capability (10th), Claude Sonnet integration |
| F-103 | Task Reminders | R1 | `reminders` table, `pm.reminders` stream |

---

## 5. Implementation Plan Gaps

### 5.1 Sprint Distribution Updates

| Sprint | Old Features | New Features Added |
|--------|-------------|-------------------|
| R0-2 | F-004→F-008 | **+F-089** (Checklists) |
| R0-6 | F-010, F-013, F-014, F-021, F-022, F-026 | **+F-093** (@Mentions) |
| R1-2 | F-039→F-041 | **+F-094** (Custom Fields) |
| R1-3 | F-042→F-046 | **+F-096** (Notifications), **+F-103** (Reminders) |
| R1-4 | F-047→F-050 | **+F-087** (Kanban), **+F-091** (Calendar View), **+F-092** (Table View) |
| R1-5 | F-051→F-053 | **+F-090** (Recurring), **+F-097** (Action Items), **+F-076a** (Templates) |
| R2-2 | F-060→F-062 | **+F-095** (Goals), **+F-088** (Gantt) |
| R2-3 | F-063→F-066 | **+F-098** (Automations), **+F-099** (Forms) |
| R2-4 | F-067→F-069 | **+F-100** (Computed Fields), **+F-101** (Docs) |
| R2-5 | F-070→F-073 | **+F-102** (AI Writing), **+F-048** (Bulk Import), **+F-038** (Calendar Integration) |

### 5.2 New Infrastructure to Build

| Item | Sprint | Effort Estimate |
|------|--------|----------------|
| 14 new DDL tables | R0-2 through R2-3 | ~40h total |
| 6 new NATS streams | R1-3 through R2-3 | ~16h total |
| 3 new consumers | R1-3 through R2-3 | ~24h total |
| 6 new API modules (~50 endpoints) | R1-2 through R2-4 | ~120h total |
| 1 new AI capability (Writing Assistant) | R2-4 | ~20h |
| 7 new wireframe implementations | R1-4 through R2-4 | ~80h total |

---

## 6. Cross-Reference & Consistency Gaps Fixed

### 6.1 Numbers Now Consistent Across All Docs

| Metric | All Documents Agree |
|--------|-------------------|
| Total features | **103** (88 original + 15 new) |
| R0 features | **28** (F-001→F-026 + F-089, F-093) |
| R1 features | **36** |
| R2 features | **27** |
| R3 features | **13** (including F-076 AI-enhanced) |
| Post-12mo features | **9** (F-104→F-112) |
| Database tables | **30** |
| NATS streams | **12** |
| Durable consumers | **11** |
| API endpoints | **~85** |
| AI capabilities | **10** |
| Application modules | **14** |
| ADRs | **12** (unchanged) |

### 6.2 Cross-Reference Scheme

All documents now use the unified scheme:
- **FR-xxx** → requirements.md
- **F-xxx** → roadmap-v2.md
- **ADR-xxx** → architecture-v3.1.md / design.md
- **NFR-xxx** → requirements.md

### 6.3 Document Ecosystem

```
roadmap-v2.md (WHAT)
    ↓ features
requirements.md (WHY + ACCEPTANCE CRITERIA)
    ↓ FR-xxx references
architecture-v3.1.md (HOW — system level)
    ↓ tier/module mapping
design.md (HOW — implementation level)
    ↓ API/schema specs
ui-ux-design.md (HOW — frontend level) ← NEW
    ↓ wireframes + tokens
implementation-plan.md (WHEN)
    ↓ sprint schedule
```

---

## 7. Risk & Impact Assessment

### 7.1 High Impact Gaps (were blocking, now resolved)

| Gap | Risk Level | Resolution |
|-----|-----------|------------|
| **No UI/UX spec** | CRITICAL — frontend team cannot start | `ui-ux-design.md` with 21 wireframes, design tokens, component architecture |
| **No Mermaid diagrams** | HIGH — architecture not visually communicable | 12 diagrams in architecture-v3.1.md + 6 in ui-ux-design.md |
| **No notification architecture** | HIGH — table-stakes feature had no design | Full notification pipeline subsystem in architecture + DDL + API |
| **No custom fields pattern** | HIGH — consultancy-critical feature undesigned | Polymorphic EAV pattern documented in design.md |
| **No automation engine** | MEDIUM — power-user feature undesigned | Rule evaluation pipeline with trigger/condition/action |

### 7.2 Remaining Gaps (to address in next iteration)

| Gap | Priority | Recommendation |
|-----|----------|----------------|
| No Figma/design tool mockups | MEDIUM | Use ASCII wireframes as spec; create Figma in Sprint R0-5 |
| No API OpenAPI spec file | LOW | Generate from TypeBox schemas during R0-2 |
| No load testing plan | LOW | Define in R1 quality gate |
| No data migration strategy (Jira→PM tool) | LOW | Design in R2 when F-073 is scheduled |
| No i18n/l10n plan | LOW | English-only for year 1; plan in R3 |
| No mobile app design | LOW | Slack bot is mobile interface for year 1 |

---

## 8. Summary

### What Changed (Quantitative)

| Dimension | Before (v1.0/v3.0) | After (v1.1/v3.1) | Change |
|-----------|--------------------|--------------------|--------|
| Total document lines | ~8,718 | 12,111 | **+39%** |
| Mermaid diagrams | 0 | 18 | **+18** |
| ASCII wireframes | 0 | 21 | **+21** |
| Application modules | 8 | 14 | **+75%** |
| NATS streams | 6 | 12 | **+100%** |
| Consumers | 8 | 11 | **+38%** |
| Database tables | ~16 | 30 | **+88%** |
| API endpoints | ~35 | ~85 | **+143%** |
| AI capabilities | 9 | 10 | **+11%** |
| Design documents | 5 | 7 | **+2 new** |

### What Changed (Qualitative)

1. **Frontend team can now start** — ui-ux-design.md provides everything needed
2. **Architecture is visual** — 18 Mermaid diagrams replace wall-of-text
3. **ClickUp gap features are fully designed** — not just listed in roadmap, but with DDL, API, events, and wireframes
4. **Cross-references are consistent** — all 7 documents use the same FR/F/ADR/NFR scheme
5. **No architectural changes needed** — the evergreen principle (ADR #7) proved correct; all 15 gap features absorbed into existing tiers without structural changes
