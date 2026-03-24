/**
 * Alibaba DashScope Qwen ASR adapter for Chinese STT.
 *
 * Reads DASHSCOPE_API_KEY from environment.
 *
 * This is a stub implementation with the correct interface shape.
 * The actual DashScope API integration will be refined later since
 * their SDK is less standardized than OpenAI-compatible APIs.
 */

import type { STTProvider, AudioChunk, TranscriptSegment } from "../types.js";

export class DashScopeQwenProvider implements STTProvider {
  readonly name = "dashscope_qwen";
  readonly type = "cloud" as const;
  readonly supportedLanguages: ("zh" | "en")[] = ["zh"];

  onResult: ((result: TranscriptSegment) => void) | null = null;

  private languageCode = "zh";
  private active = false;
  private sessionId = "";
  private segmentCounter = 0;

  private getApiKey(): string | undefined {
    return process.env.DASHSCOPE_API_KEY;
  }

  startStream(languageCode: string): void {
    this.languageCode = languageCode;
    this.active = true;
    this.segmentCounter = 0;
  }

  feedAudio(chunk: AudioChunk): void {
    if (!this.active) return;

    const apiKey = this.getApiKey();
    if (!apiKey) {
      this.emitResult(chunk, "DashScope API key not configured", false, 0);
      return;
    }

    // Stub: In the real implementation, audio chunks would be sent to
    // the DashScope Qwen ASR WebSocket endpoint:
    //   wss://dashscope.aliyuncs.com/api-ws/v1/inference
    //
    // The DashScope API uses a proprietary WebSocket protocol with
    // JSON control frames and binary audio frames. The model ID for
    // Qwen ASR is "paraformer-realtime-v2".
    //
    // Audio format: 16kHz, 16-bit, mono PCM
    //
    // Response format includes interim and final results with
    // timestamps and confidence scores.
    this.segmentCounter++;
  }

  stopStream(): void {
    this.active = false;
  }

  /**
   * Transcribe a complete audio buffer (non-streaming stub).
   * Will be implemented with the DashScope REST API.
   */
  async transcribe(
    _audioData: ArrayBuffer,
    language = "zh",
  ): Promise<{ text: string; latencyMs: number }> {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error("DashScope API key not configured");

    // Stub: POST to https://dashscope.aliyuncs.com/api/v1/services/audio/asr
    // with model: "paraformer-v2", audio data, and language parameter.
    //
    // For now, return a placeholder to satisfy the interface.
    return {
      text: `[DashScope stub — ${language} transcription pending]`,
      latencyMs: 0,
    };
  }

  private emitResult(
    chunk: AudioChunk,
    text: string,
    isFinal: boolean,
    confidence: number,
  ): void {
    if (!this.onResult) return;
    this.onResult({
      id: `dashscope_${this.segmentCounter}`,
      sessionId: this.sessionId,
      text,
      languageCode: this.languageCode as "zh" | "en",
      speakerId: "unknown",
      startTime: chunk.timestamp,
      endTime: chunk.timestamp + chunk.durationMs,
      isFinal,
      confidence,
      provider: this.name,
      createdAt: new Date(),
    });
  }
}
