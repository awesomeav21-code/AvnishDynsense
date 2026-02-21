// Ref: FR-127 — Task checklists with groups, items, completion percentage
import { z } from "zod";

export const createChecklistSchema = z.object({
  taskId: z.string().uuid(),
  title: z.string().min(1).max(255),
  position: z.number().int().min(0).default(0),
});

export const createChecklistItemSchema = z.object({
  label: z.string().min(1).max(500),
  position: z.number().int().min(0).default(0),
});

export const updateChecklistItemSchema = z.object({
  label: z.string().min(1).max(500).optional(),
  completed: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

export type CreateChecklistInput = z.infer<typeof createChecklistSchema>;
export type CreateChecklistItemInput = z.infer<typeof createChecklistItemSchema>;
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>;
