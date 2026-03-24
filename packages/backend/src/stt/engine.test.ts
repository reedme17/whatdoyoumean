import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { TranscriptionEngine } from "./engine.js";
import type {
  STTProvider,
  AudioChunk,
  TranscriptSegment,
  AdaptiveSTTConfig,
} from "./types.js";

// ── helpers ──────────────────────────────────────────────────────

function makeChunk(overrides: Partial<AudioChunk> = {}): AudioChunk {
  return {
    data: new Float32Array(160),
    timestamp: Date.now(),
    channel: "mixed",
    durationMs: 100,
    ...overrides,
  };
}

function makeSegment(
  provider: string,
  overrides: Partial<TranscriptSegment> = {},
): TranscriptSegment {
  return {
    id: `seg_${Date.now()}`,
    sessionId: "test-session",
    text: `text from ${provider}`,
    languageCode: "en",
    speakerId: "speaker_1",
    startTime: 0,
    endTime: 100,
    isFinal: true,
    confidence: 0.95,
    provider,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeProvider(
  name: string,
  opts: {
    type?: "local" | "cloud";
    supportedLanguages?: ("zh" | "en")[];
    feedLatencyMs?: number;
  } = {},
): STTProvider {
  const {
    type = "cloud",
    supportedLanguages = ["en"],
    feedLatencyMs = 0,
  } = opts;

  let resultCallback: ((result: TranscriptSegment) => void) | null = null;
  let active = false;
  let lang = "en";

  return {
    name,
    type,
    supportedLanguages,
    get onResult() {
      return resultCallback;
    },
    set onResult(cb) {
      resultCallback = cb;
    },
    startStream(languageCode: string) {
      active = true;
      lang = languageCode;
    },
    feedAudio(chunk: AudioChunk) {
      if (!active) return;
      // Simulate latency by blocking (synchronous for test simplicity)
      if (feedLatencyMs > 0) {
        const end = Date.now() + feedLatencyMs;
        while (Date.now() < end) {
          /* busy wait */
        }
      }
      // Emit a final result
      if (resultCallback) {
        resultCallback(
          makeSegment(name, {
            languageCode: lang as "zh" | "en",
            startTime: chunk.timestamp,
            endTime: chunk.timestamp + chunk.durationMs,
          }),
        );
      }
    },
    stopStream() {
      active = false;
    },
  };
}

// ── tests ────────────────────────────────────────────────────────

describe("TranscriptionEngine", () => {
  let engine: TranscriptionEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    engine = new TranscriptionEngine();
  });

  afterEach(() => {
    engine.stopTranscription();
    vi.useRealTimers();
  });

  // ── Language routing ──

  describe("language routing", () => {
    it("routes English audio to groq_whisper provider", () => {
      const groq = makeProvider("groq_whisper", {
        supportedLanguages: ["en"],
      });
      const dashscope = makeProvider("dashscope_qwen", {
        supportedLanguages: ["zh"],
      });

      engine.registerCloudProvider(groq);
      engine.registerCloudProvider(dashscope);

      engine.startTranscription("s1", "en");
      expect(engine.getActiveProvider()?.name).toBe("groq_whisper");
    });

    it("routes Chinese audio to dashscope_qwen provider", () => {
      const groq = makeProvider("groq_whisper", {
        supportedLanguages: ["en"],
      });
      const dashscope = makeProvider("dashscope_qwen", {
        supportedLanguages: ["zh"],
      });

      engine.registerCloudProvider(groq);
      engine.registerCloudProvider(dashscope);

      engine.startTranscription("s1", "zh");
      expect(engine.getActiveProvider()?.name).toBe("dashscope_qwen");
    });

    it("falls back to local provider when no cloud provider matches language", () => {
      const local = makeProvider("local_stub", {
        type: "local",
        supportedLanguages: ["zh", "en"],
      });
      engine.registerLocalProvider(local);

      engine.startTranscription("s1", "en");
      expect(engine.getActiveProvider()?.name).toBe("local_stub");
    });
  });

  // ── Result forwarding ──

  describe("result forwarding", () => {
    it("forwards final results via onFinalResult", () => {
      const groq = makeProvider("groq_whisper");
      engine.registerCloudProvider(groq);

      const results: TranscriptSegment[] = [];
      engine.onFinalResult = (r) => results.push(r);

      engine.startTranscription("s1", "en");
      engine.feedAudio(makeChunk());

      expect(results).toHaveLength(1);
      expect(results[0].provider).toBe("groq_whisper");
    });

    it("forwards interim results via onInterimResult", () => {
      // Create a provider that emits interim results
      const provider = makeProvider("groq_whisper");
      const origFeed = provider.feedAudio.bind(provider);
      provider.feedAudio = function (chunk: AudioChunk) {
        // Override to emit interim instead of final
        if (provider.onResult) {
          provider.onResult(
            makeSegment("groq_whisper", { isFinal: false }),
          );
        }
      };

      engine.registerCloudProvider(provider);

      const interimResults: TranscriptSegment[] = [];
      engine.onInterimResult = (r) => interimResults.push(r);

      engine.startTranscription("s1", "en");
      engine.feedAudio(makeChunk());

      expect(interimResults).toHaveLength(1);
      expect(interimResults[0].isFinal).toBe(false);
    });
  });

  // ── Adaptive switching ──

  describe("adaptive cloud/local switching", () => {
    it("falls back to local when cloud latency exceeds threshold", () => {
      const groq = makeProvider("groq_whisper", { feedLatencyMs: 600 });
      const local = makeProvider("local_stub", {
        type: "local",
        supportedLanguages: ["zh", "en"],
      });

      engine = new TranscriptionEngine({ cloudLatencyThresholdMs: 500 });
      engine.registerCloudProvider(groq);
      engine.registerLocalProvider(local);

      engine.startTranscription("s1", "en");
      expect(engine.getActiveProvider()?.name).toBe("groq_whisper");

      // Feed audio — the 600ms latency should trigger fallback
      vi.useRealTimers(); // need real timers for busy-wait latency
      engine.feedAudio(makeChunk());

      expect(engine.isUsingLocalFallback()).toBe(true);
      expect(engine.getActiveProvider()?.name).toBe("local_stub");
    });

    it("falls back to local on reportNetworkUnavailable()", () => {
      const groq = makeProvider("groq_whisper");
      const local = makeProvider("local_stub", {
        type: "local",
        supportedLanguages: ["zh", "en"],
      });

      engine.registerCloudProvider(groq);
      engine.registerLocalProvider(local);

      engine.startTranscription("s1", "en");
      engine.reportNetworkUnavailable();

      expect(engine.isUsingLocalFallback()).toBe(true);
      expect(engine.getActiveProvider()?.name).toBe("local_stub");
    });

    it("emits onProviderSwitch when switching providers", () => {
      const groq = makeProvider("groq_whisper");
      const local = makeProvider("local_stub", {
        type: "local",
        supportedLanguages: ["zh", "en"],
      });

      engine.registerCloudProvider(groq);
      engine.registerLocalProvider(local);

      const switches: { from: string; to: string }[] = [];
      engine.onProviderSwitch = (from, to) =>
        switches.push({ from: from.name, to: to.name });

      engine.startTranscription("s1", "en");
      engine.reportNetworkUnavailable();

      expect(switches).toHaveLength(1);
      expect(switches[0]).toEqual({
        from: "groq_whisper",
        to: "local_stub",
      });
    });
  });

  // ── Debounced switch-back ──

  describe("debounced switch-back to cloud", () => {
    it("switches back to cloud after switchBackDelayMs when network restores", () => {
      const groq = makeProvider("groq_whisper");
      const local = makeProvider("local_stub", {
        type: "local",
        supportedLanguages: ["zh", "en"],
      });

      engine = new TranscriptionEngine({ switchBackDelayMs: 5000 });
      engine.registerCloudProvider(groq);
      engine.registerLocalProvider(local);

      engine.startTranscription("s1", "en");
      engine.reportNetworkUnavailable();
      expect(engine.isUsingLocalFallback()).toBe(true);

      engine.reportNetworkRestored();

      // Before delay: still on local
      vi.advanceTimersByTime(4999);
      expect(engine.isUsingLocalFallback()).toBe(true);

      // After delay: switched back to cloud
      vi.advanceTimersByTime(1);
      expect(engine.isUsingLocalFallback()).toBe(false);
      expect(engine.getActiveProvider()?.name).toBe("groq_whisper");
    });

    it("does not switch back if latency is still high", () => {
      const groq = makeProvider("groq_whisper");
      const local = makeProvider("local_stub", {
        type: "local",
        supportedLanguages: ["zh", "en"],
      });

      engine = new TranscriptionEngine({
        switchBackDelayMs: 5000,
        cloudLatencyThresholdMs: 500,
      });
      engine.registerCloudProvider(groq);
      engine.registerLocalProvider(local);

      engine.startTranscription("s1", "en");
      engine.reportNetworkUnavailable();

      // Report that cloud latency is still high
      engine.reportCloudLatency("groq_whisper", 800);

      engine.reportNetworkRestored();
      vi.advanceTimersByTime(5000);

      // Should still be on local because last known latency is too high
      expect(engine.isUsingLocalFallback()).toBe(true);
    });
  });

  // ── Latency metrics ──

  describe("latency metrics", () => {
    it("tracks per-provider latency metrics", () => {
      const groq = makeProvider("groq_whisper");
      engine.registerCloudProvider(groq);

      engine.startTranscription("s1", "en");
      engine.feedAudio(makeChunk());
      engine.feedAudio(makeChunk());

      const metrics = engine.getMetricsFor("groq_whisper");
      expect(metrics).toBeDefined();
      expect(metrics!.totalRequests).toBe(2);
      expect(metrics!.avgLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it("returns metrics for all registered providers", () => {
      const groq = makeProvider("groq_whisper");
      const dashscope = makeProvider("dashscope_qwen", {
        supportedLanguages: ["zh"],
      });
      const local = makeProvider("local_stub", {
        type: "local",
        supportedLanguages: ["zh", "en"],
      });

      engine.registerCloudProvider(groq);
      engine.registerCloudProvider(dashscope);
      engine.registerLocalProvider(local);

      const allMetrics = engine.getMetrics();
      expect(allMetrics).toHaveLength(3);
      expect(allMetrics.map((m) => m.providerName).sort()).toEqual([
        "dashscope_qwen",
        "groq_whisper",
        "local_stub",
      ]);
    });

    it("updates metrics via reportCloudLatency", () => {
      const groq = makeProvider("groq_whisper");
      engine.registerCloudProvider(groq);

      engine.reportCloudLatency("groq_whisper", 250);
      engine.reportCloudLatency("groq_whisper", 350);

      const m = engine.getMetricsFor("groq_whisper");
      expect(m!.totalRequests).toBe(2);
      expect(m!.avgLatencyMs).toBe(300);
      expect(m!.lastLatencyMs).toBe(350);
    });
  });

  // ── Lifecycle ──

  describe("lifecycle", () => {
    it("does not forward results after stopTranscription()", () => {
      const groq = makeProvider("groq_whisper");
      engine.registerCloudProvider(groq);

      const results: TranscriptSegment[] = [];
      engine.onFinalResult = (r) => results.push(r);

      engine.startTranscription("s1", "en");
      engine.feedAudio(makeChunk());
      expect(results).toHaveLength(1);

      engine.stopTranscription();
      engine.feedAudio(makeChunk());
      expect(results).toHaveLength(1); // no new results
    });

    it("clears switch-back timer on stop", () => {
      const groq = makeProvider("groq_whisper");
      const local = makeProvider("local_stub", {
        type: "local",
        supportedLanguages: ["zh", "en"],
      });

      engine = new TranscriptionEngine({ switchBackDelayMs: 5000 });
      engine.registerCloudProvider(groq);
      engine.registerLocalProvider(local);

      engine.startTranscription("s1", "en");
      engine.reportNetworkUnavailable();
      engine.reportNetworkRestored();

      engine.stopTranscription();

      // Advancing timers should not cause errors or switch
      vi.advanceTimersByTime(10000);
      expect(engine.getActiveProvider()).toBeNull();
    });
  });
});
