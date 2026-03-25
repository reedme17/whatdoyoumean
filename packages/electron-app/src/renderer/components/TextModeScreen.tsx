/**
 * TextModeScreen — paste/type text for analysis.
 * Large textarea + Analyze button. After analyze, shows RecapScreen layout.
 */

import React, { useState } from "react";
import type { CoreMeaningCard, Recommendation } from "@wdym/shared";
import { RecapScreen } from "./RecapScreen.js";
import { Button } from "./ui/button.js";
import { Textarea } from "./ui/textarea.js";
import { Separator } from "./ui/separator.js";

interface Props {
  onAnalyze: (text: string) => void;
  onClose: () => void;
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
          const md = cards.map((c) => `- **[${c.category}]** ${c.content}`).join("\n");
          navigator.clipboard.writeText(md);
        }}
        onClose={onClose}
        onEditCard={() => {}}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-background" role="main" aria-label="Text analysis mode">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3">
        <span className="text-base font-semibold">Text Mode</span>
        <Button variant="ghost" onClick={onClose} aria-label="Close text mode">
          ✕
        </Button>
      </div>
      <Separator />

      {/* Textarea */}
      <div className="flex-1 flex flex-col px-5 py-6 gap-4">
        <Textarea
          className="flex-1 min-h-[200px] text-[15px] leading-relaxed"
          placeholder="Paste or type text here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={analyzing}
          aria-label="Text input for analysis"
        />

        <div className="flex justify-center">
          <Button
            size="lg"
            className="px-10"
            onClick={() => text.trim() && onAnalyze(text)}
            disabled={!text.trim() || analyzing}
          >
            {analyzing ? "Analyzing..." : "Analyze"}
          </Button>
        </div>

        <div className="text-center text-xs text-muted">
          Supports Chinese, English, and mixed-language text (up to 5000 characters)
        </div>
      </div>
    </div>
  );
}
