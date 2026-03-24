/**
 * LanguageDetector — pluggable language detection module.
 *
 * Detects Chinese vs English from text (via Unicode range heuristics) or audio
 * (stub — delegates to text analysis of STT output). Tracks a sliding window
 * of recent detections to smooth code-switching noise, and emits
 * onLanguageChange only when the dominant language actually changes.
 *
 * Designed as a pluggable module: swap the detection strategy without touching
 * the event/routing layer.
 */

import type { AudioChunk } from "@wdym/shared";

// ── Public types ──

export interface LanguageDetectionResult {
  primaryLanguage: "zh" | "en";
  confidence: number;
  isCodeSwitching: boolean;
}

/**
 * Pluggable detection strategy. Implement this to add new language
 * detection backends (e.g. ML-based audio classifiers).
 */
export interface LanguageDetectionStrategy {
  detectFromText(text: string): LanguageDetectionResult;
}

export interface LanguageDetectorConfig {
  /** Size of the sliding window used to smooth code-switching noise. */
  slidingWindowSize: number;
  /**
   * Fraction of window entries that must agree before we consider the
   * language "dominant" (0–1). Default 0.6.
   */
  dominanceThreshold: number;
  /** Max time (ms) allowed for detectFromAudio. Default 3000. */
  audioDetectionTimeoutMs: number;
}

export const DEFAULT_LANGUAGE_DETECTOR_CONFIG: LanguageDetectorConfig = {
  slidingWindowSize: 5,
  dominanceThreshold: 0.6,
  audioDetectionTimeoutMs: 3000,
};

// ── Default heuristic strategy ──

/**
 * Simple Unicode-range heuristic: counts CJK characters vs Latin characters
 * to determine the dominant language. Fast and accurate for Chinese vs English.
 */
export class UnicodeRangeStrategy implements LanguageDetectionStrategy {
  detectFromText(text: string): LanguageDetectionResult {
    if (!text || text.trim().length === 0) {
      return { primaryLanguage: "en", confidence: 0, isCodeSwitching: false };
    }

    let cjkCount = 0;
    let latinCount = 0;

    for (const char of text) {
      const code = char.codePointAt(0)!;
      if (isCJK(code)) {
        cjkCount++;
      } else if (isLatin(code)) {
        latinCount++;
      }
      // Ignore punctuation, digits, whitespace
    }

    const total = cjkCount + latinCount;
    if (total === 0) {
      return { primaryLanguage: "en", confidence: 0, isCodeSwitching: false };
    }

    const cjkRatio = cjkCount / total;
    const latinRatio = latinCount / total;

    const primaryLanguage: "zh" | "en" = cjkRatio >= latinRatio ? "zh" : "en";
    const dominantRatio = Math.max(cjkRatio, latinRatio);

    // Code-switching: both languages have significant presence
    const isCodeSwitching =
      cjkCount > 0 && latinCount > 0 && dominantRatio < 0.85;

    return {
      primaryLanguage,
      confidence: dominantRatio,
      isCodeSwitching,
    };
  }
}

// ── LanguageDetector ──

export class LanguageDetector {
  private strategy: LanguageDetectionStrategy;
  private config: LanguageDetectorConfig;

  /** Sliding window of recent detection results for smoothing. */
  private window: LanguageDetectionResult[] = [];
  /** Last emitted dominant language (to avoid duplicate events). */
  private currentLanguage: "zh" | "en" | null = null;

  // ── Event callback ──

  onLanguageChange: ((result: LanguageDetectionResult) => void) | null = null;

  constructor(
    config?: Partial<LanguageDetectorConfig>,
    strategy?: LanguageDetectionStrategy,
  ) {
    this.config = { ...DEFAULT_LANGUAGE_DETECTOR_CONFIG, ...config };
    this.strategy = strategy ?? new UnicodeRangeStrategy();
  }

  /**
   * Swap the detection strategy at runtime (pluggable module design).
   */
  setStrategy(strategy: LanguageDetectionStrategy): void {
    this.strategy = strategy;
  }

  /**
   * Detect language from an audio chunk.
   *
   * Stub implementation: real audio-based detection requires ML models.
   * In practice the detector analyses the *text output* from STT, so
   * callers should prefer `detectFromText()` on STT results.
   *
   * Returns a low-confidence English result as a safe default.
   */
  async detectFromAudio(_chunk: AudioChunk): Promise<LanguageDetectionResult> {
    // Stub — real implementation would run an audio language classifier
    const result: LanguageDetectionResult = {
      primaryLanguage: this.currentLanguage ?? "en",
      confidence: 0.5,
      isCodeSwitching: false,
    };
    return result;
  }

  /**
   * Detect language from text using the pluggable strategy.
   * Updates the sliding window and emits onLanguageChange when the
   * dominant language shifts.
   */
  detectFromText(text: string): LanguageDetectionResult {
    const result = this.strategy.detectFromText(text);

    this.pushToWindow(result);
    this.evaluateAndEmit();

    return result;
  }

  /**
   * Return the current dominant language (or null before first detection).
   */
  getCurrentLanguage(): "zh" | "en" | null {
    return this.currentLanguage;
  }

  /**
   * Reset internal state (useful between sessions).
   */
  reset(): void {
    this.window = [];
    this.currentLanguage = null;
  }

  // ── Internal ──

  private pushToWindow(result: LanguageDetectionResult): void {
    this.window.push(result);
    if (this.window.length > this.config.slidingWindowSize) {
      this.window.shift();
    }
  }

  private evaluateAndEmit(): void {
    if (this.window.length === 0) return;

    let zhCount = 0;
    let enCount = 0;
    let codeSwitchCount = 0;

    for (const r of this.window) {
      if (r.primaryLanguage === "zh") zhCount++;
      else enCount++;
      if (r.isCodeSwitching) codeSwitchCount++;
    }

    const total = this.window.length;
    const zhRatio = zhCount / total;
    const enRatio = enCount / total;

    const dominant: "zh" | "en" =
      zhRatio >= this.config.dominanceThreshold
        ? "zh"
        : enRatio >= this.config.dominanceThreshold
          ? "en"
          : this.currentLanguage ?? "en";

    const confidence = Math.max(zhRatio, enRatio);
    const isCodeSwitching = codeSwitchCount / total > 0.3;

    if (dominant !== this.currentLanguage) {
      this.currentLanguage = dominant;
      const changeResult: LanguageDetectionResult = {
        primaryLanguage: dominant,
        confidence,
        isCodeSwitching,
      };
      this.onLanguageChange?.(changeResult);
    }
  }
}

// ── Unicode helpers ──

function isCJK(code: number): boolean {
  return (
    (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
    (code >= 0x3400 && code <= 0x4dbf) || // CJK Unified Ideographs Extension A
    (code >= 0x20000 && code <= 0x2a6df) || // CJK Unified Ideographs Extension B
    (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility Ideographs
    (code >= 0x2f800 && code <= 0x2fa1f) // CJK Compatibility Ideographs Supplement
  );
}

function isLatin(code: number): boolean {
  return (
    (code >= 0x0041 && code <= 0x005a) || // A-Z
    (code >= 0x0061 && code <= 0x007a) || // a-z
    (code >= 0x00c0 && code <= 0x024f) // Latin Extended-A/B (accented chars)
  );
}
