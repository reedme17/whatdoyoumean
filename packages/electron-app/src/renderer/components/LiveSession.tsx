/**
 * LiveSession — editorial live canvas.
 * Cards as pull quotes, pending preview in italic, waveform bottom bar.
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import type { CoreMeaningCard, Recommendation } from "@wdym/shared";
import { CoreMeaningCardView } from "./CoreMeaningCard.js";
import { RecommendationTokens } from "./RecommendationTokens.js";
import { BottomBar } from "./BottomBar.js";

interface Props {
  cards: CoreMeaningCard[];
  currentCard: CoreMeaningCard | null;
  recommendations: Recommendation[];
  speakers: Map<string, string>;
  isCapturing?: boolean;
  audioError?: string | null;
  analyser?: AnalyserNode | null;
  onFlag: () => void;
  onStop: () => void;
  pendingPreview?: string;
}

export function LiveSession({
  cards,
  currentCard,
  recommendations,
  speakers,
  isCapturing = false,
  audioError = null,
  analyser = null,
  onFlag,
  onStop,
  pendingPreview = "",
}: Props): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [cards, currentCard, autoScroll, pendingPreview]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(atBottom);
  }, []);

  const getSpeakerName = (card: CoreMeaningCard) => {
    const segId = card.sourceSegmentIds[0];
    return speakers.get(segId ?? "") ?? "Speaker";
  };

  return (
    <div className="flex flex-col h-full bg-background" role="main" aria-label="Live session">
      {/* Canvas area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-label="Conversation flow"
        className="flex-1 overflow-y-auto px-8 py-6"
      >
        {cards.map((card) => (
          <CoreMeaningCardView key={card.id} card={card} speakerName={getSpeakerName(card)} />
        ))}

        {currentCard && (
          <CoreMeaningCardView card={currentCard} speakerName={getSpeakerName(currentCard)} isCurrent />
        )}

        {/* Pending text preview — italic, pulsing opacity */}
        {pendingPreview && (
          <div
            className="py-4 font-serif italic text-muted text-base leading-relaxed"
            style={{ animation: "gentlePulse 2s ease-in-out infinite" }}
          >
            {pendingPreview}
          </div>
        )}

        {/* Empty state */}
        {cards.length === 0 && !currentCard && !pendingPreview && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            {audioError ? (
              <>
                <span className="text-[var(--color-editorial-red)] text-sm font-sans">⚠ {audioError}</span>
                <span className="text-xs text-muted font-sans">Waiting for speech...</span>
              </>
            ) : isCapturing ? (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--color-editorial-red)] animate-pulse" />
                <span className="text-xs text-muted tracking-[0.1em] uppercase font-sans">Listening</span>
              </>
            ) : (
              <span className="text-xs text-muted tracking-[0.1em] uppercase font-sans">Waiting for speech</span>
            )}
          </div>
        )}
      </div>

      <RecommendationTokens recommendations={recommendations} />
      <BottomBar onFlag={onFlag} onStop={onStop} analyser={analyser} isCapturing={isCapturing} />
    </div>
  );
}
