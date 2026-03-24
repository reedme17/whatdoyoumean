import { describe, it, expect, beforeEach } from "vitest";
import {
  SpeakerDiarizer,
  type SpeakerSegment,
} from "./diarizer.js";
import type { AudioChunk } from "@wdym/shared";

// ── helpers ──

function makeChunk(overrides: Partial<AudioChunk> = {}): AudioChunk {
  return {
    data: new Float32Array(160),
    timestamp: Date.now(),
    channel: "mixed",
    durationMs: 100,
    ...overrides,
  };
}

// ── tests ──

describe("SpeakerDiarizer", () => {
  let diarizer: SpeakerDiarizer;

  beforeEach(() => {
    diarizer = new SpeakerDiarizer();
    diarizer.initialize("test-session");
  });

  describe("initialize", () => {
    it("requires initialization before processing", () => {
      const fresh = new SpeakerDiarizer();
      expect(() => fresh.processAudio(makeChunk())).toThrow(
        "SpeakerDiarizer not initialized",
      );
    });

    it("resets state on re-initialization", () => {
      diarizer.processAudio(makeChunk());
      expect(diarizer.getSegments()).toHaveLength(1);

      diarizer.initialize("new-session");
      expect(diarizer.getSegments()).toHaveLength(0);
      expect(diarizer.getSpeakerIds()).toHaveLength(0);
    });
  });

  describe("processAudio", () => {
    it("assigns a speaker label to the first audio chunk", () => {
      const segment = diarizer.processAudio(makeChunk());
      expect(segment.speakerId).toBe("speaker_1");
      expect(segment.displayName).toBeNull();
    });

    it("returns segments with correct timing from the chunk", () => {
      const chunk = makeChunk({ timestamp: 5000, durationMs: 200 });
      const segment = diarizer.processAudio(chunk);
      expect(segment.startTime).toBe(5000);
      expect(segment.endTime).toBe(5200);
    });

    it("returns a confidence score", () => {
      const segment = diarizer.processAudio(makeChunk());
      expect(segment.confidence).toBeGreaterThan(0);
      expect(segment.confidence).toBeLessThanOrEqual(1);
    });

    it("accumulates segments", () => {
      diarizer.processAudio(makeChunk());
      diarizer.processAudio(makeChunk());
      diarizer.processAudio(makeChunk());
      expect(diarizer.getSegments()).toHaveLength(3);
    });
  });

  describe("speaker change detection", () => {
    it("emits onSpeakerChange when a new speaker is detected", () => {
      const changes: SpeakerSegment[] = [];
      diarizer.onSpeakerChange = (s) => changes.push(s);

      // First speaker
      diarizer.processAudio(makeChunk());
      expect(changes).toHaveLength(1);
      expect(changes[0].speakerId).toBe("speaker_1");
    });

    it("emits onSpeakerChange when speaker switches", () => {
      const changes: SpeakerSegment[] = [];
      diarizer.onSpeakerChange = (s) => changes.push(s);

      diarizer.processAudio(makeChunk());
      // Hint a different speaker for the next chunk
      diarizer.setSpeakerHint("speaker_2");
      diarizer.processAudio(makeChunk());

      expect(changes).toHaveLength(2);
      expect(changes[0].speakerId).toBe("speaker_1");
      expect(changes[1].speakerId).toBe("speaker_2");
    });

    it("does NOT emit when same speaker continues", () => {
      const changes: SpeakerSegment[] = [];
      diarizer.onSpeakerChange = (s) => changes.push(s);

      diarizer.processAudio(makeChunk());
      diarizer.processAudio(makeChunk());
      diarizer.processAudio(makeChunk());

      // Only the first chunk triggers a change (null → speaker_1)
      expect(changes).toHaveLength(1);
    });
  });

  describe("assignName", () => {
    it("assigns a display name to a speaker", () => {
      diarizer.processAudio(makeChunk());
      diarizer.assignName("speaker_1", "Alice");
      expect(diarizer.getDisplayName("speaker_1")).toBe("Alice");
    });

    it("propagates name to all existing segments", () => {
      diarizer.processAudio(makeChunk());
      diarizer.processAudio(makeChunk());
      diarizer.processAudio(makeChunk());

      diarizer.assignName("speaker_1", "Bob");

      const segments = diarizer.getSegments();
      for (const seg of segments) {
        expect(seg.displayName).toBe("Bob");
      }
    });

    it("propagates name to future segments", () => {
      diarizer.processAudio(makeChunk());
      diarizer.assignName("speaker_1", "Carol");

      const segment = diarizer.processAudio(makeChunk());
      expect(segment.displayName).toBe("Carol");
    });

    it("throws for unknown speaker ID", () => {
      expect(() => diarizer.assignName("speaker_99", "Nobody")).toThrow(
        "Unknown speaker",
      );
    });
  });

  describe("uncertain attribution", () => {
    it("marks segments with confidence < 0.7 as uncertain", () => {
      // Default stub confidence is 0.85, so we use a custom config
      diarizer = new SpeakerDiarizer({ uncertaintyThreshold: 0.7 });
      diarizer.initialize("test-session");

      const segment = diarizer.processAudio(makeChunk());
      // Default stub confidence is 0.85 > 0.7
      expect(diarizer.isUncertain(segment)).toBe(false);
    });

    it("identifies low-confidence segments as uncertain", () => {
      diarizer = new SpeakerDiarizer({ uncertaintyThreshold: 0.7 });
      diarizer.initialize("test-session");

      const lowConfSegment: SpeakerSegment = {
        speakerId: "speaker_1",
        displayName: null,
        startTime: 0,
        endTime: 100,
        confidence: 0.5,
      };
      expect(diarizer.isUncertain(lowConfSegment)).toBe(true);
    });

    it("does not mark high-confidence segments as uncertain", () => {
      const highConfSegment: SpeakerSegment = {
        speakerId: "speaker_1",
        displayName: null,
        startTime: 0,
        endTime: 100,
        confidence: 0.9,
      };
      expect(diarizer.isUncertain(highConfSegment)).toBe(false);
    });
  });

  describe("speaker tracking", () => {
    it("tracks distinct speaker IDs", () => {
      diarizer.processAudio(makeChunk());
      diarizer.setSpeakerHint("speaker_2");
      diarizer.processAudio(makeChunk());

      const ids = diarizer.getSpeakerIds();
      expect(ids).toContain("speaker_1");
      expect(ids).toContain("speaker_2");
      expect(ids).toHaveLength(2);
    });

    it("maintains consistent labels throughout a session", () => {
      diarizer.processAudio(makeChunk());
      diarizer.setSpeakerHint("speaker_2");
      diarizer.processAudio(makeChunk());
      diarizer.setSpeakerHint("speaker_1");
      diarizer.processAudio(makeChunk());

      const segments = diarizer.getSegments();
      expect(segments[0].speakerId).toBe("speaker_1");
      expect(segments[1].speakerId).toBe("speaker_2");
      expect(segments[2].speakerId).toBe("speaker_1");
    });
  });
});
