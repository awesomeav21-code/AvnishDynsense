// Ref: FR-120 — CRUD tasks with full field set
// Ref: FR-121 — Status transitions
// Ref: FR-126 — Filtering by project, phase, status, priority, assignee
import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  projectId: z.string().uuid(),
  phaseId: z.string().uuid().optional(),
  parentTaskId: z.string().uuid().optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  startDate: z.string().refine((s) => !isNaN(Date.parse(s)), { message: "Invalid date" }).optional(),
  dueDate: z.string().refine((s) => !isNaN(Date.parse(s)), { message: "Invalid date" }).optional(),
  estimatedEffort: z.number().positive().optional(),
  reportedBy: z.string().uuid().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  phaseId: z.string().uuid().nullable().optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  startDate: z.string().refine((s) => !isNaN(Date.parse(s)), { message: "Invalid date" }).nullable().optional(),
  dueDate: z.string().refine((s) => !isNaN(Date.parse(s)), { message: "Invalid date" }).nullable().optional(),
  estimatedEffort: z.number().positive().nullable().optional(),
});

export const taskStatusTransitionSchema = z.object({
  status: z.enum([
    "created", "ready", "in_progress", "review",
    "completed", "blocked", "cancelled",
  ]),
});

export const taskFilterSchema = z.object({
  projectId: z.string().uuid().optional(),
  phaseId: z.string().uuid().optional(),
  status: z.enum(["created", "ready", "in_progress", "review", "completed", "blocked", "cancelled"]).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  assigneeId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const addDependencySchema = z.object({
  blockerTaskId: z.string().uuid(),
  blockedTaskId: z.string().uuid(),
  type: z.enum(["blocks", "is_blocked_by"]).default("blocks"),
});

export const assignTaskSchema = z.object({
  userId: z.string().uuid(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskStatusTransitionInput = z.infer<typeof taskStatusTransitionSchema>;
export type TaskFilterInput = z.infer<typeof taskFilterSchema>;
export type AddDependencyInput = z.infer<typeof addDependencySchema>;
export type AssignTaskInput = z.infer<typeof assignTaskSchema>;
