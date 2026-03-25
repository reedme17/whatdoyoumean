/**
 * RecapScreen — editorial post-session review.
 * Serif heading, editable pull-quote cards, flagged moments.
 */

import React from "react";
import type { CoreMeaningCard, Recommendation, Bookmark } from "@wdym/shared";
import { CoreMeaningCardView } from "./CoreMeaningCard.js";
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
      <div className="flex items-center justify-between px-8 py-5">
        <h1 className="font-serif text-2xl font-normal">Session Recap</h1>
        <div className="flex gap-4">
          <button
            className="text-xs tracking-[0.15em] uppercase text-muted hover:text-foreground transition-colors cursor-pointer bg-transparent border-none font-sans"
            onClick={onExport}
            title="Export (⌘E)"
            aria-label="Export session"
          >
            Export
          </button>
          <button
            className="text-muted hover:text-foreground transition-colors cursor-pointer bg-transparent border-none"
            onClick={onClose}
            title="Close"
            aria-label="Close recap"
          >
            ✕
          </button>
        </div>
      </div>
      <Separator />

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-8 py-4">
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
          <div className="text-muted text-sm text-center mt-16 font-serif italic">
            No cards in this session.
          </div>
        )}
      </div>

      {/* Flagged moments */}
      {bookmarks.length > 0 && (
        <>
          <Separator />
          <div className="px-8 py-3 text-xs text-muted font-sans">
            <span className="font-semibold text-[var(--color-editorial-red)]">⚑</span>
            <span className="ml-2 tracking-[0.1em] uppercase">Flagged moments</span>
            <div className="flex flex-wrap gap-3 mt-2">
              {bookmarks.map((bm) => (
                <span key={bm.id} className="text-xs text-muted">
                  {formatTimestamp(bm.timestamp)}
                  {bm.note ? ` — ${bm.note}` : ""}
                </span>
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
