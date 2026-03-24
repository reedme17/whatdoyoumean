import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PrivacyHandler } from "./handler.js";

describe("PrivacyHandler", () => {
  let handler: PrivacyHandler;

  beforeEach(() => {
    handler = new PrivacyHandler();
  });

  afterEach(() => {
    handler.dispose();
  });

  // ── Local Processing Only ──

  it("defaults to cloud providers enabled", () => {
    expect(handler.isLocalProcessingOnly()).toBe(false);
    expect(handler.shouldUseCloudProviders()).toBe(true);
  });

  it("disables cloud providers when local processing only is enabled", () => {
    handler.setLocalProcessingOnly(true);
    expect(handler.isLocalProcessingOnly()).toBe(true);
    expect(handler.shouldUseCloudProviders()).toBe(false);
  });

  it("re-enables cloud providers when local processing only is disabled", () => {
    handler.setLocalProcessingOnly(true);
    handler.setLocalProcessingOnly(false);
    expect(handler.shouldUseCloudProviders()).toBe(true);
  });

  // ── Buffer tracking ──

  it("tracks audio buffers per session", () => {
    handler.trackBuffer("s1", { id: "b1", size: 1024, createdAt: Date.now() });
    handler.trackBuffer("s1", { id: "b2", size: 2048, createdAt: Date.now() });
    handler.trackBuffer("s2", { id: "b3", size: 512, createdAt: Date.now() });

    expect(handler.getBuffers("s1")).toHaveLength(2);
    expect(handler.getBuffers("s2")).toHaveLength(1);
    expect(handler.getBuffers("s3")).toHaveLength(0);
  });

  it("purges buffers for a session", () => {
    handler.trackBuffer("s1", { id: "b1", size: 1024, createdAt: Date.now() });
    handler.trackBuffer("s1", { id: "b2", size: 2048, createdAt: Date.now() });

    const count = handler.purgeBuffers("s1");
    expect(count).toBe(2);
    expect(handler.getBuffers("s1")).toHaveLength(0);
  });

  it("purges all buffers", () => {
    handler.trackBuffer("s1", { id: "b1", size: 1024, createdAt: Date.now() });
    handler.trackBuffer("s2", { id: "b2", size: 512, createdAt: Date.now() });

    const total = handler.purgeAll();
    expect(total).toBe(2);
    expect(handler.getBuffers("s1")).toHaveLength(0);
    expect(handler.getBuffers("s2")).toHaveLength(0);
  });

  // ── Scheduled cleanup ──

  it("schedules cleanup within 5 seconds", async () => {
    const fast = new PrivacyHandler({ audioCleanupDelayMs: 50 });
    fast.trackBuffer("s1", { id: "b1", size: 1024, createdAt: Date.now() });
    fast.trackBuffer("s1", { id: "b2", size: 2048, createdAt: Date.now() });

    const count = await fast.scheduleCleanup("s1");
    expect(count).toBe(2);
    expect(fast.getBuffers("s1")).toHaveLength(0);
    fast.dispose();
  });

  // ── Concurrent audio capture detection (stub) ──

  it("returns no concurrent capture detected (stub)", () => {
    const result = handler.detectConcurrentAudioCapture();
    expect(result.detected).toBe(false);
    expect(result.appName).toBeNull();
  });

  // ── Config override ──

  it("respects custom config", () => {
    const custom = new PrivacyHandler({ localProcessingOnly: true });
    expect(custom.isLocalProcessingOnly()).toBe(true);
    expect(custom.shouldUseCloudProviders()).toBe(false);
    custom.dispose();
  });
});
