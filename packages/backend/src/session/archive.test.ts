import { describe, it, expect, beforeEach } from "vitest";
import { SessionArchiveService, clearArchives } from "./archive.js";
import type { SessionArchive } from "@wdym/shared";

function makeArchive(overrides?: Partial<{ userId: string; topicSummary: string; cardContent: string; transcriptText: string }>): SessionArchive {
  const userId = overrides?.userId ?? "u1";
  return {
    session: {
      id: `s_${Date.now()}_${Math.random()}`,
      userId,
      mode: "online",
      status: "ended",
      startedAt: new Date(),
      endedAt: new Date(),
      pausedAt: null,
      durationMs: 60000,
      languageCode: "en",
      participantCount: 2,
      sttProvider: "groq",
      llmProvider: "cerebras",
      topicSummary: overrides?.topicSummary ?? "Test session",
      metadata: { platform: "web", deviceInfo: "test", appVersion: "0.1.0", localProcessingOnly: false },
    },
    transcripts: [
      {
        id: "t1", sessionId: "s1", text: overrides?.transcriptText ?? "Hello world",
        languageCode: "en", speakerId: "speaker_1", startTime: 0, endTime: 1000,
        isFinal: true, confidence: 0.95, provider: "groq", createdAt: new Date(),
      },
    ],
    cards: [
      {
        id: "c1", sessionId: "s1", category: "factual_statement",
        content: overrides?.cardContent ?? "Test card content",
        sourceSegmentIds: ["t1"], linkedCardIds: [], linkType: null,
        topicId: "topic1", visualizationFormat: "concise_text",
        isHighlighted: false, createdAt: new Date(), updatedAt: new Date(),
      },
    ],
    recommendations: [],
    speakers: [{ id: "speaker_1", sessionId: "s1", displayName: "Alice", isUncertain: false }],
    topicMap: { sessionId: "s1", topics: [{ id: "topic1", sessionId: "s1", name: "Greetings", cardIds: ["c1"], startTime: 0, lastActiveTime: 1000, isResolved: false }], relations: [] },
    bookmarks: [],
  };
}

describe("SessionArchiveService", () => {
  let svc: SessionArchiveService;

  beforeEach(() => {
    clearArchives();
    svc = new SessionArchiveService();
  });

  it("saves and retrieves an archive", () => {
    const archive = makeArchive();
    svc.save(archive);
    const retrieved = svc.get(archive.session.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.session.id).toBe(archive.session.id);
  });

  it("lists sessions for a user", () => {
    svc.save(makeArchive({ userId: "u1" }));
    svc.save(makeArchive({ userId: "u1" }));
    svc.save(makeArchive({ userId: "u2" }));
    expect(svc.list("u1")).toHaveLength(2);
    expect(svc.list("u2")).toHaveLength(1);
  });

  it("searches by keyword in topic summary", () => {
    svc.save(makeArchive({ userId: "u1", topicSummary: "Machine learning discussion" }));
    svc.save(makeArchive({ userId: "u1", topicSummary: "Lunch plans" }));
    const results = svc.search("u1", "machine");
    expect(results).toHaveLength(1);
  });

  it("searches by keyword in card content", () => {
    svc.save(makeArchive({ userId: "u1", cardContent: "API design patterns" }));
    svc.save(makeArchive({ userId: "u1", cardContent: "Lunch menu" }));
    const results = svc.search("u1", "API");
    expect(results).toHaveLength(1);
  });

  it("searches by keyword in transcript text", () => {
    svc.save(makeArchive({ userId: "u1", transcriptText: "We should use PostgreSQL" }));
    const results = svc.search("u1", "postgresql");
    expect(results).toHaveLength(1);
  });

  it("deletes an archive", () => {
    const archive = makeArchive();
    svc.save(archive);
    expect(svc.delete(archive.session.id)).toBe(true);
    expect(svc.get(archive.session.id)).toBeUndefined();
  });

  it("exports as markdown", () => {
    const archive = makeArchive({ topicSummary: "My Session" });
    svc.save(archive);
    const md = svc.export(archive.session.id);
    expect(md).toBeDefined();
    expect(md).toContain("# Session: My Session");
    expect(md).toContain("## Key Points");
    expect(md).toContain("## Topics");
    expect(md).toContain("## Transcript");
  });

  it("returns undefined for export of nonexistent session", () => {
    expect(svc.export("nonexistent")).toBeUndefined();
  });
});
