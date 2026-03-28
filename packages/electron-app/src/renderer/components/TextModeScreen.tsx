/**
 * TextModeScreen — text analysis mode.
 * Matches design pattern: title top-left, content area, bottom bar with actions.
 */

import React, { useState } from "react";
import type { CoreMeaningCard, Recommendation } from "@wdym/shared";
import { RecapScreen } from "./RecapScreen.js";
import { XIcon } from "./ui/x-icon.js";

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
        title="Results"
        actionLabel="Analyze another"
        showSpeakers={false}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-background" role="main" aria-label="Text analysis mode">
      {/* Title */}
      <div className="pl-[20px] pt-[12px] shrink-0">
        <h1 className="font-serif font-normal text-[20px] text-[#60594D]">Text mode</h1>
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col px-[40px] py-[20px]">
        <textarea
          className="flex-1 w-full text-sm font-sans leading-relaxed text-foreground bg-transparent border-none outline-none resize-none placeholder:text-[#93918E]"
          placeholder="Paste or type text here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={analyzing}
          aria-label="Text input for analysis"
        />
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-[20px] pt-[12px] pb-[20px] shrink-0">
        <button
          className="font-sans font-bold text-sm text-[#5B5449] hover:text-foreground transition-colors cursor-pointer bg-transparent border-none p-0 disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => text.trim() && onAnalyze(text)}
          disabled={!text.trim() || analyzing}
        >
          {analyzing ? "Analyzing..." : "Analyze"}
        </button>
        <button
          className="text-muted hover:text-foreground transition-colors cursor-pointer bg-transparent border-none"
          onClick={onClose}
          aria-label="Close text mode"
        >
          <XIcon size={20} />
        </button>
      </div>
    </div>
  );
}
