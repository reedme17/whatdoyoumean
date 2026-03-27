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

  /**
   * Transcribe base64-encoded WAV audio from the renderer.
   * Converts the base64 string to a Buffer and calls the Groq API.
   */
  async transcribeBase64Wav(
    audioBase64: string,
    language?: string,
  ): Promise<{ text: string; latencyMs: number }> {
    const client = this.getClient();
    if (!client) throw new Error("Groq API key not configured");

    // Polyfill File for Node 18
    if (typeof globalThis.File === "undefined") {
      const { File } = await import("node:buffer");
      globalThis.File = File as unknown as typeof globalThis.File;
    }

    // Decode base64 to Node.js Buffer
    const audioBuffer = Buffer.from(audioBase64, "base64");

    // Use OpenAI SDK's toFile helper (works in Node 18 without global File)
    const { toFile } = await import("openai/uploads");
    const file = await toFile(audioBuffer, "audio.wav", { type: "audio/wav" });

    const start = Date.now();
    const response = await client.audio.transcriptions.create({
      file,
      model: "whisper-large-v3-turbo",
      ...(language ? { language } : {}), // omit language to let Whisper auto-detect
      response_format: "verbose_json",
    });
    const latencyMs = Date.now() - start;

    // Filter low-confidence segments using no_speech_prob and avg_logprob
    const segments = (response as unknown as { segments?: { no_speech_prob?: number; avg_logprob?: number }[] }).segments ?? [];
    const NO_SPEECH_THRESHOLD = 0.7;
    const AVG_LOGPROB_THRESHOLD = -1.0;
    const hasLowConfidence = segments.length > 0 && segments.every(
      (s) => (s.no_speech_prob ?? 0) > NO_SPEECH_THRESHOLD || (s.avg_logprob ?? 0) < AVG_LOGPROB_THRESHOLD
    );

    if (hasLowConfidence) {
      console.log(`[GroqWhisper] Low confidence — dropping. no_speech_prob=${segments[0]?.no_speech_prob?.toFixed(3)}, avg_logprob=${segments[0]?.avg_logprob?.toFixed(3)}, text="${response.text.slice(0, 40)}"`);
      return { text: "", latencyMs };
    }

    console.log(`[GroqWhisper] Transcribed in ${latencyMs}ms: "${response.text.slice(0, 80)}" (no_speech=${segments[0]?.no_speech_prob?.toFixed(3)}, logprob=${segments[0]?.avg_logprob?.toFixed(3)})`);
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
