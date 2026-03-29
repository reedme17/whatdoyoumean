/**
 * CoreMeaningCard — inline category + content style.
 * Category italic 11px, content medium 14px, baseline aligned.
 */

import React, { useState } from "react";
import type { CoreMeaningCard as CardType, MeaningCategory } from "@wdym/shared";
import { Input } from "./ui/input.js";
import { Button } from "./ui/button.js";

export const categoryLabels: Record<MeaningCategory, string> = {
  fact: "Fact",
  opinion: "Opinion",
  question: "Question",
  decision: "Decision",
  action_item: "To do",
  proposal: "Proposal",
};

interface Props {
  card: CardType;
  speakerName?: string;
  editable?: boolean;
  isCurrent?: boolean;
  onEdit?: (cardId: string, content: string) => void;
  animateHighlight?: boolean;
  highlightIndex?: number;
  badgeWidth?: number;
}

export function CoreMeaningCardView({
  card,
  editable = false,
  onEdit,
  animateHighlight = false,
  highlightIndex = 0,
  badgeWidth,
}: Props): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(card.content);

  const handleSave = () => {
    onEdit?.(card.id, editText);
    setEditing(false);
  };

  return (
    <div
      className="flex gap-[8px] items-baseline text-[#60594D]"
      style={{ animation: "fadeInUp 0.3s ease-out" }}
    >
      {/* Category — italic 11px */}
      <span
        className="font-sans italic text-[11px] whitespace-nowrap shrink-0 inline-block"
        style={badgeWidth ? { width: badgeWidth } : { width: 48 }}
      >
        {categoryLabels[card.category]}
      </span>

      {/* Content — medium 14px */}
      {editing ? (
        <div className="flex gap-2 flex-1">
          <Input
            className="flex-1 text-sm"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus
            aria-label="Edit card content"
          />
          <Button variant="outline" size="sm" onClick={handleSave}>Save</Button>
        </div>
      ) : (
        <span
          className={`font-sans font-medium text-sm ${editable ? "cursor-pointer hover:text-muted transition-colors" : ""} ${card.isHighlighted ? (animateHighlight ? "highlighter-mark animate-draw" : "highlighter-mark") : ""}`}
          style={card.isHighlighted && animateHighlight ? { animationDelay: `${highlightIndex * 0.3 + 0.5}s` } : undefined}
          onClick={() => editable && setEditing(true)}
          title={editable ? "Click to edit" : undefined}
        >
          {card.content}
        </span>
      )}
    </div>
  );
}

/** Compute badge width (px) based on the longest label among given cards */
export function computeBadgeWidth(cards: CardType[]): number {
  // Approximate widths in px at italic 11px (measured)
  const labelWidths: Record<string, number> = {
    "Fact": 22,
    "Opinion": 38,
    "Question": 44,
    "Decision": 44,
    "To do": 26,
    "Proposal": 44,
  };
  let maxW = 0;
  const seen = new Set<string>();
  for (const c of cards) {
    const label = categoryLabels[c.category];
    if (seen.has(label)) continue;
    seen.add(label);
    maxW = Math.max(maxW, labelWidths[label] ?? 40);
  }
  return maxW || 22;
}
