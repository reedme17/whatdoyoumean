/**
 * CoreMeaningCard — displays a single meaning card.
 * Shows category badge, speaker label, content, and optional edit mode.
 */

import React, { useState } from "react";
import type { CoreMeaningCard as CardType, MeaningCategory } from "@wdym/shared";
import { Card, CardHeader, CardContent } from "./ui/card.js";
import { Badge } from "./ui/badge.js";
import { Button } from "./ui/button.js";
import { Input } from "./ui/input.js";
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

  return (
    <Card
      role="article"
      aria-label={`${categoryLabels[card.category]} card: ${card.content.slice(0, 40)}`}
      className={cn("mb-2 transition-opacity duration-200", isCurrent ? "border-foreground" : "opacity-95")}
    >
      <CardHeader>
        {speakerName && <span className="font-semibold">{speakerName}</span>}
        <Badge role="status" className="text-[10px] px-2 py-0">
          {categoryLabels[card.category]}
        </Badge>
        {card.isHighlighted && <span>★</span>}
      </CardHeader>

      <CardContent>
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
            <Button variant="outline" onClick={handleSave}>Save</Button>
          </div>
        ) : (
          <div
            className={cn("text-sm leading-relaxed", editable && "cursor-pointer")}
            onClick={() => editable && setEditing(true)}
            title={editable ? "Click to edit" : undefined}
          >
            {card.content}
          </div>
        )}

        {card.linkType && (
          <div className="text-[11px] text-muted mt-1">
            {card.linkType === "contradicts" && "⟷ Contradicts previous point"}
            {card.linkType === "modifies" && "↻ Modifies previous point"}
            {card.linkType === "extends" && "→ Extends previous point"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
