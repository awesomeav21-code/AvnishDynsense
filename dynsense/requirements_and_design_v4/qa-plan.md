# Dynsense — QA Plan

**Version:** 4.0
**Date:** February 18, 2026
**Status:** Draft for Review
**Methodology:** Produced using swarm parallel agent research (3 concurrent agents)

---

## 1. QA Strategy Overview

### 1.1 Philosophy

Quality assurance for Dynsense must cover three distinct dimensions:
1. **Traditional PM features** — CRUD operations, workflows, permissions, UI
2. **AI capabilities** — Non-deterministic outputs, confidence scoring, safety guardrails
3. **Multi-tenancy** — Data isolation, cross-tenant security, per-tenant configuration

### 1.2 Testing Pyramid

```
          /  E2E Tests  \           ~10% — Playwright, full user flows
         / Integration    \         ~30% — Vitest, API + DB + NATS
        /   Unit Tests      \       ~60% — Vitest, isolated logic
```

### 1.3 Coverage Targets

| Area | Target | Measurement |
|------|--------|-------------|
| Backend (API + services) | 80%+ line coverage | Vitest coverage report |
| Agent SDK (orchestrator, hooks, MCP) | 80%+ line coverage | Vitest coverage report |
| Frontend components | 70%+ | Vitest + React Testing Library |
| E2E critical paths | 100% of happy paths | Playwright test count |
| AI capabilities | Golden test sets per capability | Custom eval harness |

### 1.4 Tools

| Tool | Purpose |
|------|---------|
| Vitest 3.0 | Unit + integration tests |
| Playwright | E2E browser tests |
| React Testing Library | Component tests |
| Custom AI Evaluation Harness | Golden test sets, acceptance/override tracking |
| k6 / Artillery | Load and performance testing |
| OWASP ZAP | Security scanning |
| Sentry | Runtime error monitoring |

---

## 2. Test Categories

### 2.1 Unit Tests

**Scope:** Individual functions, services, utilities in isolation.

#### Backend API Tests

| Module | Test Cases | Key Scenarios |
|--------|-----------|---------------|
| **auth.service** | 15+ | Register (duplicate email, weak password), login (wrong password, locked account), refresh token rotation, logout (invalidate all sessions), JWT verification |
| **task.service** | 20+ | Create with all fields, status transitions (valid/invalid), assignment (add/remove), sub-task create/promote/demote, effort tracking, filtering combinations |
| **dependency.service** | 10+ | Add dependency, circular detection (BFS), auto-unblock on resolution, cascade effects |
| **checklist.service** | 8+ | Create group, add items, toggle completion, percentage calculation accuracy |
| **comment.service** | 8+ | Create, @mention parsing (UUID extraction), client_visible filtering |
| **project.service** | 10+ | CRUD, phase management, WBS baseline storage/retrieval, soft delete |
| **audit.service** | 6+ | Field-level diff generation, actor type tracking, query filtering |
| **config.service** | 4+ | Upsert, tenant scoping, cache invalidation |
| **user.service** | 6+ | List, update role (no self-elevation), sanitized output (no passwordHash) |
| **ai.service** | 12+ | Execute capability, list/get actions, approve/reject, policy CRUD |

#### Agent SDK Tests

| Component | Test Cases | Key Scenarios |
|-----------|-----------|---------------|
| **Autonomy Policy** | 10+ | Shadow/propose/execute modes, quiet hours (midnight-wrapping), nudge limits, capability overrides, default fallback |
| **Permission Chain** | 10+ | 4-step evaluation, acceptEdits allows mutations, default denies mutations, bypassPermissions, disabled capability, restricted tools |
| **Context Assembler** | 8+ | RAG retrieval, token budget enforcement (truncation at 60%), domain-specific prompts, enriched prompt format |
| **Session Service** | 8+ | Create, resume (expired check), fork (parent linking), list (filtered/paginated), expire stale (batch) |
| **Agent Registry** | 6+ | Lookup by capability, override application, tool resolution, unknown capability error |

#### Frontend Tests

| Component | Test Cases | Key Scenarios |
|-----------|-----------|---------------|
| **Auth forms** | 6+ | Login validation, register validation, error display, loading states |
| **Task detail** | 10+ | Render all fields, edit mode, status transition UI, dependency display |
| **AI Review panel** | 8+ | Proposal list rendering, confidence badge colors, approve/reject actions, bulk selection |
| **NL Query panel** | 6+ | Input handling, streaming display, suggested queries, error states |
| **Navigation** | 4+ | Role-based items, active route, collapse/expand, mobile responsive |

### 2.2 Integration Tests

**Scope:** Multiple components working together — API routes + services + database + hooks.

#### API Integration Tests

| Flow | Steps | Assertions |
|------|-------|-----------|
| **Auth full cycle** | Register → login → refresh → me → logout | Tokens valid, refresh rotates, logout invalidates |
| **Task lifecycle** | Create → assign → update status → complete | All transitions valid, audit trail generated, events emitted |
| **Dependency chain** | Create 3 tasks → add deps → resolve first → check unblock | Auto-unblock works, circular rejection works |
| **Sub-task flow** | Create parent → create sub-task → promote to task | Parent progress rollup, promote removes parentTaskId |
| **Checklist flow** | Create group → add 3 items → toggle 2 → check percentage | 66% completion calculated |
| **Comment + mentions** | Create comment with @userId → verify mention stored → verify notification | UUID parsed, mention record created |
| **AI execute flow** | POST /ai/execute (wbs-generator) → verify ai_action created → verify hooks logged | Action in DB, cost tracked, session created |
| **AI approve flow** | Execute (propose mode) → approve → verify status change | Status transitions correctly, reviewer recorded |
| **AI reject flow** | Execute (propose mode) → reject with notes → verify | Status = rejected, notes stored |
| **Autonomy policy** | Update policy → execute capability → verify disposition | Shadow logs only, propose creates proposal, execute applies |

#### Hook Chain Integration Tests (Existing — 37 tests)

| Suite | Tests | Coverage |
|-------|-------|---------|
| PreToolUse chain | 7 | Allow reads, deny mutations (propose), deny cross-tenant, shadow marking, rate limiting, modified args propagation, decision logging |
| PostToolUse chain | 6 | Parallel execution, notification only on mutations, cost calculation, skip without usage, non-blocking failures |
| Stop chain | 3 | Session persistence, paused status on error, no session handling |
| Hook chain factory | 1 | Correct hook counts per phase |
| Agent tool resolution | 3 | nl-query tools, wbs-generator tools, summary-writer tools |
| Permission chain | 7 | acceptEdits, default deny, default allow reads, hook deny shortcircuit, disabled capability, restricted tools, bypass |
| End-to-end flow | 8 | nl-query read, wbs mutation blocked, wbs mutation allowed, capability overrides, pgvector, pm-nats, cost limits, multi-agent isolation |

#### Database Integration Tests

| Test | Assertion |
|------|----------|
| Tenant isolation | Query with tenant_id A returns zero rows from tenant B |
| Foreign key constraints | Delete project cascades phases, tasks reference valid projects |
| Unique constraints | Duplicate email rejected, duplicate dependency rejected |
| Soft delete | Deleted records excluded from default queries, recoverable |
| Audit immutability | UPDATE/DELETE on audit_log fails (if RLS or trigger enforced) |

### 2.3 AI-Specific Tests

#### Golden Test Sets (Per Capability)

Each AI capability has a set of curated inputs with expected output criteria:

| Capability | Test Count | Input | Expected Output Criteria |
|------------|-----------|-------|------------------------|
| **WBS Generator** | 10+ | NL project descriptions (3 domains) | Valid JSON schema, reasonable phase count (3-7), task count (10-50), no hallucinated fields, confidence >0.6 |
| **What's Next** | 10+ | Task sets with varying deps/priorities/dates | Correct priority ordering, blocked tasks excluded, overdue surfaced first |
| **NL Query** | 15+ | Natural language questions ("what's blocked?", "who's overdue?") | Accurate data retrieval, relevant response, no hallucination of nonexistent tasks |
| **Summary Writer** | 8+ | Project state snapshots (daily/weekly) | Correct task counts, key events included, narrative coherent, <500 words |

#### AI Quality Metrics (Tracked Continuously)

| Metric | Alert Threshold | Measurement |
|--------|----------------|-------------|
| **Acceptance rate** | <60% triggers review | approved / (approved + rejected) per capability |
| **Override rate** | >40% triggers recalibration | edited before approve / total approved |
| **Hallucination incidents** | Any occurrence | Manual review + automated schema validation |
| **Validation pass rate** | <90% triggers prompt review | Post-processing schema validation success |
| **Confidence distribution** | Mean <0.6 triggers review | Average confidence per capability per week |
| **Latency (WBS p95)** | >30s | CloudWatch metric |
| **Latency (NL Query p95)** | >8s | CloudWatch metric |

#### Autonomy Mode Tests

| Scenario | Expected Behavior |
|----------|------------------|
| Shadow mode: WBS generation | ai_action created with status=shadow_logged, no actual task mutations |
| Propose mode: WBS generation | ai_action created with status=proposed, awaits human review |
| Execute mode: summary generation | ai_action created and executed automatically |
| Quiet hours: nudge at 11pm | Nudge blocked, not delivered until morning |
| Nudge limit: 3rd nudge on same task today | Blocked (max 2/task/day) |
| Low confidence: score 0.45 | Routes to human regardless of autonomy mode |
| Cross-tenant: agent queries with wrong tenant_id | Denied by tenant-isolator hook |

#### Rollback Tests

| Scenario | Expected |
|----------|----------|
| Revert WBS: click revert on approved WBS | Pre-action snapshot restored, revert logged as ai_revert actor |
| Revert with no rollback_data | Error message, no state change |
| Revert already-reverted action | Error: action already reverted |

### 2.4 Security Tests

#### Tenant Isolation

| Test | Method | Assertion |
|------|--------|----------|
| API: cross-tenant project access | Auth as tenant A, GET /projects/:tenantB_project_id | 404 (not 403) — no information leakage |
| API: cross-tenant task mutation | Auth as tenant A, PUT /tasks/:tenantB_task_id | 404 |
| DB: RLS enforcement | Direct SQL query without SET tenant_id | Zero rows returned |
| AI: cross-tenant context | Agent assembled context only includes current tenant data | Verify RAG results scoped |
| MCP: tool call injection | Attempt tool call with forged tenant_id in args | Denied by tenant-isolator hook |

#### Authentication

| Test | Expected |
|------|----------|
| Expired access token | 401 Unauthorized |
| Invalid refresh token | 401, no new tokens issued |
| Reused refresh token (rotation) | 401, all sessions invalidated |
| Missing Authorization header | 401 |
| Malformed JWT | 401 |
| Self-role-elevation (developer → admin) | 403 Forbidden |

#### OWASP Top 10

| Vulnerability | Test Method |
|--------------|-------------|
| SQL Injection | Parameterized queries via Drizzle ORM (verify no raw SQL) |
| XSS | React auto-escaping + CSP headers (verify no dangerouslySetInnerHTML) |
| CSRF | SameSite cookies + CORS policy verification |
| Broken auth | Token expiry, rotation, invalidation tests above |
| Security misconfiguration | Helmet headers, no stack traces in production |
| Sensitive data exposure | No passwordHash in API responses, no secrets in logs |
| Prompt injection | Structured fields (not free-text concatenation), output validation |

### 2.5 Performance Tests

#### Load Testing (k6 / Artillery)

| Scenario | Concurrent Users | Duration | Pass Criteria |
|----------|-----------------|----------|---------------|
| API CRUD operations | 50 | 5 min | p95 <500ms, error rate <0.1% |
| Task listing with filters | 100 | 5 min | p95 <500ms, 10K tasks/tenant |
| AI execute (WBS) | 10 | 5 min | p95 <30s |
| AI execute (NL Query) | 20 | 5 min | p95 <8s |
| Mixed workload | 100 | 15 min | No degradation over time |
| Tenant scaling | 100 tenants, 10 users each | 10 min | p95 <500ms, zero cross-tenant |

#### Stress Testing

| Scenario | Expected Behavior |
|----------|------------------|
| API server at max capacity | Graceful 429 responses, no crashes |
| AI rate limit exceeded | Hook denies with clear error, Redis counter accurate |
| Daily AI cost limit hit | All AI requests denied for tenant until next day |
| NATS consumer lag >1000 | CloudWatch alarm fires, no message loss |
| Database connection pool exhausted | Queue requests, no data corruption |

#### Benchmark Targets

| Metric | R0 Target | R2 Target | R3 Target |
|--------|-----------|-----------|-----------|
| API p95 latency | <500ms | <500ms | <500ms |
| WBS generation p95 | <30s | <25s | <20s |
| NL Query p95 | <8s | <6s | <5s |
| Vector search p95 | <100ms | <100ms | <100ms |
| Dashboard load | <2s | <1.5s | <1s |
| Concurrent users | 50 | 500 | 1000 |

### 2.6 End-to-End Tests (Playwright)

#### Critical User Journeys

| Journey | Steps | Release |
|---------|-------|---------|
| **New user onboarding** | Register → login → create project → describe in NL → AI generates WBS → review → approve → view tasks | R0 |
| **Developer daily flow** | Login → dashboard → check What's Next → click task → view details → update status → add comment | R0 |
| **AI review cycle** | Login as admin → AI Review page → view proposal → inspect confidence → approve/reject → verify status | R0 |
| **NL query** | Cmd+K → type "what's blocked?" → verify streaming response → click referenced task | R0 |
| **Task management** | Create task → add dependency → add checklist → assign → transition status → verify audit trail | R0 |
| **Integration flow** | Configure Slack → AI PM agent sends nudge → verify Slack message received | R1 |
| **Client portal** | Login as client → view milestones → ask AI question → verify scoped response | R2 |
| **Billing cycle** | Tenant uses AI features → verify cost tracking → verify budget alerts | R2 |

---

## 3. Test Environments

| Environment | Purpose | Data | AI |
|-------------|---------|------|-----|
| **Local (Docker Compose)** | Developer testing | Seed data | Mock Claude responses |
| **CI (GitHub Actions)** | Automated test suite | Ephemeral DB, clean state | Mock Claude responses |
| **Staging** | Pre-release verification | Production-like seed | Live Claude API (sandbox budget) |
| **Production** | Smoke tests only | Real data | Live Claude API |

### Environment Parity

- All environments use same Docker images
- Same PostgreSQL version (16) with same extensions
- Same NATS JetStream configuration
- Staging mirrors production infrastructure (Multi-AZ, encrypted)

---

## 4. QA Process Per Sprint

### 4.1 During Sprint

```
Day 1-2:   Review requirements, write test cases for sprint features
Day 3-7:   Developers write unit + integration tests alongside code
Day 8:     Integration testing session (API + hooks + MCP)
Day 9:     E2E test additions for new features
Day 10:    Regression run (full suite), bug fixing
```

### 4.2 Test Execution Schedule

| Trigger | Tests Run | Duration |
|---------|-----------|----------|
| Every PR | Unit + lint + type-check | ~3 min |
| PR merge to main | Unit + integration | ~8 min |
| Nightly | Full suite (unit + integration + E2E + security scan) | ~30 min |
| Pre-release | Full suite + performance + AI golden tests | ~2 hours |

### 4.3 Bug Severity Classification

| Severity | Definition | Response Time | Example |
|----------|-----------|---------------|---------|
| **P0 Critical** | Data loss, security breach, complete outage | Fix within 4 hours | Cross-tenant data leak, auth bypass |
| **P1 High** | Major feature broken, no workaround | Fix within 24 hours | AI execute returns 500, task create fails |
| **P2 Medium** | Feature degraded, workaround exists | Fix within sprint | Filter doesn't work, slow query |
| **P3 Low** | Minor UI issue, cosmetic | Next sprint | Alignment issue, typo |

---

## 5. Release QA Gates

### 5.1 R0 Release Gate

| Gate | Criteria | Pass/Fail |
|------|----------|-----------|
| Unit test coverage | 80%+ on backend + agents | |
| Integration tests | All 37+ hook tests + 20+ API flow tests passing | |
| E2E tests | 5 critical journeys automated and passing | |
| AI golden tests | WBS + What's Next + NL Query + Summary all passing | |
| Security scan | Zero high/critical vulnerabilities | |
| Performance | API p95 <500ms, WBS p95 <30s | |
| Tenant isolation | All cross-tenant tests passing | |
| Accessibility | Keyboard navigation on all pages, screen reader basics | |
| Staging soak | Stable for 1 week, no P0/P1 bugs | |

### 5.2 R1 Release Gate

| Gate | Criteria |
|------|----------|
| All R0 gates still passing | Regression green |
| Integration tests for Git + Slack | Webhook receipt, message delivery verified |
| AI PM Agent tests | 15-min loop executing, nudges delivered, quiet hours respected |
| Risk predictor accuracy | >70% on flagged items (manual review) |
| SSO/MFA tests | Login flows for SAML + OIDC + TOTP working |
| Load test | 100 concurrent users, p95 <500ms, no degradation |
| Feature flag tests | All new features gatable per tenant |

### 5.3 R2 Release Gate

| Gate | Criteria |
|------|----------|
| All R0 + R1 gates still passing | Regression green |
| Multi-tenancy isolation | 3 test tenants with zero cross-contamination |
| Client portal E2E | Full client journey automated |
| Billing tests | Metering accurate, alerts fire, billing cycle correct |
| SOC 2 controls | All required controls verified and documented |
| Load test | 100 tenants x 10 users, p95 <500ms |
| AI cost tracking | Per-tenant costs match billing within 1% |

### 5.4 R3 Release Gate

| Gate | Criteria |
|------|----------|
| All previous gates passing | Full regression |
| Per-tenant learning | Measurable accuracy improvement over baseline |
| SOW generation | Produces valid SOW from real project data |
| Scale test | 10 tenants, 100K tasks, no performance degradation |
| SOC 2 Type I evidence | Sustained compliance demonstration |

---

## 6. AI-Specific QA Procedures

### 6.1 Golden Test Maintenance

- Golden test sets reviewed and updated **every sprint**
- New edge cases added when bugs found
- Domain coverage expanded as new templates added
- Minimum 10 tests per capability, growing over time

### 6.2 AI Regression Detection

**Weekly automated check:**
1. Run all golden tests against staging
2. Compare acceptance rate vs previous week
3. Compare average confidence vs previous week
4. Flag any capability where acceptance dropped >10% or confidence dropped >0.1

**Monthly manual review:**
1. Sample 20 random AI actions per capability from production
2. Rate quality: acceptable / needs editing / unacceptable
3. Track trends over time
4. Update golden tests based on findings

### 6.3 Prompt Version Testing

When prompts are updated:
1. Run golden test suite against new prompt version
2. A/B test: route 10% of traffic to new version, compare metrics
3. If acceptance rate >= previous version: promote
4. If acceptance rate drops: rollback, investigate

### 6.4 Model Upgrade Testing

When Anthropic releases new model versions:
1. Run full golden test suite against new model
2. Compare: latency, cost, output quality, confidence scores
3. Test in shadow mode for 1 week before promoting
4. Update MODEL_COST_RATES in constants

---

## 7. Monitoring & Alerting (Production QA)

### 7.1 Health Checks

| Check | Frequency | Alert On |
|-------|-----------|----------|
| API health endpoint | 30s | 3 consecutive failures |
| Database connectivity | 30s | Connection failure |
| Redis connectivity | 30s | Connection failure |
| NATS connectivity | 30s | Connection failure |
| Claude API reachability | 60s | 5 consecutive failures (circuit breaker) |

### 7.2 Quality Alerts

| Alert | Threshold | Action |
|-------|-----------|--------|
| API error rate >1% | 5-min window | Page on-call |
| API p95 >2s | 5-min window | Page on-call |
| AI failure rate >10% | 1-hour window | Alert AI/ML team |
| AI acceptance rate <60% | Daily aggregate | Review prompts |
| NATS consumer lag >1000 | Real-time | Alert DevOps |
| Cost budget >80% for tenant | Daily check | Notify tenant admin |
| Cross-tenant query detected | Any occurrence | P0 incident |

### 7.3 Dashboards

| Dashboard | Metrics |
|-----------|---------|
| API Health | Request rate, latency histograms, error rate, active connections |
| AI Operations | Per-capability: latency, cost, acceptance rate, confidence distribution |
| Tenant Isolation | Cross-tenant query attempts (should be 0), RLS violation attempts |
| Cost Tracking | Per-tenant AI spend, daily/weekly trends, budget utilization |
| Event Bus | NATS stream lag, consumer processing rate, DLQ depth |

---

## 8. Test Data Management

### 8.1 Seed Data

| Entity | Count | Purpose |
|--------|-------|---------|
| Tenants | 3 | Multi-tenant isolation testing |
| Users per tenant | 5 (1 admin, 1 pm, 2 dev, 1 client) | Role-based testing |
| Projects per tenant | 3 | Cross-project features |
| Tasks per project | 20-50 | Realistic workload |
| Dependencies | 10-15 per project | DAG testing |
| Comments | 5-10 per task | Activity feed testing |
| AI Actions | 20+ | Review/approve/reject testing |

### 8.2 Test Data Principles

- Seed data is deterministic and version-controlled
- Each test suite can reset to clean state
- No production data in test environments
- PII-free test data only
- AI mock responses versioned alongside test cases

---

## 9. Defect Management

### 9.1 Bug Lifecycle

```
Found → Triaged (severity) → Assigned → In Progress → Fixed → Verified → Closed
```

### 9.2 Regression Policy

- Every P0/P1 bug gets a regression test added
- Regression suite runs on every PR merge
- No release ships with known P0 bugs
- P1 bugs must have fix timeline committed before release

### 9.3 Flaky Test Policy

- Flaky tests quarantined within 24 hours
- Root cause investigated within 1 sprint
- Fix or remove — no permanent quarantine
- Flaky test count tracked as team metric (target: 0)

---

## 10. Compliance Testing (SOC 2)

### 10.1 Control Verification Schedule

| Control | Verification | Frequency |
|---------|-------------|-----------|
| CC6.1 Logical access | RBAC tests, permission matrix verification | Every sprint |
| CC6.2 Authentication | Auth flow tests, MFA tests, SSO tests | Every sprint |
| CC6.6 System boundaries | Security scan, VPC config audit | Monthly |
| CC7.1 Monitoring | Alert firing tests, dashboard review | Monthly |
| CC8.1 Data protection | Encryption at rest/transit verification | Quarterly |
| PI1.1 Data integrity | FK constraint tests, audit trail integrity | Every sprint |

### 10.2 Evidence Collection

- Automated test reports archived per sprint
- Security scan results stored
- Access logs retained 90 days
- Change management (PR approvals) logged via GitHub
- Incident response tested quarterly (tabletop exercise)
