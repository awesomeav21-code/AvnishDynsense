// Ref: FR-100 — register with email + password (bcrypt cost 12+)
// Ref: FR-101 — login issues JWT RS256
import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(255),
  tenantId: z.string().uuid(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  workspace: z.string().min(1).max(100),
});

export const loginStep1Schema = z.object({
  uid: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});

export const loginStep2Schema = z.object({
  uid: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
  tenantId: z.string().uuid(),
});

export const switchWorkspaceSchema = z.object({
  tenantId: z.string().uuid(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type LoginStep1Input = z.infer<typeof loginStep1Schema>;
export type LoginStep2Input = z.infer<typeof loginStep2Schema>;
export type SwitchWorkspaceInput = z.infer<typeof switchWorkspaceSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
