/**
 * Local STT stub for server context.
 *
 * Real local STT runs on the client (Electron via Whisper.cpp / macOS Speech
 * Recognition, iOS via Apple Speech Framework). This stub exists so the
 * TranscriptionEngine can reference a local provider for completeness and
 * fallback logic without crashing on the server.
 */

import type { STTProvider, AudioChunk, TranscriptSegment } from "../types.js";

export class LocalSTTStub implements STTProvider {
  readonly name = "local_stub";
  readonly type = "local" as const;
  readonly supportedLanguages: ("zh" | "en")[] = ["zh", "en"];

  onResult: ((result: TranscriptSegment) => void) | null = null;

  private active = false;
  private languageCode = "en";

  startStream(languageCode: string): void {
    this.languageCode = languageCode;
    this.active = true;
  }

  feedAudio(chunk: AudioChunk): void {
    if (!this.active) return;

    // Emit a result indicating local STT is not available server-side.
    // The client layer is responsible for providing a real local STT
    // implementation (Apple Speech, Whisper.js WASM, etc.).
    if (this.onResult) {
      this.onResult({
        id: `local_stub_${Date.now()}`,
        sessionId: "",
        text: "[local STT not available in server context]",
        languageCode: this.languageCode as "zh" | "en",
        speakerId: "unknown",
        startTime: chunk.timestamp,
        endTime: chunk.timestamp + chunk.durationMs,
        isFinal: true,
        confidence: 0,
        provider: this.name,
        createdAt: new Date(),
      });
    }
  }

  stopStream(): void {
    this.active = false;
  }
}
