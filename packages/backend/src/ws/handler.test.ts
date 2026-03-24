import { describe, it, expect, beforeEach, vi } from "vitest";
import { SessionManager, clearSessions } from "../session/manager.js";
import { BookmarkService, clearBookmarks } from "../bookmark/service.js";

/**
 * Unit tests for the WebSocket handler logic.
 * We test the underlying services directly since Socket.IO integration
 * testing requires a running server. The handler is a thin wiring layer.
 */

describe("WebSocket handler — session lifecycle via SessionManager", () => {
  let mgr: SessionManager;

  beforeEach(() => {
    clearSessions();
    mgr = new SessionManager();
  });

  it("session:start creates an active session", () => {
    const session = mgr.create({ userId: "u1", mode: "online" });
    expect(session.status).toBe("active");
    expect(session.id).toBeDefined();
  });

  it("session:pause → session:resume round-trip", () => {
    const session = mgr.create({ userId: "u1", mode: "online" });
    mgr.pause(session.id);
    expect(mgr.getState(session.id)).toBe("paused");
    mgr.resume(session.id);
    expect(mgr.getState(session.id)).toBe("active");
  });

  it("session:end transitions to ended", () => {
    const session = mgr.create({ userId: "u1", mode: "online" });
    mgr.end(session.id);
    expect(mgr.getState(session.id)).toBe("ended");
  });

  it("cannot pause an ended session", () => {
    const session = mgr.create({ userId: "u1", mode: "online" });
    mgr.end(session.id);
    expect(() => mgr.pause(session.id)).toThrow();
  });
});

describe("WebSocket handler — bookmark:create via BookmarkService", () => {
  let svc: BookmarkService;

  beforeEach(() => {
    clearBookmarks();
    svc = new BookmarkService();
  });

  it("creates a bookmark during active session", () => {
    const bm = svc.create({
      sessionId: "s1",
      userId: "u1",
      timestamp: 5000,
      note: "Key insight",
    });
    expect(bm.id).toBeDefined();
    expect(bm.timestamp).toBe(5000);
    expect(bm.note).toBe("Key insight");
  });
});

describe("WebSocket handler — text:submit pipeline simulation", () => {
  it("LanguageDetector detects language from text", async () => {
    const { LanguageDetector } = await import("../language/detector.js");
    const detector = new LanguageDetector();

    const enResult = detector.detectFromText("Hello, how are you?");
    expect(enResult.primaryLanguage).toBe("en");

    const zhResult = detector.detectFromText("你好，你怎么样？");
    expect(zhResult.primaryLanguage).toBe("zh");
  });

  it("VisualizationEngine selects format for a card", async () => {
    const { VisualizationEngine } = await import("../visualization/engine.js");
    const viz = new VisualizationEngine();

    const textCard = {
      id: "c1", sessionId: "s1", category: "factual_statement" as const,
      content: "Test", sourceSegmentIds: [], linkedCardIds: [],
      linkType: null, topicId: "t1", visualizationFormat: "concise_text" as const,
      isHighlighted: false, createdAt: new Date(), updatedAt: new Date(),
    };
    expect(viz.selectFormat(textCard)).toBe("concise_text");

    const diagramCard = { ...textCard, category: "decision" as const };
    expect(viz.selectFormat(diagramCard)).toBe("flow_diagram");
  });
});
