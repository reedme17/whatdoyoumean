/**
 * LiveSession — listening screen.
 * Cards appear in history area when created. Bottom bar shrinks back.
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
  recommendations,
  isCapturing = false,
  audioError = null,
  analyser = null,
  onFlag,
  onStop,
  pendingPreview = "",
}: Props): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const pendingTextRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [cards, autoScroll, pendingPreview]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  }, []);

  return (
    <div className="flex flex-col h-full bg-background" role="main" aria-label="Live session">
      {/* Card area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-label="Conversation flow"
        className="flex-1 flex flex-col justify-start overflow-y-auto px-[20px]"
      >
        <div className="flex flex-col gap-[10px]">
          {cards.length > 0 && (
            <div className="flex flex-col gap-[10px] px-[20px] py-[12px]">
              <div className="flex items-baseline gap-[10px]">
                <span className="font-sans font-semibold text-sm text-[#60594D]">Speaker 1</span>
              </div>
              <div className="flex flex-col gap-[8px]">
                {cards.map((card, i) => (
                  <React.Fragment key={card.id}>
                    {i > 0 && <div className="w-full h-px bg-border" />}
                    <CoreMeaningCardView card={card} />
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Empty state */}
        {cards.length === 0 && !pendingPreview && (
          <div className="flex flex-col items-center justify-center flex-1 gap-3">
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

      <BottomBar
        onFlag={onFlag}
        onStop={onStop}
        analyser={analyser}
        isCapturing={isCapturing}
        pendingPreview={pendingPreview}
        pendingTextRef={pendingTextRef}
      />
    </div>
  );
}
