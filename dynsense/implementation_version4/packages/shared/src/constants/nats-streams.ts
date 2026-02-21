// Ref: design-doc §6.1 — NATS JetStream (12 Streams)
// Ref: FR-560 — 12 JetStream streams covering all domain events

export const NATS_STREAMS = {
  TASKS: "pm.tasks",
  PROJECTS: "pm.projects",
  COMMENTS: "pm.comments",
  AI: "pm.ai",
  INTEGRATIONS: "pm.integrations",
  NOTIFICATIONS: "pm.notifications",
  REMINDERS: "pm.reminders",
  GOALS: "pm.goals",
  AUTOMATIONS: "pm.automations",
  FORMS: "pm.forms",
  DOCUMENTS: "pm.documents",
  SYSTEM: "pm.system",
} as const;

export type NatsStream = (typeof NATS_STREAMS)[keyof typeof NATS_STREAMS];
