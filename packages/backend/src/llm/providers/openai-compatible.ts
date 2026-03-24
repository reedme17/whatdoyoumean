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

  async complete(
    messages: LLMMessage[],
    options: LLMOptions,
  ): Promise<LLMResponse> {
    const client = this.getClient();
    if (!client) throw new Error(`${this.name} API key not configured`);

    const start = Date.now();
    const response = await client.chat.completions.create(
      {
        model: this.config.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        stream: false,
      },
      { timeout: options.timeoutMs },
    );

    const choice = response.choices[0];
    return {
      content: choice?.message?.content ?? "",
      providerId: this.id,
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
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
