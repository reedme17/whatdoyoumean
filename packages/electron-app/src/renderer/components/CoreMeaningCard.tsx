/**
 * CoreMeaningCard — displays a single meaning card.
 * Shows category badge, speaker label, content, and optional edit mode.
 */

import React, { useState } from "react";
import type { CoreMeaningCard as CardType, MeaningCategory } from "@wdym/shared";
import { colors, base } from "../styles.js";

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
    <div
      role="article"
      aria-label={`${categoryLabels[card.category]} card: ${card.content.slice(0, 40)}`}
      style={{
        padding: "12px 16px",
        border: `1px solid ${isCurrent ? colors.fg : colors.border}`,
        borderRadius: 8,
        marginBottom: 8,
        background: colors.bg,
        opacity: isCurrent ? 1 : 0.95,
        transition: "opacity 0.2s",
      }}
    >
      {/* Header: speaker + category */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
          fontSize: 11,
          color: colors.muted,
        }}
      >
        {speakerName && <span style={{ fontWeight: 600 }}>{speakerName}</span>}
        <span
          role="status"
          style={{
            ...base.badge,
            fontSize: 10,
            padding: "2px 8px",
          }}
        >
          {categoryLabels[card.category]}
        </span>
        {card.isHighlighted && <span>★</span>}
      </div>

      {/* Content */}
      {editing ? (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ ...base.input, flex: 1 }}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus
            aria-label="Edit card content"
          />
          <button style={base.btnOutline} onClick={handleSave}>
            Save
          </button>
        </div>
      ) : (
        <div
          style={{
            fontSize: 14,
            lineHeight: 1.5,
            cursor: editable ? "pointer" : "default",
          }}
          onClick={() => editable && setEditing(true)}
          title={editable ? "Click to edit" : undefined}
        >
          {card.content}
        </div>
      )}

      {/* Link indicator */}
      {card.linkType && (
        <div style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
          {card.linkType === "contradicts" && "⟷ Contradicts previous point"}
          {card.linkType === "modifies" && "↻ Modifies previous point"}
          {card.linkType === "extends" && "→ Extends previous point"}
        </div>
      )}
    </div>
  );
}
