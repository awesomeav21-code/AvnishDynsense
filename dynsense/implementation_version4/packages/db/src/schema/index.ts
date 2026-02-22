// All 19 R0 table schemas — re-exported for Drizzle kit and application use
// Core tables (FR-600 series): 13 tables
export { tenants } from "./tenants.js";
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
export { auditLog } from "./audit-log.js";
export { tenantConfigs } from "./tenant-configs.js";

// AI tables (FR-620 series): 6 tables + embeddings
export { aiActions } from "./ai-actions.js";
export { aiCostLog } from "./ai-cost-log.js";
export { aiAgentConfigs } from "./ai-agent-configs.js";
export { aiSessions } from "./ai-sessions.js";
export { aiHookLog } from "./ai-hook-log.js";
export { aiMcpServers } from "./ai-mcp-servers.js";
export { embeddings } from "./embeddings.js";

// R1 tables: tags, task-tags, notifications, saved-views, custom-fields
export { tags } from "./tags.js";
export { taskTags } from "./task-tags.js";
export { notifications } from "./notifications.js";
export { savedViews } from "./saved-views.js";
export { customFieldDefinitions } from "./custom-field-definitions.js";
export { customFieldValues } from "./custom-field-values.js";

// R1 tables: integrations, feature-flags, recurring-tasks, task-reminders
export { integrations } from "./integrations.js";
export { integrationEvents } from "./integration-events.js";
export { featureFlags } from "./feature-flags.js";
export { recurringTaskConfigs } from "./recurring-task-configs.js";
export { taskReminders } from "./task-reminders.js";
