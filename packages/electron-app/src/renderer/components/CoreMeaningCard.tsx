/**
 * CoreMeaningCard — inline category + content style.
 * Category italic 11px, content medium 14px, baseline aligned.
 */

import React, { useState } from "react";
import type { CoreMeaningCard as CardType, MeaningCategory } from "@wdym/shared";
import { Input } from "./ui/input.js";
import { Button } from "./ui/button.js";

const categoryLabels: Record<MeaningCategory, string> = {
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
}

export function CoreMeaningCardView({
  card,
  editable = false,
  onEdit,
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
      <span className="font-sans italic text-[11px] whitespace-nowrap shrink-0 inline-block w-[48px]">
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
          className={`font-sans font-medium text-sm ${editable ? "cursor-pointer hover:text-muted transition-colors" : ""}`}
          onClick={() => editable && setEditing(true)}
          title={editable ? "Click to edit" : undefined}
        >
          {card.content}
        </span>
      )}
    </div>
  );
}
