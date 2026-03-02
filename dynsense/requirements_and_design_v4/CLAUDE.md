# CLAUDE.md — Coding Standards & AI Governance

**Environment:** Node.js 20+ | macOS (dev) | Deploy: Vercel | Package Manager: pnpm 9.15.4 | Monorepo: Turborepo

**Golden Principle:** "Always code as if someone else—who knows where you live—will maintain your code."

---

## PROJECT CONTEXT

### Header
- **Project:** DynsenseAI v0.1.0
- **Framework:** Next.js 15.1 (App Router) + TypeScript 5.7 strict
- **API:** Fastify + Drizzle ORM
- **Runtime:** Node.js 20+
- **Database:** PostgreSQL 16 (pgvector) + Redis 7 + NATS 2.10 (all Docker)

### Overview
AI-native project management platform for consultancy firms. Features task management with subtasks, Kanban/Gantt/calendar views, AI agents (7 subagents with orchestrator), MCP servers, RBAC (4 roles), multi-tenant workspaces, and full audit logging.

### Architecture
```
dynsense/implementation_version4/
├── apps/
│   ├── api/              # Fastify REST API (29 route files)
│   └── web/              # Next.js 15 frontend (~27 pages)
├── packages/
│   ├── db/               # Drizzle ORM schema (33 tables) + migrations + seed
│   ├── shared/           # Zod schemas, shared types
│   ├── agents/           # AI orchestrator, 7 subagents, 8 hooks
│   └── mcp/              # 3 MCP servers (pm-db, pm-nats, pgvector)
├── .env                  # Environment config (Zod-validated)
├── turbo.json            # Monorepo build config
└── docker-compose.yml    # PostgreSQL, Redis, NATS
```

### Key Commands
```bash
pnpm dev          # Start API (port 3001) + Web (port 3000)
pnpm build        # Production build all packages
pnpm typecheck    # TypeScript strict checking
pnpm lint         # ESLint across all packages
pnpm db:migrate   # Run Drizzle migrations
pnpm db:seed      # Seed demo data (5 users, 3 projects, 45+ tasks)
```

### Auth
Custom JWT auth (RS256 key pair, access token 1h + refresh token 30d) with bcrypt. 4 RBAC roles: `site_admin`, `pm`, `developer`, `client`. Multi-workspace support with workspace switching.

### Dev Setup (Prerequisites)
Docker must be running before `pnpm dev`. Three containers required:
```bash
docker compose up -d   # Starts PostgreSQL (5432), Redis (6379), NATS (4222/8222)
pnpm db:migrate        # Apply schema
pnpm db:seed           # Seed demo data
pnpm dev               # Start API + Web
```
Environment variables defined in `.env` (validated by Zod at startup). JWT requires RS256 key pair — see `.env.example` for generation command.

### Error Handling Pattern
- **API:** Custom `AppError` class with factory methods: `.badRequest()`, `.unauthorized()`, `.forbidden()`, `.notFound()`, `.conflict()`. Global error handler middleware in Fastify.
- **Frontend:** Custom `ApiError` class (status + message + code). Auto-refresh on 401 via `ApiClient`.

### Frontend API Client
Custom `ApiClient` class in `apps/web/src/lib/api.ts`:
- Token management via localStorage (access + refresh)
- Auto-refresh on 401 responses (transparent retry)
- All methods return typed responses
- Singleton export: `export const api = new ApiClient()`

### State Management
Component-level `useState` / `useCallback` — no external state library (no Redux, Zustand, etc.). API calls made directly from components via the `api` client.

### Additional Frontend Libraries
- **Recharts** — dashboard pie charts, bar charts, activity graphs
- **Tailwind CSS** — all styling (no CSS modules, no styled-components)

### Testing Status
No test suite configured yet. Package scripts have placeholder: `echo 'no tests yet'`. Testing standards in this document (Section 14) apply when tests are added.

---

## 1. Context Management (MANDATORY)

**1.1 Project Context:** BEFORE ANY CODE: Verify complete context loaded (README.md, requirements.txt/package.json, architecture docs) | Reject if incomplete/stale | Validate scope boundaries | Auto-refresh on file changes

**1.2 Required Context:** README.md with objectives | Dependencies file | Architecture docs (ARCHITECTURE.md) | Environment setup (.env.example)

**1.3 Scope:** ALLOW: `./src/**`, `./lib/**`, `./tests/**`, `./docs/**`, `./scripts/**` | FORBID: `./node_modules/**`, `./.env`, `./secrets/**`, `./.git/**`

---

## 2. Prompt Structure (NON-NEGOTIABLE)

**2.1 Required Format:** CONTEXT (what you're working on) | GOAL (what to achieve) | CONSTRAINTS (limitations/requirements) | EXPECTED OUTPUT (format/deliverables)

**2.2 Reject:** Vague requests ("make better", "fix this") | Missing context/constraints | Unclear expectations

**Example:**
```
CONTEXT: DynsenseAI task management platform, Fastify API + Drizzle + PostgreSQL
GOAL: Client-visible comment filtering (FR-129)
CONSTRAINTS: RBAC enforcement, client role sees only clientVisible=true comments
OUTPUT: API filter logic + frontend toggle + role-based rendering
```

---

## 3. Tech Stack & UI/UX Standards

### 3.1 Framework Compliance
- **Framework:** Next.js 14+ App Router + TypeScript ONLY | Validate package.json + tsconfig.json | Reject non-compliant with migration guidance
- **TypeScript Strict:** NO .js files | Strict mode required | Auto-convert JS to typed TS

### 3.2 DynsenseAI Stack
| Service | Package |
|---------|---------|
| Auth | Custom JWT (bcrypt + access/refresh tokens) |
| Database | PostgreSQL 16 + Drizzle ORM |
| Vector DB | pgvector (cosine similarity + pg_trgm) |
| Cache | Redis 7 (via Docker) |
| Messaging | NATS 2.10 (JetStream, 12 streams) |
| API | Fastify (apps/api) |
| Frontend | Next.js 15 App Router (apps/web) |
| AI | Claude API (Anthropic SDK) |
| MCP | 3 custom servers (pm-db, pm-nats, pgvector) |
| Deploy | Vercel (web) + Docker (API) |

**Verification:** Ensure Drizzle schema matches DB | Validate .env with Zod | Docker containers running (postgres, redis, nats) | pnpm typecheck passes

### 3.3 UI/UX Core Standards
- **Self-Evidence:** All UI immediately understandable | Conventional patterns over novel
- **System Status:** Every async op needs loading/empty/error states | Auto-generate missing state components
- **Recognition:** Primary actions visible, not hidden in menus/gestures
- **Consistency:** Shadcn UI + Tailwind tokens exclusively | Block hardcoded styles
- **Error Prevention:** Prevention BEFORE messaging | Prioritize inline validation

---

## 4. Agent Platform UI/UX (MANDATORY)

### Typography & Sizing
| Element | Specification |
|---------|--------------|
| Baseline | Inter font, `text-xs`, `font-normal` |
| Headers | May use `font-bold`, must remain `text-xs` |
| Navigation | `text-xs font-normal` (no bold) |
| Icons | 16×16px max, Lucide React |
| Dashboard | Match menu typography |

### Menu System
| Aspect | Rule |
|--------|------|
| Default State | All sections collapsed (`expandedSections: []`) |
| Selection | Selected: `text-black dark:text-white` | Unselected: `text-gray-500` |
| Spacing | `py-1` to `py-1.5` max | `space-y-0.5` sections |
| Content | Essential labels only, no descriptions/explanations |
| Animation | 300ms spring with staggered reveals, 60fps |
| Hover | `text-gray-700 dark:text-gray-300` transition |
| Headers | Same `text-xs`, chevron indicators, full-area click targets |
| Nesting | `ml-4`/`ml-6` indent, max 3 levels |
| Search | `text-xs`, real-time filter, Cmd/Ctrl+K shortcut |
| Scroll | Smooth scroll, visible scrollbar on hover, sticky headers |
| State | Persist expanded/collapsed in localStorage |
| Loading | Skeleton loaders, progressive loading, error retry |
| Actions | Distinct visual treatment, confirmation for destructive |
| Breadcrumbs | Reflect menu selection, `text-xs`, interactive |

### Responsive Menu
- **Desktop:** Collapsed icon-only, expands on hover/click
- **Mobile:** Hamburger → full-screen slide | Touch spacing `py-2` min | Swipe to dismiss
- **Animation:** 300ms spring | Backdrop blur | Shadow gradients | Active states

### Accessibility
- Full keyboard nav (arrow keys, Enter, Escape)
- ARIA labels with expansion state
- Focus trapping in open menus

---

## 5. Layout & Responsive Design

**5.1 Mobile-First:** Start 320px, scale up | Required breakpoints: 320/375/768/1024/1440px

**5.2 Spacing:** Tailwind tokens only (4px/8px base) | Auto-suggest tokens for custom values

**5.3 Safe Areas:** Handle notches, safe areas, fold screens | Validate CSS safe area properties

---

## 6. Navigation & Wayfinding

**6.1 Patterns:** Clear persistent nav (tabs/sidebar/bottom bar) | Breadcrumbs for hierarchy | Current location indicators

**6.2 IA Limits:** Max 5-7 top-level items | Suggest restructuring when exceeded

**6.3 Exit Strategy:** Every modal/flow has clear exit | Modal dismiss + back button + Escape key

---

## 7. Forms & Input

**7.1 Standards:** React Hook Form + Zod | Top-aligned labels | Progressive disclosure | Logical grouping

**7.2 Field Necessity:** Only necessary data with clear purpose | Flag unnecessary fields | Privacy compliance

**7.3 Validation:** Inline with actionable errors | Input masks/constraints guide correct format | Prevention over post-submission

### Input Fields
- Clear labels (not just placeholders) | Helper text | Real-time validation | Proper input types | Max length indicators

### Buttons
- Action-specific text ("Save Profile" not "Submit") | Loading state | Disable during processing | No layout shift

### Multi-Step Forms
- Progress indicator | Save draft | Back nav without data loss | Clear step titles

---

## 8. Color & Theme

**8.1 Semantic Colors:** Tokens only (primary/secondary/success/error/warning/info) | No hardcoded values

**8.2 Accessibility:** WCAG AA contrast (4.5:1 normal, 3:1 large) | Consider color blindness | Never rely solely on color

**8.3 Theme Completeness:** Full light + dark implementations | Visual parity between modes | Test all components both themes

---

## 9. Motion & Interaction

**9.1 Purposeful:** Motion clarifies state/provides feedback | Block gratuitous animation

**9.2 Reduced Motion:** Respect `prefers-reduced-motion` | Provide equivalent feedback alternatives

**9.3 Optimistic UI:** Implement for perceived performance | Immediate update + clear rollback on failure

---

## 10. Component Standards

**10.1 Shadcn UI:** Exclusive for UI primitives | Custom components extend patterns, don't replace

**10.2 State Completeness:** All components: default/hover/focus/loading/error/disabled

**10.3 Accessibility:** Proper ARIA + keyboard support | Test with screen readers

---

## 11. Mobile-Specific

**11.1 Touch Targets:** Min 44×44pt (iOS) / 48×48dp (Android) | Adequate spacing between adjacent targets

**11.2 Platform Patterns:** iOS swipe-to-delete, Android long-press menus | Respect conventions

**11.3 Performance:** Mobile-specific optimizations | Assume slow 3G + limited processing

---

## 12. Code Development Workflow (STRICT)

**12.1 Planning (>50 LOC):** Architecture diagram | Component responsibilities | Data flow | Tech stack justification | Decision rationale

**12.2 Iterative:** Max 200 lines/phase | Review after each | Map dependencies | Quality gates between phases | Each iteration independently testable

**12.3 Review:** Mandatory checklist: functionality/design/security/performance/maintainability | Document decisions/trade-offs

---

## 13. Architecture & Design (ZERO TOLERANCE)

### 13.1 Required Patterns
- Hexagonal architecture with clear domain boundaries
- Dependency injection for testability
- Repository pattern for data access
- CQRS for read/write operations
- Event-driven communication between bounded contexts

### 13.2 SOLID Principles
| Principle | Validation |
|-----------|-----------|
| Single Responsibility | Each function/class does ONE thing |
| Open/Closed | Open for extension, closed for modification |
| Liskov Substitution | Subtypes substitutable for base types |
| Interface Segregation | No client depends on unused interfaces |
| Dependency Inversion | Depend on abstractions, not concretions |

### 13.3 Design Patterns
**REQUIRE:** Strategy, Factory, Observer, Adapter, Command
**FORBID:** God objects, singleton abuse, tight coupling

---

## 14. Testing (MANDATORY, NO EXCEPTIONS)

### 14.1 Coverage Requirements
- Unit tests for every public method
- Integration tests for external dependencies
- Contract tests for API endpoints
- Performance tests for critical paths
- **Minimum 80% code coverage**

### 14.2 Quality Standards
- AAA pattern (Arrange, Act, Assert)
- Descriptive test names
- Edge cases + error conditions
- Test fixtures + mock data
- Positive + negative cases

### 14.3 TDD Enforcement
When requested: Tests BEFORE implementation | Tests fail initially | Minimal code to pass | Refactor keeping green | BLOCK until testing requirements met

---

## 15. Code Quality Gates (AUTOMATED)

**Pre-Generation:** Requirements completeness | Coding standards | Security requirements | Architecture compliance

**Post-Generation:** Static analysis | Security scanning | Performance assessment | Documentation completeness | Test coverage

### Quality Dimensions
| Dimension | Checks |
|-----------|--------|
| Functionality | Requirements met, edge cases, error handling |
| Design | SOLID, modularity, abstractions |
| Security | Input validation, secrets management, auth checks |
| Performance | No bottlenecks, optimized DB access, resource management |
| Maintainability | Self-documenting, helpful comments, team comprehensibility |

---

## 16. Security Framework (STRICT, NO COMPROMISES)

### 16.1 Vulnerability Prevention
- OWASP Top 10 prevention
- Input validation/sanitization for ALL user inputs
- Parameterized queries (SQL injection)
- Output encoding (XSS)
- Secret detection/removal

### 16.2 Data Protection
- NO hardcoded secrets/passwords/API keys
- Encrypt at rest + in transit
- Log sensitive data access
- Data retention policies
- GDPR compliance for PII

### 16.3 Auth & Authorization
- Proper authentication patterns
- Authorization checks for all protected resources
- Secure session management
- Default to most restrictive permissions

### 16.4 Pattern Enforcement
**REQUIRE:** Parameterized queries, input sanitization, error handling, auth checks
**FORBID:** Hardcoded secrets, direct SQL, unvalidated input, exposed sensitive data

---

## 17. Documentation Standards

### 17.1 Interface Documentation
- Module-level docstrings (purpose + usage)
- Function docstrings (params, returns, exceptions)
- Type annotations (all params + returns)
- Usage examples
- Error handling docs

### 17.2 Quality
- Clear, concise, team-accessible
- Include what AND why
- Update README for new setup
- Maintain API docs
- Migration guides for breaking changes

---

## 18. Debugging & Troubleshooting

### 18.1 Problem Description Required
- Current behavior | Expected behavior | Complete error messages | Relevant code | Environment | Recent changes

### 18.2 Systematic Approach
- Root cause analysis | Step-by-step methodology | Multiple fixes with pros/cons | Prevention strategies | Document findings

### 18.3 Performance Issues
- Current metrics (numbers) | Target performance | Profiling data | Analysis: algorithm efficiency, DB queries, memory, caching | Measure first, optimize second

---

## 19. AI-Specific Governance

**19.1 Prompt Injection Defense:** Sanitize all inputs | Scan for unsafe instructions | Filter high-risk patterns | Automated blocking + escalation

**19.2 Model Versioning:** Every suggestion includes metadata | Hidden tags: `@ai-gen: model=vX.Y, date` | Traceability without clutter

**19.3 Explainability:** Human-readable rationale for decisions | Concise "why" notes | Auditability

**19.4 Context-Aware Generation:** Full project context before generation | Component library + design system awareness | Pattern consistency

---

## 20. Collaboration & Workflow

**20.1 Standards Sync:** Align with ESLint/Prettier | Validate before generation | Auto-format

**20.2 VCS Integration:** Comply with repo workflows | Verify branch naming, PR requirements, commit messages | Block merges without tests/docs

**20.3 Code Review:** Flag AI-generated code | "AI-generated" labels in diffs

---

## 21. DevOps & CI/CD

**21.1 Pipeline:** All code passes CI/CD gates (lint/test/security) | Run simulations | Block unsafe merges

**21.2 Secrets:** Vault/AWS KMS/GCP Secret Manager | Scan improper usage | Suggest secure stubs

**21.3 Observability:** Structured logging, metrics, tracing | Validate framework usage, telemetry points

---

## 22. Data & API Governance

**22.1 Contracts:** Schema compliance (OpenAPI, GraphQL SDL) | Compare against existing | Allow experimental w/"draft" tag

**22.2 Rate Limiting:** Include in API endpoints | Validate throttling middleware | Suggest defaults

**22.3 Compliance:** Align with GDPR/HIPAA/PCI-DSS | Validate storage/handling | Suggest compliant alternatives

---

## 23. Advanced Techniques

**23.1 Refactoring:** Comprehensive strategy + phased approach | Risk assessment | Rollback plan | Testing strategy | Migration guide

**23.2 Code Generation:** Follow project patterns | Comprehensive error handling | Monitoring/logging | Generate test suites | Pattern consistency

**23.3 Technology Migration:** Detailed strategy + timeline | Compatibility layer | Data migration | Risk mitigation | Rollback procedures

**23.4 Progressive Enhancement:** Graceful degradation | Accessibility | Performance | Error boundaries | Baseline functionality first

**23.5 Integration Testing:** Seamless integration | TypeScript compatibility | Prop interface consistency | Styling integration | Components feel native

---

## 24. Governance & Compliance

**24.1 Auditability:** Log ALL AI outputs | Track who accepted/modified + when | Preserve privacy

**24.2 Separation of Duties:** AI CANNOT approve own code | Human reviewer required for merges

**24.3 Regulatory Mapping:** Map to ISO 27001, SOC 2 | Generate compliance checklists

---

## 25. Override & Emergency Controls

**25.1 Human Override:** Humans override any rule w/justification | Explicit approval for security overrides | Audit trail | Flag repeated violations

**25.2 Emergency Procedures:** Immediate stop capability | Preserve safe state | Clear escalation paths | Auto-escalate security violations

**25.3 Escalation Triggers:** Security-critical changes | Architectural mods | Performance-critical paths | Repeated violations | Unusual patterns

**25.4 Design System:** Changes require approval + documentation | Token modification tracking | Pattern deviation analysis

**25.5 Emergency UX:** Critical accessibility/usability issues override normal flows | Severity assessment

**25.6 Performance Emergency:** Degradation triggers immediate optimization | Metric monitoring | Threshold validation

---

## 26. Monitoring & Compliance

**26.1 Real-Time:** Track rule compliance, quality trends | Security violations (immediate alert) | Regular compliance reports

**26.2 Metrics:** Code quality scores | Test coverage | Security violations | Documentation completeness | Architecture compliance

**26.3 Continuous Improvement:** Feedback on effectiveness | Analyze patterns | Suggest optimizations | Adapt rules

**26.4 QA Gates:** Pre: Validate requirements | Post: Test compliance | Continuous: Learn from patterns

---

## 27. Command-Specific

| Command | Requirements |
|---------|-------------|
| Add-Context | File completeness/scope, architecture docs, context freshness |
| Implement | Comprehensive testing, security scanning, quality gates, docs |
| Review | Complete checklist, specific recommendations, governance validation, approval |
| Refactor | Strategy, risk assessment, backward compatibility, improvement benefits |

---

## 28. Enforcement Priorities

| Level | Actions |
|-------|---------|
| **CRITICAL (BLOCK)** | Security vulnerabilities, missing tests, incomplete context, architecture violations |
| **HIGH (WARN)** | Documentation gaps, performance concerns, pattern misuse, code quality issues |
| **ADVISORY (SUGGEST)** | Style consistency, optimizations, alternatives, best practices |

---

## 29. Implementation Phases

| Phase | Focus |
|-------|-------|
| 1 | Tech stack, component accessibility, design tokens, responsive validation |
| 2 | Form UX, navigation patterns, performance validation, security |
| 3 | Content quality, motion validation, progressive enhancement, cross-platform |
| 4 | AI-powered UX suggestions, predictive accessibility, performance automation, design evolution |

---

## 30. Legacy Typography

**30.1 Rules:** Tokenized scale, proper hierarchy | Font size/line height/spacing tokens

**30.2 Content:** Clear, scannable, jargon-free | Readability analysis | Plain language

**30.3 Performance:** System fonts w/fallbacks | `font-display: swap` | Optimize delivery

---

## 31. Security & Privacy (Extended)

**31.1 Data Minimization:** Minimize collection | Explicit consent | PII analysis | Consent mechanisms

**31.2 Secure Implementation:** Secure auth/data handling | Vulnerability assessment | Secure defaults

---

## 32. AI Agent Building Rules

### 32.1 Core Principles
All workflows: receive → plan → act → evaluate → iterate | Secure tool access | Action logging | Human-in-the-loop | Comprehensive monitoring

### 32.2 Tech Stack
- Claude (Opus/Sonnet/Claude Code) via API/desktop
- Python for workflow logic + backend agent management
- TypeScript/React/Next.js for UIs
- Claude Code's multi-agent management

### 32.3 Agent Architecture
Control loop: Input → Plan/Reason → Tool Call(s) → Reflect → Repeat/Output
- Lead orchestrator decomposes tasks, distributes to subagents, synthesizes
- Log every step, tool call, reasoning trace, error

### 32.4 Tool Design
- Document I/O with model-readable schemas
- Sandbox system commands (Docker/Xvfb)
- Favor atomic, reversible actions
- Model-readable guides + error messages

### 32.5 Safety & Evaluation
- Limits on iterations, resources, tool access
- Critical/irreversible actions pause for human review
- Persist all logs with timestamps
- Subagents for code review/validation

### 32.6 Agent UX
- IDE panes for logs, feedback, tool state, manual overrides
- Agent-friendly codebase
- Full documentation for models, agents, users

### 32.7 Memory Layer
- Vector DBs (Pinecone) for context retention + semantic search
- Memory scope management
- Logged + auditable updates

### 32.8 Integration Standards
- RESTful APIs, Computer Use, model-readable schemas
- Backward compatibility
- Migration paths for legacy

### 32.9 Evaluator Agents
- Subagents for review, validation, auditing
- Confidence thresholds
- Feedback loops for improvement

### 32.10 Project Structure
- Separate orchestrator logic, tool implementations, agent prompts
- Version control configs + prompts
- Document capabilities + limitations

---

## 33. UI Implementation Details

### Loading States
- Skeleton screens for content
- Spinners for actions <3s
- Progress bars for longer ops
- Informative messages >5s

### Empty States
- Clear explanation why empty
- Actionable next steps
- Helpful illustration/icon
- Consistent design language

### Error States
- What went wrong (user terms)
- Why (if known)
- How to fix (actionable)
- Fallback/retry options

---

## 34. Data Tables

### Responsiveness
- Cards on mobile | Horizontal scroll w/fixed columns | Column visibility toggles | Row actions accessible

### Features
- Sorting by relevant columns
- Filtering with clear controls
- Pagination or infinite scroll
- Bulk actions where appropriate
- Export functionality

---

## 35. Modals & Dialogs

### Modal Behavior
- Dim background overlay | Close on Escape | Close on background click (unless destructive) | Return focus to trigger | Prevent background scroll

### Dialog Content
- Clear title | Concise body | Explicit action buttons | Cancel always available | Loading states for async

---

## 36. Navigation Implementation

### Tabs
- Clear active indicator | Keyboard nav (arrows) | URL state when appropriate | Lazy load | ARIA labels

### Sidebars
- Consistent width | Collapse/expand | Clear current location | Group related | Search for long lists

### Bottom Nav (Mobile)
- 3-5 items max | Labels with icons | Current section indicator | Hide on scroll down/show up | Safe area spacing

---

## 37. Performance Rules

### Image Optimization
- Appropriate formats (WebP, AVIF)
- Lazy loading
- width/height attributes
- Responsive srcsets
- Blur-up placeholders

### Bundle Limits
- Initial bundle <200KB
- Lazy load routes/components
- Tree-shake unused code
- Bundle analyzer monitoring
- Code-split at route boundaries

### Performance Budgets
| Metric | Target |
|--------|--------|
| First Contentful Paint | <1.5s |
| Time to Interactive | <3s |
| Cumulative Layout Shift | <0.1 |
| First Input Delay | <100ms |
| Performance Score | >90 |

---

## Quick Reference

### Enforcement
```
BLOCK: Security vulns | Missing tests | Incomplete context | Arch violations
WARN:  Doc gaps | Perf concerns | Pattern misuse | Quality issues
SUGGEST: Style | Optimizations | Alternatives | Best practices
```S

### Stack
```
Frontend: Next.js 15 App Router + TypeScript strict
UI: Tailwind CSS + custom components
API: Fastify + Drizzle ORM
Database: PostgreSQL 16 (pgvector) + Redis 7 + NATS 2.10
Auth: Custom JWT (bcrypt, access/refresh tokens, 4 RBAC roles)
AI: Claude API + 7 subagents + orchestrator + 8 hooks + 3 MCP servers
Monorepo: Turborepo + pnpm workspaces
Validation: Zod schemas (shared package)
```

### UI Specs
```
Typography: Inter, text-xs, font-normal baseline
Menu spacing: py-1 to py-1.5, space-y-0.5
Animation: 300ms spring, 60fps
Touch targets: 44×44pt iOS, 48×48dp Android
Contrast: 4.5:1 normal, 3:1 large (WCAG AA)
```
