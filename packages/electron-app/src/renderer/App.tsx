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
import { LoginScreen } from "./components/LoginScreen.js";
import { HomeScreen } from "./components/HomeScreen.js";
import { LiveSession } from "./components/LiveSession.js";
import { RecapScreen } from "./components/RecapScreen.js";
import { TextModeScreen } from "./components/TextModeScreen.js";
import { ExpandPanel, type SessionSummary } from "./components/ExpandPanel.js";

type Screen = "home" | "live" | "recap" | "text";

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
  const [screen, setScreen] = useState<Screen>("home");
  const [userId, setUserId] = useState<string | null>(null);
  const isGuest = userId === null;

  // ── Session state ──
  const [cards, setCards] = useState<CoreMeaningCard[]>([]);
  const [currentCard, setCurrentCard] = useState<CoreMeaningCard | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [speakers] = useState<Map<string, string>>(new Map());
  const sessionStartRef = useRef<number>(0);

  // ── Text mode state ──
  const [textCards, setTextCards] = useState<CoreMeaningCard[]>([]);
  const [textRecs, setTextRecs] = useState<Recommendation[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  // ── Expand panel ──
  const [panelOpen, setPanelOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  // ── WebSocket ──
  const handleServerEvent = useCallback((event: ServerEvent) => {
    switch (event.type) {
      case "card:created":
        // Finalize current card, push to stack
        if (currentCard) {
          setCards((prev) => [...prev, currentCard]);
        }
        setCurrentCard((event as Extract<ServerEvent, { type: "card:created" }>).card);
        break;

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
        break;

      default:
        break;
    }
  }, [currentCard]);

  const { send } = useSocket(handleServerEvent);

  // ── Handlers ──

  const handleLogin = (id: string) => {
    setUserId(id);
    // Stay on current screen — just unlock features
    fetchSessions(id);
  };

  const handleLogout = () => {
    setUserId(null);
    // Stay on home, revert to guest mode
    setScreen("home");
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
  };

  const handleStart = async () => {
    resetSession();
    sessionStartRef.current = Date.now();
    setScreen("live");

    // Start audio capture via Electron IPC
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

    // Notify backend
    send({ type: "session:start", config: { mode: "online", sampleRate: 16000, channels: 1, noiseSuppression: true, autoGain: true } });
  };

  const handleStop = async () => {
    // Finalize current card into the stack
    if (currentCard) {
      setCards((prev) => [...prev, currentCard]);
      setCurrentCard(null);
    }

    // Stop audio capture
    try {
      await window.electronAPI?.stopSession();
    } catch {
      // ignore
    }

    send({ type: "session:end" });
    setScreen("recap");

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

    // Send text to backend via WebSocket
    send({ type: "text:submit", text });

    // Also try REST fallback for text mode
    try {
      const res = await fetch("http://localhost:3000/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "text", text, userId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.cards) setTextCards(data.cards);
        if (data.recommendations) setTextRecs(data.recommendations);
      }
    } catch {
      // Backend may not be running — show mock results
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

    setAnalyzing(false);
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
        setScreen("text");
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
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {screen === "home" && (
        <HomeScreen
          onStart={handleStart}
          onTextMode={() => {
            resetSession();
            setScreen("text");
          }}
          onExpand={() => setPanelOpen(true)}
        />
      )}

      {screen === "live" && (
        <LiveSession
          cards={cards}
          currentCard={currentCard}
          recommendations={recommendations}
          speakers={speakers}
          onFlag={handleFlag}
          onStop={handleStop}
        />
      )}

      {screen === "recap" && (
        <RecapScreen
          cards={cards}
          recommendations={recommendations}
          bookmarks={bookmarks}
          speakers={speakers}
          onExport={handleExport}
          onClose={() => setScreen("home")}
          onEditCard={handleEditCard}
        />
      )}

      {screen === "text" && (
        <TextModeScreen
          onAnalyze={handleTextAnalyze}
          onClose={() => {
            resetSession();
            setScreen("home");
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
          setScreen("recap");
        }}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />
    </div>
  );
}
