// Ref: ARCHITECTURE 1.md §4.2 — PostgreSQL LISTEN/NOTIFY event channels
// Replaces NATS JetStream (saves $60/mo)

export const PG_CHANNELS = {
  TASKS_CREATED: "pm_tasks_created",
  TASKS_UPDATED: "pm_tasks_updated",
  TASKS_COMPLETED: "pm_tasks_completed",
  PROJECTS_CREATED: "pm_projects_created",
  COMMENTS_ADDED: "pm_comments_added",
  AI_ACTIONS: "pm_ai_actions",
} as const;

export type PgChannel = (typeof PG_CHANNELS)[keyof typeof PG_CHANNELS];

export const ALL_PG_CHANNELS = Object.values(PG_CHANNELS);
