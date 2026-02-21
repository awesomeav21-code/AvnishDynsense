// Ref: FR-110 — CRUD projects with name, description, status, dates
// Ref: FR-113 — Soft delete with recovery window
import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  status: z.enum(["active", "on_hold", "completed", "archived"]).optional(),
});

export const projectIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
