# Dynsense — Audit & Compliance Document

**Version:** 4.0
**Date:** February 18, 2026
**Status:** Draft for Review
**Methodology:** Produced using swarm parallel agent research (3 concurrent agents)

---

## 1. Executive Summary

**Core Audit Principles:**

| Principle | Implementation |
|-----------|---------------|
| **Every action is attributable** | actor_id + actor_type (human \| ai_agent \| system) on all mutations |
| **AI decisions are explainable** | Full pipeline trace: trigger → context → confidence → output → disposition |
| **Audit records are immutable** | Database trigger blocks UPDATE/DELETE on audit_log; 7-year retention |
| **Tenant data is isolated** | Three-layer isolation verified and logged at every access point |
| **Compliance is continuous** | Automated evidence collection, not manual snapshots |

**Swarm Parallel Agent Strategy:**

All audit infrastructure is implemented using the swarm parallel pattern where independent audit workstreams are developed concurrently:

| Agent Swarm | Concurrent Tracks | Sync Points |
|-------------|-------------------|-------------|
| **Audit Core Swarm** | Audit trail engine, immutability enforcement, retention scheduler | Merge after all pass DB constraint tests |
| **AI Traceability Swarm** | Action logging, hook decision capture, session audit, cost tracking | Merge after integration tests pass |
| **Compliance Swarm** | SOC 2 controls, evidence collector, access review automation | Merge after compliance checklist verified |
| **Monitoring Swarm** | Audit dashboards, anomaly detection, alert pipeline | Merge after monitoring stack verified |

**Rules for parallel execution:**
- Each agent owns a bounded audit module with explicit interface contracts
- Agents may run concurrently when no data dependency exists between their outputs
- Sync barriers are placed at integration test gates before merging tracks
- Shared audit types live in `@dynsense/shared` — the single source of truth for cross-agent contracts

---

## 2. Audit Trail Architecture

### 2.1 Field-Level Audit Trail (FR-140)

Every mutation in Dynsense generates an audit record capturing the exact field-level changes:

```
┌──────────────────────────────────────────────────────────┐
│                    MUTATION EVENT                         │
│  (API request / AI action / System job / Hook decision)  │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│                   AUDIT WRITER                            │
│  1. Capture entity_type + entity_id                      │
│  2. Compute field-level diff (old_value → new_value)     │
│  3. Record actor_id + actor_type                         │
│  4. Link to ai_action_id (if AI-initiated)               │
│  5. Stamp tenant_id + timestamp                          │
│  6. INSERT into audit_log (immutable)                    │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│                    audit_log TABLE                        │
│  Immutable — UPDATE/DELETE blocked at DB trigger level    │
│  7-year retention → S3 Glacier archival after 1 year     │
└──────────────────────────────────────────────────────────┘
```

### 2.2 Audit Log Schema

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Unique audit record identifier |
| tenant_id | UUID (FK) | Tenant scope — RLS enforced |
| entity_type | VARCHAR | Table name (e.g., tasks, projects, ai_actions) |
| entity_id | UUID | Primary key of the mutated record |
| action | ENUM | CREATE, UPDATE, DELETE, APPROVE, REJECT, REVERT, EXECUTE |
| actor_id | UUID | User or AI agent identifier |
| actor_type | ENUM | human, ai_agent, system, hook |
| diff | JSONB | Field-level changes: `{ "field": { "old": X, "new": Y } }` |
| metadata | JSONB | Additional context (IP address, user agent, session_id, ai_action_id) |
| created_at | TIMESTAMPTZ | Immutable timestamp |

### 2.3 Immutability Enforcement (FR-142)

```sql
-- Database trigger: blocks all modifications to audit_log
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is immutable — UPDATE and DELETE operations are blocked';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutability
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_modification();
```

**Verification Schedule:**

| Check | Frequency | Method |
|-------|-----------|--------|
| Trigger existence | Every deployment | Migration verification script |
| UPDATE attempt | Every sprint | Integration test (must fail) |
| DELETE attempt | Every sprint | Integration test (must fail) |
| Row count integrity | Daily | Monotonic growth check — count must never decrease |

### 2.4 Auditable Entity Coverage

| Entity | Actions Audited | Actor Types | Release |
|--------|----------------|-------------|---------|
| **Projects** | CREATE, UPDATE, DELETE, PHASE_CHANGE, BASELINE_SET | human, ai_agent | R0 |
| **Tasks** | CREATE, UPDATE, STATUS_CHANGE, ASSIGN, UNASSIGN, DEPENDENCY_ADD/REMOVE | human, ai_agent, system | R0 |
| **Comments** | CREATE, UPDATE, DELETE | human, ai_agent | R0 |
| **Checklists** | CREATE, UPDATE, ITEM_TOGGLE | human | R0 |
| **Dependencies** | CREATE, DELETE, AUTO_UNBLOCK | human, system | R0 |
| **Users** | CREATE, UPDATE, ROLE_CHANGE, DEACTIVATE | human (admin) | R0 |
| **AI Actions** | PROPOSE, APPROVE, REJECT, EXECUTE, REVERT | human, ai_agent | R0 |
| **AI Policies** | CREATE, UPDATE | human (admin) | R0 |
| **Tenant Configs** | UPDATE | human (admin) | R0 |
| **Integrations** | CONNECT, DISCONNECT, CONFIG_CHANGE | human (admin) | R1 |
| **Goals** | CREATE, UPDATE, PROGRESS_CHANGE | human, ai_agent | R2 |
| **Automation Rules** | CREATE, UPDATE, ENABLE, DISABLE, TRIGGER | human, system | R2 |
| **Billing** | PLAN_CHANGE, PAYMENT, BUDGET_ALERT | human (admin), system | R2 |

---

## 3. AI Action Traceability (FR-143)

### 3.1 AI Action Lifecycle

Every AI operation produces a complete audit trail linking the trigger event to the final disposition:

```
TRIGGER (NATS event / API / schedule)
    │
    ├─► ai_actions record created (status: pending)
    │       ├── capability, input, tenant_id, user_id
    │       └── session_id (links to ai_sessions)
    │
    ├─► AUTONOMY CHECK
    │       └── ai_hook_log: autonomy-enforcer decision (shadow/propose/execute)
    │
    ├─► CONTEXT ASSEMBLY
    │       └── ai_actions.context_metadata: RAG results, token count, sources
    │
    ├─► CONFIDENCE CHECK
    │       └── ai_actions.confidence: 0.0-1.0 score
    │
    ├─► LLM CALL
    │       └── ai_cost_log: model, input_tokens, output_tokens, cost_usd, latency_ms
    │
    ├─► POST-PROCESSING
    │       ├── ai_actions.output: validated result
    │       └── ai_actions.validation_status: pass/fail/retry
    │
    ├─► DISPOSITION
    │       ├── ai_actions.disposition: shadow_logged / proposed / executed
    │       └── ai_actions.rollback_data: pre-action snapshot (if execute)
    │
    └─► HOOK CHAIN LOG
            ├── ai_hook_log: tenant-isolator decision
            ├── ai_hook_log: rate-limiter decision
            ├── ai_hook_log: cost-tracker result
            ├── ai_hook_log: audit-writer confirmation
            ├── ai_hook_log: traceability link
            └── ai_hook_log: notification delivery
```

### 3.2 AI Traceability Tables

#### ai_actions (Primary AI Audit)

| Column | Type | Audit Purpose |
|--------|------|---------------|
| id | UUID | Unique action identifier |
| tenant_id | UUID | Tenant scope |
| capability | VARCHAR | Which AI capability (wbs-generator, whats-next, etc.) |
| status | ENUM | pending → proposed → approved/rejected/executed → reverted |
| input | JSONB | Original request payload |
| output | JSONB | AI-generated result |
| confidence | FLOAT | Model confidence score |
| disposition | VARCHAR | shadow_logged, proposed, executed |
| rollback_data | JSONB | Pre-action state snapshot for revert |
| reviewer_id | UUID | Human who approved/rejected |
| reviewer_notes | TEXT | Approval/rejection reasoning |
| session_id | UUID | Links to ai_sessions for multi-turn context |
| created_at | TIMESTAMPTZ | Action creation time |
| resolved_at | TIMESTAMPTZ | Approval/rejection/execution time |

#### ai_cost_log (Financial Audit)

| Column | Type | Audit Purpose |
|--------|------|---------------|
| id | UUID | Unique cost record |
| tenant_id | UUID | Per-tenant cost attribution |
| ai_action_id | UUID | Links cost to specific AI action |
| model | VARCHAR | claude-opus / claude-sonnet |
| input_tokens | INTEGER | Tokens consumed (input) |
| output_tokens | INTEGER | Tokens consumed (output) |
| cost_usd | DECIMAL(10,6) | Calculated cost |
| latency_ms | INTEGER | LLM call duration |
| created_at | TIMESTAMPTZ | Cost event time |

#### ai_hook_log (Hook Decision Audit)

| Column | Type | Audit Purpose |
|--------|------|---------------|
| id | UUID | Unique hook log entry |
| tenant_id | UUID | Tenant scope |
| hook_name | VARCHAR | tenant-isolator, autonomy-enforcer, rate-limiter, etc. |
| phase | ENUM | PreToolUse, PostToolUse, Stop |
| decision | ENUM | allow, deny, modify |
| reason | TEXT | Human-readable explanation |
| ai_action_id | UUID | Links to parent AI action |
| tool_name | VARCHAR | MCP tool that triggered the hook |
| execution_time_ms | INTEGER | Hook execution duration |
| created_at | TIMESTAMPTZ | Decision time |

#### ai_sessions (Session Audit)

| Column | Type | Audit Purpose |
|--------|------|---------------|
| id | UUID | Session identifier |
| tenant_id | UUID | Tenant scope |
| user_id | UUID | Initiating user |
| capability | VARCHAR | AI capability |
| parent_session_id | UUID | Fork lineage tracking |
| turn_count | INTEGER | Interaction count |
| state | JSONB | Session state snapshot |
| status | ENUM | active, completed, paused, expired |
| created_at | TIMESTAMPTZ | Session start |
| expires_at | TIMESTAMPTZ | TTL for automatic expiry |

### 3.3 AI Audit Query Patterns

| Query | Purpose | Frequency |
|-------|---------|-----------|
| All AI actions by tenant in date range | Tenant audit review | On-demand |
| AI actions with confidence < 0.6 | Low-confidence analysis | Weekly |
| Override rate by capability | Prompt quality tracking | Weekly |
| Cost per tenant per capability per month | Financial reconciliation | Monthly |
| Hook denials by type | Safety system verification | Daily |
| Session fork chains | Multi-turn debugging | On-demand |
| Reverted AI actions | Revert pattern analysis | Weekly |
| AI mutations vs human mutations ratio | Autonomy adoption tracking | Monthly |

---

## 4. Tenant Isolation Audit

### 4.1 Three-Layer Isolation Architecture

| Layer | Mechanism | Audit Point |
|-------|-----------|-------------|
| **Layer 1: JWT Claims** | tenant_id embedded in RS256 access token | Token decode logged on every request |
| **Layer 2: Application Middleware** | `SET LOCAL app.current_tenant_id` per request | Middleware execution logged |
| **Layer 3: PostgreSQL RLS** | `USING (tenant_id = current_setting('app.current_tenant_id')::uuid)` | Cross-tenant query returns 0 rows (verified) |

### 4.2 Tenant Isolation Verification

| Test | Method | Frequency | Owner |
|------|--------|-----------|-------|
| Cross-tenant API access | Auth as Tenant A, request Tenant B resource → expect 404 | Every sprint | QA Swarm |
| Cross-tenant DB query | Direct SQL without SET tenant_id → expect 0 rows | Every sprint | QA Swarm |
| AI cross-tenant context | Verify RAG results scoped to current tenant only | Every sprint | AI Engine Swarm |
| MCP tool injection | Forged tenant_id in tool args → denied by tenant-isolator | Every sprint | AI Engine Swarm |
| JWT tampering | Modified tenant_id in JWT → signature verification fails | Every sprint | Backend API Swarm |
| Session cross-contamination | Verify session isolation across concurrent tenant requests | Every sprint | QA Swarm |

### 4.3 Tenant Isolation Incident Response

| Severity | Trigger | Response | SLA |
|----------|---------|----------|-----|
| **P0 Critical** | Any cross-tenant data access detected | Immediate system halt for affected tenants, incident investigation, root cause analysis, full audit of affected data scope | Fix within 4 hours |
| **P0 Critical** | Tenant-isolator hook bypass | Disable AI operations, manual audit of all recent AI actions, deploy hotfix | Fix within 4 hours |
| **P1 High** | RLS policy misconfiguration detected | Rollback migration, verify all tables, full regression | Fix within 24 hours |

---

## 5. Audit Data Retention & Archival

### 5.1 Retention Policies

| Data Type | Active Retention | Archive Strategy | Total Retention | Storage |
|-----------|-----------------|------------------|-----------------|---------|
| audit_log | 1 year (PostgreSQL) | S3 Glacier after 1 year | 7 years | PostgreSQL → S3 Glacier |
| ai_actions | 6 months (PostgreSQL) | S3 Standard after 6 months | 2 years | PostgreSQL → S3 Standard |
| ai_cost_log | 3 months raw (PostgreSQL) | Monthly aggregates after 3 months, raw to S3 | 2 years | PostgreSQL → S3 Standard |
| ai_sessions | 30 days active | Archive to S3 after expiry | 1 year | PostgreSQL → S3 Standard |
| ai_hook_log | 90 days | Compress and rotate after 30 days | 90 days | PostgreSQL |
| Access logs | 90 days | CloudWatch Logs | 90 days | CloudWatch |
| Security scan results | Per-sprint archive | S3 Standard | 3 years | S3 Standard |

### 5.2 Archival Process

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  PostgreSQL      │     │  Archival Job     │     │  S3 Storage     │
│  (Active Data)   │────►│  (Daily at 2am)   │────►│  (Archived)     │
│                  │     │                   │     │                 │
│  audit_log       │     │  1. SELECT rows   │     │  Standard:      │
│  ai_actions      │     │     > threshold   │     │    ai_actions   │
│  ai_cost_log     │     │  2. Export as     │     │    ai_cost_log  │
│  ai_sessions     │     │     Parquet/JSON  │     │    ai_sessions  │
│                  │     │  3. Upload to S3  │     │                 │
│                  │     │  4. Verify upload │     │  Glacier:       │
│                  │     │  5. DELETE source │     │    audit_log    │
│                  │     │     (audit_log    │     │    (>1 year)    │
│                  │     │      EXCLUDED)    │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

**Note:** audit_log rows are never deleted from PostgreSQL during active retention. The archival job copies them to S3 Glacier after 1 year and only removes the PostgreSQL copy after confirming S3 durability (99.999999999%).

### 5.3 Archival Verification

| Check | Frequency | Method |
|-------|-----------|--------|
| S3 object integrity | After every archive run | MD5 checksum comparison |
| Row count reconciliation | After every archive run | Source count = archived count |
| Retrieval test (Glacier) | Quarterly | Restore random audit_log partition, verify readability |
| Retention policy compliance | Monthly | Verify no data retained beyond policy limits |

---

## 6. Compliance Framework

### 6.1 SOC 2 Trust Service Criteria Mapping

| TSC | Control | Dynsense Implementation | Audit Evidence | Release |
|-----|---------|------------------------|----------------|---------|
| **CC6.1** | Logical access controls | RBAC with 4 roles (site_admin, pm, developer, client); role-based endpoint protection via middleware | RBAC test results, permission matrix, access logs | R0 |
| **CC6.2** | Authentication mechanisms | JWT RS256 + bcrypt (cost 12+) + refresh rotation; SSO (SAML 2.0/OIDC) + MFA (TOTP) | Auth flow tests, token rotation logs, MFA enrollment records | R0 (JWT), R1 (SSO/MFA) |
| **CC6.3** | Authorization enforcement | Three-layer tenant isolation (JWT + middleware + RLS); AI tool allowlist per agent | Tenant isolation tests, cross-tenant test results, hook decision logs | R0 |
| **CC6.6** | System boundaries | VPC with private subnets for data layer; WAF on ALB; no direct DB access | VPC config audit, security group rules, network diagram | R1 |
| **CC7.1** | System monitoring | CloudWatch metrics/alarms, Sentry error tracking, NATS consumer lag alerts | Alert configuration, dashboard screenshots, incident response logs | R0 (basic), R1 (full) |
| **CC7.2** | Anomaly detection | AI acceptance rate monitoring, cross-tenant query detection, unusual cost spike alerts | Quality alert logs, anomaly investigation records | R1 |
| **CC7.3** | Change management | GitHub PRs with required reviews, CI/CD gates, feature flag management | PR approval logs, CI/CD pipeline history, deployment records | R0 |
| **CC8.1** | Data protection | AES-256 at rest (AWS KMS), TLS 1.3 in transit; field-level encryption for sensitive data | Encryption configuration audit, TLS certificate records | R0 (transit), R1 (at rest) |
| **PI1.1** | Data integrity | Immutable audit_log, FK constraints, Zod validation on all inputs, JSONB schema validation | Audit immutability tests, constraint verification, validation pass rate | R0 |

### 6.2 SOC 2 Compliance Timeline

| Milestone | Release | Activities |
|-----------|---------|------------|
| **Controls Implementation** | R0-R1 | RBAC, audit trail, tenant isolation, monitoring, encryption |
| **Evidence Collection Start** | R1 | Automated test reports archived, access logs retained, change management documented |
| **SOC 2 Type I Preparation** | R2 | Auditor engagement, gap analysis, remediation, control documentation |
| **SOC 2 Type I Audit** | R2-R3 | External auditor review, evidence submission, certification |
| **SOC 2 Type II Evidence** | R3 | Sustained compliance demonstration over observation period (3-6 months) |

### 6.3 Compliance Evidence Automation

| Evidence Type | Collection Method | Storage | Frequency |
|---------------|-------------------|---------|-----------|
| Test coverage reports | CI pipeline artifact | S3 + GitHub Actions | Every merge to main |
| Security scan results | OWASP ZAP + Trivy output | S3 | Every staging deployment |
| Access review logs | PostgreSQL audit_log queries | S3 export | Monthly |
| Change management records | GitHub API (PR data) | S3 export | Monthly |
| Incident response records | PagerDuty/Sentry export | S3 | Per incident |
| Deployment audit trail | GitHub Actions workflow logs | S3 | Every deployment |
| Encryption verification | AWS Config rules | CloudWatch | Continuous |
| Uptime metrics | CloudWatch availability | S3 export | Monthly |

---

## 7. AI-Specific Audit Controls

### 7.1 AI Decision Transparency

Every AI decision must be fully reconstructable from audit data:

| Decision Point | What Is Logged | Where Stored |
|---------------|---------------|--------------|
| **Trigger source** | Event type, originator, payload | ai_actions.input |
| **Autonomy disposition** | shadow/propose/execute, policy rule matched | ai_hook_log (autonomy-enforcer) |
| **Context used** | RAG results, token count, domain template selected | ai_actions.context_metadata |
| **Confidence score** | Numerical score, threshold comparison | ai_actions.confidence |
| **Model selection** | Model used, routing reason, fallback events | ai_cost_log.model |
| **Output validation** | Schema validation pass/fail, retry count | ai_actions.validation_status |
| **Human review** | Reviewer ID, decision (approve/reject/edit), notes | ai_actions.reviewer_id, reviewer_notes |
| **Rollback data** | Pre-action state snapshot | ai_actions.rollback_data |
| **Cost incurred** | Input/output tokens, USD cost | ai_cost_log |

### 7.2 AI Safety Audit Checks

| Check | Trigger | Expected Outcome | Failure Response |
|-------|---------|-------------------|-----------------|
| Hallucination detection | Every AI output | Zero references to non-existent entities | P0 incident, prompt review |
| Prompt injection scan | Every user input to AI | No prompt injection patterns detected | Block input, log attempt |
| Cross-tenant context | Every RAG retrieval | Results scoped to current tenant only | Block action, P0 investigation |
| Cost budget compliance | Every LLM call | Cost within tenant daily/monthly budget | Deny request, notify admin |
| Confidence threshold | Every AI action | Score meets capability threshold (default 0.6) | Route to human review |
| Tool permission | Every MCP tool call | Agent has permission for requested tool | Deny call, log violation |
| Rate limit | Every AI request | Within sliding window limits | Deny request, log rate limit hit |

### 7.3 AI Audit Reporting

| Report | Audience | Content | Frequency |
|--------|----------|---------|-----------|
| **AI Action Summary** | Tenant Admin | Actions by capability, acceptance/rejection rates, cost summary | Weekly |
| **AI Safety Report** | Site Admin | Hook denials, cross-tenant attempts, hallucination incidents, rate limit hits | Daily |
| **AI Cost Report** | Billing / Finance | Per-tenant token usage, cost breakdown by capability, budget utilization | Monthly |
| **AI Quality Report** | AI/ML Team | Confidence distributions, override rates, golden test results, latency trends | Weekly |
| **AI Compliance Report** | Compliance Officer | SOC 2 control evidence, audit trail completeness, retention compliance | Monthly |

---

## 8. Access Control Audit

### 8.1 RBAC Audit Matrix

| Resource | site_admin | pm | developer | client | AI Agent |
|----------|-----------|-----|-----------|--------|----------|
| Projects (own tenant) | CRUD | CRUD | Read | Read (projected) | Read + Write (if acceptEdits) |
| Tasks (own tenant) | CRUD | CRUD | CRUD (assigned) | Read (projected) | Read + Write (if acceptEdits) |
| Audit Log | Read + Export | Read | — | — | — |
| AI Policies | CRUD | Read | — | — | — |
| AI Actions | CRUD + Approve | Read + Approve | Read (own) | — | Create |
| Tenant Config | CRUD | Read | — | — | — |
| User Management | CRUD | Read | — | — | — |
| Cost Dashboard | Read | Read | — | — | — |
| Client Portal | — | Config | — | Read | Scoped Read |

### 8.2 Privileged Access Audit

| Event | Logged Fields | Alert Threshold |
|-------|--------------|-----------------|
| Role change (any user) | actor_id, target_user_id, old_role, new_role | Always logged, admin-only action |
| Self-role-elevation attempt | actor_id, attempted_role | Immediate alert — forbidden operation |
| Admin login from new IP | actor_id, IP, user_agent, geolocation | Alert on first occurrence |
| Bulk data export | actor_id, export_type, row_count, date_range | Always logged |
| Tenant config change | actor_id, config_key, old_value, new_value | Always logged |
| AI policy modification | actor_id, capability, old_policy, new_policy | Always logged |
| Integration credential update | actor_id, integration_type, action | Always logged |

### 8.3 Access Review Schedule

| Review Type | Scope | Frequency | Reviewer |
|-------------|-------|-----------|----------|
| User access review | All active users per tenant | Quarterly | Tenant Admin |
| Admin privilege review | All site_admin accounts | Monthly | Security Team |
| AI agent permission review | All subagent tool permissions | Every sprint | AI/ML Team |
| Integration credential review | OAuth tokens, API keys | Quarterly | DevOps |
| Inactive account review | Users with no login > 90 days | Quarterly | Tenant Admin |

---

## 9. Audit Monitoring & Alerting

### 9.1 Real-Time Audit Alerts

| Alert | Condition | Severity | Response |
|-------|-----------|----------|----------|
| Cross-tenant access attempt | tenant-isolator hook denies with reason=cross_tenant | P0 | Immediate investigation, isolate affected tenant |
| Audit log anomaly | audit_log row count decreases (should never happen) | P0 | Investigate potential data tampering |
| AI action without audit trail | ai_action exists without corresponding audit_log entries | P1 | Bug investigation, backfill audit records |
| Excessive AI rejections | >60% rejection rate for any capability in 24h window | P2 | Prompt review, quality investigation |
| Cost budget breach | Tenant AI spend exceeds 100% of monthly budget | P1 | Notify admin, halt AI operations for tenant |
| Unauthorized export attempt | Non-admin attempts audit log export | P1 | Block, log, alert admin |
| Authentication brute force | >10 failed login attempts for same account in 5 minutes | P1 | Temporary account lock, alert admin |
| Hook bypass detected | AI operation completes without all required hook logs | P0 | Halt AI operations, investigate hook chain integrity |

### 9.2 Audit Dashboards

| Dashboard | Key Metrics | Audience |
|-----------|------------|----------|
| **Audit Activity** | Mutations/hour (human vs AI), audit log growth rate, top mutated entities | Site Admin |
| **AI Transparency** | Actions by capability/disposition, confidence distributions, approval latency | Tenant Admin |
| **Compliance Health** | SOC 2 control status (green/yellow/red), evidence freshness, upcoming reviews | Compliance Officer |
| **Security Events** | Cross-tenant attempts (target: 0), auth failures, hook denials, rate limits | Security Team |
| **Cost Accountability** | Per-tenant AI spend, daily/weekly trends, budget utilization percentage | Finance / Admin |

### 9.3 Audit Log Integrity Monitoring

| Check | Method | Frequency | Alert On |
|-------|--------|-----------|----------|
| Row count monotonic growth | Compare current count vs last check | Every 5 minutes | Count decreased |
| Timestamp ordering | Verify no gaps > 1 hour in audit_log timestamps | Hourly | Gap detected |
| Trigger existence | Query pg_trigger for audit_log immutability trigger | Every deployment | Trigger missing |
| RLS policy active | Query pg_policies for all tenant-scoped tables | Every deployment | Policy missing |
| Archive integrity | Verify S3 object checksums match source | After every archive | Checksum mismatch |

---

## 10. Incident Audit Procedures

### 10.1 Security Incident Audit Workflow

```
INCIDENT DETECTED
    │
    ├─► 1. CONTAIN: Isolate affected tenant/service (< 15 min)
    │
    ├─► 2. PRESERVE: Snapshot all audit logs for affected scope
    │       ├── Export audit_log for time window
    │       ├── Export ai_actions for time window
    │       ├── Export ai_hook_log for time window
    │       └── Preserve CloudWatch logs and access logs
    │
    ├─► 3. INVESTIGATE: Trace the full action chain
    │       ├── Identify all affected entities
    │       ├── Reconstruct timeline from audit trail
    │       ├── Verify tenant isolation integrity
    │       └── Assess data exposure scope
    │
    ├─► 4. REMEDIATE: Fix root cause and deploy
    │       ├── Deploy fix to staging → production
    │       ├── Add regression test
    │       └── Update golden test sets if AI-related
    │
    └─► 5. REPORT: Document and communicate
            ├── Internal incident report (RCA)
            ├── Affected tenant notification (if data exposed)
            ├── SOC 2 evidence update
            └── Lessons learned → update audit procedures
```

### 10.2 AI Incident Audit Procedures

| Incident Type | Audit Actions | Resolution |
|---------------|--------------|------------|
| **Hallucination** | Query ai_actions for affected output, review context assembly, check RAG results, verify golden tests | Prompt fix, golden test addition, shadow mode for affected capability |
| **Cross-tenant AI context** | Query ai_hook_log for tenant-isolator failures, review RAG query scoping, check pgvector filters | RLS verification, hook chain fix, full AI action audit for affected tenants |
| **Cost overrun** | Query ai_cost_log for spending pattern, review rate-limiter hook decisions, check budget config | Budget adjustment, rate limit tuning, tenant notification |
| **Unauthorized AI mutation** | Query ai_actions for disposition=executed, review autonomy-enforcer decisions, check permission chain | Policy correction, revert affected mutations, add permission test |
| **Model degradation** | Compare golden test results over time, review confidence trends, analyze acceptance rate drop | Shadow mode, prompt revision, model fallback, notify AI/ML team |

---

## 11. Audit Export & Reporting (FR-144)

### 11.1 Export Capabilities

| Export Type | Format | Scope | Access |
|-------------|--------|-------|--------|
| Audit log export | CSV, JSON, Parquet | By tenant, date range, entity type, actor type | site_admin only |
| AI action report | PDF, CSV | By tenant, capability, date range, disposition | site_admin, pm |
| Cost report | CSV, PDF | By tenant, capability, date range | site_admin |
| Compliance evidence pack | ZIP (JSON + PDF) | All SOC 2 relevant data for audit period | site_admin |
| Tenant activity report | PDF | Summary of all tenant activity for period | site_admin |

### 11.2 Export Security

| Control | Implementation |
|---------|---------------|
| Access restriction | Export API endpoint requires site_admin role |
| Export logging | Every export request logged to audit_log with row_count and filters |
| Data masking | Password hashes, API keys, and PII redacted from exports |
| Rate limiting | Max 10 exports per hour per user |
| Signed URLs | Export files delivered via time-limited S3 pre-signed URLs (15 min expiry) |

---

## 12. Swarm Parallel Audit Implementation

### 12.1 Audit Swarm Agent Assignments

| Agent | Module Ownership | Key Deliverables | Release |
|-------|-----------------|-------------------|---------|
| **audit-core-agent** | audit_log table, immutability trigger, field-level diff engine, retention scheduler | Core audit infrastructure | R0 |
| **ai-trace-agent** | ai_actions traceability, hook decision logging, session audit, cost attribution | AI-specific audit trail | R0 |
| **compliance-agent** | SOC 2 control mapping, evidence collector, access review automation, export API | Compliance framework | R1-R2 |
| **monitor-agent** | Audit dashboards, integrity checks, alert pipeline, anomaly detection | Audit monitoring | R0-R1 |

### 12.2 Swarm Sync Barriers

| Barrier | Triggers When | Agents Affected | Verification |
|---------|--------------|-----------------|--------------|
| Audit schema finalized | audit_log + ai tables migration complete | All audit agents | Schema integration test |
| Hook chain integration | All 8 hooks writing to ai_hook_log | ai-trace-agent + monitor-agent | 37 hook integration tests |
| Export API ready | audit-core-agent + compliance-agent endpoints merged | compliance-agent + monitor-agent | Export integration test |
| Dashboard data contracts | All audit tables populated with test data | monitor-agent | Dashboard renders correctly |

### 12.3 Audit Agent Parallelism Rules

| Rule | Enforcement |
|------|-------------|
| audit-core-agent and ai-trace-agent run concurrently — no data dependency | Both write to independent tables |
| compliance-agent depends on both core agents for schema | Starts after sync barrier 1 |
| monitor-agent can start dashboards after any agent produces test data | Progressive integration |
| All agents must pass module-level tests before merging | CI gate per agent branch |
| Shared audit types in `@dynsense/shared/audit` | Single source of truth |

---

## 13. Audit Traceability Matrix

| Requirement | Section | Implementation Sprint | QA Coverage |
|------------|---------|----------------------|-------------|
| FR-140 (Field-level audit trail) | §2.1, §2.2, §2.4 | R0-2 (DONE) | Unit: 6+ audit.service tests; Integration: field diff verification |
| FR-141 (Actor type tracking) | §2.2, §3.1 | R0-2 (DONE) | Unit: actor_type enum coverage; Integration: human vs AI attribution |
| FR-142 (Immutable audit_log) | §2.3 | R0-2 (DONE) | Integration: UPDATE/DELETE blocked; Monitoring: row count monotonic check |
| FR-143 (AI action traceability) | §3.1, §3.2, §3.3 | R0-3 (DONE) | Integration: 37 hook tests; E2E: trigger-to-disposition chain verification |
| FR-144 (Audit log export) | §11.1, §11.2 | R2 | Integration: export API tests; Security: access control verification |
| NFR-010 (Three-layer tenant isolation) | §4.1, §4.2 | R0 (DONE) | Security: cross-tenant tests; Monitoring: zero-leakage verification |
| NFR-016 (SOC 2 Type I) | §6.1, §6.2 | R2 | Compliance: control checklist; Evidence: automated collection |
| NFR-017 (SOC 2 Type II) | §6.2 | R3 | Compliance: sustained evidence over observation period |

---

## 14. Risk Register — Audit Specific

| ID | Risk | Likelihood | Impact | Mitigation | Swarm Owner |
|----|------|-----------|--------|------------|-------------|
| AUD-001 | Audit log storage grows beyond budget | Medium | Medium | Archival to S3 Glacier, monthly partitioning, aggregate older data | audit-core-agent |
| AUD-002 | Immutability trigger accidentally dropped during migration | Low | Critical | Migration validation script checks trigger existence; CI gate | audit-core-agent |
| AUD-003 | AI actions without complete audit trail | Medium | High | PostToolUse hooks are non-optional; missing hook log triggers P0 alert | ai-trace-agent |
| AUD-004 | SOC 2 evidence gaps | Medium | High | Automated evidence collection; monthly compliance health check | compliance-agent |
| AUD-005 | Audit export data leakage | Low | Critical | Export restricted to site_admin; logged; time-limited S3 URLs; PII masking | compliance-agent |
| AUD-006 | Clock skew between services | Low | Medium | NTP sync on all containers; UTC timestamps only; monotonic ordering checks | monitor-agent |
| AUD-007 | Archive retrieval failure (Glacier) | Low | Medium | Quarterly retrieval test; redundant Standard tier for recent archives | audit-core-agent |
| AUD-008 | Merge conflicts between audit swarm agents | Medium | Medium | Bounded module ownership; sequential migration numbering; shared type contracts | All audit agents |
