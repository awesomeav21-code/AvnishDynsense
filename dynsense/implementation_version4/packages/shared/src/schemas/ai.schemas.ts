// Ref: FR-200 — 7-stage orchestration pipeline
// Ref: FR-301 — AI Review page approve/reject/edit
import { z } from "zod";

export const aiExecuteSchema = z.object({
  capability: z.enum([
    "wbs_generator", "whats_next", "nl_query", "summary_writer",
    "risk_predictor", "ai_pm_agent", "scope_detector",
    "writing_assistant", "sow_generator", "learning_agent",
  ]),
  input: z.record(z.unknown()),
  sessionId: z.string().uuid().optional(),
});

export const aiReviewActionSchema = z.object({
  action: z.enum(["approve", "reject", "edit"]),
  editedOutput: z.record(z.unknown()).optional(),
});

export type AiExecuteInput = z.infer<typeof aiExecuteSchema>;
export type AiReviewActionInput = z.infer<typeof aiReviewActionSchema>;
