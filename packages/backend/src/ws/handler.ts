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
        // Cancel silence timer
        if (state.silenceTimer) {
          clearTimeout(state.silenceTimer);
          state.silenceTimer = null;
        }
        // Flush any pending text into a card before ending
        if (state.pendingText.trim()) {
          await finalizePendingText(
            socket, state,
            semanticAnalyzer, recommendationEngine, visualizationEngine,
          );
        }
        sessionManager.end(state.sessionId);
        state.transcriptionEngine.stopTranscription();
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

        // New path: base64-encoded WAV from renderer audio capture
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
    });

    socket.on("text:submit", (data: Extract<ClientEvent, { type: "text:submit" }>) => {
      try {
        console.log("[WS] text:submit received, sessionId:", state.sessionId, "text length:", data?.text?.length);
        if (!state.sessionId) throw new Error("No active session");
        processTextSubmit(
          socket, state, data.text,
          semanticAnalyzer, recommendationEngine, visualizationEngine,
        );
      } catch (err) {
        emitError(socket, "text", String(err), true);
      }
    });

    socket.on("speaker:rename", (data: Extract<ClientEvent, { type: "speaker:rename" }>) => {
      // Speaker rename is handled client-side for now
      // Could propagate to diarizer in future
      socket.emit("speaker:renamed", {
        speakerId: data.speakerId,
        name: data.name,
      });
    });

    socket.on("bookmark:create", (data: Extract<ClientEvent, { type: "bookmark:create" }>) => {
      try {
        if (!state.sessionId) throw new Error("No active session");
        bookmarkService.create({
          sessionId: state.sessionId,
          userId: state.userId,
          timestamp: data.timestamp,
          note: data.note,
        });
      } catch (err) {
        emitError(socket, "bookmark", String(err), true);
      }
    });

    socket.on("disconnect", () => {
      if (state.silenceTimer) {
        clearTimeout(state.silenceTimer);
        state.silenceTimer = null;
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
  const mergedSegment: TranscriptSegment = {
    id: `merged_${Date.now()}`,
    sessionId: state.sessionId!,
    text,
    languageCode: segments[0]?.languageCode ?? "en",
    speakerId: "user",
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
    console.log("[WS] Card created:", card.content.slice(0, 50));
    const format = visualizer.selectFormat(card);
    card.visualizationFormat = format;
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
  } catch (err) {
    console.error("[WS] Pipeline error:", err);
    emitError(socket, "pipeline", String(err), true);
  }
}

async function processTextSubmit(
  socket: Socket,
  state: SocketSessionState,
  text: string,
  analyzer: SemanticAnalyzer,
  recommender: RecommendationEngine,
  visualizer: VisualizationEngine,
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
