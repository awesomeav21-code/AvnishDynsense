// Ref: ARCHITECTURE 1.md §4.2 — PostgreSQL LISTEN/NOTIFY event channels
// Ref: FR-141 — Actor type tracking (human vs AI)

export interface BaseEvent {
  tenantId: string;
  actorId: string;
  actorType: "human" | "ai";
  timestamp: string;
}

// ---- pm_tasks_created / pm_tasks_updated / pm_tasks_completed channels ----

export interface TaskEvent extends BaseEvent {
  taskId: string;
  projectId: string;
}

export interface TaskStatusChangedEvent extends TaskEvent {
  type: "task.status_changed";
  fromStatus: string;
  toStatus: string;
}

export interface TaskAssignedEvent extends TaskEvent {
  type: "task.assigned";
  assigneeId: string;
}

export interface TaskCompletedEvent extends TaskEvent {
  type: "task.completed";
}

export interface TaskDependencyResolvedEvent extends TaskEvent {
  type: "task.dependency_resolved";
  blockerTaskId: string;
}

// ---- pm_projects_created channel ----

export interface ProjectCreatedEvent extends BaseEvent {
  type: "project.created";
  projectId: string;
  name: string;
}

export interface ProjectUpdatedEvent extends BaseEvent {
  type: "project.updated";
  projectId: string;
}

export interface ProjectBaselineSetEvent extends BaseEvent {
  type: "project.baseline_set";
  projectId: string;
}

// ---- pm_comments_added channel ----

export interface CommentCreatedEvent extends BaseEvent {
  type: "comment.created";
  commentId: string;
  taskId: string;
}

export interface MentionCreatedEvent extends BaseEvent {
  type: "comment.mention_created";
  commentId: string;
  mentionedUserId: string;
}

// ---- pm_ai_actions channel ----

export interface AiActionProposedEvent extends BaseEvent {
  type: "ai.action_proposed";
  aiActionId: string;
  capability: string;
}

export interface AiActionApprovedEvent extends BaseEvent {
  type: "ai.action_approved";
  aiActionId: string;
}

export interface AiActionRejectedEvent extends BaseEvent {
  type: "ai.action_rejected";
  aiActionId: string;
}

export interface AiActionExecutedEvent extends BaseEvent {
  type: "ai.action_executed";
  aiActionId: string;
}

export interface AiConfidenceLowEvent extends BaseEvent {
  type: "ai.confidence_low";
  aiActionId: string;
  confidence: number;
}

// ---- system events ----

export interface ConfigChangedEvent extends BaseEvent {
  type: "system.config_changed";
  key: string;
}

export interface TenantCreatedEvent extends BaseEvent {
  type: "system.tenant_created";
}

export type DomainEvent =
  | TaskStatusChangedEvent
  | TaskAssignedEvent
  | TaskCompletedEvent
  | TaskDependencyResolvedEvent
  | ProjectCreatedEvent
  | ProjectUpdatedEvent
  | ProjectBaselineSetEvent
  | CommentCreatedEvent
  | MentionCreatedEvent
  | AiActionProposedEvent
  | AiActionApprovedEvent
  | AiActionRejectedEvent
  | AiActionExecutedEvent
  | AiConfidenceLowEvent
  | ConfigChangedEvent
  | TenantCreatedEvent;
