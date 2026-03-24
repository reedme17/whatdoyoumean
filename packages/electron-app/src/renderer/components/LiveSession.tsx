/**
 * LiveSession — full canvas for active listening.
 * Core_Meaning_Cards stack vertically, auto-scroll, recommendation tokens,
 * bottom bar with listening indicator, flag, and stop.
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import type { CoreMeaningCard, Recommendation, Bookmark } from "@wdym/shared";
import { CoreMeaningCardView } from "./CoreMeaningCard.js";
import { RecommendationTokens } from "./RecommendationTokens.js";
import { BottomBar } from "./BottomBar.js";
import { colors } from "../styles.js";

interface Props {
  cards: CoreMeaningCard[];
  currentCard: CoreMeaningCard | null;
  recommendations: Recommendation[];
  speakers: Map<string, string>;
  isCapturing?: boolean;
  audioError?: string | null;
  onFlag: () => void;
  onStop: () => void;
}

export function LiveSession({
  cards,
  currentCard,
  recommendations,
  speakers,
  isCapturing = false,
  audioError = null,
  onFlag,
  onStop,
}: Props): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new cards arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [cards, currentCard, autoScroll]);

  // Pause auto-scroll when user scrolls up
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(atBottom);
  }, []);

  const getSpeakerName = (card: CoreMeaningCard) => {
    // Derive speaker from first source segment's speaker
    // For now use a simple mapping
    const segId = card.sourceSegmentIds[0];
    return speakers.get(segId ?? "") ?? "Speaker";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: colors.bg }} role="main" aria-label="Live session">
      {/* Canvas area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-label="Conversation flow"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
        }}
      >
        {/* Finalized cards */}
        {cards.map((card) => (
          <CoreMeaningCardView
            key={card.id}
            card={card}
            speakerName={getSpeakerName(card)}
          />
        ))}

        {/* Current (in-progress) card */}
        {currentCard && (
          <CoreMeaningCardView
            card={currentCard}
            speakerName={getSpeakerName(currentCard)}
            isCurrent
          />
        )}

        {/* Empty state */}
        {cards.length === 0 && !currentCard && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: colors.muted,
              fontSize: 14,
              gap: 8,
            }}
          >
            {audioError ? (
              <>
                <span style={{ color: "#dc2626" }}>⚠ Mic error: {audioError}</span>
                <span>Waiting for speech...</span>
              </>
            ) : isCapturing ? (
              <>
                <span style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#dc2626",
                  animation: "pulse 1.5s infinite",
                }} />
                <span>Listening... speak into your microphone</span>
              </>
            ) : (
              <span>Waiting for speech...</span>
            )}
          </div>
        )}
      </div>

      {/* Recommendation tokens */}
      <RecommendationTokens recommendations={recommendations} />

      {/* Bottom bar */}
      <BottomBar onFlag={onFlag} onStop={onStop} />
    </div>
  );
}
