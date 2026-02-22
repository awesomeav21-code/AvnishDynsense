// Ref: FR-3003 — AI Session Persistence: resumable, forkable, 30-day retention, parent_session_id
// Ref: NFR-045 — session resume < 100ms
// Ref: NFR-046 — session creation < 50ms
// Ref: NFR-047 — session fork < 200ms

import { eq, and, gt } from "drizzle-orm";
import type { Database } from "@dynsense/db";
import { aiSessions } from "@dynsense/db";
import { AI_SESSION_RETENTION_DAYS } from "@dynsense/shared";

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

export interface SessionRecord {
  id: string;
  tenantId: string;
  userId: string;
  capability: string;
  parentSessionId: string | null;
  turnCount: number;
  state: Record<string, unknown> | null;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class SessionService {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Create a new AI session with 30-day expiry.
   * Returns the session ID.
   */
  async create(input: CreateSessionInput): Promise<string> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + AI_SESSION_RETENTION_DAYS);

    const [row] = await this.db
      .insert(aiSessions)
      .values({
        tenantId: input.tenantId,
        userId: input.userId,
        capability: input.capability,
        turnCount: 0,
        state: {},
        status: "active",
        expiresAt,
      })
      .returning();

    return row!.id;
  }

  /**
   * Resume an existing session by ID + tenantId.
   * Verifies the session is not expired and returns its state.
   * Returns null if the session doesn't exist or is expired.
   */
  async resume(input: ResumeSessionInput): Promise<SessionRecord | null> {
    const now = new Date();

    const rows = await this.db
      .select()
      .from(aiSessions)
      .where(
        and(
          eq(aiSessions.id, input.sessionId),
          eq(aiSessions.tenantId, input.tenantId),
          gt(aiSessions.expiresAt, now),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      tenantId: row.tenantId,
      userId: row.userId,
      capability: row.capability,
      parentSessionId: row.parentSessionId,
      turnCount: row.turnCount,
      state: row.state as Record<string, unknown> | null,
      status: row.status,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Fork a session: copy parent session state, set parentSessionId, insert new record.
   * Returns the new session ID.
   */
  async fork(input: ForkSessionInput): Promise<string> {
    // Load parent session
    const parentRows = await this.db
      .select()
      .from(aiSessions)
      .where(
        and(
          eq(aiSessions.id, input.parentSessionId),
          eq(aiSessions.tenantId, input.tenantId),
        ),
      )
      .limit(1);

    const parent = parentRows[0];
    if (!parent) {
      throw new Error(
        `Parent session '${input.parentSessionId}' not found for tenant '${input.tenantId}'`,
      );
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + AI_SESSION_RETENTION_DAYS);

    const [row] = await this.db
      .insert(aiSessions)
      .values({
        tenantId: input.tenantId,
        userId: input.userId,
        capability: parent.capability,
        parentSessionId: input.parentSessionId,
        turnCount: 0,
        state: parent.state ?? {},
        status: "active",
        expiresAt,
      })
      .returning();

    return row!.id;
  }
}
