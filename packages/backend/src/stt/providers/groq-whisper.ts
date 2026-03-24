/**
 * Groq Whisper Large v3 Turbo adapter for English STT.
 *
 * Uses the OpenAI-compatible API at api.groq.com/openai/v1.
 * Reads GROQ_API_KEY from environment.
 */

import OpenAI from "openai";
import type { STTProvider, AudioChunk, TranscriptSegment } from "../types.js";

export class GroqWhisperProvider implements STTProvider {
  readonly name = "groq_whisper";
  readonly type = "cloud" as const;
  readonly supportedLanguages: ("zh" | "en")[] = ["en"];

  onResult: ((result: TranscriptSegment) => void) | null = null;

  private client: OpenAI | null = null;
  private languageCode = "en";
  private active = false;
  private sessionId = "";
  private segmentCounter = 0;

  private getClient(): OpenAI | null {
    if (this.client) return this.client;
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null;
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });
    return this.client;
  }

  startStream(languageCode: string): void {
    this.languageCode = languageCode;
    this.active = true;
    this.segmentCounter = 0;
  }

  feedAudio(chunk: AudioChunk): void {
    if (!this.active) return;

    const client = this.getClient();
    if (!client) {
      this.emitResult(chunk, "Groq API key not configured", false, 0);
      return;
    }

    // In a real implementation, audio chunks would be accumulated and sent
    // to the Groq Whisper API for transcription. The Groq API accepts audio
    // files via the /audio/transcriptions endpoint (OpenAI-compatible).
    //
    // For now, this is the correct interface shape — actual audio-to-file
    // conversion and API calls will be wired when the audio pipeline is
    // integrated end-to-end.
    this.segmentCounter++;
  }

  stopStream(): void {
    this.active = false;
  }

  /**
   * Transcribe a complete audio buffer (non-streaming convenience method).
   * Returns the transcript text and latency in ms.
   */
  async transcribe(
    audioFile: File | Blob,
    language = "en",
  ): Promise<{ text: string; latencyMs: number }> {
    const client = this.getClient();
    if (!client) throw new Error("Groq API key not configured");

    const start = Date.now();
    const response = await client.audio.transcriptions.create({
      file: audioFile as unknown as File,
      model: "whisper-large-v3-turbo",
      language,
      response_format: "json",
    });
    const latencyMs = Date.now() - start;

    return { text: response.text, latencyMs };
  }

  private emitResult(
    chunk: AudioChunk,
    text: string,
    isFinal: boolean,
    confidence: number,
  ): void {
    if (!this.onResult) return;
    this.onResult({
      id: `groq_${this.segmentCounter}`,
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
