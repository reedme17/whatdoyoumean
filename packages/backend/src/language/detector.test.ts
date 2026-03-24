import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  LanguageDetector,
  UnicodeRangeStrategy,
  type LanguageDetectionResult,
  type LanguageDetectionStrategy,
} from "./detector.js";
import type { AudioChunk } from "@wdym/shared";

// ── helpers ──

function makeChunk(): AudioChunk {
  return {
    data: new Float32Array(160),
    timestamp: Date.now(),
    channel: "mixed",
    durationMs: 100,
  };
}

// ── UnicodeRangeStrategy ──

describe("UnicodeRangeStrategy", () => {
  const strategy = new UnicodeRangeStrategy();

  it("detects pure English text", () => {
    const result = strategy.detectFromText("Hello world, this is a test");
    expect(result.primaryLanguage).toBe("en");
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.isCodeSwitching).toBe(false);
  });

  it("detects pure Chinese text", () => {
    const result = strategy.detectFromText("你好世界这是一个测试");
    expect(result.primaryLanguage).toBe("zh");
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.isCodeSwitching).toBe(false);
  });

  it("detects mixed Chinese-English as code-switching", () => {
    const result = strategy.detectFromText("这个API很好用 the design is great");
    expect(result.isCodeSwitching).toBe(true);
  });

  it("returns low confidence for empty text", () => {
    const result = strategy.detectFromText("");
    expect(result.confidence).toBe(0);
  });

  it("returns low confidence for whitespace-only text", () => {
    const result = strategy.detectFromText("   \n\t  ");
    expect(result.confidence).toBe(0);
  });

  it("handles text with only numbers and punctuation", () => {
    const result = strategy.detectFromText("123 456 !@#");
    expect(result.confidence).toBe(0);
  });

  it("detects Chinese-dominant mixed text", () => {
    const result = strategy.detectFromText("今天讨论了很多关于项目的事情 API");
    expect(result.primaryLanguage).toBe("zh");
  });
});

// ── LanguageDetector ──

describe("LanguageDetector", () => {
  let detector: LanguageDetector;

  beforeEach(() => {
    detector = new LanguageDetector({ slidingWindowSize: 3 });
  });

  describe("detectFromText", () => {
    it("returns detection result for English text", () => {
      const result = detector.detectFromText("Hello world");
      expect(result.primaryLanguage).toBe("en");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("returns detection result for Chinese text", () => {
      const result = detector.detectFromText("你好世界");
      expect(result.primaryLanguage).toBe("zh");
    });
  });

  describe("onLanguageChange events", () => {
    it("emits onLanguageChange on first detection", () => {
      const changes: LanguageDetectionResult[] = [];
      detector.onLanguageChange = (r) => changes.push(r);

      detector.detectFromText("Hello world");

      expect(changes).toHaveLength(1);
      expect(changes[0].primaryLanguage).toBe("en");
    });

    it("emits onLanguageChange when dominant language shifts", () => {
      const changes: LanguageDetectionResult[] = [];
      detector.onLanguageChange = (r) => changes.push(r);

      // Establish English as dominant
      detector.detectFromText("Hello world");
      detector.detectFromText("This is English");

      // Switch to Chinese — need enough entries to shift the window
      detector.detectFromText("你好世界");
      detector.detectFromText("这是中文");
      detector.detectFromText("继续说中文");

      // Should have emitted: first English, then Chinese
      expect(changes.length).toBeGreaterThanOrEqual(2);
      expect(changes[0].primaryLanguage).toBe("en");
      expect(changes[changes.length - 1].primaryLanguage).toBe("zh");
    });

    it("does NOT emit when language stays the same", () => {
      const changes: LanguageDetectionResult[] = [];
      detector.onLanguageChange = (r) => changes.push(r);

      detector.detectFromText("Hello");
      detector.detectFromText("World");
      detector.detectFromText("Test");

      // Only the first detection should trigger a change (null → en)
      expect(changes).toHaveLength(1);
    });
  });

  describe("sliding window smoothing", () => {
    it("does not flip language on a single outlier", () => {
      // Window size 3, dominance threshold 0.6
      detector = new LanguageDetector({
        slidingWindowSize: 3,
        dominanceThreshold: 0.6,
      });

      const changes: LanguageDetectionResult[] = [];
      detector.onLanguageChange = (r) => changes.push(r);

      detector.detectFromText("Hello world");
      detector.detectFromText("This is English");
      // One Chinese entry shouldn't flip the dominant language
      detector.detectFromText("你好");

      // Window: [en, en, zh] → en is still dominant (2/3 ≈ 0.67 > 0.6)
      expect(detector.getCurrentLanguage()).toBe("en");
    });
  });

  describe("detectFromAudio (stub)", () => {
    it("returns a result (stub implementation)", async () => {
      const result = await detector.detectFromAudio(makeChunk());
      expect(result).toBeDefined();
      expect(result.primaryLanguage).toBeDefined();
      expect(typeof result.confidence).toBe("number");
    });
  });

  describe("pluggable strategy", () => {
    it("uses a custom strategy when provided", () => {
      const customStrategy: LanguageDetectionStrategy = {
        detectFromText: () => ({
          primaryLanguage: "zh",
          confidence: 0.99,
          isCodeSwitching: false,
        }),
      };

      detector = new LanguageDetector({}, customStrategy);
      const result = detector.detectFromText("anything");
      expect(result.primaryLanguage).toBe("zh");
      expect(result.confidence).toBe(0.99);
    });

    it("allows swapping strategy at runtime via setStrategy", () => {
      const result1 = detector.detectFromText("Hello world");
      expect(result1.primaryLanguage).toBe("en");

      const alwaysChinese: LanguageDetectionStrategy = {
        detectFromText: () => ({
          primaryLanguage: "zh",
          confidence: 1,
          isCodeSwitching: false,
        }),
      };
      detector.setStrategy(alwaysChinese);

      const result2 = detector.detectFromText("Hello world");
      expect(result2.primaryLanguage).toBe("zh");
    });
  });

  describe("reset", () => {
    it("clears window and current language", () => {
      detector.detectFromText("Hello world");
      expect(detector.getCurrentLanguage()).toBe("en");

      detector.reset();
      expect(detector.getCurrentLanguage()).toBeNull();
    });
  });
});
