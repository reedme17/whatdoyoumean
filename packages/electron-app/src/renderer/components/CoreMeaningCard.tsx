/**
 * CoreMeaningCard — editorial pull quote style.
 * Category as uppercase section label, speaker as italic byline, content in serif.
 */

import React, { useState } from "react";
import type { CoreMeaningCard as CardType, MeaningCategory } from "@wdym/shared";
import { Input } from "./ui/input.js";
import { Button } from "./ui/button.js";
import { cn } from "../lib/utils.js";

const categoryLabels: Record<MeaningCategory, string> = {
  factual_statement: "Fact",
  opinion: "Opinion",
  question: "Question",
  decision: "Decision",
  action_item: "Action",
  disagreement: "Disagree",
};

interface Props {
  card: CardType;
  speakerName?: string;
  editable?: boolean;
  isCurrent?: boolean;
  onEdit?: (cardId: string, content: string) => void;
}

export function CoreMeaningCardView({
  card,
  speakerName,
  editable = false,
  isCurrent = false,
  onEdit,
}: Props): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(card.content);

  const handleSave = () => {
    onEdit?.(card.id, editText);
    setEditing(false);
  };

  const isAccent = card.category === "disagreement" || card.category === "action_item";

  return (
    <article
      aria-label={`${categoryLabels[card.category]} card: ${card.content.slice(0, 40)}`}
      className="py-5 border-b border-border"
      style={{ animation: "fadeInUp 0.3s ease-out" }}
    >
      {/* Category label — uppercase, letter-spaced */}
      <div className="flex items-center gap-3 mb-1.5">
        <span
          className={cn(
            "text-[10px] tracking-[0.15em] uppercase font-semibold font-sans",
            isAccent ? "text-[var(--color-editorial-red)]" : "text-muted"
          )}
        >
          {categoryLabels[card.category]}
        </span>
        {card.isHighlighted && <span className="text-[var(--color-editorial-red)]">★</span>}
      </div>

      {/* Speaker byline — italic */}
      {speakerName && (
        <div className="text-xs italic text-muted mb-2 font-sans">
          {speakerName}
        </div>
      )}

      {/* Content — serif pull quote */}
      {editing ? (
        <div className="flex gap-2">
          <Input
            className="flex-1"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus
            aria-label="Edit card content"
          />
          <Button variant="outline" size="sm" onClick={handleSave}>Save</Button>
        </div>
      ) : (
        <div
          className={cn(
            "font-serif text-base leading-relaxed",
            isCurrent && "text-foreground",
            editable && "cursor-pointer hover:text-muted transition-colors"
          )}
          onClick={() => editable && setEditing(true)}
          title={editable ? "Click to edit" : undefined}
        >
          {card.content}
        </div>
      )}

      {/* Link indicator */}
      {card.linkType && (
        <div className="text-[11px] text-muted mt-2 font-sans italic">
          {card.linkType === "contradicts" && "⟷ Contradicts previous point"}
          {card.linkType === "modifies" && "↻ Modifies previous point"}
          {card.linkType === "extends" && "→ Extends previous point"}
        </div>
      )}
    </article>
  );
}
