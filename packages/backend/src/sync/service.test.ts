import { describe, it, expect, beforeEach } from "vitest";
import { SyncService, clearSync } from "./service.js";

describe("SyncService", () => {
  let svc: SyncService;

  beforeEach(() => {
    clearSync();
    svc = new SyncService();
  });

  it("pushes a new sync record", () => {
    const record = svc.push({ userId: "u1", sessionId: "s1", localVersion: 1 });
    expect(record.syncStatus).toBe("synced");
    expect(record.localVersion).toBe(1);
    expect(record.remoteVersion).toBe(1);
  });

  it("updates existing sync record on re-push", () => {
    const r1 = svc.push({ userId: "u1", sessionId: "s1", localVersion: 1 });
    const r2 = svc.push({ userId: "u1", sessionId: "s1", localVersion: 2 });
    expect(r2.id).toBe(r1.id);
    expect(r2.localVersion).toBe(2);
    expect(r2.syncStatus).toBe("synced");
  });

  it("detects conflict when versions diverge", () => {
    const r1 = svc.push({ userId: "u1", sessionId: "s1", localVersion: 1 });
    // Simulate remote version being different by manually changing it
    r1.remoteVersion = 5;
    r1.syncStatus = "synced";
    const r2 = svc.push({ userId: "u1", sessionId: "s1", localVersion: 2 });
    expect(r2.syncStatus).toBe("conflict");
  });

  it("pulls all records for a user", () => {
    svc.push({ userId: "u1", sessionId: "s1", localVersion: 1 });
    svc.push({ userId: "u1", sessionId: "s2", localVersion: 1 });
    svc.push({ userId: "u2", sessionId: "s3", localVersion: 1 });
    const records = svc.pull({ userId: "u1" });
    expect(records).toHaveLength(2);
  });

  it("resolves a conflict with local resolution", () => {
    const r = svc.push({ userId: "u1", sessionId: "s1", localVersion: 1 });
    r.remoteVersion = 5;
    r.syncStatus = "conflict";
    r.localVersion = 2;
    const resolved = svc.resolve({ syncId: r.id, resolution: "local" });
    expect(resolved).toBeDefined();
    expect(resolved!.syncStatus).toBe("synced");
    expect(resolved!.remoteVersion).toBe(2); // local wins
  });

  it("resolves a conflict with remote resolution", () => {
    const r = svc.push({ userId: "u1", sessionId: "s1", localVersion: 1 });
    r.remoteVersion = 5;
    r.syncStatus = "conflict";
    r.localVersion = 2;
    const resolved = svc.resolve({ syncId: r.id, resolution: "remote" });
    expect(resolved).toBeDefined();
    expect(resolved!.syncStatus).toBe("synced");
    expect(resolved!.localVersion).toBe(5); // remote wins
  });

  it("returns undefined when resolving non-conflict record", () => {
    const r = svc.push({ userId: "u1", sessionId: "s1", localVersion: 1 });
    expect(svc.resolve({ syncId: r.id, resolution: "local" })).toBeUndefined();
  });

  it("returns undefined for nonexistent sync id", () => {
    expect(svc.resolve({ syncId: "nonexistent", resolution: "local" })).toBeUndefined();
  });
});
