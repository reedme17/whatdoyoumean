/**
 * SpeakerDiarizer — identifies and labels distinct speakers within a session.
 *
 * Stub/interface implementation: real speaker diarization requires ML models
 * (e.g. pyannote) that will run as a separate service. This module implements
 * the interface with basic logic: assign speaker IDs, support name assignment,
 * track confidence, and emit speaker change events.
 */

import type { AudioChunk } from "@wdym/shared";

// ── Public types ──

export interface SpeakerSegment {
  speakerId: string;
  displayName: string | null;
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface SpeakerDiarizerConfig {
  /** Confidence threshold below which segments are marked uncertain. */
  uncertaintyThreshold: number;
  /** Maximum number of speakers to track per session. */
  maxSpeakers: number;
}

export const DEFAULT_DIARIZER_CONFIG: SpeakerDiarizerConfig = {
  uncertaintyThreshold: 0.7,
  maxSpeakers: 10,
};

// ── SpeakerDiarizer ──

export class SpeakerDiarizer {
  private config: SpeakerDiarizerConfig;
  private sessionId: string | null = null;
  private initialized = false;

  /** Map of speakerId → user-assigned display name. */
  private speakerNames: Map<string, string> = new Map();
  /** All segments produced in this session. */
  private segments: SpeakerSegment[] = [];
  /** Current active speaker ID. */
  private currentSpeakerId: string | null = null;
  /** Counter for generating speaker IDs. */
  private speakerCounter = 0;
  /** Set of known speaker IDs in this session. */
  private knownSpeakers: Set<string> = new Set();

  // ── Event callback ──

  onSpeakerChange: ((segment: SpeakerSegment) => void) | null = null;

  constructor(config?: Partial<SpeakerDiarizerConfig>) {
    this.config = { ...DEFAULT_DIARIZER_CONFIG, ...config };
  }

  /**
   * Initialize the diarizer for a new session.
   */
  initialize(sessionId: string): void {
    this.sessionId = sessionId;
    this.initialized = true;
    this.speakerNames.clear();
    this.segments = [];
    this.currentSpeakerId = null;
    this.speakerCounter = 0;
    this.knownSpeakers.clear();
  }

  /**
   * Process an audio chunk and return a speaker segment.
   *
   * Stub implementation: assigns speakers based on simple heuristics.
   * Real implementation would use ML-based embeddings to cluster speakers.
   */
  processAudio(chunk: AudioChunk): SpeakerSegment {
    if (!this.initialized) {
      throw new Error("SpeakerDiarizer not initialized. Call initialize() first.");
    }

    // Stub: simulate speaker detection.
    // In a real implementation, this would extract voice embeddings from the
    // audio chunk and compare against known speaker profiles.
    const speakerId = this.detectSpeaker(chunk);
    const confidence = this.estimateConfidence(chunk);

    const segment: SpeakerSegment = {
      speakerId,
      displayName: this.speakerNames.get(speakerId) ?? null,
      startTime: chunk.timestamp,
      endTime: chunk.timestamp + chunk.durationMs,
      confidence,
    };

    this.segments.push(segment);

    // Emit speaker change if the speaker changed
    if (speakerId !== this.currentSpeakerId) {
      this.currentSpeakerId = speakerId;
      this.onSpeakerChange?.(segment);
    }

    return segment;
  }

  /**
   * Assign a user-friendly name to a speaker. Propagates to all existing
   * and future segments for that speaker.
   */
  assignName(speakerId: string, name: string): void {
    if (!this.knownSpeakers.has(speakerId)) {
      throw new Error(`Unknown speaker: ${speakerId}`);
    }
    this.speakerNames.set(speakerId, name);

    // Propagate to all existing segments
    for (const seg of this.segments) {
      if (seg.speakerId === speakerId) {
        seg.displayName = name;
      }
    }
  }

  /**
   * Get all segments produced in this session.
   */
  getSegments(): SpeakerSegment[] {
    return [...this.segments];
  }

  /**
   * Get all known speaker IDs in this session.
   */
  getSpeakerIds(): string[] {
    return Array.from(this.knownSpeakers);
  }

  /**
   * Get the display name for a speaker (or null if not assigned).
   */
  getDisplayName(speakerId: string): string | null {
    return this.speakerNames.get(speakerId) ?? null;
  }

  /**
   * Check whether a segment has uncertain attribution.
   */
  isUncertain(segment: SpeakerSegment): boolean {
    return segment.confidence < this.config.uncertaintyThreshold;
  }

  /**
   * Manually set the speaker for the next processAudio call.
   * Useful for testing or manual override scenarios.
   */
  setSpeakerHint(speakerId: string): void {
    this._speakerHint = speakerId;
  }

  private _speakerHint: string | null = null;

  // ── Internal: stub speaker detection ──

  private detectSpeaker(_chunk: AudioChunk): string {
    // If a hint is set, use it (for testing / manual override)
    if (this._speakerHint) {
      const id = this._speakerHint;
      this._speakerHint = null;
      if (!this.knownSpeakers.has(id)) {
        this.knownSpeakers.add(id);
      }
      return id;
    }

    // Stub: if no speakers exist yet, create the first one.
    // Otherwise return the current speaker (real impl would use embeddings).
    if (this.knownSpeakers.size === 0) {
      return this.createNewSpeaker();
    }

    return this.currentSpeakerId ?? this.createNewSpeaker();
  }

  private createNewSpeaker(): string {
    if (this.knownSpeakers.size >= this.config.maxSpeakers) {
      // Return the last known speaker if we've hit the limit
      return this.currentSpeakerId ?? `speaker_1`;
    }

    this.speakerCounter++;
    const id = `speaker_${this.speakerCounter}`;
    this.knownSpeakers.add(id);
    return id;
  }

  private estimateConfidence(_chunk: AudioChunk): number {
    // Stub: return a default confidence.
    // Real implementation would compute confidence from embedding distance,
    // overlap detection, SNR, etc.
    return 0.85;
  }
}
