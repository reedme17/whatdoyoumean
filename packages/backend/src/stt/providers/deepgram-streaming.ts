/**
 * Deepgram Streaming STT Provider — WebSocket-based real-time transcription.
 * Maintains a persistent WebSocket connection with auto-reconnect.
 */

import WebSocket from "ws";

export interface DeepgramStreamResult {
  text: string;
  isFinal: boolean;
  speaker: number;
  confidence: number;
}

export type OnResultCallback = (result: DeepgramStreamResult) => void;
export type OnUtteranceEndCallback = () => void;

export class DeepgramStreamingProvider {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private onResult: OnResultCallback | null = null;
  private onUtteranceEnd: OnUtteranceEndCallback | null = null;
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;
  private language: string | undefined;
  private stopped = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.apiKey = process.env.DEEPGRAM_API_KEY ?? "";
  }

  start(
    language: string | undefined,
    onResult: OnResultCallback,
    onUtteranceEnd: OnUtteranceEndCallback,
  ): void {
    this.stopped = false;
    this.onResult = onResult;
    this.onUtteranceEnd = onUtteranceEnd;
    this.language = language;
    this.connect();
  }

  private connect(): void {
    if (this.stopped) return;
    if (this.ws) { try { this.ws.close(); } catch {} }

    const params = new URLSearchParams({
      model: "nova-2",
      smart_format: "true",
      diarize: "true",
      interim_results: "true",
      utterance_end_ms: "1500",
      endpointing: "300",
      encoding: "linear16",
      sample_rate: "16000",
      channels: "1",
    });
    if (this.language === "zh" || this.language === "en") {
      params.set("language", this.language);
    } else {
      params.set("language", "multi");
    }

    const url = `wss://api.deepgram.com/v1/listen?${params}`;
    console.log("[DeepgramStream] Connecting:", params.toString());

    this.ws = new WebSocket(url, {
      headers: { Authorization: `Token ${this.apiKey}` },
    });

    this.ws.on("open", () => {
      console.log("[DeepgramStream] Connected");
      this.keepAliveInterval = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: "KeepAlive" }));
        }
      }, 8000);
    });

    this.ws.on("message", (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "Results") {
          const alt = msg.channel?.alternatives?.[0];
          if (!alt) return;
          const text = alt.transcript ?? "";
          const confidence = alt.confidence ?? 0;
          const isFinal = msg.is_final === true;
          // Collect all unique speakers from words array
          const words = alt.words ?? [];
          const speakerSet = new Set(words.map((w: { speaker?: number }) => w.speaker).filter((s: number | undefined) => s !== undefined));
          const speaker = words[0]?.speaker ?? 0;
          if (isFinal && text.trim()) {
            console.log(`[DeepgramStream] Result: final=${isFinal} speaker=${speaker} speakers=[${[...speakerSet]}] words=${words.length} text="${text.slice(0, 40)}"`);
          }
          if (text.trim()) {
            this.onResult?.({ text, isFinal, speaker, confidence });
          }
        } else if (msg.type === "UtteranceEnd") {
          console.log("[DeepgramStream] Utterance end");
          this.onUtteranceEnd?.();
        }
      } catch (err) {
        console.error("[DeepgramStream] Parse error:", err);
      }
    });

    this.ws.on("error", (err) => {
      console.error("[DeepgramStream] Error:", err.message);
    });

    this.ws.on("close", (code, reason) => {
      console.log(`[DeepgramStream] Closed: ${code} ${reason}`);
      if (this.keepAliveInterval) { clearInterval(this.keepAliveInterval); this.keepAliveInterval = null; }
      this.ws = null;
      // Auto-reconnect if not intentionally stopped
      if (!this.stopped) {
        console.log("[DeepgramStream] Reconnecting in 1s...");
        this.reconnectTimer = setTimeout(() => this.connect(), 1000);
      }
    });
  }

  sendAudio(audioBuffer: Buffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(audioBuffer);
    }
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.keepAliveInterval) { clearInterval(this.keepAliveInterval); this.keepAliveInterval = null; }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "CloseStream" }));
      setTimeout(() => { this.ws?.close(); this.ws = null; }, 500);
    } else {
      this.ws = null;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
