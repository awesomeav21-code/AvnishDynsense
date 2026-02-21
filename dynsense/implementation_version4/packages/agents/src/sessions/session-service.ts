// Ref: FR-3003 — AI Session Persistence: resumable, forkable, 30-day retention, parent_session_id
// Ref: NFR-045 — session resume < 100ms
// Ref: NFR-046 — session creation < 50ms
// Ref: NFR-047 — session fork < 200ms

import { randomUUID } from "node:crypto";

export interface CreateSessionInput {
  tenantId: string;
  userId: string;
  capability: string;
}

export interface ResumeSessionInput {
  sessionId: string;
  tenantId: string;
}

export interface ForkSessionInput {
  parentSessionId: string;
  tenantId: string;
  userId: string;
}

export class SessionService {
  async create(_input: CreateSessionInput): Promise<string> {
    // Stub: Insert into ai_sessions with 30-day expiry, return session ID
    return randomUUID();
  }

  async resume(_input: ResumeSessionInput): Promise<Record<string, unknown> | null> {
    // Stub: Load session state from ai_sessions, verify not expired
    return null;
  }

  async fork(_input: ForkSessionInput): Promise<string> {
    // Stub: Clone parent session state, set parent_session_id, return new ID
    return randomUUID();
  }
}
