import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { clearUsers } from "../auth/routes.js";
import { clearMemory } from "./service.js";
import { memoryService } from "./routes.js";
import type { SessionArchive } from "@wdym/shared";

async function getAccessToken(app: Awaited<ReturnType<typeof buildApp>>): Promise<{ token: string; userId: string }> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: "memory-user@example.com", password: "password123" },
  });
  const body = res.json();
  return { token: body.accessToken, userId: body.user.id };
}

function makeArchive(userId: string): SessionArchive {
  return {
    session: {
      id: "s1", userId, mode: "online", status: "ended",
      startedAt: new Date(), endedAt: new Date(), pausedAt: null,
      durationMs: 60000, languageCode: "en", participantCount: 1,
      sttProvider: "groq", llmProvider: "cerebras", topicSummary: "Test",
      metadata: { platform: "web", deviceInfo: "test", appVersion: "0.1.0", localProcessingOnly: false },
    },
    transcripts: [],
    cards: [
      { id: "c1", sessionId: "s1", category: "decision", content: "Use TypeScript", sourceSegmentIds: [], linkedCardIds: [], linkType: null, topicId: "t1", visualizationFormat: "concise_text", isHighlighted: false, createdAt: new Date(), updatedAt: new Date() },
    ],
    recommendations: [],
    speakers: [],
    topicMap: { sessionId: "s1", topics: [{ id: "t1", sessionId: "s1", name: "Tech", cardIds: ["c1"], startTime: 0, lastActiveTime: 1000, isResolved: false }], relations: [] },
    bookmarks: [],
  };
}

describe("Memory REST routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    clearUsers();
    clearMemory();
    app = await buildApp();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it("GET /api/memory returns empty initially", async () => {
    const { token } = await getAccessToken(app);
    const res = await app.inject({ method: "GET", url: "/api/memory", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("GET /api/memory returns entries after extraction", async () => {
    const { token, userId } = await getAccessToken(app);
    memoryService.extractMemory(userId, makeArchive(userId));
    const res = await app.inject({ method: "GET", url: "/api/memory", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().length).toBeGreaterThan(0);
  });

  it("GET /api/memory/profile returns user profile", async () => {
    const { token, userId } = await getAccessToken(app);
    memoryService.extractMemory(userId, makeArchive(userId));
    const res = await app.inject({ method: "GET", url: "/api/memory/profile", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().userId).toBe(userId);
  });

  it("DELETE /api/memory/:entryId deletes an entry", async () => {
    const { token, userId } = await getAccessToken(app);
    const entries = memoryService.extractMemory(userId, makeArchive(userId));
    const res = await app.inject({ method: "DELETE", url: `/api/memory/${entries[0].id}`, headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(204);
  });

  it("DELETE /api/memory/:entryId returns 404 for unknown entry", async () => {
    const { token } = await getAccessToken(app);
    const res = await app.inject({ method: "DELETE", url: "/api/memory/nonexistent", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(404);
  });

  it("DELETE /api/memory clears all memory", async () => {
    const { token, userId } = await getAccessToken(app);
    memoryService.extractMemory(userId, makeArchive(userId));
    const res = await app.inject({ method: "DELETE", url: "/api/memory", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(204);
    const getRes = await app.inject({ method: "GET", url: "/api/memory", headers: { authorization: `Bearer ${token}` } });
    expect(getRes.json()).toEqual([]);
  });

  it("returns 401 without auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/memory" });
    expect(res.statusCode).toBe(401);
  });
});
