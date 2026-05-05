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
import { SUMMARY_TIMEOUT_MS } from "../config/timeouts.js";
import { SemanticAnalyzer, type SessionContext } from "../semantic/analyzer.js";
import { RecommendationEngine } from "../recommendation/engine.js";
import { VisualizationEngine } from "../visualization/engine.js";
import { LanguageDetector } from "../language/detector.js";
import { TranscriptionEngine } from "../stt/engine.js";
import { GroqWhisperProvider } from "../stt/providers/groq-whisper.js";
import { DeepgramProvider } from "../stt/providers/deepgram.js";
import { DeepgramStreamingProvider } from "../stt/providers/deepgram-streaming.js";
import type { LLMGateway } from "../llm/gateway.js";
import type { DeepgramWord } from "../stt/providers/deepgram-streaming.js";

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
  /** Guard duplicate recommendation backfill requests while one is already running */
  recommendationInFlight: boolean;
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
      recommendationInFlight: false,
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

          // Final recap dedup uses the same normalized overlap logic as live
          // consolidation so we do not regress at session end.
          const seenItems: { content: string; category: string }[] = [];
          const dedupedFinal = allFinalCards.filter((card) => {
            const cardLower = card.content.toLowerCase();
            for (const seen of seenItems) {
              if (seen.category !== card.category) continue;
              if (overlapRatio(cardLower, seen.content) > 0.68) return false;
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
              let score = 0;
              for (const hc of highlightedContents) {
                score += Math.round(overlapRatio(dedupedFinal[i].content, hc) * 10);
              }
              for (const mt of state.markedTexts) {
                score += Math.round(overlapRatio(dedupedFinal[i].content, mt) * 10);
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
            const summary = await generateSummaryWithFallback(deps.llmGateway, state.cards, "conversation");
            emitServerEvent(socket, { type: "session:summary", summary });
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

    socket.on("subtitle:analyze", async (data: { type: string; newText: string; pendingText: string; existingCards: CoreMeaningCard[] }) => {
      try {
        if (!state.sessionId) {
          const session = sessionManager.create({ userId: state.userId, mode: "offline" });
          state.sessionId = session.id;
        }
        const langResult = state.languageDetector.detectFromText(data.newText + data.pendingText);
        console.log(`[WS] subtitle:analyze — new: ${data.newText.length} chars, pending: ${data.pendingText.length} chars, existingCards: ${data.existingCards.length}`);

        const result = await semanticAnalyzer.analyzeIncremental(
          data.newText,
          data.pendingText,
          data.existingCards,
          langResult.primaryLanguage,
        );

        for (const card of result.cards) {
          card.sessionId = state.sessionId;
        }

        emitServerEvent(socket, {
          type: "subtitle:result",
          cards: result.cards,
          pendingText: result.pendingText,
        });
      } catch (err) {
        console.error("[WS] subtitle:analyze error:", err);
        emitError(socket, "subtitle", String(err), true);
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
        if (!state.sessionId || state.transcripts.length === 0 || state.recommendationInFlight) return;
        state.recommendationInFlight = true;
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
        emitError(socket, "recommendation", String(err), true);
      } finally {
        state.recommendationInFlight = false;
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

/**
 * Legacy segmentation / consolidation tuning.
 *
 * IMPORTANT:
 * The values below power the current production-like heuristic pipeline.
 * We are intentionally keeping them grouped and documented because upcoming
 * quality work may replace this with a more mature turn-detection strategy.
 *
 * Current legacy behavior:
 * - Build `pendingText` by concatenating finalized transcript snippets
 * - Cut immediately on "obvious" textual boundaries
 * - Otherwise cut after a fixed silence timeout
 * - Run async consolidation later to re-interpret recent transcript windows
 *
 * This is simple and fast, but it can over-segment short pauses and
 * under-segment long, multi-part utterances.
 */
/** Default silence duration (ms) before finalizing accumulated text into a card */
const SILENCE_THRESHOLD_MS = 2200;
const MIN_PENDING_CHARS = 8;
const PUNCTUATION_MIN_CHARS = 18;
const MAX_PENDING_CHARS_EN = 160;
const MAX_PENDING_CHARS_ZH = 80;
const MAX_PENDING_WORDS_EN = 36;

/**
 * Legacy segmentation heuristic.
 *
 * This function is the current "cut now or keep waiting" gate. It does not use
 * acoustic VAD scores, turn-taking models, or semantic completeness scoring.
 * Instead it relies on three lightweight text-side rules:
 *
 * 1. Hard cut when the accumulated pending text gets too long.
 * 2. Cut when the text is long enough and ends with sentence punctuation.
 * 3. Otherwise keep buffering until the silence timer fires elsewhere.
 *
 * We are keeping this behavior stable for now so it is easy to compare against
 * future strategies.
 */
function checkSegmentationTriggers(text: string, opts?: {
  speakerChanged?: boolean;
  utteranceEnded?: boolean;
}): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const speakerChanged = opts?.speakerChanged === true;
  const utteranceEnded = opts?.utteranceEnded === true;
  const score = segmentationScore(trimmed, { speakerChanged, utteranceEnded });

  if (score.maxLengthExceeded) return "max_length";
  if (score.cutNow) return score.reason;

  return null;
}

function segmentationScore(text: string, opts?: {
  speakerChanged?: boolean;
  utteranceEnded?: boolean;
}): {
  cutNow: boolean;
  maxLengthExceeded: boolean;
  reason: string;
  score: number;
} {
  const trimmed = text.trim();
  const lang = detectDominantLanguage(trimmed);
  const isQuestion = /(?:\?|？|吗$|呢$|么$)/.test(trimmed);
  const endsWithPunctuation = /[。！？.!?]$/.test(trimmed);
  const endsWithCommaLike = /[，、,:;]$/.test(trimmed);
  const words = normalizedTerms(trimmed);
  const charLimit = lang === "zh" ? MAX_PENDING_CHARS_ZH : MAX_PENDING_CHARS_EN;
  const wordLimitExceeded = lang === "en" && words.length > MAX_PENDING_WORDS_EN;
  const maxLengthExceeded = trimmed.length > charLimit || wordLimitExceeded;
  const looksComplete = looksLikeCompleteThought(trimmed);

  let score = 0;
  let reason = "wait";

  if (opts?.speakerChanged) {
    score += 4;
    reason = "speaker_change";
  }
  if (opts?.utteranceEnded) {
    score += 4;
    reason = "utterance_end";
  }
  if (endsWithPunctuation && trimmed.length >= PUNCTUATION_MIN_CHARS) {
    score += isQuestion ? 3 : 2;
    if (reason === "wait") reason = isQuestion ? "question_boundary" : "punctuation";
  }
  if (looksComplete && trimmed.length >= MIN_PENDING_CHARS) {
    score += 2;
    if (reason === "wait") reason = "complete_thought";
  }
  if (endsWithCommaLike) {
    score -= 1;
  }

  return {
    cutNow: score >= 4,
    maxLengthExceeded,
    reason: maxLengthExceeded ? "max_length" : reason,
    score,
  };
}

function getSilenceTimeoutMs(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return SILENCE_THRESHOLD_MS;

  const lang = detectDominantLanguage(trimmed);
  const terms = normalizedTerms(trimmed);
  const isQuestion = /(?:\?|？|吗$|呢$|么$)/.test(trimmed);
  const endsWithPunctuation = /[。！？.!?]$/.test(trimmed);
  const endsWithCommaLike = /[，、,:;]$/.test(trimmed);
  const meaningful = isMeaningfulUtterance(trimmed);

  if (!meaningful) return 2800;
  if (isQuestion) return 900;
  if (endsWithPunctuation) return 1100;
  if (looksLikeCompleteThought(trimmed)) return 1400;
  if (lang === "zh" && trimmed.length >= 40) return 1600;
  if (lang === "en" && terms.length >= 20) return 1600;
  if (endsWithCommaLike) return 2600;
  return SILENCE_THRESHOLD_MS;
}

function isMeaningfulUtterance(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  if (!trimmed) return false;

  const compact = trimmed.replace(/\s+/g, " ");
  const trivialPhrases = new Set([
    "uh",
    "um",
    "hmm",
    "mm",
    "mhm",
    "yeah",
    "yep",
    "nope",
    "ok",
    "okay",
    "right",
    "got it",
    "i see",
    "sure",
    "thanks",
    "thank you",
    "嗯",
    "啊",
    "哦",
    "唉",
    "对",
    "好的",
    "好",
    "行",
    "可以",
    "收到",
    "知道了",
    "明白了",
    "谢谢",
  ]);
  if (trivialPhrases.has(compact)) return false;

  const terms = normalizedTerms(compact);
  if (terms.length <= 1 && compact.length <= 6) return false;

  return true;
}

function looksLikeCompleteThought(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/[。！？.!?]$/.test(trimmed)) return true;
  if (/(\b(?:because|so|therefore|we should|we need|let's|i think|can you|could you|please)\b)/i.test(trimmed)) return true;
  if (/(因为|所以|我们要|我们应该|请|麻烦|我觉得|我想|要不|能不能|是不是)/.test(trimmed)) return true;
  return normalizedTerms(trimmed).length >= 10 || trimmed.length >= 24;
}

function detectDominantLanguage(text: string): "zh" | "en" {
  const zhCount = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const enCount = (text.match(/[A-Za-z]/g) ?? []).length;
  return zhCount >= enCount ? "zh" : "en";
}

function normalizedTerms(text: string): string[] {
  const lower = text.toLowerCase();
  const englishTerms = lower.match(/[a-z0-9]+/g) ?? [];
  const chineseTerms = Array.from(lower.matchAll(/[\u4e00-\u9fff]{1,2}/g), (m) => m[0]);
  return [...englishTerms, ...chineseTerms];
}

function overlapRatio(a: string, b: string): number {
  const aTerms = normalizedTerms(a).filter((t) => t.length > 1);
  const bTerms = normalizedTerms(b).filter((t) => t.length > 1);
  if (aTerms.length === 0 || bTerms.length === 0) return 0;

  const bSet = new Set(bTerms);
  let overlap = 0;
  for (const term of aTerms) {
    if (bSet.has(term)) overlap++;
  }

  return overlap / Math.min(aTerms.length, bTerms.length);
}

function shouldDropTranscriptText(text: string, confidence?: number): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;

  const suspiciousTokens = findSuspiciousTokens(trimmed);
  const suspiciousRatio = suspiciousTokens.length / Math.max(tokenizeTranscript(trimmed).length, 1);

  // Very low confidence plus suspicious surface form is almost certainly ASR garbage.
  if ((confidence ?? 1) < 0.45 && suspiciousTokens.length > 0) {
    return true;
  }

  // A sentence dominated by suspicious tokens should not enter semantic analysis.
  if (suspiciousTokens.length >= 2 && suspiciousRatio >= 0.4) {
    return true;
  }

  // One extremely suspicious token with little surrounding natural language
  // is also likely hallucinated gibberish.
  if (suspiciousTokens.some((token) => token.length >= 16) && tokenizeTranscript(trimmed).length <= 6) {
    return true;
  }

  return false;
}

function tokenizeTranscript(text: string): string[] {
  return text.match(/[A-Za-z0-9_]+|[\u4e00-\u9fff]+/g) ?? [];
}

function findSuspiciousTokens(text: string): string[] {
  const tokens = tokenizeTranscript(text);
  return tokens.filter(isSuspiciousToken);
}

function isSuspiciousToken(token: string): boolean {
  if (/^[\u4e00-\u9fff]+$/.test(token)) return false;
  if (token.length < 10) return false;
  if (/^[A-Z][a-z]+(?:[A-Z][a-z]+)+$/.test(token)) return false; // common PascalCase
  if (/^[a-z]+(?:[A-Z][a-z0-9]+)+$/.test(token)) return false; // common camelCase
  if (/^[A-Z0-9_]+$/.test(token) && token.length <= 14 && token.includes("_")) return false; // env-like constants

  const alphaCount = (token.match(/[A-Za-z]/g) ?? []).length;
  const upperCount = (token.match(/[A-Z]/g) ?? []).length;
  const digitCount = (token.match(/[0-9]/g) ?? []).length;
  const vowelCount = (token.match(/[aeiou]/gi) ?? []).length;
  const nonAlphaNumCount = token.length - alphaCount - digitCount;

  const upperRatio = alphaCount > 0 ? upperCount / alphaCount : 0;
  const digitRatio = token.length > 0 ? digitCount / token.length : 0;
  const vowelRatio = alphaCount > 0 ? vowelCount / alphaCount : 0;

  // Hallucinated ASR tokens often look like long all-caps or alnum blobs with
  // almost no vowels, e.g. LINKSTYC0UNTAXMEWRAPT0RTH0N.
  if (upperRatio > 0.75 && token.length >= 12) return true;
  if (digitRatio > 0.18 && token.length >= 10) return true;
  if (vowelRatio < 0.15 && alphaCount >= 8 && token.length >= 12) return true;
  if (nonAlphaNumCount > 2 && token.length >= 10) return true;

  return false;
}

export interface SpeakerWordRun {
  speakerId: string;
  text: string;
}

function renderWords(words: DeepgramWord[]): string {
  let text = "";
  for (const word of words) {
    const token = word.punctuatedWord || word.word;
    if (!token) continue;

    if (!text) {
      text = token;
      continue;
    }

    const prevChar = text[text.length - 1];
    const startsWithPunctuation = /^[,.;:!?%)}\]，。！？、；：）】》]/.test(token);
    const prevIsOpenBracket = /[(\[{（【《]$/.test(prevChar);
    const prevIsChinese = /[\u4e00-\u9fff]$/.test(prevChar);
    const nextIsChinese = /^[\u4e00-\u9fff]/.test(token);

    if (startsWithPunctuation || prevIsOpenBracket || prevIsChinese || nextIsChinese) {
      text += token;
    } else {
      text += ` ${token}`;
    }
  }
  return text.trim();
}

export function buildSpeakerRunsFromWords(
  words: DeepgramWord[],
  fallbackText: string,
  fallbackSpeakerId: string,
): SpeakerWordRun[] {
  if (words.length === 0) {
    return fallbackText.trim() ? [{ speakerId: fallbackSpeakerId, text: fallbackText.trim() }] : [];
  }

  const runs: { speakerId: string; words: DeepgramWord[] }[] = [];
  for (const word of words) {
    const speakerId = `speaker_${word.speaker}`;
    const last = runs[runs.length - 1];
    if (last && last.speakerId === speakerId) {
      last.words.push(word);
    } else {
      runs.push({ speakerId, words: [word] });
    }
  }

  return runs
    .map((run) => ({ speakerId: run.speakerId, text: renderWords(run.words) }))
    .filter((run) => run.text.trim());
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
    let deepgramWords: DeepgramWord[] = [];

    // Try Deepgram first (has diarization), fall back to Groq Whisper
    if (process.env.DEEPGRAM_API_KEY) {
      const dg = await deepgram.transcribeBase64Wav(audioBase64, sttLang);
      text = dg.text;
      latencyMs = dg.latencyMs;
      speakerIdx = dg.speaker;
      deepgramWords = dg.words;
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

    if (shouldDropTranscriptText(text, 0.95)) {
      console.log(`[WS] Dropping suspicious REST transcript: "${text.slice(0, 80)}"`);
      return;
    }

    console.log(`[WS] Groq transcription (${latencyMs}ms): "${text.slice(0, 80)}"`);

    const langResult = state.languageDetector.detectFromText(text);
    console.log(`[WS] Detected language: ${langResult.primaryLanguage}`);

    const runs = buildSpeakerRunsFromWords(deepgramWords, text, `speaker_${speakerIdx}`);
    const segments: TranscriptSegment[] = runs.map((run, idx) => {
      const runLang = state.languageDetector.detectFromText(run.text);
      return {
        id: `groq_audio_${Date.now()}_${idx}`,
        sessionId: state.sessionId!,
        text: run.text,
        languageCode: runLang.primaryLanguage,
        speakerId: run.speakerId,
        startTime: Date.now() - latencyMs,
        endTime: Date.now(),
        isFinal: true,
        confidence: 0.95,
        provider: "groq_whisper",
        createdAt: new Date(),
      };
    });

    for (const segment of segments) {
      state.transcripts.push(segment);
      emitServerEvent(socket, { type: "transcript:final", segment });
      state.pendingText += (state.pendingText ? " " : "") + segment.text.trim();
      state.pendingSegments.push(segment);
    }
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

    // Legacy silence-based segmentation: each new finalized snippet resets the
    // fixed timer. If nothing else arrives within the threshold, we flush the
    // entire pending buffer into one semantic-analysis request.
    if (state.silenceTimer) {
      clearTimeout(state.silenceTimer);
    }
    const silenceTimeoutMs = getSilenceTimeoutMs(state.pendingText);
    state.silenceTimer = setTimeout(() => {
      finalizePendingText(socket, state, analyzer, recommender, visualizer);
    }, silenceTimeoutMs);

    console.log(`[WS] Accumulated pending text (${state.pendingText.length} chars), waiting ${silenceTimeoutMs}ms for silence...`);
  } catch (err) {
    console.error("[WS] Audio chunk processing error:", err);
    emitError(socket, "stt", String(err), true);
  }
}

/**
 * Finalize accumulated pending text into a card.
 *
 * Legacy behavior:
 * - Merge every pending transcript snippet into one synthetic segment
 * - Choose the dominant speaker by majority vote within the pending window
 * - Run the standard single-segment semantic pipeline on that merged text
 *
 * This gives us a low-latency draft card, but the boundary can still be wrong,
 * which is why a later consolidation pass exists.
 */
async function finalizePendingText(
  socket: Socket,
  state: SocketSessionState,
  analyzer: SemanticAnalyzer,
  recommender: RecommendationEngine,
  visualizer: VisualizationEngine,
): Promise<void> {
  if (!state.pendingText.trim()) return;

  const segments = [...state.pendingSegments];
  const text = state.pendingText;

  if (!isMeaningfulUtterance(text)) {
    console.log(`[WS] Dropping low-information pending text: "${text.slice(0, 60)}"`);
    state.pendingText = "";
    state.pendingSegments = [];
    state.silenceTimer = null;
    emitServerEvent(socket, { type: "pending:preview", text: "" });
    return;
  }

  // Clear pending state
  state.pendingText = "";
  state.pendingSegments = [];
  state.silenceTimer = null;

  console.log(`[WS] Silence detected — finalizing ${text.length} chars into card`);

  const speakerRuns: TranscriptSegment[][] = [];
  for (const segment of segments) {
    const lastRun = speakerRuns[speakerRuns.length - 1];
    if (lastRun && lastRun[lastRun.length - 1].speakerId === segment.speakerId) {
      lastRun.push(segment);
    } else {
      speakerRuns.push([segment]);
    }
  }

  for (let i = 0; i < speakerRuns.length; i++) {
    const run = speakerRuns[i];
    const mergedSegment: TranscriptSegment = {
      id: `merged_${Date.now()}_${i}`,
      sessionId: state.sessionId!,
      text: run.map((segment) => segment.text).join(" ").trim(),
      languageCode: run[0]?.languageCode ?? "en",
      speakerId: run[0]?.speakerId ?? "user",
      startTime: run[0]?.startTime ?? Date.now(),
      endTime: run[run.length - 1]?.endTime ?? Date.now(),
      isFinal: true,
      confidence: Math.max(...run.map((segment) => segment.confidence), 0.95),
      provider: run[0]?.provider ?? "groq_whisper",
      createdAt: new Date(),
    };

    await processFinalTranscript(
      socket, state, mergedSegment,
      analyzer, recommender, visualizer,
    );
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
      try {
        const recommendations = await recommender.generateRecommendations(card, {
          sessionId: state.sessionId!,
          existingCards: state.cards,
          topicMap: state.topicMap,
        });
        if (recommendations.length > 0) {
          emitServerEvent(socket, { type: "recommendation:new", recommendations });
        }
      } catch (err) {
        console.error("[WS] Recommendation generation error:", err);
        emitError(socket, "recommendation", String(err), true);
      }
    } else {
      console.log("[WS] Recommendations disabled — skipping LLM call");
    }

    // Legacy refinement model: emit a draft card immediately, then schedule a
    // non-blocking consolidation pass that may replace the card set with a more
    // coherent interpretation of the recent transcript window.
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

/**
 * Legacy consolidation algorithm.
 *
 * Goal:
 * Re-interpret the most recent transcript window in larger speaker-grouped
 * chunks so the live draft cards can be replaced by a cleaner recap.
 *
 * Current strategy:
 * - Keep older cards in `lockedCards`
 * - Rebuild the active window from raw transcripts, grouped by sequential
 *   speaker runs
 * - Use `analyzeMulti()` to extract multiple points per run
 * - Deduplicate using category match + word-overlap ratio
 * - After several passes with no meaningful new data, lock the window
 *
 * This is intentionally documented as legacy because it relies on lexical
 * overlap heuristics rather than a stronger turn/intent model.
 */
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

  // Legacy regrouping rule: sequential transcripts from the same speaker are
  // treated as a single run for multi-point semantic re-analysis.
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

      const runLang = state.languageDetector.detectFromText(runText);
      const runCards = await analyzer.analyzeMulti(runText, runLang.primaryLanguage);
      for (const card of runCards) {
        card.sessionId = state.sessionId!;
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

    // Improved deduplication: normalize mixed Chinese/English text before
    // computing overlap so recap cards are more stable across paraphrases.
    const seenItems: { content: string; category: string }[] = [];
    for (const lc of state.lockedCards) {
      seenItems.push({ content: lc.content.toLowerCase(), category: lc.category });
    }
    const dedupedCards = windowCards.filter((card) => {
      const cardLower = card.content.toLowerCase();
      for (const seen of seenItems) {
        if (seen.category !== card.category) continue;
        if (overlapRatio(cardLower, seen.content) > 0.68) return false;
      }
      seenItems.push({ content: cardLower, category: card.category });
      return true;
    });

    // Legacy bookmark/highlight inheritance: choose the best lexical match in
    // the new card set and carry the highlight over.
    const hadHighlight = state.cards.some(c => c.isHighlighted);
    if (hadHighlight && dedupedCards.length > 0) {
      // Collect all highlighted card contents for matching
      const highlightedContents = state.cards.filter(c => c.isHighlighted).map(c => c.content.toLowerCase());
      let bestIdx = 0;
      let bestScore = -1;
      for (let i = 0; i < dedupedCards.length; i++) {
        let score = 0;
        for (const hc of highlightedContents) {
          score += Math.round(overlapRatio(dedupedCards[i].content, hc) * 10);
        }
        // Also check against marked transcript texts
        for (const mt of state.markedTexts) {
          score += Math.round(overlapRatio(dedupedCards[i].content, mt) * 10);
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
    if (shouldDropTranscriptText(result.text, result.confidence)) {
      console.log(`[WS] Dropping suspicious streaming transcript (conf=${result.confidence.toFixed(3)}): "${result.text.slice(0, 80)}"`);
      state.interimText = "";
      emitServerEvent(socket, { type: "pending:preview", text: state.pendingText });
      return;
    }

    const runs = buildSpeakerRunsFromWords(result.words, result.text, `speaker_${result.speaker}`);
    state.interimText = "";

    for (const run of runs) {
      if (state.pendingText.trim() && state.pendingSegments.length > 0) {
        const prevSpeaker = state.pendingSegments[state.pendingSegments.length - 1].speakerId;
        if (prevSpeaker !== run.speakerId) {
          console.log(`[WS] Speaker change: ${prevSpeaker} → ${run.speakerId} — finalizing pending`);
          if (state.silenceTimer) { clearTimeout(state.silenceTimer); state.silenceTimer = null; }
          finalizePendingText(socket, state, analyzer, recommender, visualizer);
        }
      }

      state.pendingText += (state.pendingText ? " " : "") + run.text.trim();

      const langResult = state.languageDetector.detectFromText(run.text);
      const segment: TranscriptSegment = {
        id: `dg_stream_${Date.now()}`,
        sessionId: state.sessionId!,
        text: run.text,
        languageCode: langResult.primaryLanguage,
        speakerId: run.speakerId,
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
    }

    // Show accumulated text as preview
    emitServerEvent(socket, { type: "pending:preview", text: state.pendingText });

    // Legacy text-side segmentation triggers run even in streaming mode; the
    // stream gives us faster transcript updates, but the cut decision is still
    // primarily heuristic.
    const shouldFinalize = checkSegmentationTriggers(state.pendingText, { speakerChanged: false, utteranceEnded: false });
    if (shouldFinalize) {
      if (state.silenceTimer) { clearTimeout(state.silenceTimer); state.silenceTimer = null; }
      console.log(`[WS] Stream segmentation trigger: ${shouldFinalize}`);
      finalizePendingText(socket, state, analyzer, recommender, visualizer);
      return;
    }

    // Reset silence timer (Deepgram's utterance_end will also trigger finalize)
    if (state.silenceTimer) clearTimeout(state.silenceTimer);
    const silenceTimeoutMs = getSilenceTimeoutMs(state.pendingText);
    state.silenceTimer = setTimeout(() => {
      finalizePendingText(socket, state, analyzer, recommender, visualizer);
    }, silenceTimeoutMs);

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
  // Legacy streaming endpoint integration: Deepgram's utterance boundary is
  // treated as a strong flush signal for the current pending buffer.
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
      try {
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
      } catch (err) {
        console.error("[WS] Text recommendation error:", err);
        emitError(socket, "recommendation", String(err), true);
      }
    }

    // Generate summary for text mode results
    if (state.cards.length > 0) {
      try {
        const summary = await generateSummaryWithFallback(llmGateway, state.cards, "text analysis");
        emitServerEvent(socket, { type: "session:summary", summary });
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
  message: unknown,
  recoverable: boolean,
): void {
  emitServerEvent(socket, {
    type: "error",
    subsystem,
    message: toUserFacingErrorMessage(message),
    recoverable,
  });
}

function toUserFacingErrorMessage(err: unknown): string {
  if (isErrorWithStatus(err, 402)) {
    return "Cerebras API returned 402 Payment Required. Check that billing is active for the correct organization/project, and that this API key has access to the selected model.";
  }

  if (err instanceof Error) return err.message;
  return String(err);
}

function isErrorWithStatus(err: unknown, status: number): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof (err as { status?: unknown }).status === "number" &&
    (err as { status: number }).status === status
  );
}

async function generateSummaryWithFallback(
  llmGateway: LLMGateway,
  cards: CoreMeaningCard[],
  subject: "conversation" | "text analysis",
): Promise<string> {
  const cardsSummaryInput = cards.map((c) => `[${c.category}] ${c.content}`).join("\n");
  const hasChinese = cards.some((c) => /[\u4e00-\u9fff]/.test(c.content));
  const langHint = hasChinese ? "Respond in Chinese." : "Respond in English.";

  try {
    const summaryResponse = await llmGateway.complete({
      taskType: "semantic_analysis",
      messages: [
        {
          role: "system",
          content: `You summarize ${subject}s in 2-3 concise sentences. ${langHint} Be direct and factual. Do not use phrases like "The ${subject} covered..." — just state the key points.`,
        },
        { role: "user", content: `Summarize this ${subject}:\n${cardsSummaryInput}` },
      ],
      maxTokens: 200,
      temperature: 0.3,
      stream: false,
      timeoutMs: SUMMARY_TIMEOUT_MS,
    });
    return summaryResponse.content.trim();
  } catch (err) {
    if (isRateLimitOrTimeout(err)) {
      console.warn(`[WS] Summary LLM unavailable (${formatSummaryError(err)}). Falling back to local summary.`);
      return buildLocalSummary(cards, hasChinese);
    }
    throw err;
  }
}

function buildLocalSummary(cards: CoreMeaningCard[], hasChinese: boolean): string {
  const contents = cards
    .map((card) => card.content.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (contents.length === 0) {
    return hasChinese ? "这次没有生成可用摘要。" : "No summary was generated this time.";
  }

  if (hasChinese) {
    return contents.join("；");
  }

  return contents.join(". ");
}

function isRateLimitOrTimeout(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return "status" in err && (err as Error & { status?: number }).status === 429
    || /timeout|timed out/i.test(err.message);
}

function formatSummaryError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const status = "status" in err ? (err as Error & { status?: number }).status : undefined;
  return status ? `${status} ${err.message}` : err.message;
}
