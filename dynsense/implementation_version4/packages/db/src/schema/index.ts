// ============================================================
// R0 Tables — included in launch (24 tables)
// ============================================================

// Core tables (17)
export { tenants } from "./tenants.js";
export { accounts } from "./accounts.js";
export { users } from "./users.js";
export { projects } from "./projects.js";
export { phases } from "./phases.js";
export { tasks } from "./tasks.js";
export { taskAssignments } from "./task-assignments.js";
export { taskDependencies } from "./task-dependencies.js";
export { comments } from "./comments.js";
export { mentions } from "./mentions.js";
export { taskChecklists } from "./task-checklists.js";
export { checklistItems } from "./checklist-items.js";
export { tags } from "./tags.js";
export { taskTags } from "./task-tags.js";
export { auditLog } from "./audit-log.js";
export { tenantConfigs } from "./tenant-configs.js";
export { projectMembers } from "./project-members.js";

// AI tables (5)
export { aiActions } from "./ai-actions.js";
export { aiCostLog } from "./ai-cost-log.js";
export { aiAgentConfigs } from "./ai-agent-configs.js";
export { aiSessions } from "./ai-sessions.js";
export { aiHookLog } from "./ai-hook-log.js";
export { aiSessionEvents } from "./ai-session-events.js";

// Lookup tables (2)
export { priorities } from "./priorities.js";
export { taskStatuses } from "./task-statuses.js";

// Integration tables (2)
export { integrations } from "./integrations.js";
export { integrationEvents } from "./integration-events.js";

// ============================================================
// R1-DEFERRED Tables — kept in schema for migrations, not seeded
// ============================================================
export { notifications } from "./notifications.js";
export { savedViews } from "./saved-views.js";
export { customFieldDefinitions } from "./custom-field-definitions.js";
export { customFieldValues } from "./custom-field-values.js";
export { featureFlags } from "./feature-flags.js";
export { recurringTaskConfigs } from "./recurring-task-configs.js";
export { taskReminders } from "./task-reminders.js";
export { inviteLinks } from "./invite-links.js";
export { embeddings } from "./embeddings.js";
export { aiMcpServers } from "./ai-mcp-servers.js";
