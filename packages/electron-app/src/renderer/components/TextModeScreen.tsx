/**
 * TextModeScreen — editorial text analysis.
 * Serif heading, large textarea, analyze button.
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
      <div className="flex items-center justify-between px-8 py-5">
        <h1 className="font-serif text-2xl font-normal">Text Mode</h1>
        <button
          className="text-muted hover:text-foreground transition-colors cursor-pointer bg-transparent border-none"
          onClick={onClose}
          aria-label="Close text mode"
        >
          ✕
        </button>
      </div>
      <Separator />

      <div className="flex-1 flex flex-col px-8 py-8 gap-6">
        <Textarea
          className="flex-1 min-h-[200px] text-base leading-relaxed font-serif bg-card"
          placeholder="Paste or type text here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={analyzing}
          aria-label="Text input for analysis"
        />

        <div className="flex justify-center">
          <Button
            variant="outline"
            className="px-12 py-3 h-auto text-xs tracking-[0.25em] uppercase font-semibold"
            onClick={() => text.trim() && onAnalyze(text)}
            disabled={!text.trim() || analyzing}
          >
            {analyzing ? "Analyzing..." : "Analyze"}
          </Button>
        </div>

        <div className="text-center text-xs text-muted font-sans">
          Supports Chinese, English, and mixed-language text
        </div>
      </div>
    </div>
  );
}
