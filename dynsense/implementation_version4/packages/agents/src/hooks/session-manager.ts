// Ref: FR-349 — session-manager (stop hook): persist session state and turn count
// Ref: FR-3003 — AI Session Persistence: resumable, forkable
// Ref: design-doc §4.4 — Phase: Stop (sequential)
import { eq, and } from "drizzle-orm";
import type { Database } from "@dynsense/db";
import { aiSessions } from "@dynsense/db";
import { AI_SESSION_RETENTION_DAYS } from "@dynsense/shared";

export interface SessionState {
  sessionId: string;
  tenantId: string;
  userId: string;
  capability: string;
  turnCount: number;
  state: Record<string, unknown>;
}

export async function sessionManager(
  sessionState: SessionState,
  db: Database,
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + AI_SESSION_RETENTION_DAYS);

  // Try to update an existing session first
  const updated = await db
    .update(aiSessions)
    .set({
      turnCount: sessionState.turnCount,
      state: sessionState.state,
      expiresAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(aiSessions.id, sessionState.sessionId),
        eq(aiSessions.tenantId, sessionState.tenantId),
      ),
    )
    .returning();

  // If no rows updated, this session doesn't exist yet — that's fine.
  // Session creation is handled by the SessionService.create() path.
  if (updated.length === 0) {
    // Session does not exist — skip silently. The orchestrator may have used
    // a temporary aiActionId as sessionId when no explicit session was provided.
    return;
  }
}
