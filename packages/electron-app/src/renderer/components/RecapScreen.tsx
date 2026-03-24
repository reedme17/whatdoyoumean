/**
 * RecapScreen — post-session review.
 * Same layout as live session but cards are editable.
 * Export button, Close button, flagged moments.
 */

import React from "react";
import type { CoreMeaningCard, Recommendation, Bookmark } from "@wdym/shared";
import { CoreMeaningCardView } from "./CoreMeaningCard.js";
import { RecommendationTokens } from "./RecommendationTokens.js";
import { base, colors } from "../styles.js";

interface Props {
  cards: CoreMeaningCard[];
  recommendations: Recommendation[];
  bookmarks: Bookmark[];
  speakers: Map<string, string>;
  onExport: () => void;
  onClose: () => void;
  onEditCard: (cardId: string, content: string) => void;
}

export function RecapScreen({
  cards,
  recommendations,
  bookmarks,
  speakers,
  onExport,
  onClose,
  onEditCard,
}: Props): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: colors.bg }} role="main" aria-label="Session recap">
      {/* Top bar */}
      <div style={base.topBar}>
        <span style={base.heading}>Session Recap</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={base.btnOutline} onClick={onExport} title="Export (⌘E)" aria-label="Export session">
            Export
          </button>
          <button style={base.btnGhost} onClick={onClose} title="Close" aria-label="Close recap">
            ✕
          </button>
        </div>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {cards.map((card) => (
          <CoreMeaningCardView
            key={card.id}
            card={card}
            speakerName={speakers.get(card.sourceSegmentIds[0] ?? "") ?? "Speaker"}
            editable
            onEdit={onEditCard}
          />
        ))}

        {cards.length === 0 && (
          <div style={{ color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 40 }}>
            No cards in this session.
          </div>
        )}
      </div>

      {/* Recommendations */}
      <RecommendationTokens recommendations={recommendations} />

      {/* Flagged moments */}
      {bookmarks.length > 0 && (
        <div
          style={{
            padding: "10px 20px",
            borderTop: `1px solid ${colors.border}`,
            fontSize: 12,
            color: colors.muted,
          }}
        >
          <span style={{ fontWeight: 600 }}>⚑ Flagged moments</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            {bookmarks.map((bm) => (
              <span key={bm.id} style={base.badge}>
                {formatTimestamp(bm.timestamp)}
                {bm.note ? ` — ${bm.note}` : ""}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}
