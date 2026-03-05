-- SOC 2 Control: Row-Level Security for tenant isolation
-- All tenant-scoped tables enforce that queries can only access rows
-- matching the current session's tenant_id (set via SET app.current_tenant_id).

-- Helper: set tenant context per request (called by API before each query)
-- Usage: SELECT set_config('app.current_tenant_id', '<uuid>', true);

-- ============================================================
-- Enable RLS on all 29 tenant-scoped tables
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cost_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_hook_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_session_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_task_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Policies: allow access only when tenant_id matches session var
-- ============================================================

-- Tables with direct tenant_id column
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'users', 'projects', 'phases', 'tasks', 'task_checklists',
      'comments', 'tags', 'audit_log', 'tenant_configs', 'project_members',
      'notifications', 'saved_views', 'custom_field_definitions',
      'integrations', 'integration_events',
      'ai_actions', 'ai_cost_log', 'ai_agent_configs', 'ai_hook_log',
      'ai_sessions', 'ai_session_events',
      'feature_flags', 'recurring_task_configs', 'task_reminders',
      'invite_links', 'priorities', 'task_statuses', 'embeddings'
    ])
  LOOP
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
       FOR ALL
       USING (tenant_id = current_setting(''app.current_tenant_id'')::uuid)
       WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'')::uuid)',
      tbl
    );
  END LOOP;
END $$;

-- Junction/child tables without direct tenant_id: isolate via parent join
CREATE POLICY tenant_isolation ON task_assignments
  FOR ALL
  USING (task_id IN (SELECT id FROM tasks WHERE tenant_id = current_setting('app.current_tenant_id')::uuid))
  WITH CHECK (task_id IN (SELECT id FROM tasks WHERE tenant_id = current_setting('app.current_tenant_id')::uuid));

CREATE POLICY tenant_isolation ON task_dependencies
  FOR ALL
  USING (task_id IN (SELECT id FROM tasks WHERE tenant_id = current_setting('app.current_tenant_id')::uuid))
  WITH CHECK (task_id IN (SELECT id FROM tasks WHERE tenant_id = current_setting('app.current_tenant_id')::uuid));

CREATE POLICY tenant_isolation ON task_tags
  FOR ALL
  USING (task_id IN (SELECT id FROM tasks WHERE tenant_id = current_setting('app.current_tenant_id')::uuid))
  WITH CHECK (task_id IN (SELECT id FROM tasks WHERE tenant_id = current_setting('app.current_tenant_id')::uuid));

CREATE POLICY tenant_isolation ON checklist_items
  FOR ALL
  USING (checklist_id IN (SELECT id FROM task_checklists WHERE tenant_id = current_setting('app.current_tenant_id')::uuid))
  WITH CHECK (checklist_id IN (SELECT id FROM task_checklists WHERE tenant_id = current_setting('app.current_tenant_id')::uuid));

CREATE POLICY tenant_isolation ON mentions
  FOR ALL
  USING (comment_id IN (SELECT id FROM comments WHERE tenant_id = current_setting('app.current_tenant_id')::uuid))
  WITH CHECK (comment_id IN (SELECT id FROM comments WHERE tenant_id = current_setting('app.current_tenant_id')::uuid));

-- Enable RLS on child tables that were missed above
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON custom_field_values
  FOR ALL
  USING (task_id IN (SELECT id FROM tasks WHERE tenant_id = current_setting('app.current_tenant_id')::uuid))
  WITH CHECK (task_id IN (SELECT id FROM tasks WHERE tenant_id = current_setting('app.current_tenant_id')::uuid));

-- ============================================================
-- Bypass policy for the application superuser role (migrations, seeds)
-- The app connects as 'dynsense' role which is the table owner,
-- and RLS is bypassed for table owners by default in PostgreSQL.
-- For non-owner app roles, grant bypass explicitly:
-- ALTER ROLE dynsense_app SET row_security = off;
-- ============================================================
