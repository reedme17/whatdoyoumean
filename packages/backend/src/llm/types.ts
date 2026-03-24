/** Message in an LLM conversation */
export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Options passed to a provider adapter */
export interface LLMOptions {
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}

/** Task-typed request routed through the gateway */
export interface LLMRequest {
  taskType:
    | "semantic_analysis"
    | "recommendation"
    | "visualization_detection"
    | "topic_extraction";
  messages: LLMMessage[];
  maxTokens: number;
  temperature: number;
  stream: boolean;
  timeoutMs: number; // default 3000
}

/** Response from a provider */
export interface LLMResponse {
  content: string;
  providerId: string;
  usage: { promptTokens: number; completionTokens: number };
  latencyMs: number;
}

/** A single chunk in a streaming response */
export interface LLMStreamChunk {
  content: string;
  providerId: string;
  done: boolean;
}

/** Per-provider performance stats */
export interface ProviderStats {
  providerId: string;
  avgResponseTimeMs: number;
  errorRate: number; // 0.0 – 1.0
  totalRequests: number;
  lastErrorTimestamp: number | null;
}

/** Adapter interface that each LLM provider must implement */
export interface LLMProviderAdapter {
  id: string;
  name: string;
  isAvailable(): Promise<boolean>;
  complete(
    messages: LLMMessage[],
    options: LLMOptions,
  ): Promise<LLMResponse>;
  stream(
    messages: LLMMessage[],
    options: LLMOptions,
  ): AsyncIterable<LLMStreamChunk>;
}
