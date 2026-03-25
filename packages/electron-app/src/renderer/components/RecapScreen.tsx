/**
 * RecapScreen — post-session review.
 * Same layout as live session but cards are editable.
 * Export button, Close button, flagged moments.
 */

import React from "react";
import type { CoreMeaningCard, Recommendation, Bookmark } from "@wdym/shared";
import { CoreMeaningCardView } from "./CoreMeaningCard.js";
import { RecommendationTokens } from "./RecommendationTokens.js";
import { Button } from "./ui/button.js";
import { Badge } from "./ui/badge.js";
import { Separator } from "./ui/separator.js";

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
    <div className="flex flex-col h-full bg-background" role="main" aria-label="Session recap">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3">
        <span className="text-base font-semibold">Session Recap</span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onExport} title="Export (⌘E)" aria-label="Export session">
            Export
          </Button>
          <Button variant="ghost" onClick={onClose} title="Close" aria-label="Close recap">
            ✕
          </Button>
        </div>
      </div>
      <Separator />

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
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
          <div className="text-muted text-sm text-center mt-10">
            No cards in this session.
          </div>
        )}
      </div>

      {/* Flagged moments */}
      {bookmarks.length > 0 && (
        <>
          <Separator />
          <div className="px-5 py-2.5 text-xs text-muted">
            <span className="font-semibold">⚑ Flagged moments</span>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {bookmarks.map((bm) => (
                <Badge key={bm.id}>
                  {formatTimestamp(bm.timestamp)}
                  {bm.note ? ` — ${bm.note}` : ""}
                </Badge>
              ))}
            </div>
          </div>
        </>
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
