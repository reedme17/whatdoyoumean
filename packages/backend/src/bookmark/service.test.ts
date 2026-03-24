import { describe, it, expect, beforeEach } from "vitest";
import { BookmarkService, clearBookmarks } from "./service.js";

describe("BookmarkService", () => {
  let svc: BookmarkService;

  beforeEach(() => {
    clearBookmarks();
    svc = new BookmarkService();
  });

  it("creates a bookmark", () => {
    const bm = svc.create({
      sessionId: "s1",
      userId: "u1",
      timestamp: 5000,
      note: "Important point",
    });
    expect(bm.id).toBeDefined();
    expect(bm.sessionId).toBe("s1");
    expect(bm.note).toBe("Important point");
    expect(bm.timestamp).toBe(5000);
  });

  it("creates a bookmark with cardId", () => {
    const bm = svc.create({
      sessionId: "s1",
      userId: "u1",
      timestamp: 3000,
      cardId: "card_1",
    });
    expect(bm.cardId).toBe("card_1");
    expect(bm.note).toBeNull();
  });

  it("retrieves bookmarks by session", () => {
    svc.create({ sessionId: "s1", userId: "u1", timestamp: 1000 });
    svc.create({ sessionId: "s1", userId: "u1", timestamp: 2000 });
    svc.create({ sessionId: "s2", userId: "u1", timestamp: 3000 });
    expect(svc.getBySession("s1")).toHaveLength(2);
    expect(svc.getBySession("s2")).toHaveLength(1);
  });

  it("retrieves bookmarks by user", () => {
    svc.create({ sessionId: "s1", userId: "u1", timestamp: 1000 });
    svc.create({ sessionId: "s2", userId: "u1", timestamp: 2000 });
    svc.create({ sessionId: "s1", userId: "u2", timestamp: 3000 });
    expect(svc.getByUser("u1")).toHaveLength(2);
    expect(svc.getByUser("u2")).toHaveLength(1);
  });

  it("deletes a bookmark", () => {
    const bm = svc.create({ sessionId: "s1", userId: "u1", timestamp: 1000 });
    expect(svc.delete("s1", bm.id)).toBe(true);
    expect(svc.getBySession("s1")).toHaveLength(0);
  });

  it("returns false when deleting nonexistent bookmark", () => {
    expect(svc.delete("s1", "nonexistent")).toBe(false);
  });
});
