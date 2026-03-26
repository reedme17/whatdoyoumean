/**
 * Root React component — state machine driving all screens.
 *
 * Navigation: home → live/text → recap (guest mode, no login required)
 * Sign-in is accessed from the Expand Panel to unlock History, Memory, Sync, etc.
 * Connects to backend via WebSocket (socket.io-client) for live sessions.
 * Uses window.electronAPI for audio capture control.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import type {
  CoreMeaningCard,
  Recommendation,
  Bookmark,
  ServerEvent,
} from "@wdym/shared";
import { useSocket } from "./hooks/useSocket.js";
import { useAudioCapture } from "./hooks/useAudioCapture.js";
import { LoginScreen } from "./components/LoginScreen.js";
import { HomeScreen } from "./components/HomeScreen.js";
import { LiveSession } from "./components/LiveSession.js";
import { RecapScreen } from "./components/RecapScreen.js";
import { TextModeScreen } from "./components/TextModeScreen.js";
import { ExpandPanel, type SessionSummary, type SttLanguage } from "./components/ExpandPanel.js";
import { Onboarding } from "./components/Onboarding.js";

type Screen = "onboarding" | "home" | "live" | "recap" | "text" | "processing";

/** Minimal ElectronAPI type for window.electronAPI */
interface ElectronAPI {
  startSession(config: unknown): Promise<void>;
  stopSession(): Promise<unknown>;
  pauseSession(): Promise<void>;
  resumeSession(): Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export function App(): React.JSX.Element {
  // ── Navigation state ──
  const [screen, setScreen] = useState<Screen>("onboarding");
  const screenRef = useRef<Screen>("onboarding");
  const [userId, setUserId] = useState<string | null>(null);
  const isGuest = userId === null;

  const goToScreen = useCallback((s: Screen) => {
    screenRef.current = s;
    setScreen(s);
  }, []);

  // ── Session state ──
  const [cards, setCards] = useState<CoreMeaningCard[]>([]);
  const [currentCard, setCurrentCard] = useState<CoreMeaningCard | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [speakers] = useState<Map<string, string>>(new Map());
  const sessionStartRef = useRef<number>(0);
  const [audioSource, setAudioSource] = useState<"mic" | "mic+system">("mic");
  const [sttLanguage, setSttLanguage] = useState<SttLanguage>("zh+en");
  const [pendingPreview, setPendingPreview] = useState<string>("");

  // ── Text mode state ──
  const [textCards, setTextCards] = useState<CoreMeaningCard[]>([]);
  const [textRecs, setTextRecs] = useState<Recommendation[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  // ── Expand panel ──
  const [panelOpen, setPanelOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  // ── WebSocket ──
  // ── WebSocket ──
  const handleServerEvent = useCallback((event: ServerEvent) => {
    switch (event.type) {
      case "card:created": {
        const newCard = (event as Extract<ServerEvent, { type: "card:created" }>).card;
        const s = screenRef.current;
        // Accept cards during live, text, or processing (waiting for final card)
        if (s !== "live" && s !== "text" && s !== "processing") {
          console.log("[App] Ignoring late card:created on screen:", s);
          break;
        }
        setCards((prev) => [...prev, newCard]);
        setTextCards((prev) => [...prev, newCard]);
        setAnalyzing(false);
        setPendingPreview("");
        break;
      }

      case "card:updated": {
        const updated = (event as Extract<ServerEvent, { type: "card:updated" }>).card;
        // Update in-place: check if it's the current card or an existing one
        setCurrentCard((prev) =>
          prev?.id === updated.id ? updated : prev
        );
        setCards((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c))
        );
        break;
      }

      case "recommendation:new":
        setRecommendations(
          (event as Extract<ServerEvent, { type: "recommendation:new" }>).recommendations
        );
        setTextRecs(
          (event as Extract<ServerEvent, { type: "recommendation:new" }>).recommendations
        );
        break;

      case "pending:preview":
        setPendingPreview((event as Extract<ServerEvent, { type: "pending:preview" }>).text);
        break;

      case "session:state": {
        const sessionState = (event as Extract<ServerEvent, { type: "session:state" }>).state;
        if (sessionState === "ended" && screenRef.current === "processing") {
          goToScreen("recap");
        }
        break;
      }

      default:
        break;
    }
  }, [currentCard]);

  const { send } = useSocket(handleServerEvent);

  // ── Audio capture (renderer-side mic → base64 WAV → backend via WS) ──
  const { startCapture, stopCapture, isCapturing, error: audioError, analyser } = useAudioCapture({ send, mode: "online", captureSystem: audioSource === "mic+system" });

  // ── Handlers ──

  const handleLogin = (id: string) => {
    setUserId(id);
    // Stay on current screen — just unlock features
    fetchSessions(id);
  };

  const handleLogout = () => {
    setUserId(null);
    goToScreen("home");
    resetSession();
  };

  const resetSession = () => {
    setCards([]);
    setCurrentCard(null);
    setRecommendations([]);
    setBookmarks([]);
    setTextCards([]);
    setTextRecs([]);
    setAnalyzing(false);
    setPendingPreview("");
  };

  const handleStart = async () => {
    resetSession();
    sessionStartRef.current = Date.now();
    goToScreen("live");

    // Notify backend to start session
    send({ type: "session:start", config: { mode: "online", sampleRate: 16000, channels: 1, noiseSuppression: true, autoGain: true, language: sttLanguage } });

    // Start real audio capture in renderer (getUserMedia → base64 WAV → WS)
    try {
      await startCapture();
    } catch {
      console.warn("[App] Renderer audio capture failed — falling back to stub");
    }

    // Also try Electron IPC audio capture (stub for now)
    try {
      await window.electronAPI?.startSession({
        mode: "online",
        sampleRate: 16000,
        channels: 1,
        noiseSuppression: true,
        autoGain: true,
      });
    } catch {
      // Audio capture may not be available in dev
    }
  };

  const handleStop = async () => {
    setCurrentCard(null);
    stopCapture();

    try {
      await window.electronAPI?.stopSession();
    } catch {
      // ignore
    }

    // Show processing screen while backend finalizes pending text
    goToScreen("processing");
    send({ type: "session:end" });

    // Fallback: if session:ended never arrives, go to recap after 15s
    setTimeout(() => {
      if (screenRef.current === "processing") {
        console.warn("[App] session:ended timeout — forcing recap");
        goToScreen("recap");
      }
    }, 15000);

    // Save to local session list
    const duration = Math.round((Date.now() - sessionStartRef.current) / 60000);
    const summary = cards.length > 0 ? cards[0].content.slice(0, 40) : "Untitled";
    setSessions((prev) => [
      {
        id: "session_" + Date.now(),
        date: new Date().toLocaleDateString(),
        durationMin: Math.max(1, duration),
        topicSummary: summary,
        mode: "online",
      },
      ...prev,
    ]);
  };

  const handleFlag = () => {
    const ts = Date.now() - sessionStartRef.current;
    const bm: Bookmark = {
      id: "bm_" + Date.now(),
      sessionId: "",
      userId: userId ?? "",
      timestamp: ts,
      note: null,
      cardId: currentCard?.id ?? null,
      createdAt: new Date(),
    };
    setBookmarks((prev) => [...prev, bm]);
    send({ type: "bookmark:create", timestamp: ts });
  };

  const handleTextAnalyze = async (text: string) => {
    setAnalyzing(true);
    setTextCards([]);
    setTextRecs([]);

    // Start a text-mode session first, then submit text
    send({ type: "session:start", config: { mode: "offline", sampleRate: 16000, channels: 1, noiseSuppression: false, autoGain: false, language: sttLanguage } });

    // Small delay to let session initialize, then submit text
    setTimeout(() => {
      send({ type: "text:submit", text });
    }, 200);

    // Wait for results via WebSocket (handled by handleServerEvent)
    // Set a timeout to show mock results if nothing comes back
    setTimeout(() => {
      setAnalyzing((prev) => {
        if (prev) {
          // No results came back — show the text as a basic card
          const mockCard: CoreMeaningCard = {
            id: "tc_" + Date.now(),
            sessionId: "",
            category: "factual_statement",
            content: text.slice(0, 100),
            sourceSegmentIds: [],
            linkedCardIds: [],
            linkType: null,
            topicId: "",
            visualizationFormat: "concise_text",
            isHighlighted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          setTextCards([mockCard]);
        }
        return false;
      });
    }, 10000); // 10s timeout
  };

  const handleExport = () => {
    const allCards = screen === "text" ? textCards : cards;
    const md = [
      "# Session Recap\n",
      ...allCards.map((c) => `- **[${c.category}]** ${c.content}`),
      "",
      "## Recommendations\n",
      ...recommendations.map((r) => `- ${r.text}`),
    ].join("\n");
    navigator.clipboard.writeText(md);
  };

  const handleEditCard = (cardId: string, content: string) => {
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, content, updatedAt: new Date() } : c))
    );
  };

  const fetchSessions = async (uid: string) => {
    try {
      const res = await fetch(`http://localhost:3000/api/sessions?userId=${uid}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setSessions(
            data.map((s: Record<string, unknown>) => ({
              id: s.id as string,
              date: new Date(s.startedAt as string).toLocaleDateString(),
              durationMin: Math.round((s.durationMs as number) / 60000),
              topicSummary: (s.topicSummary as string) || "Untitled",
              mode: s.mode as "online" | "offline" | "text",
            }))
          );
        }
      }
    } catch {
      // Backend not available — that's fine
    }
  };

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ⌘+Shift+S: Start/Stop
      if (e.metaKey && e.shiftKey && e.key === "s") {
        e.preventDefault();
        if (screen === "live") handleStop();
        else if (screen === "home") handleStart();
      }
      // ⌘+B: Flag
      if (e.metaKey && !e.shiftKey && e.key === "b" && screen === "live") {
        e.preventDefault();
        handleFlag();
      }
      // ⌘+T: Text Mode
      if (e.metaKey && !e.shiftKey && e.key === "t" && screen === "home") {
        e.preventDefault();
        goToScreen("text");
      }
      // ⌘+E: Export
      if (e.metaKey && !e.shiftKey && e.key === "e" && (screen === "recap" || screen === "text")) {
        e.preventDefault();
        handleExport();
      }
      // ⌘+/: Toggle expand panel
      if (e.metaKey && e.key === "/") {
        e.preventDefault();
        setPanelOpen((p) => !p);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // ── Render ──

  return (
    <div className="w-full h-full relative">
      {screen === "onboarding" && (
        <Onboarding onComplete={() => goToScreen("home")} />
      )}

      {screen === "home" && (
        <HomeScreen
          onStart={handleStart}
          onTextMode={() => {
            resetSession();
            goToScreen("text");
          }}
          audioSource={audioSource}
          onExpand={() => setPanelOpen(true)}
          panelOpen={panelOpen}
          onToggleAudioSource={() => setAudioSource((s) => s === "mic" ? "mic+system" : "mic")}
          sttLanguage={sttLanguage}
        />
      )}

      {screen === "live" && (
        <LiveSession
          cards={cards}
          currentCard={currentCard}
          recommendations={recommendations}
          speakers={speakers}
          isCapturing={isCapturing}
          audioError={audioError}
          analyser={analyser}
          onFlag={handleFlag}
          onStop={handleStop}
          pendingPreview={pendingPreview}
        />
      )}

      {screen === "processing" && (
        <div className="flex flex-col items-center justify-center h-full bg-background text-foreground gap-4">
          <span className="font-serif italic text-lg text-muted">Processing...</span>
          <div className="h-px bg-border overflow-hidden" style={{ animation: "expandLine 2s ease-in-out infinite" }} />
        </div>
      )}

      {screen === "recap" && (
        <RecapScreen
          cards={cards}
          recommendations={recommendations}
          bookmarks={bookmarks}
          speakers={speakers}
          onExport={handleExport}
          onClose={() => goToScreen("home")}
          onEditCard={handleEditCard}
        />
      )}

      {screen === "text" && (
        <TextModeScreen
          onAnalyze={handleTextAnalyze}
          onClose={() => {
            resetSession();
            goToScreen("home");
          }}
          cards={textCards}
          recommendations={textRecs}
          analyzing={analyzing}
        />
      )}

      {/* Expand panel overlay */}
      <ExpandPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        userId={userId ?? ""}
        isGuest={isGuest}
        sessions={sessions}
        onOpenSession={(id) => {
          setPanelOpen(false);
          goToScreen("recap");
        }}
        onLogin={handleLogin}
        onLogout={handleLogout}
        sttLanguage={sttLanguage}
        onSttLanguageChange={setSttLanguage}
      />


    </div>
  );
}
