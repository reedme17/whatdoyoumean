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

    socket.on("session:end", () => {
      try {
        if (!state.sessionId) throw new Error("No active session");
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

    // Transcribe via Groq Whisper
    const { text, latencyMs } = await groqWhisper.transcribeBase64Wav(audioBase64, "en");

    if (!text || text.trim().length === 0) {
      console.log("[WS] Empty transcription — skipping");
      return;
    }

    console.log(`[WS] Groq transcription (${latencyMs}ms): "${text.slice(0, 80)}"`);

    // Create a TranscriptSegment from the transcription
    const segment: TranscriptSegment = {
      id: `groq_audio_${Date.now()}`,
      sessionId: state.sessionId!,
      text,
      languageCode: "en",
      speakerId: "user",
      startTime: Date.now() - latencyMs,
      endTime: Date.now(),
      isFinal: true,
      confidence: 0.95,
      provider: "groq_whisper",
      createdAt: new Date(),
    };

    state.transcripts.push(segment);
    emitServerEvent(socket, { type: "transcript:final", segment });

    // Run through the full semantic pipeline
    await processFinalTranscript(
      socket, state, segment,
      analyzer, recommender, visualizer,
    );
  } catch (err) {
    console.error("[WS] Audio chunk processing error:", err);
    emitError(socket, "stt", String(err), true);
  }
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

    // Duplicate detection + merge
    const mergeDecision = await analyzer.detectDuplicate(card, state.cards.slice(0, -1));
    if (mergeDecision.shouldMerge && mergeDecision.targetCardId) {
      const target = state.cards.find((c) => c.id === mergeDecision.targetCardId);
      if (target && mergeDecision.mergedContent) {
        target.content = mergeDecision.mergedContent;
        target.updatedAt = new Date();
        emitServerEvent(socket, { type: "card:updated", card: target });
      }
    }

    // Topic map update
    state.topicMap = await analyzer.updateTopicMap(card, state.topicMap);
    emitServerEvent(socket, { type: "topic:updated", topicMap: state.topicMap });

    // Recommendations
    const recommendations = await recommender.generateRecommendations(card, {
      sessionId: state.sessionId!,
      existingCards: state.cards,
      topicMap: state.topicMap,
    });
    if (recommendations.length > 0) {
      emitServerEvent(socket, { type: "recommendation:new", recommendations });
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

    // Run through semantic pipeline (same as audio path)
    await processFinalTranscript(
      socket, state, segment,
      analyzer, recommender, visualizer,
    );
  } catch (err) {
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
