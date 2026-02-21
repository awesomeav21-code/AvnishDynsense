// Ref: FR-349 — session-manager (stop hook): persist session state and turn count
// Ref: FR-3003 — AI Session Persistence: resumable, forkable
// Ref: design-doc §4.4 — Phase: Stop (sequential)

export interface SessionState {
  sessionId: string;
  tenantId: string;
  userId: string;
  capability: string;
  turnCount: number;
  state: Record<string, unknown>;
}

export async function sessionManager(_sessionState: SessionState): Promise<void> {
  // Stub: In full implementation:
  // 1. Update ai_sessions table with current state and turn count
  // 2. Update expires_at (30-day rolling window)
  // 3. Mark session as "completed" or "paused" based on stop reason
}
