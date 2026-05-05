import React, { useRef, useState, useCallback, useEffect } from "react";
import type { CoreMeaningCard } from "@wdym/shared";
import { CoreMeaningCardView } from "./CoreMeaningCard.js";
import { XIcon } from "./ui/x-icon.js";
import { ChevronDownIcon } from "./ui/chevron-down-icon.js";
import { DownloadPopover } from "./DownloadPopover.js";

interface Props {
  cards: CoreMeaningCard[];
  accumulatedText: string;
  onClose: () => void;
  onCopy: () => void;
  onExportMd: () => void;
  onToggleMark?: (cardId: string) => void;
  resultErrorMessage?: string | null;
}

export function SubtitleResultScreen({
  cards,
  accumulatedText,
  onClose,
  onCopy,
  onExportMd,
  onToggleMark,
  resultErrorMessage,
}: Props): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowScrollHint(el.scrollHeight - el.scrollTop - el.clientHeight > 40);
  }, []);

  useEffect(() => {
    checkScroll();
  }, [cards, transcriptExpanded, checkScroll]);

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  };

  let highlightCounter = 0;

  return (
    <div className="flex flex-col h-full bg-background screen-enter" role="main" aria-label="Meeting notes">
      <div ref={scrollRef} onScroll={checkScroll} className="flex-1 flex flex-col overflow-y-auto">
        {/* Title */}
        <div className="flex items-center justify-between px-[20px] pt-[12px] pb-[4px] shrink-0 sticky top-0 z-10 bg-background">
          <h1 className="font-serif font-normal text-[20px] text-[#60594D]">Meeting notes</h1>
          <DownloadPopover onCopy={onCopy} onExportMd={onExportMd} />
        </div>

        {/* Cards */}
        <div className="flex flex-col gap-[8px] px-[20px] pt-[12px]">
          {cards.map((card, i) => (
            <React.Fragment key={card.id}>
              {i > 0 && <div className="w-full h-px bg-border" />}
              <CoreMeaningCardView
                card={card}
                animateHighlight
                highlightIndex={card.isHighlighted ? highlightCounter++ : 0}
                onToggleMark={onToggleMark}
              />
            </React.Fragment>
          ))}

          {cards.length === 0 && (
            <div className="text-sm text-center mt-16 font-sans text-[#93918E]">
              {resultErrorMessage ?? "No notes were captured in this session."}
            </div>
          )}
        </div>

        {/* Collapsible transcript */}
        <div className="mx-[20px] mb-[16px] mt-[12px] rounded-[20px] border border-[#DED8CE] bg-[#F7F3ED] p-4 shadow-[0_10px_30px_rgba(96,89,77,0.08)]">
          <button
            className="flex w-full items-center justify-between bg-transparent border-none p-0 cursor-pointer"
            onClick={() => setTranscriptExpanded((v) => !v)}
            aria-expanded={transcriptExpanded}
          >
            <span className="font-sans text-xs uppercase tracking-[0.18em] text-[#A6A095]">
              Transcript
            </span>
            <svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[#A6A095] transition-transform"
              style={{ transform: transcriptExpanded ? "rotate(0deg)" : "rotate(-90deg)" }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {transcriptExpanded && (
            <div className="mt-3 whitespace-pre-wrap font-sans text-[15px] leading-7 text-[#4E493F]">
              {accumulatedText.trim() || (
                <span className="text-[#93918E]">No subtitle text was captured.</span>
              )}
            </div>
          )}
        </div>
      </div>

      {showScrollHint && (
        <div className="shrink-0 relative h-[48px] -mt-[48px] pointer-events-none" style={{ background: "linear-gradient(to bottom, transparent, var(--color-background))" }}>
          <button
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[#93918E] hover:text-[#60594D] transition-colors cursor-pointer bg-transparent border-none p-0 pointer-events-auto"
            onClick={scrollToBottom}
            aria-label="Scroll to bottom"
          >
            <ChevronDownIcon size={18} />
          </button>
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex items-center justify-end px-[20px] pt-[12px] pb-[20px] shrink-0">
        <button
          className="text-muted hover:text-foreground transition-colors cursor-pointer bg-transparent border-none"
          onClick={onClose}
          title="Close"
          aria-label="Close meeting notes"
        >
          <XIcon size={20} />
        </button>
      </div>
    </div>
  );
}
