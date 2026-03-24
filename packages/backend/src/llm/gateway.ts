import type {
  LLMProviderAdapter,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  ProviderStats,
} from "./types.js";

const DEFAULT_TIMEOUT_MS = 3000;

interface InternalStats {
  totalRequests: number;
  totalErrors: number;
  totalResponseTimeMs: number;
  lastErrorTimestamp: number | null;
}

/**
 * LLMGateway manages registered providers, routes requests by taskType,
 * handles fallback chains on timeout/error, and tracks per-provider stats.
 */
export class LLMGateway {
  private providers: LLMProviderAdapter[] = [];
  private preferredProviderId: string | null = null;
  private stats = new Map<string, InternalStats>();

  /** Register a provider adapter. First registered = highest fallback priority. */
  registerProvider(provider: LLMProviderAdapter): void {
    this.providers.push(provider);
    this.stats.set(provider.id, {
      totalRequests: 0,
      totalErrors: 0,
      totalResponseTimeMs: 0,
      lastErrorTimestamp: null,
    });
  }

  /** Set the preferred provider by id. It will be tried first on every request. */
  setPreferredProvider(providerId: string): void {
    this.preferredProviderId = providerId;
  }

  /** Return a snapshot of per-provider stats. */
  getProviderStats(): ProviderStats[] {
    return this.providers.map((p) => {
      const s = this.stats.get(p.id)!;
      return {
        providerId: p.id,
        avgResponseTimeMs:
          s.totalRequests > 0
            ? Math.round(s.totalResponseTimeMs / s.totalRequests)
            : 0,
        errorRate:
          s.totalRequests > 0
            ? +(s.totalErrors / s.totalRequests).toFixed(4)
            : 0,
        totalRequests: s.totalRequests,
        lastErrorTimestamp: s.lastErrorTimestamp,
      };
    });
  }

  /**
   * Send a completion request. Tries the preferred provider first, then
   * falls back through remaining providers in registration order.
   */
  async complete(request: LLMRequest): Promise<LLMResponse> {
    const ordered = this.orderedProviders();
    if (ordered.length === 0) {
      throw new Error("No LLM providers registered");
    }

    const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    let lastError: unknown;

    for (const provider of ordered) {
      const available = await provider.isAvailable().catch(() => false);
      if (!available) continue;

      const start = Date.now();
      try {
        const response = await withTimeout(
          provider.complete(request.messages, {
            maxTokens: request.maxTokens,
            temperature: request.temperature,
            timeoutMs,
          }),
          timeoutMs,
        );
        this.recordSuccess(provider.id, Date.now() - start);
        return response;
      } catch (err) {
        this.recordError(provider.id, Date.now() - start);
        lastError = err;
        // fall through to next provider
      }
    }

    throw lastError ?? new Error("All LLM providers failed");
  }

  /**
   * Stream a response. Tries the preferred provider first, then falls back
   * through remaining providers in registration order.
   */
  async *stream(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    const ordered = this.orderedProviders();
    if (ordered.length === 0) {
      throw new Error("No LLM providers registered");
    }

    const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    let lastError: unknown;

    for (const provider of ordered) {
      const available = await provider.isAvailable().catch(() => false);
      if (!available) continue;

      const start = Date.now();
      try {
        // Get the first chunk within the timeout to validate the stream works
        const iterable = provider.stream(request.messages, {
          maxTokens: request.maxTokens,
          temperature: request.temperature,
          timeoutMs,
        });

        const iterator = iterable[Symbol.asyncIterator]();
        const firstResult = await withTimeout(
          iterator.next(),
          timeoutMs,
        );

        if (firstResult.done) {
          throw new Error("Stream ended without producing any chunks");
        }

        // First chunk arrived — stream is healthy. Yield it and the rest.
        yield firstResult.value;
        let result = await iterator.next();
        while (!result.done) {
          yield result.value;
          result = await iterator.next();
        }
        this.recordSuccess(provider.id, Date.now() - start);
        return;
      } catch (err) {
        this.recordError(provider.id, Date.now() - start);
        lastError = err;
        // fall through to next provider
      }
    }

    throw lastError ?? new Error("All LLM providers failed");
  }

  // ── private helpers ──────────────────────────────────────────────

  /**
   * Build the provider try-order: preferred first, then the rest in
   * registration order (skipping the preferred so it isn't tried twice).
   */
  private orderedProviders(): LLMProviderAdapter[] {
    if (!this.preferredProviderId) return [...this.providers];

    const preferred = this.providers.find(
      (p) => p.id === this.preferredProviderId,
    );
    const rest = this.providers.filter(
      (p) => p.id !== this.preferredProviderId,
    );
    return preferred ? [preferred, ...rest] : [...this.providers];
  }

  private recordSuccess(providerId: string, elapsedMs: number): void {
    const s = this.stats.get(providerId);
    if (!s) return;
    s.totalRequests++;
    s.totalResponseTimeMs += elapsedMs;
  }

  private recordError(providerId: string, elapsedMs: number): void {
    const s = this.stats.get(providerId);
    if (!s) return;
    s.totalRequests++;
    s.totalErrors++;
    s.totalResponseTimeMs += elapsedMs;
    s.lastErrorTimestamp = Date.now();
  }
}

// ── utility functions ────────────────────────────────────────────

/** Race a promise against a timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Provider timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}


