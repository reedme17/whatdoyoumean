import OpenAI from "openai";
import type {
  LLMProviderAdapter,
  LLMMessage,
  LLMOptions,
  LLMResponse,
  LLMStreamChunk,
} from "../types.js";

export interface OpenAICompatibleConfig {
  id: string;
  name: string;
  apiKeyEnvVar: string;
  baseURL: string;
  model: string;
}

/**
 * Base adapter for any OpenAI-compatible API (Cerebras, OpenAI, Groq, etc.).
 * Subclasses only need to provide config — the HTTP/streaming logic is shared.
 */
export class OpenAICompatibleAdapter implements LLMProviderAdapter {
  readonly id: string;
  readonly name: string;
  private client: OpenAI | null = null;
  private config: OpenAICompatibleConfig;

  constructor(config: OpenAICompatibleConfig) {
    this.id = config.id;
    this.name = config.name;
    this.config = config;
  }

  private getClient(): OpenAI | null {
    if (this.client) return this.client;
    const apiKey = process.env[this.config.apiKeyEnvVar];
    if (!apiKey) return null;
    this.client = new OpenAI({
      apiKey,
      baseURL: this.config.baseURL,
    });
    return this.client;
  }

  async isAvailable(): Promise<boolean> {
    return !!process.env[this.config.apiKeyEnvVar];
  }

  getDebugInfo(): { model?: string; baseURL?: string } {
    return {
      model: this.config.model,
      baseURL: this.config.baseURL,
    };
  }

  async complete(
    messages: LLMMessage[],
    options: LLMOptions,
  ): Promise<LLMResponse> {
    const apiKey = process.env[this.config.apiKeyEnvVar];
    if (!apiKey) throw new Error(`${this.name} API key not configured`);

    const start = Date.now();
    const response = await fetch(
      `${this.config.baseURL}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          max_tokens: options.maxTokens,
          temperature: options.temperature,
          stream: false,
        }),
        signal: AbortSignal.timeout(options.timeoutMs),
      },
    );

    const rawText = await response.text();
    const parsed = safeParseJSON(rawText);

    if (!response.ok) {
      throw new APIResponseError({
        message: buildErrorMessage(response.status, parsed, rawText),
        status: response.status,
        headers: response.headers,
        requestID: response.headers.get("x-request-id"),
        error: parsed,
      });
    }

    const completion = asChatCompletion(parsed);

    const choice = completion.choices[0];
    return {
      content: choice?.message?.content ?? "",
      providerId: this.id,
      usage: {
        promptTokens: completion.usage?.prompt_tokens ?? 0,
        completionTokens: completion.usage?.completion_tokens ?? 0,
      },
      latencyMs: Date.now() - start,
    };
  }

  async *stream(
    messages: LLMMessage[],
    options: LLMOptions,
  ): AsyncIterable<LLMStreamChunk> {
    const client = this.getClient();
    if (!client) throw new Error(`${this.name} API key not configured`);

    const stream = await client.chat.completions.create(
      {
        model: this.config.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        stream: true,
      },
      { timeout: options.timeoutMs },
    );

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      const done = chunk.choices[0]?.finish_reason !== null;
      yield { content: delta, providerId: this.id, done };
    }
  }
}

class APIResponseError extends Error {
  readonly status: number;
  readonly headers: Headers;
  readonly requestID: string | null;
  readonly error: unknown;

  constructor(params: {
    message: string;
    status: number;
    headers: Headers;
    requestID: string | null;
    error: unknown;
  }) {
    super(params.message);
    this.name = "APIResponseError";
    this.status = params.status;
    this.headers = params.headers;
    this.requestID = params.requestID;
    this.error = params.error;
  }
}

function safeParseJSON(text: string): unknown {
  if (!text) return undefined;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function buildErrorMessage(
  status: number,
  parsed: unknown,
  rawText: string,
): string {
  const payloadMessage = extractPayloadMessage(parsed);
  if (payloadMessage) return `HTTP ${status}: ${payloadMessage}`;
  if (rawText) return `HTTP ${status}: ${rawText}`;
  return `HTTP ${status}`;
}

function extractPayloadMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  if (typeof record.message === "string") return record.message;

  if (record.error && typeof record.error === "object") {
    const nested = record.error as Record<string, unknown>;
    if (typeof nested.message === "string") return nested.message;
  }

  return null;
}

function asChatCompletion(payload: unknown): {
  choices: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
} {
  if (!payload || typeof payload !== "object") {
    throw new Error("Provider returned a non-JSON success response");
  }

  const record = payload as {
    choices?: Array<{ message?: { content?: string | null } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  if (!Array.isArray(record.choices)) {
    throw new Error("Provider success response is missing choices");
  }

  return {
    choices: record.choices,
    usage: record.usage,
  };
}
