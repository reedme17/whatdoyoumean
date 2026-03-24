import { describe, it, expect, beforeEach, vi } from "vitest";
import { ErrorHandler } from "./handler.js";

describe("ErrorHandler", () => {
  let handler: ErrorHandler;

  beforeEach(() => {
    handler = new ErrorHandler();
  });

  // ── Error logging ──

  it("logs errors with timestamp, subsystem, and details", () => {
    const entry = handler.logError("stt", "Transcription failed", "timeout", true);
    expect(entry.subsystem).toBe("stt");
    expect(entry.message).toBe("Transcription failed");
    expect(entry.details).toBe("timeout");
    expect(entry.recoverable).toBe(true);
    expect(entry.timestamp).toBeTruthy();

    const logs = handler.getErrorLogs();
    expect(logs).toHaveLength(1);
  });

  it("clears logs", () => {
    handler.logError("stt", "err1");
    handler.logError("llm", "err2");
    handler.clearLogs();
    expect(handler.getErrorLogs()).toHaveLength(0);
  });

  // ── Retry logic ──

  it("retries up to 3 times then throws", async () => {
    let attempts = 0;
    const op = async () => {
      attempts++;
      throw new Error("fail");
    };

    await expect(handler.withRetry(op, "stt", "transcribe")).rejects.toThrow("fail");
    expect(attempts).toBe(3);
    // 3 attempt logs + 1 exhaustion log
    expect(handler.getErrorLogs()).toHaveLength(4);
  });

  it("succeeds on second attempt", async () => {
    let attempts = 0;
    const op = async () => {
      attempts++;
      if (attempts < 2) throw new Error("transient");
      return "ok";
    };

    const result = await handler.withRetry(op, "stt", "transcribe");
    expect(result).toBe("ok");
    expect(attempts).toBe(2);
  });

  it("succeeds on first attempt without logging errors", async () => {
    const result = await handler.withRetry(async () => 42, "stt", "transcribe");
    expect(result).toBe(42);
    expect(handler.getErrorLogs()).toHaveLength(0);
  });

  // ── Transcription queue ──

  it("queues and drains transcription data", () => {
    handler.queueTranscription("s1", { audio: "chunk1" });
    handler.queueTranscription("s1", { audio: "chunk2" });
    expect(handler.getQueueSize()).toBe(2);

    const items = handler.drainTranscriptionQueue();
    expect(items).toHaveLength(2);
    expect(items[0].sessionId).toBe("s1");
    expect(handler.getQueueSize()).toBe(0);
  });

  // ── Safe semantic analysis ──

  it("returns result on success", async () => {
    const result = await handler.safeSemanticAnalysis(async () => "card", "seg1");
    expect(result).toBe("card");
  });

  it("returns null and logs on failure", async () => {
    const result = await handler.safeSemanticAnalysis(
      async () => { throw new Error("LLM down"); },
      "seg1",
    );
    expect(result).toBeNull();
    expect(handler.getErrorLogs()).toHaveLength(1);
    expect(handler.getErrorLogs()[0].subsystem).toBe("semantic");
  });

  // ── Session checkpoints ──

  it("saves and retrieves checkpoints", () => {
    const cp = {
      sessionId: "s1",
      timestamp: Date.now(),
      transcriptCount: 10,
      cardCount: 3,
      lastSegmentId: "seg_5",
    };
    handler.saveCheckpoint(cp);
    expect(handler.getCheckpoint("s1")).toEqual(cp);
    expect(handler.getCheckpoint("s2")).toBeNull();
  });

  it("clears checkpoints", () => {
    handler.saveCheckpoint({
      sessionId: "s1",
      timestamp: Date.now(),
      transcriptCount: 5,
      cardCount: 1,
      lastSegmentId: null,
    });
    handler.clearCheckpoint("s1");
    expect(handler.getCheckpoint("s1")).toBeNull();
  });

  it("lists recoverable sessions", () => {
    handler.saveCheckpoint({ sessionId: "s1", timestamp: 1, transcriptCount: 1, cardCount: 0, lastSegmentId: null });
    handler.saveCheckpoint({ sessionId: "s2", timestamp: 2, transcriptCount: 3, cardCount: 1, lastSegmentId: "x" });
    expect(handler.getRecoverableSessions()).toHaveLength(2);
  });

  // ── Resource warnings ──

  it("emits low storage warning", () => {
    const cb = vi.fn();
    handler.onWarning = cb;
    handler.emitLowStorageWarning();
    expect(cb).toHaveBeenCalledOnce();
    expect(cb.mock.calls[0][0].type).toBe("low_storage");
    expect(handler.getErrorLogs()).toHaveLength(1);
  });

  it("emits low battery warning", () => {
    const cb = vi.fn();
    handler.onWarning = cb;
    handler.emitLowBatteryWarning(8);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb.mock.calls[0][0].type).toBe("low_battery");
    expect(cb.mock.calls[0][0].message).toContain("8%");
  });
});
