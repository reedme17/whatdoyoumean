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
import type { AudioSourceMode } from "../hooks/useAudioCapture.js";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover.js";
import { Waveform } from "./Waveform.js";
import { ChevronDownIcon } from "./ui/chevron-down-icon.js";

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
  onSpeakerRename?: (name: string) => void;
  speakerName?: string;
  pendingPreview?: string;
  sttLanguage?: SttLanguage;
  onSttLanguageChange?: (lang: SttLanguage) => void;
  responseEnabled?: boolean;
  onResponseEnabledChange?: (v: boolean) => void;
  audioSource?: AudioSourceMode;
  onAudioSourceChange?: (source: AudioSourceMode) => void;
  sessionStartTime?: number;
}

export function LiveSession({
  cards,
  recommendations,
  speakers,
  isCapturing = false,
  audioError = null,
  analyser = null,
  onFlag,
  onStop,
  onSpeakerRename,
  speakerName,
  pendingPreview = "",
  sttLanguage,
  onSttLanguageChange,
  responseEnabled = false,
  onResponseEnabledChange,
  audioSource,
  onAudioSourceChange,
  sessionStartTime,
}: Props): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const pendingTextRef = useRef<HTMLDivElement>(null);
  const [nameInput, setNameInput] = useState("");
  const [namePopoverOpen, setNamePopoverOpen] = useState(false);

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
        style={undefined}
      >
        <div className="flex flex-col gap-[10px]">
          {(() => {
            // Group cards into sequential speaker runs (same logic as RecapScreen)
            const groups: { speakerKey: string; speaker: string; cards: CoreMeaningCard[] }[] = [];
            for (const card of cards) {
              const speakerKey = card.speakerId ?? "";
              const speaker = speakers.get(speakerKey) ?? speakerName ?? "Speaker 1";
              const last = groups[groups.length - 1];
              if (last && last.speakerKey === speakerKey) {
                last.cards.push(card);
              } else {
                groups.push({ speakerKey, speaker, cards: [card] });
              }
            }
            return groups.map((group, gi) => (
              <div key={gi} className="flex flex-col gap-[10px] px-[20px] py-[12px]">
                <span className="font-sans font-semibold text-sm text-[#60594D]">{group.speaker}</span>
                <div className="flex flex-col gap-[8px]">
                  {group.cards.map((card, i) => (
                    <React.Fragment key={card.id}>
                      {i > 0 && <div className="w-full h-px bg-border" />}
                      <CoreMeaningCardView card={card} />
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ));
          })()}
          {/* Recommendations below last card */}
          {responseEnabled && recommendations.length > 0 && cards.length > 0 && (
            <div className="px-[20px]">
              <RecommendationTokens recommendations={recommendations} />
            </div>
          )}
        </div>

        {/* Empty state — just blank space, bottom bar has Listening indicator */}
        {cards.length === 0 && !pendingPreview && null}
      </div>

      {/* Scroll-to-bottom gradient hint (same as RecapScreen) */}
      {!autoScroll && (
        <div className="shrink-0 relative h-[48px] -mt-[48px] pointer-events-none" style={{ background: "linear-gradient(to bottom, transparent, var(--color-background))" }}>
          <button
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[#93918E] hover:text-[#60594D] transition-colors cursor-pointer bg-transparent border-none p-0 pointer-events-auto"
            onClick={() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }}
            aria-label="Scroll to bottom"
          >
            <ChevronDownIcon size={18} />
          </button>
        </div>
      )}

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
        audioSource={audioSource}
        onAudioSourceChange={onAudioSourceChange}
        sessionStartTime={sessionStartTime}
        speakerName={speakerName}
      />
    </div>
  );
}
