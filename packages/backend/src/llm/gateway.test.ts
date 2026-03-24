import { describe, it, expect, beforeEach } from "vitest";
import { LLMGateway } from "./gateway.js";
import type {
  LLMProviderAdapter,
  LLMMessage,
  LLMOptions,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
} from "./types.js";

// ── helpers ──────────────────────────────────────────────────────

function makeRequest(overrides: Partial<LLMRequest> = {}): LLMRequest {
  return {
    taskType: "semantic_analysis",
    messages: [{ role: "user", content: "hello" }],
    maxTokens: 100,
    temperature: 0.7,
    stream: false,
    timeoutMs: 3000,
    ...overrides,
  };
}

function makeProvider(
  id: string,
  opts: {
    available?: boolean;
    delayMs?: number;
    shouldFail?: boolean;
  } = {},
): LLMProviderAdapter {
  const { available = true, delayMs = 0, shouldFail = false } = opts;

  return {
    id,
    name: `Provider ${id}`,
    async isAvailable() {
      return available;
    },
    async complete(
      _messages: LLMMessage[],
      _options: LLMOptions,
    ): Promise<LLMResponse> {
      if (delayMs > 0) await sleep(delayMs);
      if (shouldFail) throw new Error(`${id} failed`);
      return {
        content: `response from ${id}`,
        providerId: id,
        usage: { promptTokens: 10, completionTokens: 20 },
        latencyMs: delayMs,
      };
    },
    async *stream(
      _messages: LLMMessage[],
      _options: LLMOptions,
    ): AsyncIterable<LLMStreamChunk> {
      if (delayMs > 0) await sleep(delayMs);
      if (shouldFail) throw new Error(`${id} stream failed`);
      yield { content: `chunk from ${id}`, providerId: id, done: false };
      yield { content: "", providerId: id, done: true };
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function collectStream(
  iter: AsyncIterable<LLMStreamChunk>,
): Promise<LLMStreamChunk[]> {
  const chunks: LLMStreamChunk[] = [];
  for await (const c of iter) chunks.push(c);
  return chunks;
}

// ── tests ────────────────────────────────────────────────────────

describe("LLMGateway", () => {
  let gateway: LLMGateway;

  beforeEach(() => {
    gateway = new LLMGateway();
  });

  // ── provider registration ──

  it("throws when no providers are registered", async () => {
    await expect(gateway.complete(makeRequest())).rejects.toThrow(
      "No LLM providers registered",
    );
  });

  // ── complete() ──

  describe("complete()", () => {
    it("returns response from the first available provider", async () => {
      gateway.registerProvider(makeProvider("a"));
      gateway.registerProvider(makeProvider("b"));

      const res = await gateway.complete(makeRequest());
      expect(res.providerId).toBe("a");
      expect(res.content).toBe("response from a");
    });

    it("uses preferred provider first", async () => {
      gateway.registerProvider(makeProvider("a"));
      gateway.registerProvider(makeProvider("b"));
      gateway.setPreferredProvider("b");

      const res = await gateway.complete(makeRequest());
      expect(res.providerId).toBe("b");
    });

    it("falls back when preferred provider fails", async () => {
      gateway.registerProvider(makeProvider("a"));
      gateway.registerProvider(makeProvider("b", { shouldFail: true }));
      gateway.setPreferredProvider("b");

      const res = await gateway.complete(makeRequest());
      expect(res.providerId).toBe("a");
    });

    it("falls back when provider times out", async () => {
      gateway.registerProvider(
        makeProvider("slow", { delayMs: 5000 }),
      );
      gateway.registerProvider(makeProvider("fast"));

      const res = await gateway.complete(
        makeRequest({ timeoutMs: 100 }),
      );
      expect(res.providerId).toBe("fast");
    });

    it("skips unavailable providers", async () => {
      gateway.registerProvider(
        makeProvider("down", { available: false }),
      );
      gateway.registerProvider(makeProvider("up"));

      const res = await gateway.complete(makeRequest());
      expect(res.providerId).toBe("up");
    });

    it("throws when all providers fail", async () => {
      gateway.registerProvider(makeProvider("a", { shouldFail: true }));
      gateway.registerProvider(makeProvider("b", { shouldFail: true }));

      await expect(gateway.complete(makeRequest())).rejects.toThrow(
        "b failed",
      );
    });
  });

  // ── stream() ──

  describe("stream()", () => {
    it("streams chunks from the first available provider", async () => {
      gateway.registerProvider(makeProvider("a"));
      const chunks = await collectStream(
        gateway.stream(makeRequest({ stream: true })),
      );
      expect(chunks.length).toBe(2);
      expect(chunks[0].content).toBe("chunk from a");
    });

    it("falls back when stream provider fails", async () => {
      gateway.registerProvider(
        makeProvider("bad", { shouldFail: true }),
      );
      gateway.registerProvider(makeProvider("good"));

      const chunks = await collectStream(
        gateway.stream(makeRequest({ stream: true })),
      );
      expect(chunks[0].providerId).toBe("good");
    });

    it("throws when no providers registered for stream", async () => {
      const iter = gateway.stream(makeRequest({ stream: true }));
      await expect(collectStream(iter)).rejects.toThrow(
        "No LLM providers registered",
      );
    });
  });

  // ── stats tracking ──

  describe("getProviderStats()", () => {
    it("returns empty stats for freshly registered providers", () => {
      gateway.registerProvider(makeProvider("a"));
      const stats = gateway.getProviderStats();
      expect(stats).toHaveLength(1);
      expect(stats[0]).toEqual({
        providerId: "a",
        avgResponseTimeMs: 0,
        errorRate: 0,
        totalRequests: 0,
        lastErrorTimestamp: null,
      });
    });

    it("tracks successful requests", async () => {
      gateway.registerProvider(makeProvider("a"));
      await gateway.complete(makeRequest());

      const stats = gateway.getProviderStats();
      expect(stats[0].totalRequests).toBe(1);
      expect(stats[0].errorRate).toBe(0);
      expect(stats[0].lastErrorTimestamp).toBeNull();
    });

    it("tracks errors and updates lastErrorTimestamp", async () => {
      gateway.registerProvider(makeProvider("a", { shouldFail: true }));
      gateway.registerProvider(makeProvider("b"));

      await gateway.complete(makeRequest());

      const statsA = gateway
        .getProviderStats()
        .find((s) => s.providerId === "a")!;
      expect(statsA.totalRequests).toBe(1);
      expect(statsA.errorRate).toBe(1);
      expect(statsA.lastErrorTimestamp).toBeTypeOf("number");
    });

    it("computes average response time across multiple requests", async () => {
      gateway.registerProvider(makeProvider("a"));
      await gateway.complete(makeRequest());
      await gateway.complete(makeRequest());

      const stats = gateway.getProviderStats();
      expect(stats[0].totalRequests).toBe(2);
      expect(stats[0].avgResponseTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});
