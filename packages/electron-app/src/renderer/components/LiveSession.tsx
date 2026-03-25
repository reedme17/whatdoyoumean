/**
 * LiveSession — full canvas for active listening.
 * Core_Meaning_Cards stack vertically, auto-scroll, recommendation tokens,
 * bottom bar with listening indicator, flag, and stop.
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
  }, [cards, currentCard, autoScroll]);

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
        className="flex-1 overflow-y-auto px-5 py-4"
      >
        {cards.map((card) => (
          <CoreMeaningCardView key={card.id} card={card} speakerName={getSpeakerName(card)} />
        ))}

        {currentCard && (
          <CoreMeaningCardView card={currentCard} speakerName={getSpeakerName(currentCard)} isCurrent />
        )}

        {/* Pending text preview — shows accumulated transcript before card is finalized */}
        {pendingPreview && (
          <div className="px-4 py-3 mb-2 rounded-lg border border-dashed border-border text-sm text-muted opacity-70 italic">
            {pendingPreview}
          </div>
        )}

        {cards.length === 0 && !currentCard && !pendingPreview && (
          <div className="flex flex-col items-center justify-center h-full text-muted text-sm gap-2">
            {audioError ? (
              <>
                <span className="text-destructive">⚠ Mic error: {audioError}</span>
                <span>Waiting for speech...</span>
              </>
            ) : isCapturing ? (
              <>
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
                <span>Listening... speak into your microphone</span>
              </>
            ) : (
              <span>Waiting for speech...</span>
            )}
          </div>
        )}
      </div>

      <RecommendationTokens recommendations={recommendations} />
      <BottomBar onFlag={onFlag} onStop={onStop} analyser={analyser} isCapturing={isCapturing} />
    </div>
  );
}
