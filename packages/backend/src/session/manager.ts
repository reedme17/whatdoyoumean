/**
 * SessionManager — session lifecycle management.
 *
 * Handles create, pause, resume, end, and state tracking for conversation sessions.
 * Uses in-memory store (will be replaced with PostgreSQL later).
 */

import { randomUUID } from "node:crypto";
import type { ConversationSession, SessionMetadata } from "@wdym/shared";

export interface CreateSessionOptions {
  userId: string;
  mode: ConversationSession["mode"];
  languageCode?: ConversationSession["languageCode"];
  metadata?: Partial<SessionMetadata>;
}

const sessions = new Map<string, ConversationSession>();

function defaultMetadata(): SessionMetadata {
  return {
    platform: "web",
    deviceInfo: "unknown",
    appVersion: "0.1.0",
    localProcessingOnly: false,
  };
}

export class SessionManager {
  create(options: CreateSessionOptions): ConversationSession {
    const now = new Date();
    const session: ConversationSession = {
      id: randomUUID(),
      userId: options.userId,
      mode: options.mode,
      status: "active",
      startedAt: now,
      endedAt: null,
      pausedAt: null,
      durationMs: 0,
      languageCode: options.languageCode ?? "en",
      participantCount: 1,
      sttProvider: "",
      llmProvider: "",
      topicSummary: "",
      metadata: { ...defaultMetadata(), ...options.metadata },
    };
    sessions.set(session.id, session);
    return session;
  }

  get(sessionId: string): ConversationSession | undefined {
    return sessions.get(sessionId);
  }

  pause(sessionId: string): ConversationSession {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (session.status !== "active") throw new Error(`Cannot pause session in state: ${session.status}`);

    session.status = "paused";
    session.pausedAt = new Date();
    // Accumulate duration up to pause point
    session.durationMs += Date.now() - session.startedAt.getTime() - session.durationMs;
    return session;
  }

  resume(sessionId: string): ConversationSession {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (session.status !== "paused") throw new Error(`Cannot resume session in state: ${session.status}`);

    session.status = "active";
    session.pausedAt = null;
    return session;
  }

  end(sessionId: string): ConversationSession {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (session.status === "ended") throw new Error("Session already ended");

    session.status = "ended";
    session.endedAt = new Date();
    session.durationMs = session.endedAt.getTime() - session.startedAt.getTime();
    return session;
  }

  getState(sessionId: string): ConversationSession["status"] | undefined {
    return sessions.get(sessionId)?.status;
  }

  listByUser(userId: string): ConversationSession[] {
    return Array.from(sessions.values())
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  delete(sessionId: string): boolean {
    return sessions.delete(sessionId);
  }
}

/** Exported for testing — clears the in-memory store. */
export function clearSessions(): void {
  sessions.clear();
}
