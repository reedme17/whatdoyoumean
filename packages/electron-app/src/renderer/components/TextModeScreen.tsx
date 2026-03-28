/**
 * TextModeScreen — text analysis mode.
 * Matches design pattern: title top-left, content area, bottom bar with actions.
 */

import React, { useState } from "react";
import type { CoreMeaningCard, Recommendation } from "@wdym/shared";
import { RecapScreen } from "./RecapScreen.js";
import { Button } from "./ui/button.js";
import { XIcon } from "./ui/x-icon.js";
import { SlidersHorizontalIcon } from "./ui/sliders-icon.js";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover.js";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs.js";

interface Props {
  onAnalyze: (text: string) => void;
  onClose: () => void;
  onReset?: () => void;
  cards: CoreMeaningCard[];
  recommendations: Recommendation[];
  analyzing: boolean;
  responseEnabled?: boolean;
  onResponseEnabledChange?: (v: boolean) => void;
}

export function TextModeScreen({
  onAnalyze,
  onClose,
  onReset,
  cards,
  recommendations,
  analyzing,
  responseEnabled = false,
  onResponseEnabledChange,
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
        onAction={() => {
          // Reset to text input page
          setText("");
          onReset?.();
        }}
        onEditCard={() => {}}
        title="Results"
        actionLabel="Analyze another"
        showSpeakers={false}
        responseEnabled={responseEnabled}
        onResponseEnabledChange={onResponseEnabledChange}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-background screen-enter" role="main" aria-label="Text analysis mode">
      {/* Title */}
      <div className="pl-[20px] pt-[12px] shrink-0">
        <h1 className="font-serif font-normal text-[20px] text-[#60594D]">Analyze text</h1>
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
      <div className="flex items-center justify-center px-[20px] pt-[12px] pb-[20px] shrink-0 relative">
        <Button
          variant="normal"
          onClick={() => text.trim() && onAnalyze(text)}
          disabled={!text.trim() || analyzing}
        >
          {analyzing ? "Analyzing..." : "Analyze"}
        </Button>
        <div className="absolute right-[20px] flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-[#93918E] hover:text-[#60594D] transition-colors cursor-pointer bg-transparent border-none p-0">
                <SlidersHorizontalIcon size={16} />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-[160px] p-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-sans font-medium text-[#60594D]">Response recommendation</span>
                <Tabs value={responseEnabled ? "on" : "off"} onValueChange={(v) => onResponseEnabledChange?.(v === "on")}>
                  <TabsList><TabsTrigger value="on">On</TabsTrigger><TabsTrigger value="off">Off</TabsTrigger></TabsList>
                </Tabs>
              </div>
            </PopoverContent>
          </Popover>
          <button
            className="text-muted hover:text-foreground transition-colors cursor-pointer bg-transparent border-none"
            onClick={onClose}
            aria-label="Close text mode"
          >
            <XIcon size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
