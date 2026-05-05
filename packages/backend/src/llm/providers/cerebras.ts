import { OpenAICompatibleAdapter } from "./openai-compatible.js";

const DEFAULT_CEREBRAS_MODEL = "llama3.1-8b";

/**
 * Cerebras Llama 3.1 8B — primary LLM provider.
 * Uses the OpenAI-compatible API at api.cerebras.ai.
 *
 * Default to the configured Cerebras production model. Override with CEREBRAS_MODEL when
 * testing alternates.
 */
export class CerebrasAdapter extends OpenAICompatibleAdapter {
  constructor() {
    super({
      id: "cerebras",
      name: "Cerebras Llama 3.1 8B",
      apiKeyEnvVar: "CEREBRAS_API_KEY",
      baseURL: "https://api.cerebras.ai/v1",
      model: process.env.CEREBRAS_MODEL?.trim() || DEFAULT_CEREBRAS_MODEL,
    });
  }
}
