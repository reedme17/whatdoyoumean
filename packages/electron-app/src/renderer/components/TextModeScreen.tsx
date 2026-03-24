/**
 * TextModeScreen — paste/type text for analysis.
 * Large textarea + Analyze button. After analyze, shows RecapScreen layout.
 */

import React, { useState } from "react";
import type { CoreMeaningCard, Recommendation } from "@wdym/shared";
import { RecapScreen } from "./RecapScreen.js";
import { base, colors } from "../styles.js";

interface Props {
  onAnalyze: (text: string) => void;
  onClose: () => void;
  /** Results populated after analysis completes */
  cards: CoreMeaningCard[];
  recommendations: Recommendation[];
  analyzing: boolean;
}

export function TextModeScreen({
  onAnalyze,
  onClose,
  cards,
  recommendations,
  analyzing,
}: Props): React.JSX.Element {
  const [text, setText] = useState("");
  const hasResults = cards.length > 0;

  if (hasResults) {
    return (
      <RecapScreen
        cards={cards}
        recommendations={recommendations}
        bookmarks={[]}
        speakers={new Map()}
        onExport={() => {
          // Export as markdown — simplified for now
          const md = cards.map((c) => `- **[${c.category}]** ${c.content}`).join("\n");
          navigator.clipboard.writeText(md);
        }}
        onClose={onClose}
        onEditCard={() => {}}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: colors.bg }} role="main" aria-label="Text analysis mode">
      {/* Top bar */}
      <div style={base.topBar}>
        <span style={base.heading}>Text Mode</span>
        <button style={base.btnGhost} onClick={onClose} aria-label="Close text mode">
          ✕
        </button>
      </div>

      {/* Textarea */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px 20px", gap: 16 }}>
        <textarea
          style={{
            ...base.textarea,
            flex: 1,
            minHeight: 200,
            fontSize: 15,
            lineHeight: 1.6,
          }}
          placeholder="Paste or type text here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={analyzing}
          aria-label="Text input for analysis"
        />

        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            style={{
              ...base.btn,
              fontSize: 16,
              padding: "12px 40px",
              opacity: !text.trim() || analyzing ? 0.5 : 1,
            }}
            onClick={() => text.trim() && onAnalyze(text)}
            disabled={!text.trim() || analyzing}
          >
            {analyzing ? "Analyzing..." : "Analyze"}
          </button>
        </div>

        <div style={{ textAlign: "center", fontSize: 12, color: colors.muted }}>
          Supports Chinese, English, and mixed-language text (up to 5000 characters)
        </div>
      </div>
    </div>
  );
}
