import {
  GoogleGenerativeAI,
  type GenerateContentStreamResult,
} from "@google/generative-ai";
import type {
  LLMProviderAdapter,
  LLMMessage,
  LLMOptions,
  LLMResponse,
  LLMStreamChunk,
} from "../types.js";

/**
 * Google Gemini — fallback LLM provider.
 * Uses the @google/generative-ai SDK.
 */
export class GoogleAdapter implements LLMProviderAdapter {
  readonly id = "google";
  readonly name = "Google Gemini";
  private genAI: GoogleGenerativeAI | null = null;
  private readonly model = "gemini-2.0-flash";

  private getGenAI(): GoogleGenerativeAI | null {
    if (this.genAI) return this.genAI;
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return null;
    this.genAI = new GoogleGenerativeAI(apiKey);
    return this.genAI;
  }

  async isAvailable(): Promise<boolean> {
    return !!process.env.GOOGLE_API_KEY;
  }

  /**
   * Convert our LLMMessage[] to Gemini's content format.
   * Gemini uses "user" and "model" roles (no "system" role in contents).
   * System instructions are passed separately.
   */
  private toGeminiContents(messages: LLMMessage[]) {
    return messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
  }

  async complete(
    messages: LLMMessage[],
    options: LLMOptions,
  ): Promise<LLMResponse> {
    const genAI = this.getGenAI();
    if (!genAI) throw new Error("Google API key not configured");

    const systemMsg = messages.find((m) => m.role === "system");
    const model = genAI.getGenerativeModel({
      model: this.model,
      systemInstruction: systemMsg?.content,
      generationConfig: {
        maxOutputTokens: options.maxTokens,
        temperature: options.temperature,
      },
    });

    const start = Date.now();
    const result = await model.generateContent({
      contents: this.toGeminiContents(messages),
    });

    const response = result.response;
    const text = response.text();
    const usage = response.usageMetadata;

    return {
      content: text,
      providerId: this.id,
      usage: {
        promptTokens: usage?.promptTokenCount ?? 0,
        completionTokens: usage?.candidatesTokenCount ?? 0,
      },
      latencyMs: Date.now() - start,
    };
  }

  async *stream(
    messages: LLMMessage[],
    options: LLMOptions,
  ): AsyncIterable<LLMStreamChunk> {
    const genAI = this.getGenAI();
    if (!genAI) throw new Error("Google API key not configured");

    const systemMsg = messages.find((m) => m.role === "system");
    const model = genAI.getGenerativeModel({
      model: this.model,
      systemInstruction: systemMsg?.content,
      generationConfig: {
        maxOutputTokens: options.maxTokens,
        temperature: options.temperature,
      },
    });

    const result: GenerateContentStreamResult =
      await model.generateContentStream({
        contents: this.toGeminiContents(messages),
      });

    for await (const chunk of result.stream) {
      const text = chunk.text();
      yield { content: text, providerId: this.id, done: false };
    }
    yield { content: "", providerId: this.id, done: true };
  }
}
