/**
 * WebSocket handler — real-time transport layer using Socket.IO.
 *
 * Wires the full pipeline:
 *   audio:chunk → TranscriptionEngine → SemanticAnalyzer → RecommendationEngine → VisualizationEngine
 *   text:submit → LanguageDetector → SemanticAnalyzer (bypass audio)
 *
 * Handles session lifecycle events and emits all ServerEvent types.
 */

import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer, Socket } from "socket.io";
import type { FastifyInstance } from "fastify";
import type {
  ClientEvent,
  ServerEvent,
  CoreMeaningCard,
  TopicMap,
  TranscriptSegment,
} from "@wdym/shared";
import { SessionManager } from "../session/manager.js";
import { BookmarkService } from "../bookmark/service.js";
import { SemanticAnalyzer, type SessionContext } from "../semantic/analyzer.js";
import { RecommendationEngine } from "../recommendation/engine.js";
import { VisualizationEngine } from "../visualization/engine.js";
import { LanguageDetector } from "../language/detector.js";
import { TranscriptionEngine } from "../stt/engine.js";
import { GroqWhisperProvider } from "../stt/providers/groq-whisper.js";
import { DeepgramProvider } from "../stt/providers/deepgram.js";
import { DeepgramStreamingProvider } from "../stt/providers/deepgram-streaming.js";
import type { LLMGateway } from "../llm/gateway.js";

export interface WsHandlerDeps {
  llmGateway: LLMGateway;
}

interface SocketSessionState {
  sessionId: string | null;
  userId: string;
  cards: CoreMeaningCard[];
  topicMap: TopicMap;
  transcripts: TranscriptSegment[];
  transcriptionEngine: TranscriptionEngine;
  languageDetector: LanguageDetector;
  /** Accumulated transcript text waiting to be finalized into a card */
  pendingText: string;
  /** Accumulated transcript segments for the pending text */
  pendingSegments: TranscriptSegment[];
  /** Timer for silence detection — fires after 5s of no new audio */
  silenceTimer: ReturnType<typeof setTimeout> | null;
  /** Timestamp of last received audio chunk */
  lastAudioTime: number;
  /** STT language preference: "auto" | "zh" | "en" */
  responseEnabled: boolean;
  sttLanguage: string;
  /** Deepgram streaming provider instance (one per session) */
  deepgramStream: DeepgramStreamingProvider | null;
  /** Whether we're using streaming mode (vs REST chunk mode) */
  useStreaming: boolean;
  /** Interim text from Deepgram streaming (not yet final) */
  interimText: string;
  /** Set of transcript texts that were marked/highlighted by user */
  markedTexts: Set<string>;
  /** Consolidation: version counter to discard stale results */
  consolidationVersion: number;
  /** Consolidation: locked cards from previous windows (won't be re-analyzed) */
  lockedCards: CoreMeaningCard[];
  /** Consolidation: transcript index where current window starts */
  windowStartIndex: number;
  /** Consolidation: how many times the current window has been analyzed */
  windowPassCount: number;
  /** Consolidation: is a consolidation currently in flight */
  consolidationInFlight: boolean;
  /** Flag: next card created should be highlighted (set by bookmark during pending) */
  markNextCard: boolean;
}

/**
 * Attach Socket.IO to a Fastify server and wire all event handlers.
 */
export function setupWebSocket(
  app: FastifyInstance,
  deps: WsHandlerDeps,
): SocketIOServer {
  const httpServer = app.server as HttpServer;
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
  });
  setupWebSocketHandlers(io, deps);
  return io;
}

/**
 * Wire event handlers on an existing Socket.IO server instance.
 */
export function setupWebSocketHandlers(
  io: SocketIOServer,
  deps: WsHandlerDeps,
): void {
  const sessionManager = new SessionManager();
  const bookmarkService = new BookmarkService();
  const semanticAnalyzer = new SemanticAnalyzer(deps.llmGateway);
  const recommendationEngine = new RecommendationEngine(deps.llmGateway);
  const visualizationEngine = new VisualizationEngine();

  io.on("connection", (socket: Socket) => {
    console.log("[WS] Client connected:", socket.id);
    const state: SocketSessionState = {
      sessionId: null,
      userId: socket.handshake.auth?.userId ?? "anonymous",
      cards: [],
      topicMap: { sessionId: "", topics: [], relations: [] },
      transcripts: [],
      transcriptionEngine: new TranscriptionEngine(),
      languageDetector: new LanguageDetector(),
      pendingText: "",
      pendingSegments: [],
      silenceTimer: null,
      lastAudioTime: 0,
      sttLanguage: "auto",
      responseEnabled: false,
      deepgramStream: null,
      useStreaming: !!process.env.DEEPGRAM_API_KEY,
      interimText: "",
      markedTexts: new Set(),
      consolidationVersion: 0,
      lockedCards: [],
      windowStartIndex: 0,
      windowPassCount: 0,
      consolidationInFlight: false,
      markNextCard: false,
    };

    // Wire transcription engine callbacks
    state.transcriptionEngine.onInterimResult = (segment) => {
      emitServerEvent(socket, { type: "transcript:interim", segment });
    };

    state.transcriptionEngine.onFinalResult = (segment) => {
      state.transcripts.push(segment);
      emitServerEvent(socket, { type: "transcript:final", segment });
      // Trigger semantic pipeline
      processFinalTranscript(
        socket, state, segment,
        semanticAnalyzer, recommendationEngine, visualizationEngine,
      );
    };

    state.transcriptionEngine.onProviderSwitch = (from, to) => {
      emitServerEvent(socket, {
        type: "stt:provider_switch",
        from: from.name,
        to: to.name,
      });
    };

    // ── Client event handlers ──

    socket.on("session:start", (data: Extract<ClientEvent, { type: "session:start" }>) => {
      try {
        console.log("[WS] session:start received", data?.config?.mode);
        const session = sessionManager.create({
          userId: state.userId,
          mode: data.config.mode === "online" ? "online" : "offline",
        });
        state.sessionId = session.id;
        state.topicMap = { sessionId: session.id, topics: [], relations: [] };
        state.cards = [];
        state.transcripts = [];

        // Read language preference from client config
        const lang = (data.config as unknown as Record<string, unknown>)?.language;
        state.sttLanguage = (lang === "zh+en" || lang === "zh" || lang === "en" || lang === "auto") ? (lang as string) : "zh+en";
        console.log("[WS] STT language preference:", state.sttLanguage);

        const respEnabled = (data.config as unknown as Record<string, unknown>)?.responseEnabled;
        state.responseEnabled = respEnabled === true;
        console.log("[WS] Response enabled:", state.responseEnabled);

        state.transcriptionEngine.startTranscription(session.id, "en");

        // Start Deepgram streaming if available
        if (state.useStreaming && process.env.DEEPGRAM_API_KEY) {
          const sttLang = (state.sttLanguage === "zh" || state.sttLanguage === "en") ? state.sttLanguage : undefined;
          state.deepgramStream = new DeepgramStreamingProvider();
          state.deepgramStream.start(
            sttLang,
            // onResult: interim or final transcription
            (result) => {
              handleStreamingResult(socket, state, result, semanticAnalyzer, recommendationEngine, visualizationEngine);
            },
            // onUtteranceEnd: Deepgram detected end of utterance
            () => {
              handleUtteranceEnd(socket, state, semanticAnalyzer, recommendationEngine, visualizationEngine);
            },
          );
          console.log("[WS] Deepgram streaming started");
        }

        emitServerEvent(socket, { type: "session:state", state: "active" });
      } catch (err) {
        emitError(socket, "session", String(err), true);
      }
    });

    socket.on("session:pause", () => {
      try {
        if (!state.sessionId) throw new Error("No active session");
        sessionManager.pause(state.sessionId);
        emitServerEvent(socket, { type: "session:state", state: "paused" });
      } catch (err) {
        emitError(socket, "session", String(err), true);
      }
    });

    socket.on("session:resume", () => {
      try {
        if (!state.sessionId) throw new Error("No active session");
        sessionManager.resume(state.sessionId);
        emitServerEvent(socket, { type: "session:state", state: "active" });
      } catch (err) {
        emitError(socket, "session", String(err), true);
      }
    });

    socket.on("session:end", async () => {
      try {
        if (!state.sessionId) throw new Error("No active session");
        console.log("[WS] session:end — emitting processing:progress");
        emitServerEvent(socket, { type: "processing:progress", stage: "Wrapping up..." });
        // Cancel silence timer
        if (state.silenceTimer) {
          clearTimeout(state.silenceTimer);
          state.silenceTimer = null;
        }
        // Stop Deepgram streaming — wait for final results to arrive
        if (state.deepgramStream) {
          state.deepgramStream.stop();
          state.deepgramStream = null;
          // Give Deepgram 600ms to send final results before we flush
          await new Promise((r) => setTimeout(r, 600));
        }
        // Flush any pending text into a card before ending
        emitServerEvent(socket, { type: "processing:progress", stage: "Finalizing..." });
        if (state.pendingText.trim()) {
          await finalizePendingText(
            socket, state,
            semanticAnalyzer, recommendationEngine, visualizationEngine,
          );
        }

        // Final consolidation: full transcript review with marks
        if (state.transcripts.length >= 2) {
          emitServerEvent(socket, { type: "processing:progress", stage: "Putting it together..." });

          // Group transcripts into sequential speaker runs (preserves time order)
          const runs: { speakerId: string; segments: TranscriptSegment[] }[] = [];
          for (const t of state.transcripts) {
            const last = runs[runs.length - 1];
            if (last && last.speakerId === t.speakerId) {
              last.segments.push(t);
            } else {
              runs.push({ speakerId: t.speakerId, segments: [t] });
            }
          }

          const allFinalCards: CoreMeaningCard[] = [];
          let orderIdx = 0;

          for (const run of runs) {
            const runText = run.segments
              .map((t) => {
                const isMarked = state.markedTexts.has(t.text);
                return `${isMarked ? "⭐IMPORTANT " : ""}${t.text}`;
              })
              .join("\n");

            // Track if this run contains any marked text
            const runHasMarked = run.segments.some((t) => state.markedTexts.has(t.text));

            if (!runText.trim()) continue;

            const langResult = state.languageDetector.detectFromText(runText);
            const runCards = await semanticAnalyzer.analyzeMulti(runText, langResult.primaryLanguage);

            for (const card of runCards) {
              card.sessionId = state.sessionId!;
              card.speakerId = run.speakerId;
              // Use createdAt to preserve ordering
              card.createdAt = new Date(Date.now() + orderIdx++);
              // If this run had marked text, highlight the first card from it
              if (runHasMarked && !allFinalCards.some(c => c.isHighlighted)) {
                card.isHighlighted = true;
                console.log("[WS] Highlighted card from marked run:", card.content.slice(0, 50));
              }
              allFinalCards.push(card);
            }
          }

          // Dedup across all speakers — only merge if same category AND high word overlap
          const seenItems: { content: string; category: string }[] = [];
          const dedupedFinal = allFinalCards.filter((card) => {
            const cardLower = card.content.toLowerCase();
            const cardWords = cardLower.split(/\s+/).filter(w => w.length > 2);
            for (const seen of seenItems) {
              if (seen.category !== card.category) continue; // different intent = keep both
              const seenWords = seen.content.split(/\s+/).filter(w => w.length > 2);
              if (seenWords.length === 0) continue;
              const overlap = cardWords.filter(w => seenWords.includes(w)).length;
              const ratio = overlap / Math.min(cardWords.length, seenWords.length);
              if (ratio > 0.6) return false;
            }
            seenItems.push({ content: cardLower, category: card.category });
            return true;
          });

          // Inherit highlights — fallback for cases where run-level marking didn't catch it
          const hadHighlight = state.cards.some(c => c.isHighlighted);
          const alreadyHighlighted = dedupedFinal.some(c => c.isHighlighted);
          if (hadHighlight && !alreadyHighlighted && dedupedFinal.length > 0) {
            const highlightedContents = state.cards.filter(c => c.isHighlighted).map(c => c.content.toLowerCase());
            let bestIdx = 0;
            let bestScore = -1;
            for (let i = 0; i < dedupedFinal.length; i++) {
              const cardWords = dedupedFinal[i].content.toLowerCase().split(/\s+/);
              let score = 0;
              for (const hc of highlightedContents) {
                score += cardWords.filter(w => w.length > 2 && hc.includes(w)).length;
              }
              for (const mt of state.markedTexts) {
                score += cardWords.filter(w => w.length > 2 && mt.toLowerCase().includes(w)).length;
              }
              if (score > bestScore) { bestScore = score; bestIdx = i; }
            }
            dedupedFinal[bestIdx].isHighlighted = true;
          }

          state.cards = dedupedFinal;
          console.log(`[WS] Final consolidation complete — ${dedupedFinal.length} cards from ${runs.length} speaker runs`);
          for (const c of dedupedFinal) {
            console.log(`[WS]   card: "${c.content.slice(0, 30)}" speaker=${c.speakerId}`);
          }
          emitServerEvent(socket, { type: "cards:consolidated", cards: dedupedFinal });
        }

        // Invalidate any in-flight window consolidations
        state.consolidationVersion++;
        sessionManager.end(state.sessionId);
        state.transcriptionEngine.stopTranscription();
        emitServerEvent(socket, { type: "processing:progress", stage: "Almost there..." });

        // Generate session summary
        if (state.cards.length > 0) {
          try {
            const cardsSummaryInput = state.cards.map((c) => `[${c.category}] ${c.content}`).join("\n");
            const hasChinese = state.cards.some((c) => /[\u4e00-\u9fff]/.test(c.content));
            const langHint = hasChinese ? "Respond in Chinese." : "Respond in English.";
            const summaryResponse = await deps.llmGateway.complete({
              taskType: "semantic_analysis",
              messages: [
                { role: "system", content: `You summarize conversations in 2-3 concise sentences. ${langHint} Be direct and factual. Do not use phrases like "The conversation covered..." — just state the key points.` },
                { role: "user", content: `Summarize this conversation:\n${cardsSummaryInput}` },
              ],
              maxTokens: 200,
              temperature: 0.3,
              stream: false,
              timeoutMs: 5000,
            });
            emitServerEvent(socket, { type: "session:summary", summary: summaryResponse.content.trim() });
          } catch (err) {
            console.error("[WS] Summary generation failed:", err);
          }
        }

        emitServerEvent(socket, { type: "session:state", state: "ended" });
        state.sessionId = null;
      } catch (err) {
        emitError(socket, "session", String(err), true);
      }
    });

    socket.on("audio:chunk", (data: { type: string; audioBase64?: string; format?: string; sampleRate?: number; data?: unknown }) => {
      try {
        if (!state.sessionId) throw new Error("No active session");
        const session = sessionManager.get(state.sessionId);
        if (session?.status !== "active") return;

        // Streaming mode: forward raw PCM to Deepgram stream
        if (state.useStreaming && state.deepgramStream?.isConnected && data.audioBase64) {
          const buf = Buffer.from(data.audioBase64, "base64");
          // Strip WAV header (44 bytes) if present, send raw PCM
          const pcm = (buf.length > 44 && buf.toString("ascii", 0, 4) === "RIFF") ? buf.subarray(44) : buf;
          state.deepgramStream.sendAudio(pcm);
          return;
        }

        // Fallback: REST chunk mode (base64 WAV)
        if (data.audioBase64 && typeof data.audioBase64 === "string") {
          processAudioChunk(
            socket, state, data.audioBase64,
            semanticAnalyzer, recommendationEngine, visualizationEngine,
          );
          return;
        }

        // Legacy path: raw AudioChunk via TranscriptionEngine
        if (data.data) {
          state.transcriptionEngine.feedAudio(data.data as any);
        }
      } catch (err) {
        emitError(socket, "stt", String(err), true);
      }
    });

    // Handle mid-session settings updates
    socket.on("settings:update", (data: { type: string; settings?: Record<string, unknown> }) => {
      if (data.settings?.responseEnabled !== undefined) {
        state.responseEnabled = data.settings.responseEnabled === true;
        console.log("[WS] Settings updated — responseEnabled:", state.responseEnabled);
      }
      if (data.settings?.sttLanguage !== undefined) {
        const lang = data.settings.sttLanguage as string;
        if ((lang === "zh+en" || lang === "zh" || lang === "en" || lang === "auto") && lang !== state.sttLanguage) {
          state.sttLanguage = lang;
          console.log("[WS] Settings updated — sttLanguage:", state.sttLanguage);
          // Restart Deepgram stream with new language
          if (state.deepgramStream) {
            state.deepgramStream.stop();
            const sttLang = (lang === "zh" || lang === "en") ? lang : undefined;
            state.deepgramStream = new DeepgramStreamingProvider();
            state.deepgramStream.start(
              sttLang,
              (result) => handleStreamingResult(socket, state, result, semanticAnalyzer, recommendationEngine, visualizationEngine),
              () => handleUtteranceEnd(socket, state, semanticAnalyzer, recommendationEngine, visualizationEngine),
            );
            console.log("[WS] Deepgram stream restarted with language:", lang);
          }
        }
      }
    });

    socket.on("text:submit", (data: Extract<ClientEvent, { type: "text:submit" }>) => {
      try {
        console.log("[WS] text:submit received, sessionId:", state.sessionId, "text length:", data?.text?.length);
        if (!state.sessionId) throw new Error("No active session");
        processTextSubmit(
          socket, state, data.text,
          semanticAnalyzer, recommendationEngine, visualizationEngine,
          deps.llmGateway,
        );
      } catch (err) {
        emitError(socket, "text", String(err), true);
      }
    });

    socket.on("speaker:rename", (data: Extract<ClientEvent, { type: "speaker:rename" }>) => {
      // Speaker rename is handled client-side for now
      socket.emit("speaker:renamed", {
        speakerId: data.speakerId,
        name: data.name,
      });
    });

    // On-demand recommendation generation (e.g. user toggles response on after analysis)
    socket.on("recommendations:request", async () => {
      try {
        if (!state.sessionId || state.transcripts.length === 0) return;
        // Build a synthetic card from all raw transcript text
        const fullText = state.transcripts.map((t) => t.text).join(" ");
        const syntheticCard = {
          id: `rec_req_${Date.now()}`,
          sessionId: state.sessionId,
          category: "fact" as const,
          content: fullText.slice(0, 200),
          sourceSegmentIds: [] as string[],
          linkedCardIds: [] as string[],
          linkType: null,
          topicId: "",
          visualizationFormat: "concise_text" as const,
          isHighlighted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const recs = await recommendationEngine.generateRecommendations(syntheticCard, {
          sessionId: state.sessionId,
          existingCards: state.cards,
          topicMap: state.topicMap,
        });
        if (recs.length > 0) {
          emitServerEvent(socket, { type: "recommendation:new", recommendations: recs });
        }
      } catch (err) {
        console.error("[WS] recommendations:request error:", err);
      }
    });

    socket.on("bookmark:create", async (data: Extract<ClientEvent, { type: "bookmark:create" }>) => {
      try {
        if (!state.sessionId) throw new Error("No active session");
        bookmarkService.create({
          sessionId: state.sessionId,
          userId: state.userId,
          timestamp: data.timestamp,
          note: data.note,
        });
        // Track the most recent transcript text as marked
        if (state.transcripts.length > 0) {
          const lastTranscript = state.transcripts[state.transcripts.length - 1];
          state.markedTexts.add(lastTranscript.text);
          console.log("[WS] Marked transcript text:", lastTranscript.text.slice(0, 50));
        }
        // If there's pending text, force-finalize it into a card first so the mark lands on it
        if (state.pendingText.trim()) {
          state.markedTexts.add(state.pendingText.trim());
          state.markNextCard = true;
          if (state.silenceTimer) { clearTimeout(state.silenceTimer); state.silenceTimer = null; }
          console.log("[WS] Mark during pending — force finalizing");
          await finalizePendingText(socket, state, semanticAnalyzer, recommendationEngine, visualizationEngine);
          // markNextCard flag handled in processFinalTranscript
        } else if (state.interimText.trim()) {
          // Deepgram streaming path — interim text not yet finalized
          state.markedTexts.add(state.interimText.trim());
          state.markNextCard = true;
          console.log("[WS] Mark during interim text:", state.interimText.slice(0, 50));
        } else {
          // No pending text — highlight the most recent existing card
          if (state.cards.length > 0) {
            state.cards[state.cards.length - 1].isHighlighted = true;
            console.log("[WS] Highlighted card:", state.cards[state.cards.length - 1].content.slice(0, 50));
            emitServerEvent(socket, { type: "card:updated", card: state.cards[state.cards.length - 1] });
          }
        }
      } catch (err) {
        emitError(socket, "bookmark", String(err), true);
      }
    });

    socket.on("disconnect", () => {
      if (state.silenceTimer) {
        clearTimeout(state.silenceTimer);
        state.silenceTimer = null;
      }
      if (state.deepgramStream) {
        state.deepgramStream.stop();
        state.deepgramStream = null;
      }
      if (state.sessionId) {
        try {
          state.transcriptionEngine.stopTranscription();
        } catch {
          // ignore cleanup errors
        }
      }
    });
  });
}

// ── Pipeline helpers ──

/** Shared Groq Whisper provider instance for audio chunk transcription */
const groqWhisper = new GroqWhisperProvider();
const deepgram = new DeepgramProvider();

/** Silence duration (ms) before finalizing accumulated text into a card */
const SILENCE_THRESHOLD_MS = 3000;
const PUNCTUATION_MIN_CHARS = 20;
const MAX_PENDING_CHARS = 120;

/** Check if pending text should be finalized based on punctuation or length */
function checkSegmentationTriggers(text: string): string | null {
  const len = text.length;

  // Rule 3: Force finalize if text is too long
  if (len > MAX_PENDING_CHARS) return "max_length";

  // Rule 2: Finalize on sentence-ending punctuation when text is long enough
  if (len > PUNCTUATION_MIN_CHARS) {
    // Check if text ends with sentence-ending punctuation (allowing trailing spaces)
    const trimmed = text.trimEnd();
    if (/[。！？.!?]$/.test(trimmed)) return "punctuation";
  }

  return null;
}

async function processAudioChunk(
  socket: Socket,
  state: SocketSessionState,
  audioBase64: string,
  analyzer: SemanticAnalyzer,
  recommender: RecommendationEngine,
  visualizer: VisualizationEngine,
): Promise<void> {
  try {
    console.log(`[WS] processAudioChunk: ${Math.round(audioBase64.length / 1024)}KB base64`);

    const sttLang = (state.sttLanguage === "zh" || state.sttLanguage === "en") ? state.sttLanguage : undefined;
    let text: string;
    let latencyMs: number;
    let speakerIdx = 0;

    // Try Deepgram first (has diarization), fall back to Groq Whisper
    if (process.env.DEEPGRAM_API_KEY) {
      const dg = await deepgram.transcribeBase64Wav(audioBase64, sttLang);
      text = dg.text;
      latencyMs = dg.latencyMs;
      speakerIdx = dg.speaker;
    } else {
      console.log("[WS] No DEEPGRAM_API_KEY, falling back to Groq Whisper");
      const gw = await groqWhisper.transcribeBase64Wav(audioBase64, sttLang);
      text = gw.text;
      latencyMs = gw.latencyMs;
    }

    if (!text || text.trim().length === 0) {
      console.log("[WS] Empty transcription — silence detected");
      // Don't reset the silence timer — let it fire if no more audio comes
      return;
    }

    console.log(`[WS] Groq transcription (${latencyMs}ms): "${text.slice(0, 80)}"`);

    const langResult = state.languageDetector.detectFromText(text);
    console.log(`[WS] Detected language: ${langResult.primaryLanguage}`);

    const segment: TranscriptSegment = {
      id: `groq_audio_${Date.now()}`,
      sessionId: state.sessionId!,
      text,
      languageCode: langResult.primaryLanguage,
      speakerId: `speaker_${speakerIdx}`,
      startTime: Date.now() - latencyMs,
      endTime: Date.now(),
      isFinal: true,
      confidence: 0.95,
      provider: "groq_whisper",
      createdAt: new Date(),
    };

    state.transcripts.push(segment);
    emitServerEvent(socket, { type: "transcript:final", segment });

    // Accumulate text instead of immediately creating a card
    state.pendingText += (state.pendingText ? " " : "") + text.trim();
    state.pendingSegments.push(segment);
    state.lastAudioTime = Date.now();

    // Send preview of accumulated text to frontend
    emitServerEvent(socket, { type: "pending:preview", text: state.pendingText });

    // Check for immediate finalization triggers
    const shouldFinalize = checkSegmentationTriggers(state.pendingText);
    if (shouldFinalize) {
      if (state.silenceTimer) { clearTimeout(state.silenceTimer); state.silenceTimer = null; }
      console.log(`[WS] Segmentation trigger: ${shouldFinalize}`);
      await finalizePendingText(socket, state, analyzer, recommender, visualizer);
      return;
    }

    // Reset silence timer — will fire after 3s of no new transcription
    if (state.silenceTimer) {
      clearTimeout(state.silenceTimer);
    }
    state.silenceTimer = setTimeout(() => {
      finalizePendingText(socket, state, analyzer, recommender, visualizer);
    }, SILENCE_THRESHOLD_MS);

    console.log(`[WS] Accumulated pending text (${state.pendingText.length} chars), waiting for silence...`);
  } catch (err) {
    console.error("[WS] Audio chunk processing error:", err);
    emitError(socket, "stt", String(err), true);
  }
}

/**
 * Finalize accumulated pending text into a card.
 * Called when silence is detected (5s no audio) or session ends.
 */
async function finalizePendingText(
  socket: Socket,
  state: SocketSessionState,
  analyzer: SemanticAnalyzer,
  recommender: RecommendationEngine,
  visualizer: VisualizationEngine,
): Promise<void> {
  if (!state.pendingText.trim()) return;

  const text = state.pendingText;
  const segments = [...state.pendingSegments];

  // Clear pending state
  state.pendingText = "";
  state.pendingSegments = [];
  state.silenceTimer = null;

  console.log(`[WS] Silence detected — finalizing ${text.length} chars into card`);

  // Create a merged segment representing the full utterance
  // Use the most common speaker from pending segments
  const speakerCounts = new Map<string, number>();
  for (const s of segments) {
    speakerCounts.set(s.speakerId, (speakerCounts.get(s.speakerId) ?? 0) + 1);
  }
  let dominantSpeaker = segments[0]?.speakerId ?? "user";
  let maxCount = 0;
  for (const [spk, cnt] of speakerCounts) {
    if (cnt > maxCount) { maxCount = cnt; dominantSpeaker = spk; }
  }

  const mergedSegment: TranscriptSegment = {
    id: `merged_${Date.now()}`,
    sessionId: state.sessionId!,
    text,
    languageCode: segments[0]?.languageCode ?? "en",
    speakerId: dominantSpeaker,
    startTime: segments[0]?.startTime ?? Date.now(),
    endTime: segments[segments.length - 1]?.endTime ?? Date.now(),
    isFinal: true,
    confidence: 0.95,
    provider: "groq_whisper",
    createdAt: new Date(),
  };

  await processFinalTranscript(
    socket, state, mergedSegment,
    analyzer, recommender, visualizer,
  );
}

async function processFinalTranscript(
  socket: Socket,
  state: SocketSessionState,
  segment: TranscriptSegment,
  analyzer: SemanticAnalyzer,
  recommender: RecommendationEngine,
  visualizer: VisualizationEngine,
): Promise<void> {
  try {
    console.log("[WS] processFinalTranscript starting for segment:", segment.text.slice(0, 50));
    const context: SessionContext = {
      sessionId: state.sessionId!,
      recentTranscripts: state.transcripts.slice(-10),
      existingCards: state.cards,
      topicMap: state.topicMap,
    };

    // Semantic analysis → card
    console.log("[WS] Calling analyzer.analyze()...");
    const card = await analyzer.analyze(segment, context);
    console.log("[WS] Card created:", card.content.slice(0, 50), "speaker:", segment.speakerId);
    const format = visualizer.selectFormat(card);
    card.visualizationFormat = format;
    card.speakerId = segment.speakerId;
    // Check if this card should be auto-highlighted (mark during pending text)
    if (state.markNextCard) {
      card.isHighlighted = true;
      state.markNextCard = false;
      console.log("[WS] Auto-highlighted card from pending mark:", card.content.slice(0, 50));
    }
    state.cards.push(card);
    emitServerEvent(socket, { type: "card:created", card });

    // Duplicate detection disabled for now — it causes cards to mutate
    // unexpectedly in recap view. Will revisit with better UX.
    // const mergeDecision = await analyzer.detectDuplicate(card, state.cards.slice(0, -1));

    // Topic map update
    state.topicMap = await analyzer.updateTopicMap(card, state.topicMap);
    emitServerEvent(socket, { type: "topic:updated", topicMap: state.topicMap });

    // Recommendations (skip if disabled to save tokens)
    if (state.responseEnabled) {
      const recommendations = await recommender.generateRecommendations(card, {
        sessionId: state.sessionId!,
        existingCards: state.cards,
        topicMap: state.topicMap,
      });
      if (recommendations.length > 0) {
        emitServerEvent(socket, { type: "recommendation:new", recommendations });
      }
    } else {
      console.log("[WS] Recommendations disabled — skipping LLM call");
    }

    // Trigger async consolidation pass (non-blocking, delayed to avoid rate limit)
    if (state.cards.length >= 2) {
      setTimeout(() => {
        runConsolidation(socket, state, analyzer).catch((err) => {
          console.error("[WS] Consolidation error:", err);
        });
      }, 1000);
    }
  } catch (err) {
    console.error("[WS] Pipeline error:", err);
    emitError(socket, "pipeline", String(err), true);
  }
}

/** Max times a window gets re-analyzed before locking */
const MAX_WINDOW_PASSES = 3;

async function runConsolidation(
  socket: Socket,
  state: SocketSessionState,
  analyzer: SemanticAnalyzer,
): Promise<void> {
  // Skip if already in flight
  if (state.consolidationInFlight) {
    console.log("[WS] Consolidation already in flight — skipping");
    return;
  }

  const totalTranscripts = state.transcripts.length;
  const windowTranscripts = state.transcripts.slice(state.windowStartIndex);

  // Nothing new in window
  if (windowTranscripts.length === 0) return;

  // Check if window has been analyzed too many times without new transcripts
  const hasNewTranscripts = totalTranscripts > state.windowStartIndex + state.windowPassCount;
  if (!hasNewTranscripts) {
    state.windowPassCount++;
  } else {
    state.windowPassCount = 0;
  }

  if (state.windowPassCount >= MAX_WINDOW_PASSES) {
    // Lock current window cards and slide window forward
    console.log(`[WS] Window analyzed ${MAX_WINDOW_PASSES}x — locking ${state.cards.length - state.lockedCards.length} window cards`);
    state.lockedCards = [...state.cards]; // all current cards become locked
    state.windowStartIndex = totalTranscripts; // window starts at next new transcript
    state.windowPassCount = 0;
    return;
  }

  state.consolidationInFlight = true;
  const version = ++state.consolidationVersion;

  // Group window transcripts into sequential speaker runs (preserves time order)
  const runs: { speakerId: string; segments: TranscriptSegment[] }[] = [];
  for (const t of windowTranscripts) {
    const last = runs[runs.length - 1];
    if (last && last.speakerId === t.speakerId) {
      last.segments.push(t);
    } else {
      runs.push({ speakerId: t.speakerId, segments: [t] });
    }
  }

  const langResult = state.languageDetector.detectFromText(
    windowTranscripts.map(t => t.text).join(" ")
  );

  console.log(`[WS] Consolidation v${version} starting — window [${state.windowStartIndex}..${totalTranscripts}], ${runs.length} speaker runs, ${state.lockedCards.length} locked cards`);

  try {
    const allNewCards: CoreMeaningCard[] = [];
    let orderIdx = 0;

    // Consolidate each sequential speaker run separately
    for (const run of runs) {
      const runText = run.segments
        .map((t) => {
          const isMarked = state.markedTexts.has(t.text);
          return `${isMarked ? "⭐IMPORTANT " : ""}${t.text}`;
        })
        .join("\n");

      if (!runText.trim()) continue;

      const runCards = await analyzer.analyzeMulti(runText, langResult.primaryLanguage);
      for (const card of runCards) {
        card.speakerId = run.speakerId;
        card.createdAt = new Date(Date.now() + orderIdx++);
        allNewCards.push(card);
      }
    }

    const windowCards = allNewCards;

    // Check if this consolidation is still current
    if (version !== state.consolidationVersion) {
      console.log(`[WS] Consolidation v${version} stale (current: v${state.consolidationVersion}) — discarding`);
      return;
    }

    // Deduplicate — only merge if same category AND high word overlap
    const seenItems: { content: string; category: string }[] = [];
    for (const lc of state.lockedCards) {
      seenItems.push({ content: lc.content.toLowerCase(), category: lc.category });
    }
    const dedupedCards = windowCards.filter((card) => {
      const cardLower = card.content.toLowerCase();
      const cardWords = cardLower.split(/\s+/).filter(w => w.length > 2);
      for (const seen of seenItems) {
        if (seen.category !== card.category) continue; // different intent = keep both
        const seenWords = seen.content.split(/\s+/).filter(w => w.length > 2);
        if (seenWords.length === 0) continue;
        const overlap = cardWords.filter(w => seenWords.includes(w)).length;
        const ratio = overlap / Math.min(cardWords.length, seenWords.length);
        if (ratio > 0.6) return false; // same category + >60% word overlap = duplicate
      }
      seenItems.push({ content: cardLower, category: card.category });
      return true;
    });

    for (const card of dedupedCards) {
      card.sessionId = state.sessionId!;
      // Match card content to window transcripts to inherit speaker
      const cardWords = card.content.toLowerCase().split(/\s+/).filter(w => w.length > 1);
      let bestSpeaker = "speaker_0";
      let bestScore = -1;
      for (const t of windowTranscripts) {
        const tWords = t.text.toLowerCase().split(/\s+/).filter(w => w.length > 1);
        const overlap = cardWords.filter(w => tWords.some(tw => tw.includes(w) || w.includes(tw))).length;
        if (overlap > bestScore) { bestScore = overlap; bestSpeaker = t.speakerId; }
      }
      card.speakerId = bestSpeaker;
    }

    // Inherit highlight: if any old card was highlighted, mark the best-matching new card
    const hadHighlight = state.cards.some(c => c.isHighlighted);
    if (hadHighlight && dedupedCards.length > 0) {
      // Collect all highlighted card contents for matching
      const highlightedContents = state.cards.filter(c => c.isHighlighted).map(c => c.content.toLowerCase());
      let bestIdx = 0;
      let bestScore = -1;
      for (let i = 0; i < dedupedCards.length; i++) {
        const cardWords = dedupedCards[i].content.toLowerCase().split(/\s+/);
        let score = 0;
        for (const hc of highlightedContents) {
          score += cardWords.filter(w => w.length > 2 && hc.includes(w)).length;
        }
        // Also check against marked transcript texts
        for (const mt of state.markedTexts) {
          score += cardWords.filter(w => w.length > 2 && mt.toLowerCase().includes(w)).length;
        }
        if (score > bestScore) { bestScore = score; bestIdx = i; }
      }
      dedupedCards[bestIdx].isHighlighted = true;
    }

    const allCards = [...state.lockedCards, ...dedupedCards];

    console.log(`[WS] Consolidation v${version} complete — ${dedupedCards.length} window cards + ${state.lockedCards.length} locked = ${allCards.length} total (before dedup: ${windowCards.length})`);

    state.cards = allCards;
    emitServerEvent(socket, { type: "cards:consolidated", cards: allCards });
  } catch (err) {
    console.error(`[WS] Consolidation v${version} failed:`, err);
  } finally {
    state.consolidationInFlight = false;
  }
}

// ── Deepgram Streaming handlers ──

import type { DeepgramStreamResult } from "../stt/providers/deepgram-streaming.js";

function handleStreamingResult(
  socket: Socket,
  state: SocketSessionState,
  result: DeepgramStreamResult,
  analyzer: SemanticAnalyzer,
  recommender: RecommendationEngine,
  visualizer: VisualizationEngine,
): void {
  if (result.isFinal) {
    const newSpeakerId = `speaker_${result.speaker}`;

    // Speaker change detection: if pending text belongs to a different speaker, finalize it first
    if (state.pendingText.trim() && state.pendingSegments.length > 0) {
      const prevSpeaker = state.pendingSegments[state.pendingSegments.length - 1].speakerId;
      if (prevSpeaker !== newSpeakerId) {
        console.log(`[WS] Speaker change: ${prevSpeaker} → ${newSpeakerId} — finalizing pending`);
        if (state.silenceTimer) { clearTimeout(state.silenceTimer); state.silenceTimer = null; }
        finalizePendingText(socket, state, analyzer, recommender, visualizer);
      }
    }

    // Final result — accumulate into pendingText
    state.pendingText += (state.pendingText ? " " : "") + result.text.trim();
    state.interimText = "";

    const langResult = state.languageDetector.detectFromText(result.text);
    const segment: TranscriptSegment = {
      id: `dg_stream_${Date.now()}`,
      sessionId: state.sessionId!,
      text: result.text,
      languageCode: langResult.primaryLanguage,
      speakerId: newSpeakerId,
      startTime: Date.now(),
      endTime: Date.now(),
      isFinal: true,
      confidence: result.confidence,
      provider: "deepgram_stream",
      createdAt: new Date(),
    };
    state.transcripts.push(segment);
    state.pendingSegments.push(segment);
    emitServerEvent(socket, { type: "transcript:final", segment });

    // Show accumulated text as preview
    emitServerEvent(socket, { type: "pending:preview", text: state.pendingText });

    // Check segmentation triggers
    const shouldFinalize = checkSegmentationTriggers(state.pendingText);
    if (shouldFinalize) {
      if (state.silenceTimer) { clearTimeout(state.silenceTimer); state.silenceTimer = null; }
      console.log(`[WS] Stream segmentation trigger: ${shouldFinalize}`);
      finalizePendingText(socket, state, analyzer, recommender, visualizer);
      return;
    }

    // Reset silence timer (Deepgram's utterance_end will also trigger finalize)
    if (state.silenceTimer) clearTimeout(state.silenceTimer);
    state.silenceTimer = setTimeout(() => {
      finalizePendingText(socket, state, analyzer, recommender, visualizer);
    }, SILENCE_THRESHOLD_MS);

    console.log(`[WS] Stream final: "${result.text.slice(0, 60)}" speaker=${result.speaker} (pending: ${state.pendingText.length} chars)`);
  } else {
    // Interim result — show as preview but don't accumulate
    state.interimText = result.text;
    const preview = state.pendingText + (state.pendingText ? " " : "") + result.text;
    emitServerEvent(socket, { type: "pending:preview", text: preview });
  }
}

function handleUtteranceEnd(
  socket: Socket,
  state: SocketSessionState,
  analyzer: SemanticAnalyzer,
  recommender: RecommendationEngine,
  visualizer: VisualizationEngine,
): void {
  // Deepgram detected end of utterance — finalize pending text
  if (state.pendingText.trim()) {
    if (state.silenceTimer) { clearTimeout(state.silenceTimer); state.silenceTimer = null; }
    console.log(`[WS] Utterance end — finalizing ${state.pendingText.length} chars`);
    finalizePendingText(socket, state, analyzer, recommender, visualizer);
  }
}

async function processTextSubmit(
  socket: Socket,
  state: SocketSessionState,
  text: string,
  analyzer: SemanticAnalyzer,
  recommender: RecommendationEngine,
  visualizer: VisualizationEngine,
  llmGateway: LLMGateway,
): Promise<void> {
  try {
    console.log("[WS] processTextSubmit starting, text:", text.slice(0, 50));
    // Detect language from text
    const langResult = state.languageDetector.detectFromText(text);
    console.log("[WS] Language detected:", langResult.primaryLanguage);

    // Create a synthetic transcript segment
    const segment: TranscriptSegment = {
      id: `text_${Date.now()}`,
      sessionId: state.sessionId!,
      text,
      languageCode: langResult.primaryLanguage,
      speakerId: "user",
      startTime: Date.now(),
      endTime: Date.now(),
      isFinal: true,
      confidence: 1.0,
      provider: "text_input",
      createdAt: new Date(),
    };

    state.transcripts.push(segment);
    emitServerEvent(socket, { type: "transcript:final", segment });

    // Use multi-card analysis for text mode (LLM decides how many cards)
    console.log("[WS] Running multi-card analysis for text mode");
    const cards = await analyzer.analyzeMulti(text, langResult.primaryLanguage);
    console.log(`[WS] Multi-analysis returned ${cards.length} cards`);

    for (const card of cards) {
      card.sessionId = state.sessionId!;
      card.sourceSegmentIds = [segment.id];
      state.cards.push(card);
      emitServerEvent(socket, { type: "card:created", card });
    }

    // Generate recommendations from all raw input if enabled
    if (state.responseEnabled && cards.length > 0) {
      const fullText = state.transcripts.map((t) => t.text).join(" ");
      const syntheticCard = {
        id: `rec_text_${Date.now()}`,
        sessionId: state.sessionId!,
        category: "fact" as const,
        content: fullText.slice(0, 200),
        sourceSegmentIds: [] as string[],
        linkedCardIds: [] as string[],
        linkType: null,
        topicId: "",
        visualizationFormat: "concise_text" as const,
        isHighlighted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const recs = await recommender.generateRecommendations(syntheticCard, {
        sessionId: state.sessionId!,
        existingCards: state.cards,
        topicMap: state.topicMap,
      });
      if (recs.length > 0) {
        emitServerEvent(socket, { type: "recommendation:new", recommendations: recs });
      }
    }

    // Generate summary for text mode results
    if (state.cards.length > 0) {
      try {
        const cardsSummaryInput = state.cards.map((c) => `[${c.category}] ${c.content}`).join("\n");
        const hasChinese = state.cards.some((c) => /[\u4e00-\u9fff]/.test(c.content));
        const langHint = hasChinese ? "Respond in Chinese." : "Respond in English.";
        const summaryResponse = await llmGateway.complete({
          taskType: "semantic_analysis",
          messages: [
            { role: "system", content: `You summarize text analysis results in 2-3 concise sentences. ${langHint} Be direct and factual. Do not use phrases like "The text covered..." — just state the key points.` },
            { role: "user", content: `Summarize these analysis results:\n${cardsSummaryInput}` },
          ],
          maxTokens: 200,
          temperature: 0.3,
          stream: false,
          timeoutMs: 5000,
        });
        emitServerEvent(socket, { type: "session:summary", summary: summaryResponse.content.trim() });
      } catch (err) {
        console.error("[WS] Text summary generation failed:", err);
      }
    }
  } catch (err) {
    console.error("[WS] Text pipeline error:", err);
    emitError(socket, "text_pipeline", String(err), true);
  }
}

// ── Emit helpers ──

function emitServerEvent(socket: Socket, event: ServerEvent): void {
  socket.emit(event.type, event);
}

function emitError(
  socket: Socket,
  subsystem: string,
  message: string,
  recoverable: boolean,
): void {
  emitServerEvent(socket, {
    type: "error",
    subsystem,
    message,
    recoverable,
  });
}
