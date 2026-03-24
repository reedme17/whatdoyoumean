import { OpenAICompatibleAdapter } from "./openai-compatible.js";

/**
 * Cerebras GPT-OSS-120B — primary LLM provider.
 * Uses the OpenAI-compatible API at api.cerebras.ai.
 * 2,224 tokens/sec output, free tier 1M tokens/day.
 */
export class CerebrasAdapter extends OpenAICompatibleAdapter {
  constructor() {
    super({
      id: "cerebras",
      name: "Cerebras GPT-OSS-120B",
      apiKeyEnvVar: "CEREBRAS_API_KEY",
      baseURL: "https://api.cerebras.ai/v1",
      model: "llama3.1-8b",
    });
  }
}
