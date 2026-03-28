/**
 * RecapScreen — editorial post-session review.
 * Matches Figma design: Session recap title, speaker blocks with cards, bottom bar.
 */

import React, { useState, useEffect } from "react";
import type { CoreMeaningCard, Recommendation, Bookmark } from "@wdym/shared";
import { CoreMeaningCardView } from "./CoreMeaningCard.js";
import { XIcon } from "./ui/x-icon.js";

interface Props {
  cards: CoreMeaningCard[];
  recommendations: Recommendation[];
  bookmarks: Bookmark[];
  speakers: Map<string, string>;
  onExport: () => void;
  onClose: () => void;
  onAction?: () => void;
  onEditCard: (cardId: string, content: string) => void;
  title?: string;
  actionLabel?: string;
  showSpeakers?: boolean;
}

export function RecapScreen({
  cards,
  bookmarks,
  speakers,
  onExport,
  onClose,
  onAction,
  onEditCard,
  title = "Session recap",
  actionLabel = "New session",
  showSpeakers = true,
}: Props): React.JSX.Element {
  // Suppress hover on X icon for 300ms after mount (End button overlaps X position)
  const [xReady, setXReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setXReady(true), 300); return () => clearTimeout(t); }, []);

  // Group cards by speaker
  const speakerGroups: { speaker: string; cards: CoreMeaningCard[] }[] = [];
  for (const card of cards) {
    const speaker = speakers.get(card.sourceSegmentIds[0] ?? "") ?? "Speaker 1";
    const last = speakerGroups[speakerGroups.length - 1];
    if (last && last.speaker === speaker) {
      last.cards.push(card);
    } else {
      speakerGroups.push({ speaker, cards: [card] });
    }
  }

  return (
    <div className="flex flex-col h-full bg-background" role="main" aria-label="Session recap">
      {/* Content area */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Title */}
        <div className="pl-[20px] pt-[12px] shrink-0">
          <h1 className="font-serif font-normal text-[20px] text-[#60594D]">{title}</h1>
        </div>

        {/* Speaker blocks */}
        <div className="flex flex-col gap-[10px] px-[20px]">
          {speakerGroups.map((group, gi) => (
            <div key={gi} className="flex flex-col gap-[10px] px-[20px] py-[12px]">
              <div className="flex items-baseline gap-[10px]">
                {showSpeakers && <span className="font-sans font-semibold text-sm text-[#60594D]">{group.speaker}</span>}
              </div>
              <div className="flex flex-col gap-[8px]">
                {group.cards.map((card, i) => (
                  <React.Fragment key={card.id}>
                    {i > 0 && <div className="w-full h-px bg-border" />}
                    <CoreMeaningCardView card={card} />
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}

          {cards.length === 0 && (
            <div className="text-muted text-sm text-center mt-16 font-serif italic">
              No cards in this session.
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-[20px] pt-[12px] pb-[20px] shrink-0">
        <button
          className="font-sans font-bold text-sm text-[#5B5449] hover:text-foreground transition-colors cursor-pointer bg-transparent border-none p-0"
          onClick={onAction ?? onClose}
        >
          {actionLabel}
        </button>
        <button
          className="text-muted hover:text-foreground transition-colors cursor-pointer bg-transparent border-none"
          style={xReady ? undefined : { pointerEvents: "none" }}
          onClick={onClose}
          aria-label="Close recap"
        >
          <XIcon size={20} />
        </button>
      </div>
    </div>
  );
}
