// Ref: FR-128 — Comments with @mention parsing (UUID extraction)
import { z } from "zod";

export const createCommentSchema = z.object({
  taskId: z.string().uuid(),
  body: z.string().min(1).max(10000),
  clientVisible: z.boolean().default(false),
});

export const updateCommentSchema = z.object({
  body: z.string().min(1).max(10000),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
