// ---- Types ----
export type { Role, JwtPayload, JwtTokenPair, AuthUser } from "./types/auth.js";
export type { TaskStatus, TaskPriority, DependencyType, TaskSummary } from "./types/task.js";
export type { ProjectStatus, ProjectSummary } from "./types/project.js";
export type {
  AiCapability, AiDisposition, AiActionStatus, AiModel,
  PermissionMode, AiActionSummary,
} from "./types/ai.js";
export type {
  BaseEvent, TaskEvent, TaskStatusChangedEvent, TaskAssignedEvent,
  TaskCompletedEvent, TaskDependencyResolvedEvent,
  ProjectCreatedEvent, ProjectUpdatedEvent, ProjectBaselineSetEvent,
  CommentCreatedEvent, MentionCreatedEvent,
  AiActionProposedEvent, AiActionApprovedEvent, AiActionRejectedEvent,
  AiActionExecutedEvent, AiConfidenceLowEvent,
  ConfigChangedEvent, TenantCreatedEvent, DomainEvent,
} from "./types/events.js";

// ---- Constants ----
export { ROLES, ALL_ROLES } from "./constants/roles.js";
export { ROLE_PERMISSIONS } from "./constants/permissions.js";
export type { Permission } from "./constants/permissions.js";
export {
  R0_SUBAGENTS, AI_CONFIDENCE_THRESHOLD,
  AI_MAX_NUDGES_PER_TASK_PER_DAY, AI_SESSION_RETENTION_DAYS,
  AI_CIRCUIT_BREAKER_THRESHOLD, AI_CIRCUIT_BREAKER_RESET_MS,
} from "./constants/ai-capabilities.js";
export type { SubagentConfig } from "./constants/ai-capabilities.js";
export { NATS_STREAMS } from "./constants/nats-streams.js";
export type { NatsStream } from "./constants/nats-streams.js";

// ---- Schemas ----
export {
  registerSchema, loginSchema, refreshTokenSchema,
} from "./schemas/auth.schemas.js";
export type { RegisterInput, LoginInput, RefreshTokenInput } from "./schemas/auth.schemas.js";

export {
  createProjectSchema, updateProjectSchema, projectIdParamSchema,
} from "./schemas/project.schemas.js";
export type { CreateProjectInput, UpdateProjectInput } from "./schemas/project.schemas.js";

export {
  createTaskSchema, updateTaskSchema, taskStatusTransitionSchema,
  taskFilterSchema, addDependencySchema, assignTaskSchema,
} from "./schemas/task.schemas.js";
export type {
  CreateTaskInput, UpdateTaskInput, TaskStatusTransitionInput,
  TaskFilterInput, AddDependencyInput, AssignTaskInput,
} from "./schemas/task.schemas.js";

export { aiExecuteSchema, aiReviewActionSchema } from "./schemas/ai.schemas.js";
export type { AiExecuteInput, AiReviewActionInput } from "./schemas/ai.schemas.js";

export { createCommentSchema, updateCommentSchema } from "./schemas/comment.schemas.js";
export type { CreateCommentInput, UpdateCommentInput } from "./schemas/comment.schemas.js";

export {
  createChecklistSchema, createChecklistItemSchema, updateChecklistItemSchema,
} from "./schemas/checklist.schemas.js";
export type {
  CreateChecklistInput, CreateChecklistItemInput, UpdateChecklistItemInput,
} from "./schemas/checklist.schemas.js";

export { upsertConfigSchema } from "./schemas/config.schemas.js";
export type { UpsertConfigInput } from "./schemas/config.schemas.js";
