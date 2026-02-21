// Ref: FR-109 (README) — Admin-configurable values per-tenant key-value config
import { z } from "zod";

export const upsertConfigSchema = z.object({
  key: z.string().min(1).max(255),
  value: z.unknown(),
});

export type UpsertConfigInput = z.infer<typeof upsertConfigSchema>;
