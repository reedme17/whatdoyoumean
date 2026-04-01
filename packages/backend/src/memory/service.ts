/**
 * ConversationMemoryService — extract, query, and manage conversation memory.
 * In-memory store with simple text matching (no pgvector yet).
 */

import { randomUUID } from "node:crypto";
import type { MemoryEntry, UserProfile, SessionArchive } from "@wdym/shared";

export interface MemoryQuery {
  speakerIds?: string[];
  topics?: string[];
  limit: number;
  includeUnresolved: boolean;
}

export interface MemoryContext {
  relevantEntries: MemoryEntry[];
  unresolvedQuestions: MemoryEntry[];
  pendingActionItems: MemoryEntry[];
  recurringTopics: string[];
}

const memoryStore = new Map<string, MemoryEntry[]>();

export class ConversationMemoryService {
  /**
   * Extract memory entries from a completed session archive.
   * Pulls decisions, action items, and questions from cards.
   */
  extractMemory(userId: string, archive: SessionArchive): MemoryEntry[] {
    const entries: MemoryEntry[] = [];
    const typesOfInterest: Record<string, MemoryEntry["type"]> = {
      decision: "decision",
      todo: "todo",
      question: "unresolved_question",
    };

    for (const card of archive.cards) {
      const memType = typesOfInterest[card.category];
      if (!memType) continue;

      const topic = archive.topicMap.topics.find((t) => t.id === card.topicId);
      const entry: MemoryEntry = {
        id: randomUUID(),
        userId,
        sessionId: archive.session.id,
        type: memType,
        content: card.content,
        speakerIds: [],
        topics: topic ? [topic.name] : [],
        embedding: [], // no pgvector yet
        isResolved: false,
        createdAt: new Date(),
        resolvedAt: null,
      };
      entries.push(entry);
    }

    // Store them
    const existing = memoryStore.get(userId) ?? [];
    existing.push(...entries);
    memoryStore.set(userId, existing);

    return entries;
  }

  /**
   * Query memory with simple text matching (pgvector semantic search later).
   */
  queryMemory(userId: string, query: MemoryQuery): MemoryContext {
    const all = memoryStore.get(userId) ?? [];
    let filtered = all;

    if (query.speakerIds && query.speakerIds.length > 0) {
      filtered = filtered.filter((e) =>
        e.speakerIds.some((s) => query.speakerIds!.includes(s)),
      );
    }

    if (query.topics && query.topics.length > 0) {
      const lowerTopics = query.topics.map((t) => t.toLowerCase());
      filtered = filtered.filter((e) =>
        e.topics.some((t) => lowerTopics.includes(t.toLowerCase())),
      );
    }

    const relevantEntries = filtered.slice(0, query.limit);

    const unresolvedQuestions = query.includeUnresolved
      ? all.filter((e) => e.type === "unresolved_question" && !e.isResolved)
      : [];

    const pendingActionItems = query.includeUnresolved
      ? all.filter((e) => e.type === "todo" && !e.isResolved)
      : [];

    // Count topic frequency for recurring topics
    const topicCounts = new Map<string, number>();
    for (const e of all) {
      for (const t of e.topics) {
        topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);
      }
    }
    const recurringTopics = Array.from(topicCounts.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([topic]) => topic);

    return { relevantEntries, unresolvedQuestions, pendingActionItems, recurringTopics };
  }

  deleteEntry(userId: string, entryId: string): boolean {
    const entries = memoryStore.get(userId);
    if (!entries) return false;
    const idx = entries.findIndex((e) => e.id === entryId);
    if (idx === -1) return false;
    entries.splice(idx, 1);
    return true;
  }

  clearAll(userId: string): void {
    memoryStore.delete(userId);
  }

  getUserProfile(userId: string): UserProfile {
    const entries = memoryStore.get(userId) ?? [];

    const topicCounts = new Map<string, number>();
    const sessionIds = new Set<string>();
    for (const e of entries) {
      sessionIds.add(e.sessionId);
      for (const t of e.topics) {
        topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);
      }
    }

    const frequentTopics = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));

    const trackedActionItems = entries
      .filter((e) => e.type === "todo")
      .map((e) => ({
        id: e.id,
        content: e.content,
        isResolved: e.isResolved,
        sessionId: e.sessionId,
        createdAt: e.createdAt,
        resolvedAt: e.resolvedAt,
      }));

    return {
      userId,
      frequentTopics,
      commonSpeakers: [],
      trackedActionItems,
      totalSessions: sessionIds.size,
      totalDurationMs: 0,
    };
  }

  /** Get all entries for a user (for REST endpoint) */
  getAll(userId: string): MemoryEntry[] {
    return memoryStore.get(userId) ?? [];
  }
}

/** Exported for testing */
export function clearMemory(): void {
  memoryStore.clear();
}
