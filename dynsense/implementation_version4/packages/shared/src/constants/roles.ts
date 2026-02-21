// Ref: FR-104 — RBAC with 4 roles
import type { Role } from "../types/auth.js";

export const ROLES = {
  SITE_ADMIN: "site_admin",
  PM: "pm",
  DEVELOPER: "developer",
  CLIENT: "client",
} as const satisfies Record<string, Role>;

export const ALL_ROLES: readonly Role[] = [
  ROLES.SITE_ADMIN,
  ROLES.PM,
  ROLES.DEVELOPER,
  ROLES.CLIENT,
];
