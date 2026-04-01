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
import { DownloadPopover } from "./components/DownloadPopover.js";

type Screen = "onboarding" | "home" | "live" | "recap" | "text" | "processing" ;

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
  const screenKeyRef = useRef(0);
  const [userId, setUserId] = useState<string | null>(null);
  const isGuest = userId === null;

  const goToScreen = useCallback((s: Screen) => {
    if (s === "home") screenKeyRef.current++;
    screenRef.current = s;
    setScreen(s);
  }, []);

  // ── Session state ──
  const [cards, setCards] = useState<CoreMeaningCard[]>([]);
  const [currentCard, setCurrentCard] = useState<CoreMeaningCard | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [speakers, setSpeakers] = useState<Map<string, string>>(new Map());
  const [speakerName, setSpeakerName] = useState("");
  const sessionStartRef = useRef<number>(0);
  const [audioSource, setAudioSource] = useState<"mic" | "internal" | "mic+internal">("mic");
  const [sttLanguage, setSttLanguage] = useState<SttLanguage>("en");
  const [responseEnabled, setResponseEnabled] = useState(true);

  const [pendingPreview, setPendingPreview] = useState<string>("");
  const [transcriptTexts, setTranscriptTexts] = useState<string[]>([]);

  // ── Text mode state ──
  const [textCards, setTextCards] = useState<CoreMeaningCard[]>([]);
  const [textRecs, setTextRecs] = useState<Recommendation[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [processingStage, setProcessingStage] = useState("");

  // ── Summary state ──
  const [sessionSummary, setSessionSummary] = useState("");
  const [textSummary, setTextSummary] = useState("");

  // ── Expand panel ──
  const [panelOpen, setPanelOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  // ── Per-group speaker name overrides from RecapScreen ──
  const [groupOverrides, setGroupOverrides] = useState<Map<number, { speakerKey: string; name: string }>>(new Map());

  // Refs for latest state (used in session save inside useCallback closure)
  const cardsRef = useRef<CoreMeaningCard[]>([]);
  cardsRef.current = cards;
  const recommendationsRef = useRef<Recommendation[]>([]);
  recommendationsRef.current = recommendations;
  const transcriptTextsRef = useRef<string[]>([]);
  transcriptTextsRef.current = transcriptTexts;
  const speakersRef = useRef<Map<string, string>>(new Map());
  speakersRef.current = speakers;
  const sessionSummaryRef = useRef("");
  sessionSummaryRef.current = sessionSummary;

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
        if (s === "text") {
          setTextCards((prev) => [...prev, newCard]);
        } else {
          setCards((prev) => [...prev, newCard]);
        }
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

      case "cards:consolidated": {
        const consolidated = (event as Extract<ServerEvent, { type: "cards:consolidated" }>).cards;
        const s = screenRef.current;
        if (s === "live" || s === "processing") {
          console.log(`[App] Cards consolidated: ${consolidated.length} cards`, consolidated.map(c => `${c.content?.slice(0,15)} spk=${c.speakerId}`));
          setCards(consolidated);
        }
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

      case "transcript:final": {
        const seg = (event as any).segment;
        // Only accumulate transcript for audio mode — text mode sets it in handleTextAnalyze
        if (seg?.text && screenRef.current !== "text") setTranscriptTexts((prev) => [...prev, seg.text]);
        // Track speaker from Deepgram diarization
        if (seg?.speakerId && seg.speakerId !== "user") {
          console.log(`[App] Speaker detected: ${seg.speakerId}`);
          setSpeakers((prev) => {
            if (prev.has(seg.speakerId)) return prev;
            const next = new Map(prev);
            const idx = next.size + 1;
            next.set(seg.speakerId, `Speaker ${idx}`);
            console.log(`[App] Speakers map now:`, [...next.entries()]);
            return next;
          });
        }
        break;
      }

      case "pending:preview":
        setPendingPreview((event as Extract<ServerEvent, { type: "pending:preview" }>).text);
        break;

      case "session:state": {
        const sessionState = (event as Extract<ServerEvent, { type: "session:state" }>).state;
        if (sessionState === "ended" && screenRef.current === "processing") {
          // Save session with final consolidated cards
          const duration = Math.round((Date.now() - sessionStartRef.current) / 60000);
          setSessions((prev) => {
            // Update the most recent session with final data, or remove if nothing captured
            if (prev.length > 0 && prev[0].mode === "online") {
              if (cardsRef.current.length === 0) {
                // Nothing captured — remove the placeholder session
                return prev.slice(1);
              }
              const updated = { ...prev[0], cards: [...cardsRef.current], recommendations: [...recommendationsRef.current], transcriptTexts: [...transcriptTextsRef.current], speakers: new Map(speakersRef.current), summary: sessionSummaryRef.current };
              return [updated, ...prev.slice(1)];
            }
            return prev;
          });
          // Brief delay so the last processing stage text is visible
          setTimeout(() => {
            if (screenRef.current === "processing") goToScreen("recap");
          }, 600);
        }
        break;
      }

      case "processing:progress":
        console.log("[App] processing:progress received:", (event as Extract<ServerEvent, { type: "processing:progress" }>).stage);
        setProcessingStage((event as Extract<ServerEvent, { type: "processing:progress" }>).stage);
        break;

      case "session:summary":
        const summaryText = (event as Extract<ServerEvent, { type: "session:summary" }>).summary;
        setSessionSummary(summaryText);
        setTextSummary(summaryText);
        break;

      default:
        break;
    }
  }, [currentCard]);

  const { send } = useSocket(handleServerEvent);

  // Send settings:update to backend when response toggle or language changes mid-session
  useEffect(() => {
    if (screen === "live") {
      send({ type: "settings:update", settings: { responseEnabled, sttLanguage } });
    }
  }, [responseEnabled, sttLanguage, screen, send]);

  // When response is toggled on in text results, request recommendations
  useEffect(() => {
    if (screen === "text" && responseEnabled && textCards.length > 0 && textRecs.length === 0) {
      send({ type: "recommendations:request" });
    }
  }, [responseEnabled, screen, textCards.length, textRecs.length, send]);

  // ── Audio capture (renderer-side mic → base64 WAV → backend via WS) ──
  const { startCapture, stopCapture, isCapturing, error: audioError, analyser } = useAudioCapture({ send, mode: "online", audioSource });

  // Save text mode session when analysis completes
  const prevTextCardsLen = useRef(0);
  useEffect(() => {
    if (screen === "text" && textCards.length > 0 && prevTextCardsLen.current === 0) {
      setSessions((prev) => [
        {
          id: "session_text_" + Date.now(),
          date: new Date().toLocaleDateString(),
          timestamp: Date.now(),
          durationMin: 0,
          topicSummary: textCards[0]?.content?.slice(0, 40) ?? "Text analysis",
          mode: "text",
          cards: [...textCards],
          recommendations: [...textRecs],
          transcriptTexts: [...transcriptTexts],
          summary: textSummary,
        },
        ...prev,
      ]);
    }
    prevTextCardsLen.current = textCards.length;
  }, [textCards.length]);

  // Update most recent session's summary when it arrives (may come after initial save)
  useEffect(() => {
    if (!textSummary && !sessionSummary) return;
    setSessions((prev) => {
      if (prev.length === 0) return prev;
      const latest = prev[0];
      const newSummary = latest.mode === "text" ? textSummary : sessionSummary;
      if (!newSummary || latest.summary === newSummary) return prev;
      return [{ ...latest, summary: newSummary }, ...prev.slice(1)];
    });
  }, [textSummary, sessionSummary]);

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
    setTranscriptTexts([]);
    setAnalyzing(false);
    setPendingPreview("");
    setSpeakerName("");
    setSpeakers(new Map());
    setSessionSummary("");
    setTextSummary("");
  };

  const handleStart = async () => {
    resetSession();
    sessionStartRef.current = Date.now();
    goToScreen("live");

    // Notify backend to start session
    send({ type: "session:start", config: { mode: "online", sampleRate: 16000, channels: 1, noiseSuppression: true, autoGain: true, language: sttLanguage, responseEnabled } });

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
    setProcessingStage("");
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
        timestamp: Date.now(),
        durationMin: Math.max(1, duration),
        topicSummary: summary,
        mode: "online",
        cards: [...cards],
        recommendations: [...recommendations],
        transcriptTexts: [...transcriptTexts],
        speakers: new Map(speakers),
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
    // Backend handles highlighting — either marks the last card (card:updated)
    // or force-finalizes pending text and marks the new card (card:created with isHighlighted)
  };

  const handleTextAnalyze = async (text: string) => {
    setAnalyzing(true);
    setTextCards([]);
    setTextRecs([]);
    setTranscriptTexts([text]);

    // Start a text-mode session first, then submit text
    send({ type: "session:start", config: { mode: "offline", sampleRate: 16000, channels: 1, noiseSuppression: false, autoGain: false, language: sttLanguage, responseEnabled } });

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
            category: "fact",
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
    const allRecs = screen === "text" ? textRecs : recommendations;
    const sections = [
      "# WDYM - 啥意思\n",
      ...allCards.map((c) => `- **[${c.category}]** ${c.content}`),
      "",
    ];
    if (allRecs.length > 0) {
      sections.push("## Recommendations\n", ...allRecs.map((r) => `- ${r.text}`), "");
    }
    if (transcriptTexts.length > 0) {
      sections.push("## Original Transcript\n", transcriptTexts.join(" "), "");
    }
    navigator.clipboard.writeText(sections.join("\n"));
  };

  const handleExportMd = () => {
    const allCards = screen === "text" ? textCards : cards;
    const allRecs = screen === "text" ? textRecs : recommendations;
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");

    const sections: string[] = [
      `# WDYM - 啥意思`,
      `> ${dateStr} ${now.toTimeString().slice(0, 8)}\n`,
    ];

    // Analysis results — group cards by speaker runs (same as RecapScreen)
    const isAudioMode = screen !== "text";
    sections.push("## Analysis\n");

    if (isAudioMode) {
      // Build speaker runs for export
      const exportGroups: { speakerKey: string; cards: typeof allCards }[] = [];
      for (const c of allCards) {
        const spkKey = c.speakerId ?? "";
        const last = exportGroups[exportGroups.length - 1];
        if (last && last.speakerKey === spkKey) {
          last.cards.push(c);
        } else {
          exportGroups.push({ speakerKey: spkKey, cards: [c] });
        }
      }
      for (let gi = 0; gi < exportGroups.length; gi++) {
        const g = exportGroups[gi];
        // Check per-group override first, then speakers Map, then default
        const override = groupOverrides.get(gi);
        const name = (override?.speakerKey === g.speakerKey ? override.name : null)
          ?? speakers.get(g.speakerKey) ?? (speakerName || "Speaker 1");
        sections.push(`### ${name}\n`);
        for (const c of g.cards) {
          const mark = c.isHighlighted ? " ⭐" : "";
          sections.push(`- **${c.category}**${mark} — ${c.content}`);
        }
        sections.push("");
      }
    } else {
      for (const c of allCards) {
        const mark = c.isHighlighted ? " ⭐" : "";
        sections.push(`- **${c.category}**${mark} — ${c.content}`);
      }
      sections.push("");
    }

    // Recommendations
    if (allRecs.length > 0) {
      sections.push("## Response Recommendations\n");
      for (const r of allRecs) {
        sections.push(`- ${r.text}`);
      }
      sections.push("");
    }

    // Original transcript
    sections.push("## Original Transcript\n");
    if (transcriptTexts.length > 0) {
      sections.push(transcriptTexts.join(" "));
    } else {
      sections.push("_(No transcript recorded)_");
    }
    sections.push("");

    const md = sections.join("\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wdym-${dateStr}-${timeStr}.md`;
    a.click();
    URL.revokeObjectURL(url);
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
              timestamp: new Date(s.startedAt as string).getTime(),
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
        <div key={`home-${screenKeyRef.current}`} className="screen-enter h-full">
        <HomeScreen
          onStart={handleStart}
          onTextMode={() => {
            resetSession();
            goToScreen("text");
          }}
          onExpand={() => setPanelOpen(true)}
          panelOpen={panelOpen}
        />
        </div>
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
          onSpeakerRename={(name) => {
            setSpeakerName(name);
            // Update all known speaker entries with the custom name
            setSpeakers((prev) => {
              const next = new Map(prev);
              for (const key of next.keys()) {
                next.set(key, name);
              }
              // Also ensure speaker_0 is set (most common single-speaker case)
              if (next.size === 0) next.set("speaker_0", name);
              return next;
            });
          }}
          speakerName={speakerName}
          pendingPreview={pendingPreview}
          sttLanguage={sttLanguage}
          onSttLanguageChange={setSttLanguage}
          responseEnabled={responseEnabled}
          onResponseEnabledChange={setResponseEnabled}
          audioSource={audioSource}
          onAudioSourceChange={setAudioSource}
          sessionStartTime={sessionStartRef.current}
        />
      )}

      {screen === "processing" && (
        <div key="processing" className="screen-enter flex flex-col items-center justify-center h-full bg-background text-foreground gap-4">
          <span
            key={processingStage}
            className="font-sans text-sm text-[#93918E]"
            style={{ animation: "stageFadeIn 0.8s ease-out" }}
          >
            {processingStage || "Wrapping up..."}
          </span>
        </div>
      )}

      {screen === "recap" && (
        <div key="recap" className="screen-enter h-full">
        <RecapScreen
          cards={cards}
          recommendations={recommendations}
          bookmarks={bookmarks}
          speakers={speakers}
          onExport={handleExport}
          onClose={() => goToScreen("home")}
          onAction={() => {
            handleStart();
          }}
          onEditCard={handleEditCard}
          speakerName={speakerName}
          summary={sessionSummary}
          topRightContent={<DownloadPopover onCopy={handleExport} onExportMd={handleExportMd} />}
          onSpeakerRename={(key, name) => {
            setSpeakers((prev) => {
              const next = new Map(prev);
              next.set(key, name);
              return next;
            });
          }}
          onGroupOverridesChange={setGroupOverrides}
          onToggleMark={(cardId) => {
            setCards((prev) => prev.map((c) => c.id === cardId ? { ...c, isHighlighted: !c.isHighlighted } : c));
          }}
        />
        </div>
      )}


      {screen === "text" && (
        <div key="text" className="screen-enter h-full">
        <TextModeScreen
          onAnalyze={handleTextAnalyze}
          onClose={() => {
            resetSession();
            goToScreen("home");
          }}
          onReset={() => {
            setTextCards([]);
            setTextRecs([]);
          }}
          cards={textCards}
          recommendations={textRecs}
          analyzing={analyzing}
          responseEnabled={responseEnabled}
          onResponseEnabledChange={setResponseEnabled}
          onExportMd={handleExportMd}
          onToggleMark={(cardId) => {
            setTextCards((prev) => prev.map((c) => c.id === cardId ? { ...c, isHighlighted: !c.isHighlighted } : c));
          }}
          summary={textSummary}
        />
        </div>
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
        responseEnabled={responseEnabled}
        onResponseEnabledChange={setResponseEnabled}
        audioSource={audioSource}
        onAudioSourceChange={setAudioSource}
        onViewOnboarding={() => goToScreen("onboarding")}
      />


    </div>
  );
}
