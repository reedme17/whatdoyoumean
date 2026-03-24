import Anthropic from "@anthropic-ai/sdk";
import type {
  LLMProviderAdapter,
  LLMMessage,
  LLMOptions,
  LLMResponse,
  LLMStreamChunk,
} from "../types.js";

/**
 * Anthropic Claude — fallback LLM provider.
 * Uses the Anthropic SDK (different API format from OpenAI).
 */
export class AnthropicAdapter implements LLMProviderAdapter {
  readonly id = "anthropic";
  readonly name = "Anthropic Claude";
  private client: Anthropic | null = null;
  private readonly model = "claude-sonnet-4-20250514";

  private getClient(): Anthropic | null {
    if (this.client) return this.client;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    this.client = new Anthropic({ apiKey });
    return this.client;
  }

  async isAvailable(): Promise<boolean> {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  async complete(
    messages: LLMMessage[],
    options: LLMOptions,
  ): Promise<LLMResponse> {
    const client = this.getClient();
    if (!client) throw new Error("Anthropic API key not configured");

    // Separate system message from conversation messages
    const systemMsg = messages.find((m) => m.role === "system");
    const conversationMsgs = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    const start = Date.now();
    const response = await client.messages.create({
      model: this.model,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      system: systemMsg?.content,
      messages: conversationMsgs,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return {
      content: textBlock?.text ?? "",
      providerId: this.id,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
      },
      latencyMs: Date.now() - start,
    };
  }

  async *stream(
    messages: LLMMessage[],
    options: LLMOptions,
  ): AsyncIterable<LLMStreamChunk> {
    const client = this.getClient();
    if (!client) throw new Error("Anthropic API key not configured");

    const systemMsg = messages.find((m) => m.role === "system");
    const conversationMsgs = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    const stream = client.messages.stream({
      model: this.model,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      system: systemMsg?.content,
      messages: conversationMsgs,
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield {
          content: event.delta.text,
          providerId: this.id,
          done: false,
        };
      }
      if (event.type === "message_stop") {
        yield { content: "", providerId: this.id, done: true };
      }
    }
  }
}
