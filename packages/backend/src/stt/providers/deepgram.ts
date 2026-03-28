/**
 * Deepgram STT Provider — REST API with speaker diarization.
 * Uses fetch directly (Deepgram SDK v5 changed API structure).
 */

export class DeepgramProvider {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.DEEPGRAM_API_KEY;
  }

  async transcribeBase64Wav(
    audioBase64: string,
    language?: string,
  ): Promise<{ text: string; speaker: number; latencyMs: number }> {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) throw new Error("Deepgram API key not configured");

    const audioBuffer = Buffer.from(audioBase64, "base64");

    const params = new URLSearchParams({
      model: "nova-2",
      smart_format: "true",
      diarize: "true",
    });
    if (language === "zh" || language === "en") {
      params.set("language", language);
    } else {
      // zh+en or auto: use multi-language mode
      params.set("language", "multi");
    }

    console.log("[Deepgram] Request params:", params.toString());

    const start = Date.now();
    const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "audio/wav",
      },
      body: audioBuffer,
    });
    const latencyMs = Date.now() - start;

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Deepgram API error ${res.status}: ${err}`);
    }

    const result = await res.json() as {
      results?: {
        channels?: {
          alternatives?: {
            transcript?: string;
            confidence?: number;
            words?: { speaker?: number }[];
          }[];
        }[];
      };
    };

    const alt = result?.results?.channels?.[0]?.alternatives?.[0];
    const text = alt?.transcript ?? "";
    const speaker = alt?.words?.[0]?.speaker ?? 0;
    const confidence = alt?.confidence ?? 0;

    if (confidence < 0.3 || !text.trim()) {
      console.log(`[Deepgram] Low confidence (${confidence.toFixed(3)}) or empty — dropping: "${text.slice(0, 40)}"`);
      return { text: "", speaker: 0, latencyMs };
    }

    console.log(`[Deepgram] Transcribed in ${latencyMs}ms (speaker ${speaker}, conf ${confidence.toFixed(3)}): "${text.slice(0, 80)}"`);
    return { text, speaker, latencyMs };
  }
}
