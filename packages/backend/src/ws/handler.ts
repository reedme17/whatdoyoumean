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
    path: "/ws",
  });

  const sessionManager = new SessionManager();
  const bookmarkService = new BookmarkService();
  const semanticAnalyzer = new SemanticAnalyzer(deps.llmGateway);
  const recommendationEngine = new RecommendationEngine(deps.llmGateway);
  const visualizationEngine = new VisualizationEngine();

  io.on("connection", (socket: Socket) => {
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

    socket.on("audio:chunk", (data: Extract<ClientEvent, { type: "audio:chunk" }>) => {
      try {
        if (!state.sessionId) throw new Error("No active session");
        const session = sessionManager.get(state.sessionId);
        if (session?.status !== "active") return;
        state.transcriptionEngine.feedAudio(data.data);
      } catch (err) {
        emitError(socket, "stt", String(err), true);
      }
    });

    socket.on("text:submit", (data: Extract<ClientEvent, { type: "text:submit" }>) => {
      try {
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

  return io;
}

// ── Pipeline helpers ──

async function processFinalTranscript(
  socket: Socket,
  state: SocketSessionState,
  segment: TranscriptSegment,
  analyzer: SemanticAnalyzer,
  recommender: RecommendationEngine,
  visualizer: VisualizationEngine,
): Promise<void> {
  try {
    const context: SessionContext = {
      sessionId: state.sessionId!,
      recentTranscripts: state.transcripts.slice(-10),
      existingCards: state.cards,
      topicMap: state.topicMap,
    };

    // Semantic analysis → card
    const card = await analyzer.analyze(segment, context);
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
    // Detect language from text
    const langResult = state.languageDetector.detectFromText(text);

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
