/**
 * Privacy handler — audio data handling, local processing mode,
 * and session cleanup.
 *
 * Audio transmission encryption: handled at the transport layer (HTTPS/WSS with TLS 1.2+).
 * On-device encryption: handled at the storage layer (OS-level encryption).
 * This module manages:
 *   - Raw audio buffer cleanup on session end (within 5s)
 *   - "Local Processing Only" mode gating
 *   - Concurrent third-party audio capture detection (stub)
 *
 * Requirements: 17.1, 17.2, 17.3, 17.5, 17.6
 */

export interface PrivacyConfig {
  localProcessingOnly: boolean;
  audioCleanupDelayMs: number; // max delay before buffers are purged
}

const DEFAULT_CONFIG: PrivacyConfig = {
  localProcessingOnly: false,
  audioCleanupDelayMs: 5000,
};

export interface AudioBufferRef {
  id: string;
  size: number;
  createdAt: number;
}

/**
 * Tracks audio buffers and enforces cleanup within the configured delay
 * after session end.
 */
export class PrivacyHandler {
  private config: PrivacyConfig;
  private buffers: Map<string, AudioBufferRef[]> = new Map();
  private cleanupTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(config?: Partial<PrivacyConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── Local Processing Only mode ──

  isLocalProcessingOnly(): boolean {
    return this.config.localProcessingOnly;
  }

  setLocalProcessingOnly(enabled: boolean): void {
    this.config.localProcessingOnly = enabled;
  }

  /**
   * Returns true if cloud STT / cloud LLM should be used.
   * When localProcessingOnly is enabled, cloud providers are skipped.
   */
  shouldUseCloudProviders(): boolean {
    return !this.config.localProcessingOnly;
  }

  // ── Audio buffer tracking ──

  /**
   * Register an audio buffer for a session so it can be cleaned up later.
   */
  trackBuffer(sessionId: string, buffer: AudioBufferRef): void {
    if (!this.buffers.has(sessionId)) {
      this.buffers.set(sessionId, []);
    }
    this.buffers.get(sessionId)!.push(buffer);
  }

  /**
   * Get tracked buffers for a session.
   */
  getBuffers(sessionId: string): AudioBufferRef[] {
    return this.buffers.get(sessionId) ?? [];
  }

  /**
   * Schedule cleanup of all audio buffers for a session.
   * Buffers are deleted within `audioCleanupDelayMs` (default 5s) of session end.
   * Returns a promise that resolves when cleanup is complete.
   */
  scheduleCleanup(sessionId: string): Promise<number> {
    return new Promise((resolve) => {
      // Clear any existing timer
      const existing = this.cleanupTimers.get(sessionId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        const count = this.purgeBuffers(sessionId);
        this.cleanupTimers.delete(sessionId);
        resolve(count);
      }, Math.min(this.config.audioCleanupDelayMs, 5000));

      this.cleanupTimers.set(sessionId, timer);
    });
  }

  /**
   * Immediately purge all audio buffers for a session.
   * Returns the number of buffers purged.
   */
  purgeBuffers(sessionId: string): number {
    const bufs = this.buffers.get(sessionId);
    const count = bufs?.length ?? 0;
    this.buffers.delete(sessionId);
    return count;
  }

  /**
   * Purge all tracked buffers across all sessions.
   */
  purgeAll(): number {
    let total = 0;
    for (const [sid] of this.buffers) {
      total += this.purgeBuffers(sid);
    }
    return total;
  }

  // ── Concurrent audio capture detection (stub) ──

  /**
   * Detect if a third-party application is concurrently capturing audio.
   * This is platform-specific and requires native APIs (CoreAudio on macOS,
   * AVAudioSession on iOS). Returns a stub result here.
   */
  detectConcurrentAudioCapture(): { detected: boolean; appName: string | null } {
    // Stub — real implementation requires platform-specific native code
    return { detected: false, appName: null };
  }

  // ── Cleanup ──

  dispose(): void {
    for (const timer of this.cleanupTimers.values()) {
      clearTimeout(timer);
    }
    this.cleanupTimers.clear();
    this.buffers.clear();
  }
}
