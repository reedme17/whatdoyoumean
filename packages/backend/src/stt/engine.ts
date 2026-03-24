/**
 * TranscriptionEngine — adaptive, language-routed STT orchestrator.
 *
 * Routes audio by detected language (English → Groq Whisper, Chinese → DashScope),
 * falls back to local STT when cloud latency exceeds threshold or network is
 * unavailable, and debounces switch-back to cloud.
 */

import type {
  STTProvider,
  AudioChunk,
  TranscriptSegment,
  AdaptiveSTTConfig,
  ProviderLatencyMetrics,
} from "./types.js";
import { DEFAULT_ADAPTIVE_STT_CONFIG } from "./types.js";

export class TranscriptionEngine {
  private cloudProviders: Map<string, STTProvider> = new Map();
  private localProvider: STTProvider | null = null;
  private activeProvider: STTProvider | null = null;
  private config: AdaptiveSTTConfig;
  private languageCode = "en";
  private sessionId = "";
  private active = false;

  /** Whether we are currently using the local fallback */
  private usingLocalFallback = false;
  /** Timer handle for debounced switch-back to cloud */
  private switchBackTimer: ReturnType<typeof setTimeout> | null = null;

  /** Per-provider latency metrics */
  private metrics: Map<string, ProviderLatencyMetrics> = new Map();

  // ── Event callbacks ──

  onInterimResult: ((result: TranscriptSegment) => void) | null = null;
  onFinalResult: ((result: TranscriptSegment) => void) | null = null;
  onProviderSwitch:
    | ((from: STTProvider, to: STTProvider) => void)
    | null = null;

  constructor(config?: Partial<AdaptiveSTTConfig>) {
    this.config = { ...DEFAULT_ADAPTIVE_STT_CONFIG, ...config };
  }

  // ── Provider registration ──

  /**
   * Register a cloud STT provider. The provider's `name` is used as the
   * routing key (must match values in `config.cloudProviderRouting`).
   */
  registerCloudProvider(provider: STTProvider): void {
    this.cloudProviders.set(provider.name, provider);
    this.initMetrics(provider.name);
    this.wireProviderCallbacks(provider);
  }

  /** Register the local fallback provider. */
  registerLocalProvider(provider: STTProvider): void {
    this.localProvider = provider;
    this.initMetrics(provider.name);
    this.wireProviderCallbacks(provider);
  }

  // ── Lifecycle ──

  startTranscription(sessionId: string, languageCode: string): void {
    this.sessionId = sessionId;
    this.languageCode = languageCode;
    this.active = true;
    this.usingLocalFallback = false;

    const provider = this.resolveProvider(languageCode);
    if (provider) {
      this.activateProvider(provider, languageCode);
    }
  }

  stopTranscription(): void {
    this.active = false;
    this.activeProvider?.stopStream();
    this.activeProvider = null;
    this.clearSwitchBackTimer();
  }

  /**
   * Feed an audio chunk. The engine routes it to the active provider and
   * measures latency to decide whether to switch providers.
   */
  feedAudio(chunk: AudioChunk): void {
    if (!this.active || !this.activeProvider) return;

    const start = Date.now();
    this.activeProvider.feedAudio(chunk);
    const latencyMs = Date.now() - start;

    this.recordLatency(this.activeProvider.name, latencyMs);

    // Check if we need to fall back to local
    if (
      this.activeProvider.type === "cloud" &&
      latencyMs > this.config.cloudLatencyThresholdMs
    ) {
      this.fallbackToLocal();
    }

    // If we're on local fallback, schedule a switch-back attempt
    if (this.usingLocalFallback && !this.switchBackTimer) {
      this.scheduleSwitchBack();
    }
  }

  /**
   * Notify the engine that cloud latency has been measured externally
   * (e.g. from a health-check ping). Useful for proactive switching.
   */
  reportCloudLatency(providerName: string, latencyMs: number): void {
    this.recordLatency(providerName, latencyMs);

    if (latencyMs > this.config.cloudLatencyThresholdMs) {
      if (!this.usingLocalFallback && this.activeProvider?.type === "cloud") {
        this.fallbackToLocal();
      }
    }
  }

  /**
   * Notify the engine that the network is unavailable.
   * Immediately falls back to local STT.
   */
  reportNetworkUnavailable(): void {
    if (!this.usingLocalFallback) {
      this.fallbackToLocal();
    }
  }

  /**
   * Notify the engine that the network is restored.
   * Schedules a debounced switch-back to cloud.
   */
  reportNetworkRestored(): void {
    if (this.usingLocalFallback && !this.switchBackTimer) {
      this.scheduleSwitchBack();
    }
  }

  // ── Queries ──

  getActiveProvider(): STTProvider | null {
    return this.activeProvider;
  }

  isUsingLocalFallback(): boolean {
    return this.usingLocalFallback;
  }

  getMetrics(): ProviderLatencyMetrics[] {
    return Array.from(this.metrics.values());
  }

  getMetricsFor(providerName: string): ProviderLatencyMetrics | undefined {
    return this.metrics.get(providerName);
  }

  // ── Internal: provider resolution ──

  private resolveProvider(languageCode: string): STTProvider | null {
    if (this.config.preferCloud) {
      const cloudName = this.config.cloudProviderRouting[languageCode];
      if (cloudName) {
        const cloud = this.cloudProviders.get(cloudName);
        if (cloud) return cloud;
      }
      // Fall back to any cloud provider that supports this language
      for (const p of this.cloudProviders.values()) {
        if (p.supportedLanguages.includes(languageCode as "zh" | "en")) {
          return p;
        }
      }
    }
    return this.localProvider;
  }

  private activateProvider(provider: STTProvider, languageCode: string): void {
    const previous = this.activeProvider;
    if (previous && previous !== provider) {
      previous.stopStream();
    }
    provider.startStream(languageCode);
    this.activeProvider = provider;

    if (previous && previous !== provider && this.onProviderSwitch) {
      this.onProviderSwitch(previous, provider);
    }
  }

  // ── Internal: adaptive switching ──

  private fallbackToLocal(): void {
    if (!this.localProvider || this.usingLocalFallback) return;

    this.usingLocalFallback = true;
    this.activateProvider(this.localProvider, this.languageCode);
  }

  private scheduleSwitchBack(): void {
    this.clearSwitchBackTimer();
    this.switchBackTimer = setTimeout(() => {
      this.switchBackTimer = null;
      this.attemptSwitchBackToCloud();
    }, this.config.switchBackDelayMs);
  }

  private attemptSwitchBackToCloud(): void {
    if (!this.active || !this.usingLocalFallback) return;

    const cloudProvider = this.resolveCloudProvider(this.languageCode);
    if (!cloudProvider) return;

    // Check last known latency for the cloud provider
    const m = this.metrics.get(cloudProvider.name);
    if (m && m.lastLatencyMs > this.config.cloudLatencyThresholdMs) {
      // Still too slow — reschedule
      this.scheduleSwitchBack();
      return;
    }

    this.usingLocalFallback = false;
    this.activateProvider(cloudProvider, this.languageCode);
  }

  private resolveCloudProvider(languageCode: string): STTProvider | null {
    const cloudName = this.config.cloudProviderRouting[languageCode];
    if (cloudName) {
      return this.cloudProviders.get(cloudName) ?? null;
    }
    return null;
  }

  // ── Internal: metrics ──

  private initMetrics(providerName: string): void {
    if (!this.metrics.has(providerName)) {
      this.metrics.set(providerName, {
        providerName,
        totalRequests: 0,
        totalLatencyMs: 0,
        avgLatencyMs: 0,
        lastLatencyMs: 0,
        lastRequestTimestamp: null,
      });
    }
  }

  private recordLatency(providerName: string, latencyMs: number): void {
    const m = this.metrics.get(providerName);
    if (!m) return;
    m.totalRequests++;
    m.totalLatencyMs += latencyMs;
    m.avgLatencyMs = m.totalLatencyMs / m.totalRequests;
    m.lastLatencyMs = latencyMs;
    m.lastRequestTimestamp = Date.now();
  }

  // ── Internal: callbacks ──

  private wireProviderCallbacks(provider: STTProvider): void {
    provider.onResult = (result: TranscriptSegment) => {
      if (!this.active) return;
      if (result.isFinal) {
        this.onFinalResult?.(result);
      } else {
        this.onInterimResult?.(result);
      }
    };
  }

  private clearSwitchBackTimer(): void {
    if (this.switchBackTimer) {
      clearTimeout(this.switchBackTimer);
      this.switchBackTimer = null;
    }
  }
}
