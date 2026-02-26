// Ref: FR-105 — Role-based endpoint protection via middleware
// Ref: design-doc §8.1 — RBAC (4 roles)
import type { Role } from "../types/auth.js";

export type Permission =
  | "project:create"
  | "project:read"
  | "project:update"
  | "project:delete"
  | "task:create"
  | "task:read"
  | "task:update"
  | "task:delete"
  | "task:assign"
  | "task:transition"
  | "comment:create"
  | "comment:read"
  | "user:manage"
  | "ai:execute"
  | "ai:review"
  | "ai:configure"
  | "config:manage"
  | "audit:read";

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  site_admin: [
    "project:create", "project:read", "project:update", "project:delete",
    "task:create", "task:read", "task:update", "task:delete", "task:assign", "task:transition",
    "comment:create", "comment:read",
    "user:manage",
    "ai:execute", "ai:review", "ai:configure",
    "config:manage",
    "audit:read",
  ],
  pm: [
    "project:create", "project:read", "project:update", "project:delete",
    "task:create", "task:read", "task:update", "task:delete", "task:assign", "task:transition",
    "comment:create", "comment:read",
    "user:manage",
    "ai:execute", "ai:review", "ai:configure",
    "config:manage",
    "audit:read",
  ],
  developer: [
    "project:read",
    "task:read", "task:update", "task:transition",
    "comment:create", "comment:read",
  ],
  client: [
    "project:read",
    "task:create", "task:read", "task:update", "task:delete", "task:assign", "task:transition",
    "comment:create", "comment:read",
    "config:manage",
  ],
};
