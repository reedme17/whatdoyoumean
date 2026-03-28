import { describe, it, expect, beforeEach } from "vitest";
import { ConversationMemoryService, clearMemory } from "./service.js";
import type { SessionArchive } from "@wdym/shared";

function makeArchive(): SessionArchive {
  return {
    session: {
      id: "s1", userId: "u1", mode: "online", status: "ended",
      startedAt: new Date(), endedAt: new Date(), pausedAt: null,
      durationMs: 60000, languageCode: "en", participantCount: 2,
      sttProvider: "groq", llmProvider: "cerebras", topicSummary: "Test",
      metadata: { platform: "web", deviceInfo: "test", appVersion: "0.1.0", localProcessingOnly: false },
    },
    transcripts: [],
    cards: [
      {
        id: "c1", sessionId: "s1", category: "decision",
        content: "We decided to use TypeScript",
        sourceSegmentIds: [], linkedCardIds: [], linkType: null,
        topicId: "t1", visualizationFormat: "concise_text",
        isHighlighted: false, createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: "c2", sessionId: "s1", category: "action_item",
        content: "Set up CI pipeline",
        sourceSegmentIds: [], linkedCardIds: [], linkType: null,
        topicId: "t1", visualizationFormat: "concise_text",
        isHighlighted: false, createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: "c3", sessionId: "s1", category: "question",
        content: "What database should we use?",
        sourceSegmentIds: [], linkedCardIds: [], linkType: null,
        topicId: "t1", visualizationFormat: "concise_text",
        isHighlighted: false, createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: "c4", sessionId: "s1", category: "fact",
        content: "The server runs on port 3000",
        sourceSegmentIds: [], linkedCardIds: [], linkType: null,
        topicId: "t1", visualizationFormat: "concise_text",
        isHighlighted: false, createdAt: new Date(), updatedAt: new Date(),
      },
    ],
    recommendations: [],
    speakers: [],
    topicMap: {
      sessionId: "s1",
      topics: [{ id: "t1", sessionId: "s1", name: "Architecture", cardIds: ["c1", "c2", "c3", "c4"], startTime: 0, lastActiveTime: 1000, isResolved: false }],
      relations: [],
    },
    bookmarks: [],
  };
}

describe("ConversationMemoryService", () => {
  let svc: ConversationMemoryService;

  beforeEach(() => {
    clearMemory();
    svc = new ConversationMemoryService();
  });

  it("extracts memory from session archive", () => {
    const entries = svc.extractMemory("u1", makeArchive());
    // Should extract decision, action_item, and question (not fact)
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.type).sort()).toEqual(["action_item", "decision", "unresolved_question"]);
  });

  it("stores extracted entries and retrieves them", () => {
    svc.extractMemory("u1", makeArchive());
    const all = svc.getAll("u1");
    expect(all).toHaveLength(3);
  });

  it("queries memory with topic filter", () => {
    svc.extractMemory("u1", makeArchive());
    const ctx = svc.queryMemory("u1", { topics: ["Architecture"], limit: 10, includeUnresolved: false });
    expect(ctx.relevantEntries.length).toBeGreaterThan(0);
  });

  it("returns unresolved questions and pending action items", () => {
    svc.extractMemory("u1", makeArchive());
    const ctx = svc.queryMemory("u1", { limit: 10, includeUnresolved: true });
    expect(ctx.unresolvedQuestions.length).toBeGreaterThan(0);
    expect(ctx.pendingActionItems.length).toBeGreaterThan(0);
  });

  it("deletes a specific entry", () => {
    const entries = svc.extractMemory("u1", makeArchive());
    expect(svc.deleteEntry("u1", entries[0].id)).toBe(true);
    expect(svc.getAll("u1")).toHaveLength(2);
  });

  it("returns false when deleting nonexistent entry", () => {
    expect(svc.deleteEntry("u1", "nonexistent")).toBe(false);
  });

  it("clears all memory for a user", () => {
    svc.extractMemory("u1", makeArchive());
    svc.clearAll("u1");
    expect(svc.getAll("u1")).toHaveLength(0);
  });

  it("returns user profile with frequent topics and action items", () => {
    svc.extractMemory("u1", makeArchive());
    const profile = svc.getUserProfile("u1");
    expect(profile.userId).toBe("u1");
    expect(profile.frequentTopics.length).toBeGreaterThan(0);
    expect(profile.trackedActionItems.length).toBeGreaterThan(0);
    expect(profile.totalSessions).toBe(1);
  });

  it("returns empty profile for unknown user", () => {
    const profile = svc.getUserProfile("unknown");
    expect(profile.frequentTopics).toHaveLength(0);
    expect(profile.totalSessions).toBe(0);
  });
});
