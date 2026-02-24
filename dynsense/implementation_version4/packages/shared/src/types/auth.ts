// Ref: FR-104 — RBAC with 4 roles: site_admin, pm, developer, client
export type Role = "site_admin" | "pm" | "developer" | "client";

// Ref: design-doc §8.1 — JWT RS256 with tenant_id in claims
export interface JwtPayload {
  sub: string;
  accountId?: string;
  tenantId: string;
  role: Role;
  iat: number;
  exp: number;
}

// Ref: FR-101 — access token (1h) + refresh token (30d)
export interface JwtTokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  accountId?: string;
  tenantId: string;
  email: string;
  role: Role;
  name: string;
}

export interface WorkspaceMembership {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  userId: string;
  role: Role;
}
