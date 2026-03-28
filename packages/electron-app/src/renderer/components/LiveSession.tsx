/**
 * LiveSession — listening screen.
 * Cards appear in history area when created. Bottom bar shrinks back.
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import type { CoreMeaningCard, Recommendation } from "@wdym/shared";
import { CoreMeaningCardView } from "./CoreMeaningCard.js";
import { RecommendationTokens } from "./RecommendationTokens.js";
import { BottomBar } from "./BottomBar.js";
import { Button } from "./ui/button.js";
import type { SttLanguage } from "./ExpandPanel.js";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover.js";
import { Waveform } from "./Waveform.js";

interface Props {
  cards: CoreMeaningCard[];
  currentCard: CoreMeaningCard | null;
  recommendations: Recommendation[];
  speakers: Map<string, string>;
  isCapturing?: boolean;
  audioError?: string | null;
  analyser?: AnalyserNode | null;
  onFlag: () => void;
  onStop: () => void;
  pendingPreview?: string;
  sttLanguage?: SttLanguage;
  onSttLanguageChange?: (lang: SttLanguage) => void;
  responseEnabled?: boolean;
  onResponseEnabledChange?: (v: boolean) => void;
}

export function LiveSession({
  cards,
  recommendations,
  isCapturing = false,
  audioError = null,
  analyser = null,
  onFlag,
  onStop,
  pendingPreview = "",
  sttLanguage,
  onSttLanguageChange,
  responseEnabled = false,
  onResponseEnabledChange,
}: Props): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const pendingTextRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [cards, autoScroll, pendingPreview]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  }, []);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden" role="main" aria-label="Live session">
      {/* Card area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-label="Conversation flow"
        className="flex-1 flex flex-col justify-start overflow-y-auto px-[20px]"
        style={{ maskImage: "linear-gradient(to bottom, black calc(100% - 32px), transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black calc(100% - 32px), transparent 100%)" }}
      >
        <div className="flex flex-col gap-[10px]">
          {cards.length > 0 && (
            <div className="flex flex-col gap-[10px] px-[20px] py-[12px]">
              <div className="flex items-baseline gap-[10px]">
                <span className="font-sans font-semibold text-sm text-[#60594D]">Speaker 1</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="small" className="leading-[20px]">Add name</Button>
                  </PopoverTrigger>
                  <PopoverContent side="right" align="start" className="w-[200px] p-3">
                    <div className="flex flex-col gap-2">
                      <input
                        className="w-full px-2 py-1 text-xs font-sans border border-border rounded-md bg-transparent text-foreground outline-none focus:border-[#60594D] focus:ring-1 focus:ring-[#60594D] caret-[#60594D]"
                        placeholder="Enter name..."
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <button className="text-[10px] font-sans text-[#93918E] hover:text-foreground cursor-pointer bg-transparent border-none">Cancel</button>
                        <button className="text-[10px] font-sans font-medium text-[#5B5449] hover:text-foreground cursor-pointer bg-transparent border-none">Save</button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex flex-col gap-[8px]">
                {cards.map((card, i) => (
                  <React.Fragment key={card.id}>
                    {i > 0 && <div className="w-full h-px bg-border" />}
                    <CoreMeaningCardView card={card} />
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Empty state — just blank space, bottom bar has Listening indicator */}
        {cards.length === 0 && !pendingPreview && null}
      </div>

      {responseEnabled && <RecommendationTokens recommendations={recommendations} />}

      {/* Full-width waveform above bottom bar */}
      <div className="w-full px-[20px] shrink-0">
        <Waveform analyser={analyser} isCapturing={isCapturing} width={600} height={60} barCount={40} color="#F0EDE8" idleColor="#E8E4DE" mode="wave" />
      </div>

      <BottomBar
        onFlag={onFlag}
        onStop={onStop}
        analyser={analyser}
        isCapturing={isCapturing}
        pendingPreview={pendingPreview}
        pendingTextRef={pendingTextRef}
        sttLanguage={sttLanguage}
        onSttLanguageChange={onSttLanguageChange}
        responseEnabled={responseEnabled}
        onResponseEnabledChange={onResponseEnabledChange}
      />
    </div>
  );
}
