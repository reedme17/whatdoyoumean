import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { LLMOptions } from "../types.js";

const defaultOptions: LLMOptions = {
  maxTokens: 100,
  temperature: 0.7,
  timeoutMs: 3000,
};

// ── OpenAICompatibleAdapter ──────────────────────────────────────

describe("OpenAICompatibleAdapter", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.TEST_API_KEY;
    vi.restoreAllMocks();
  });

  it("isAvailable() returns false when env var is not set", async () => {
    const { OpenAICompatibleAdapter } = await import("./openai-compatible.js");
    const adapter = new OpenAICompatibleAdapter({
      id: "test",
      name: "Test",
      apiKeyEnvVar: "TEST_API_KEY",
      baseURL: "https://api.test.com/v1",
      model: "test-model",
    });
    expect(await adapter.isAvailable()).toBe(false);
  });

  it("isAvailable() returns true when env var is set", async () => {
    process.env.TEST_API_KEY = "sk-test-key";
    const { OpenAICompatibleAdapter } = await import("./openai-compatible.js");
    const adapter = new OpenAICompatibleAdapter({
      id: "test",
      name: "Test",
      apiKeyEnvVar: "TEST_API_KEY",
      baseURL: "https://api.test.com/v1",
      model: "test-model",
    });
    expect(await adapter.isAvailable()).toBe(true);
  });

  it("complete() throws when API key is not configured", async () => {
    const { OpenAICompatibleAdapter } = await import("./openai-compatible.js");
    const adapter = new OpenAICompatibleAdapter({
      id: "test",
      name: "Test Provider",
      apiKeyEnvVar: "TEST_API_KEY",
      baseURL: "https://api.test.com/v1",
      model: "test-model",
    });
    await expect(
      adapter.complete([{ role: "user", content: "hi" }], defaultOptions),
    ).rejects.toThrow("Test Provider API key not configured");
  });

  it("stream() throws when API key is not configured", async () => {
    const { OpenAICompatibleAdapter } = await import("./openai-compatible.js");
    const adapter = new OpenAICompatibleAdapter({
      id: "test",
      name: "Test Provider",
      apiKeyEnvVar: "TEST_API_KEY",
      baseURL: "https://api.test.com/v1",
      model: "test-model",
    });
    const iter = adapter.stream(
      [{ role: "user", content: "hi" }],
      defaultOptions,
    );
    const chunks: unknown[] = [];
    await expect(async () => {
      for await (const c of iter) chunks.push(c);
    }).rejects.toThrow("Test Provider API key not configured");
  });
});

// ── CerebrasAdapter ──────────────────────────────────────────────

describe("CerebrasAdapter", () => {
  afterEach(() => {
    delete process.env.CEREBRAS_API_KEY;
  });

  it("has correct id and name", async () => {
    const { CerebrasAdapter } = await import("./cerebras.js");
    const adapter = new CerebrasAdapter();
    expect(adapter.id).toBe("cerebras");
    expect(adapter.name).toBe("Cerebras GPT-OSS-120B");
  });

  it("isAvailable() returns false without CEREBRAS_API_KEY", async () => {
    const { CerebrasAdapter } = await import("./cerebras.js");
    const adapter = new CerebrasAdapter();
    expect(await adapter.isAvailable()).toBe(false);
  });

  it("isAvailable() returns true with CEREBRAS_API_KEY", async () => {
    process.env.CEREBRAS_API_KEY = "sk-cerebras-test";
    const { CerebrasAdapter } = await import("./cerebras.js");
    const adapter = new CerebrasAdapter();
    expect(await adapter.isAvailable()).toBe(true);
  });
});

// ── OpenAIAdapter ────────────────────────────────────────────────

describe("OpenAIAdapter", () => {
  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it("has correct id and name", async () => {
    const { OpenAIAdapter } = await import("./openai.js");
    const adapter = new OpenAIAdapter();
    expect(adapter.id).toBe("openai");
    expect(adapter.name).toBe("OpenAI GPT");
  });

  it("isAvailable() returns false without OPENAI_API_KEY", async () => {
    const { OpenAIAdapter } = await import("./openai.js");
    const adapter = new OpenAIAdapter();
    expect(await adapter.isAvailable()).toBe(false);
  });

  it("isAvailable() returns true with OPENAI_API_KEY", async () => {
    process.env.OPENAI_API_KEY = "sk-openai-test";
    const { OpenAIAdapter } = await import("./openai.js");
    const adapter = new OpenAIAdapter();
    expect(await adapter.isAvailable()).toBe(true);
  });
});

// ── AnthropicAdapter ─────────────────────────────────────────────

describe("AnthropicAdapter", () => {
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("has correct id and name", async () => {
    const { AnthropicAdapter } = await import("./anthropic.js");
    const adapter = new AnthropicAdapter();
    expect(adapter.id).toBe("anthropic");
    expect(adapter.name).toBe("Anthropic Claude");
  });

  it("isAvailable() returns false without ANTHROPIC_API_KEY", async () => {
    const { AnthropicAdapter } = await import("./anthropic.js");
    const adapter = new AnthropicAdapter();
    expect(await adapter.isAvailable()).toBe(false);
  });

  it("isAvailable() returns true with ANTHROPIC_API_KEY", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const { AnthropicAdapter } = await import("./anthropic.js");
    const adapter = new AnthropicAdapter();
    expect(await adapter.isAvailable()).toBe(true);
  });

  it("complete() throws when API key is not configured", async () => {
    const { AnthropicAdapter } = await import("./anthropic.js");
    const adapter = new AnthropicAdapter();
    await expect(
      adapter.complete([{ role: "user", content: "hi" }], defaultOptions),
    ).rejects.toThrow("Anthropic API key not configured");
  });
});

// ── GoogleAdapter ────────────────────────────────────────────────

describe("GoogleAdapter", () => {
  afterEach(() => {
    delete process.env.GOOGLE_API_KEY;
  });

  it("has correct id and name", async () => {
    const { GoogleAdapter } = await import("./google.js");
    const adapter = new GoogleAdapter();
    expect(adapter.id).toBe("google");
    expect(adapter.name).toBe("Google Gemini");
  });

  it("isAvailable() returns false without GOOGLE_API_KEY", async () => {
    const { GoogleAdapter } = await import("./google.js");
    const adapter = new GoogleAdapter();
    expect(await adapter.isAvailable()).toBe(false);
  });

  it("isAvailable() returns true with GOOGLE_API_KEY", async () => {
    process.env.GOOGLE_API_KEY = "google-test-key";
    const { GoogleAdapter } = await import("./google.js");
    const adapter = new GoogleAdapter();
    expect(await adapter.isAvailable()).toBe(true);
  });

  it("complete() throws when API key is not configured", async () => {
    const { GoogleAdapter } = await import("./google.js");
    const adapter = new GoogleAdapter();
    await expect(
      adapter.complete([{ role: "user", content: "hi" }], defaultOptions),
    ).rejects.toThrow("Google API key not configured");
  });
});
