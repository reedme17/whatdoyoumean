import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { clearUsers } from "../auth/routes.js";
import { clearArchives } from "./archive.js";
import { archiveService } from "./routes.js";
import type { SessionArchive } from "@wdym/shared";

async function getAccessToken(app: Awaited<ReturnType<typeof buildApp>>): Promise<{ token: string; userId: string }> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: "session-user@example.com", password: "password123" },
  });
  const body = res.json();
  return { token: body.accessToken, userId: body.user.id };
}

function makeArchive(userId: string, sessionId: string, topicSummary = "Test"): SessionArchive {
  return {
    session: {
      id: sessionId, userId, mode: "online", status: "ended",
      startedAt: new Date(), endedAt: new Date(), pausedAt: null,
      durationMs: 60000, languageCode: "en", participantCount: 1,
      sttProvider: "groq", llmProvider: "cerebras", topicSummary,
      metadata: { platform: "web", deviceInfo: "test", appVersion: "0.1.0", localProcessingOnly: false },
    },
    transcripts: [{ id: "t1", sessionId, text: "Hello", languageCode: "en", speakerId: "s1", startTime: 0, endTime: 1000, isFinal: true, confidence: 0.9, provider: "groq", createdAt: new Date() }],
    cards: [{ id: "c1", sessionId, category: "factual_statement", content: "Test card", sourceSegmentIds: ["t1"], linkedCardIds: [], linkType: null, topicId: "t1", visualizationFormat: "concise_text", isHighlighted: false, createdAt: new Date(), updatedAt: new Date() }],
    recommendations: [],
    speakers: [],
    topicMap: { sessionId, topics: [], relations: [] },
    bookmarks: [],
  };
}

describe("Session REST routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    clearUsers();
    clearArchives();
    app = await buildApp();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it("GET /api/sessions returns empty list initially", async () => {
    const { token } = await getAccessToken(app);
    const res = await app.inject({ method: "GET", url: "/api/sessions", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("GET /api/sessions returns saved sessions", async () => {
    const { token, userId } = await getAccessToken(app);
    archiveService.save(makeArchive(userId, "s1"));
    const res = await app.inject({ method: "GET", url: "/api/sessions", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it("GET /api/sessions/:id returns full archive", async () => {
    const { token, userId } = await getAccessToken(app);
    archiveService.save(makeArchive(userId, "s1"));
    const res = await app.inject({ method: "GET", url: "/api/sessions/s1", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().session.id).toBe("s1");
  });

  it("GET /api/sessions/:id returns 404 for unknown session", async () => {
    const { token } = await getAccessToken(app);
    const res = await app.inject({ method: "GET", url: "/api/sessions/unknown", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(404);
  });

  it("GET /api/sessions/:id/export returns markdown", async () => {
    const { token, userId } = await getAccessToken(app);
    archiveService.save(makeArchive(userId, "s1", "My Session"));
    const res = await app.inject({ method: "GET", url: "/api/sessions/s1/export", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/markdown");
    expect(res.body).toContain("# Session: My Session");
  });

  it("DELETE /api/sessions/:id removes session", async () => {
    const { token, userId } = await getAccessToken(app);
    archiveService.save(makeArchive(userId, "s1"));
    const res = await app.inject({ method: "DELETE", url: "/api/sessions/s1", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(204);
    const getRes = await app.inject({ method: "GET", url: "/api/sessions/s1", headers: { authorization: `Bearer ${token}` } });
    expect(getRes.statusCode).toBe(404);
  });

  it("GET /api/sessions/search?q=keyword searches sessions", async () => {
    const { token, userId } = await getAccessToken(app);
    archiveService.save(makeArchive(userId, "s1", "Machine learning"));
    archiveService.save(makeArchive(userId, "s2", "Lunch plans"));
    const res = await app.inject({ method: "GET", url: "/api/sessions/search?q=machine", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it("GET /api/sessions/search without q returns 400", async () => {
    const { token } = await getAccessToken(app);
    const res = await app.inject({ method: "GET", url: "/api/sessions/search", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(400);
  });

  it("returns 401 without auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/sessions" });
    expect(res.statusCode).toBe(401);
  });
});
