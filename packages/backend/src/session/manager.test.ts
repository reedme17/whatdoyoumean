import { describe, it, expect, beforeEach } from "vitest";
import { SessionManager, clearSessions } from "./manager.js";

describe("SessionManager", () => {
  let mgr: SessionManager;

  beforeEach(() => {
    clearSessions();
    mgr = new SessionManager();
  });

  it("creates a session with active status", () => {
    const s = mgr.create({ userId: "u1", mode: "online" });
    expect(s.status).toBe("active");
    expect(s.userId).toBe("u1");
    expect(s.mode).toBe("online");
    expect(s.id).toBeDefined();
  });

  it("pauses an active session", () => {
    const s = mgr.create({ userId: "u1", mode: "online" });
    const paused = mgr.pause(s.id);
    expect(paused.status).toBe("paused");
    expect(paused.pausedAt).not.toBeNull();
  });

  it("resumes a paused session", () => {
    const s = mgr.create({ userId: "u1", mode: "online" });
    mgr.pause(s.id);
    const resumed = mgr.resume(s.id);
    expect(resumed.status).toBe("active");
    expect(resumed.pausedAt).toBeNull();
  });

  it("ends a session", () => {
    const s = mgr.create({ userId: "u1", mode: "online" });
    const ended = mgr.end(s.id);
    expect(ended.status).toBe("ended");
    expect(ended.endedAt).not.toBeNull();
  });

  it("throws when pausing a non-active session", () => {
    const s = mgr.create({ userId: "u1", mode: "online" });
    mgr.end(s.id);
    expect(() => mgr.pause(s.id)).toThrow();
  });

  it("throws when resuming a non-paused session", () => {
    const s = mgr.create({ userId: "u1", mode: "online" });
    expect(() => mgr.resume(s.id)).toThrow();
  });

  it("throws when ending an already ended session", () => {
    const s = mgr.create({ userId: "u1", mode: "online" });
    mgr.end(s.id);
    expect(() => mgr.end(s.id)).toThrow();
  });

  it("throws for unknown session id", () => {
    expect(() => mgr.pause("nonexistent")).toThrow();
  });

  it("lists sessions by user sorted by date", () => {
    mgr.create({ userId: "u1", mode: "online" });
    mgr.create({ userId: "u1", mode: "text" });
    mgr.create({ userId: "u2", mode: "online" });
    const list = mgr.listByUser("u1");
    expect(list).toHaveLength(2);
  });

  it("deletes a session", () => {
    const s = mgr.create({ userId: "u1", mode: "online" });
    expect(mgr.delete(s.id)).toBe(true);
    expect(mgr.get(s.id)).toBeUndefined();
  });

  it("getState returns correct state", () => {
    const s = mgr.create({ userId: "u1", mode: "online" });
    expect(mgr.getState(s.id)).toBe("active");
    mgr.pause(s.id);
    expect(mgr.getState(s.id)).toBe("paused");
  });
});
