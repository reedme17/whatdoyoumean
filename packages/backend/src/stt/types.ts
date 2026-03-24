/**
 * STT (Speech-to-Text) provider interfaces and configuration types.
 */

import type { TranscriptSegment } from "@wdym/shared";
import type { AudioChunk } from "@wdym/shared";

/** Re-export for convenience within the STT module */
export type { TranscriptSegment, AudioChunk };

/**
 * Adapter interface that each STT provider must implement.
 */
export interface STTProvider {
  /** Unique provider identifier, e.g. 'groq_whisper', 'dashscope_qwen' */
  name: string;
  /** Whether this provider runs locally or in the cloud */
  type: "local" | "cloud";
  /** Language codes this provider supports */
  supportedLanguages: ("zh" | "en")[];

  /** Begin a streaming transcription session for the given language */
  startStream(languageCode: string): void;
  /** Feed an audio chunk into the active stream */
  feedAudio(chunk: AudioChunk): void;
  /** End the current streaming session */
  stopStream(): void;

  /** Callback invoked when a transcript result (interim or final) is ready */
  onResult: ((result: TranscriptSegment) => void) | null;
}

/**
 * Configuration for the adaptive cloud/local STT switching logic.
 */
export interface AdaptiveSTTConfig {
  /** Max acceptable cloud latency before falling back to local (ms) */
  cloudLatencyThresholdMs: number;
  /** Debounce delay before switching back to cloud after local fallback (ms) */
  switchBackDelayMs: number;
  /** Whether the user prefers cloud STT when available */
  preferCloud: boolean;
  /** Maps language codes to their preferred cloud provider name */
  cloudProviderRouting: Record<string, string>;
}

/** Default adaptive STT configuration matching the design spec */
export const DEFAULT_ADAPTIVE_STT_CONFIG: AdaptiveSTTConfig = {
  cloudLatencyThresholdMs: 500,
  switchBackDelayMs: 5000,
  preferCloud: true,
  cloudProviderRouting: {
    en: "groq_whisper",
    zh: "dashscope_qwen",
  },
};

/** Per-provider latency tracking entry */
export interface ProviderLatencyMetrics {
  providerName: string;
  totalRequests: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
  lastLatencyMs: number;
  lastRequestTimestamp: number | null;
}
