/**
 * Error handler — resilience layer for the real-time pipeline.
 *
 * - Retry transcription errors up to 3 times
 * - Queue transcription on network loss, continue local capture
 * - Skip failed semantic analysis without interrupting stream
 * - Session crash recovery from last checkpoint
 * - Structured error logging with timestamp, subsystem, details
 * - Low storage / low battery warnings (emit events)
 *
 * Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 12.5, 12.6
 */

export interface ErrorLogEntry {
  timestamp: string;
  subsystem: string;
  message: string;
  details?: string;
  recoverable: boolean;
}

export interface SessionCheckpoint {
  sessionId: string;
  timestamp: number;
  transcriptCount: number;
  cardCount: number;
  lastSegmentId: string | null;
}

export type WarningType = "low_storage" | "low_battery";

export interface WarningEvent {
  type: WarningType;
  message: string;
  timestamp: string;
}

/**
 * Resilient error handler for the pipeline.
 */
export class ErrorHandler {
  private logs: ErrorLogEntry[] = [];
  private checkpoints: Map<string, SessionCheckpoint> = new Map();
  private transcriptionQueue: Array<{ sessionId: string; audioData: unknown; queuedAt: number }> = [];
  private maxRetries = 3;

  /** Event callback for warnings (low storage, low battery) */
  onWarning: ((event: WarningEvent) => void) | null = null;

  // ── Error logging ──

  logError(subsystem: string, message: string, details?: string, recoverable = true): ErrorLogEntry {
    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      subsystem,
      message,
      details,
      recoverable,
    };
    this.logs.push(entry);
    return entry;
  }

  getErrorLogs(): ErrorLogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  // ── Retry logic for transcription ──

  /**
   * Execute an async operation with retry. Returns the result or throws
   * after maxRetries attempts.
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    subsystem: string,
    description: string,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.logError(
          subsystem,
          `Attempt ${attempt}/${this.maxRetries} failed: ${description}`,
          lastError.message,
          attempt < this.maxRetries,
        );
      }
    }

    this.logError(subsystem, `All ${this.maxRetries} retries exhausted: ${description}`, lastError?.message, false);
    throw lastError;
  }

  // ── Network loss: queue transcription ──

  /**
   * Queue audio data for later transcription when network is unavailable.
   */
  queueTranscription(sessionId: string, audioData: unknown): void {
    this.transcriptionQueue.push({
      sessionId,
      audioData,
      queuedAt: Date.now(),
    });
  }

  /**
   * Drain the transcription queue. Returns all queued items and clears the queue.
   */
  drainTranscriptionQueue(): Array<{ sessionId: string; audioData: unknown; queuedAt: number }> {
    const items = [...this.transcriptionQueue];
    this.transcriptionQueue = [];
    return items;
  }

  getQueueSize(): number {
    return this.transcriptionQueue.length;
  }

  // ── Safe semantic analysis wrapper ──

  /**
   * Run semantic analysis safely — if it fails, log the error and return null
   * instead of interrupting the stream.
   */
  async safeSemanticAnalysis<T>(
    operation: () => Promise<T>,
    segmentId: string,
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logError("semantic", `Analysis failed for segment ${segmentId}`, message, true);
      return null;
    }
  }

  // ── Session crash recovery ──

  /**
   * Save a periodic checkpoint for crash recovery.
   */
  saveCheckpoint(checkpoint: SessionCheckpoint): void {
    this.checkpoints.set(checkpoint.sessionId, checkpoint);
  }

  /**
   * Retrieve the last checkpoint for a session.
   */
  getCheckpoint(sessionId: string): SessionCheckpoint | null {
    return this.checkpoints.get(sessionId) ?? null;
  }

  /**
   * Remove checkpoint after successful session end.
   */
  clearCheckpoint(sessionId: string): void {
    this.checkpoints.delete(sessionId);
  }

  /**
   * List all sessions with saved checkpoints (for recovery on restart).
   */
  getRecoverableSessions(): SessionCheckpoint[] {
    return Array.from(this.checkpoints.values());
  }

  // ── Resource warnings ──

  /**
   * Emit a low storage warning to the client.
   */
  emitLowStorageWarning(): void {
    const event: WarningEvent = {
      type: "low_storage",
      message: "Low storage: continuing in reduced mode, prioritizing live transcription",
      timestamp: new Date().toISOString(),
    };
    this.logError("system", event.message, undefined, true);
    this.onWarning?.(event);
  }

  /**
   * Emit a low battery warning (< 10%) to the client.
   */
  emitLowBatteryWarning(batteryPercent: number): void {
    const event: WarningEvent = {
      type: "low_battery",
      message: `Low battery (${batteryPercent}%): consider pausing or ending the session`,
      timestamp: new Date().toISOString(),
    };
    this.logError("system", event.message, undefined, true);
    this.onWarning?.(event);
  }
}
