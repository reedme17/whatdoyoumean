import { OpenAICompatibleAdapter } from "./openai-compatible.js";

/**
 * OpenAI GPT — fallback LLM provider.
 * Uses the standard OpenAI API.
 */
export class OpenAIAdapter extends OpenAICompatibleAdapter {
  constructor() {
    super({
      id: "openai",
      name: "OpenAI GPT",
      apiKeyEnvVar: "OPENAI_API_KEY",
      baseURL: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
    });
  }
}
