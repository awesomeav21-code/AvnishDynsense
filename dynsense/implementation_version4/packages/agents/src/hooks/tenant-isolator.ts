// Ref: FR-341 — tenant-isolator hook: block cross-tenant access, inject tenant_id
// Ref: FR-3004 — PreToolUse (sequential, first-deny-wins)
// Ref: design-doc §4.4 — Phase: PreToolUse (sequential)

export interface HookContext {
  tenantId: string;
  userId: string;
  aiActionId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
}

export interface HookResult {
  allowed: boolean;
  reason?: string;
  modifiedInput?: Record<string, unknown>;
}

export async function tenantIsolator(ctx: HookContext): Promise<HookResult> {
  // Inject tenant_id into all tool inputs
  const modifiedInput = { ...ctx.toolInput, tenant_id: ctx.tenantId };

  // Block if tool input references a different tenant
  const inputTenantId = ctx.toolInput["tenant_id"];
  if (inputTenantId && inputTenantId !== ctx.tenantId) {
    return { allowed: false, reason: "Cross-tenant access blocked" };
  }

  return { allowed: true, modifiedInput };
}
