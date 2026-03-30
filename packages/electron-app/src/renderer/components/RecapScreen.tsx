/**
 * RecapScreen — editorial post-session review.
 * Matches Figma design: Session recap title, speaker blocks with cards, bottom bar.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import type { CoreMeaningCard, Recommendation, Bookmark } from "@wdym/shared";
import { CoreMeaningCardView } from "./CoreMeaningCard.js";
import { RecommendationTokens } from "./RecommendationTokens.js";
import { XIcon } from "./ui/x-icon.js";
import { SlidersHorizontalIcon } from "./ui/sliders-icon.js";
import { DownloadPopover } from "./DownloadPopover.js";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover.js";
import { SettingsControls } from "./SettingsControls.js";
import { ChevronDownIcon } from "./ui/chevron-down-icon.js";

interface Props {
  cards: CoreMeaningCard[];
  recommendations: Recommendation[];
  bookmarks: Bookmark[];
  speakers: Map<string, string>;
  onExport: () => void;
  onClose: () => void;
  onAction?: () => void;
  onEditCard: (cardId: string, content: string) => void;
  title?: string;
  actionLabel?: string;
  showSpeakers?: boolean;
  speakerName?: string;
  responseEnabled?: boolean;
  onResponseEnabledChange?: (v: boolean) => void;
  topRightContent?: React.ReactNode;
  onSpeakerRename?: (speakerKey: string, name: string) => void;
  /** Called when per-group speaker name overrides change (for export) */
  onGroupOverridesChange?: (overrides: Map<number, { speakerKey: string; name: string }>) => void;
  onToggleMark?: (cardId: string) => void;
}

export function RecapScreen({
  cards,
  recommendations,
  bookmarks,
  speakers,
  onExport,
  onClose,
  onAction,
  onEditCard,
  title = "Session recap",
  actionLabel = "New session",
  showSpeakers = true,
  speakerName,
  responseEnabled = false,
  onResponseEnabledChange,
  topRightContent,
  onSpeakerRename,
  onGroupOverridesChange,
  onToggleMark,
}: Props): React.JSX.Element {
  // Suppress hover on X icon for 300ms after mount (End button overlaps X position)
  const [xReady, setXReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setXReady(true), 300); return () => clearTimeout(t); }, []);

  // Group cards by speaker
  const speakerGroups: { speaker: string; speakerKey: string; cards: CoreMeaningCard[] }[] = [];
  for (const card of cards) {
    const speakerKey = card.speakerId ?? card.sourceSegmentIds[0] ?? "";
    const speaker = speakers.get(speakerKey) ?? speakerName ?? "Speaker 1";
    const last = speakerGroups[speakerGroups.length - 1];
    if (last && last.speakerKey === speakerKey) {
      last.cards.push(card);
    } else {
      speakerGroups.push({ speaker, speakerKey, cards: [card] });
    }
  }

  // Compute original default names per speakerKey (Speaker 1, Speaker 2, etc.)
  const originalNames = useRef(new Map<string, string>());
  const seenKeys = new Set<string>();
  for (const group of speakerGroups) {
    if (!seenKeys.has(group.speakerKey)) {
      seenKeys.add(group.speakerKey);
      if (!originalNames.current.has(group.speakerKey)) {
        originalNames.current.set(group.speakerKey, `Speaker ${originalNames.current.size + 1}`);
      }
    }
  }

  // Per-group name overrides (only this specific group, not all with same speakerKey)
  const [groupNameOverrides, setGroupNameOverrides] = useState<Map<number, string>>(new Map());

  // Resolve display name: group override > speakers Map > original default
  const getGroupDisplayName = (gi: number, group: { speakerKey: string }) => {
    return groupNameOverrides.get(gi) ?? speakers.get(group.speakerKey) ?? originalNames.current.get(group.speakerKey) ?? "Speaker 1";
  };

  // Inline speaker rename state
  const [editingGroupIdx, setEditingGroupIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  // Sync per-group overrides to parent for export
  useEffect(() => {
    if (!onGroupOverridesChange || groupNameOverrides.size === 0) return;
    const mapped = new Map<number, { speakerKey: string; name: string }>();
    for (const [gi, name] of groupNameOverrides) {
      if (gi < speakerGroups.length) {
        mapped.set(gi, { speakerKey: speakerGroups[gi].speakerKey, name });
      }
    }
    onGroupOverridesChange(mapped);
  }, [groupNameOverrides]);

  // Count highlighted cards for staggered animation
  let highlightCounter = 0;

  // Scroll-to-bottom indicator
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowScrollHint(el.scrollHeight - el.scrollTop - el.clientHeight > 40);
  }, []);

  useEffect(() => {
    checkScroll();
  }, [cards, checkScroll]);

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  };

  return (
    <div className="flex flex-col h-full bg-background" role="main" aria-label="Session recap">
      {/* Content area */}
      <div ref={scrollRef} onScroll={checkScroll} className="flex-1 flex flex-col overflow-y-auto relative" style={editingGroupIdx !== null ? { overflow: "hidden" } : undefined}>
        {/* Title — sticky */}
        <div className="flex items-center justify-between px-[20px] pt-[12px] pb-[4px] shrink-0 sticky top-0 z-10 bg-background">
          <h1 className="font-serif font-normal text-[20px] text-[#60594D]">{title}</h1>
          {topRightContent}
        </div>

        {/* Speaker blocks */}
        <div className="flex flex-col gap-[10px] px-[20px]">
          {speakerGroups.map((group, gi) => {
            const displayName = getGroupDisplayName(gi, group);
            const isDefault = displayName.startsWith("Speaker");
            const origName = originalNames.current.get(group.speakerKey) ?? "Speaker 1";
            // "Apply to all" shows when the speakerKey hasn't been globally renamed yet
            const globalName = speakers.get(group.speakerKey);
            const showApplyAll = !globalName || globalName.startsWith("Speaker");
            return (
            <div key={gi} className="flex flex-col gap-[10px] px-[20px] py-[12px]">
              <div className="flex items-baseline gap-[10px]">
                {showSpeakers && (
                  <>
                    <span className="font-sans font-semibold text-sm text-[#60594D]">{displayName}</span>
                    {onSpeakerRename && (
                      <Popover open={editingGroupIdx === gi} onOpenChange={(open) => {
                        if (open) { setEditingGroupIdx(gi); setEditName(isDefault ? "" : displayName); }
                        else setEditingGroupIdx(null);
                      }}>
                        <PopoverTrigger asChild>
                          <button className="font-sans font-bold text-[10px] text-[#5B5449] bg-[#F0EDE8] rounded-[18px] px-2 py-0.5 border-none cursor-pointer hover:bg-[#E8E4DE] transition-colors leading-[20px]">
                            {isDefault ? "Add name" : "Edit"}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent side="right" align="start" className="w-[220px] p-3">
                          <div className="flex flex-col gap-2">
                            <input
                              className="w-full px-2 py-1 text-xs font-sans border border-border rounded-md bg-transparent text-foreground outline-none focus:border-[#60594D] focus:ring-[0.5px] focus:ring-[#60594D] caret-[#60594D]"
                              placeholder="Enter name..."
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  if (editName.trim()) {
                                    setGroupNameOverrides((prev) => { const next = new Map(prev); next.set(gi, editName.trim()); return next; });
                                  } else {
                                    // Empty = reset to original Speaker X
                                    setGroupNameOverrides((prev) => { const next = new Map(prev); next.delete(gi); return next; });
                                    // Also reset global name if it was set
                                    onSpeakerRename(group.speakerKey, origName);
                                  }
                                  setEditingGroupIdx(null);
                                }
                              }}
                              autoFocus
                            />
                            <div className="flex justify-end gap-2 flex-wrap">
                              <button className="text-[10px] font-sans text-[#93918E] hover:text-foreground cursor-pointer bg-transparent border-none" onClick={() => setEditingGroupIdx(null)}>Cancel</button>
                              {showApplyAll && (
                                <button
                                  className={`text-[10px] font-sans font-medium cursor-pointer bg-transparent border-none ${editName.trim() ? "text-[#5B5449] hover:text-foreground" : "text-[#C4C0BA] cursor-default"}`}
                                  onClick={() => {
                                    if (!editName.trim()) return;
                                    onSpeakerRename(group.speakerKey, editName.trim());
                                    setGroupNameOverrides((prev) => {
                                      const next = new Map(prev);
                                      for (let i = 0; i < speakerGroups.length; i++) {
                                        if (speakerGroups[i].speakerKey === group.speakerKey) next.delete(i);
                                      }
                                      return next;
                                    });
                                    setEditingGroupIdx(null);
                                  }}
                                >Apply to all {origName}</button>
                              )}
                              <button className="text-[10px] font-sans font-medium text-[#5B5449] hover:text-foreground cursor-pointer bg-transparent border-none" onClick={() => {
                                if (editName.trim()) {
                                  setGroupNameOverrides((prev) => { const next = new Map(prev); next.set(gi, editName.trim()); return next; });
                                } else {
                                  // Empty = reset to original Speaker X
                                  setGroupNameOverrides((prev) => { const next = new Map(prev); next.delete(gi); return next; });
                                }
                                setEditingGroupIdx(null);
                              }}>Save</button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </>
                )}
              </div>
              <div className="flex flex-col gap-[8px]">
                {group.cards.map((card, i) => (
                  <React.Fragment key={card.id}>
                    {i > 0 && <div className="w-full h-px bg-border" />}
                    <CoreMeaningCardView card={card} animateHighlight highlightIndex={card.isHighlighted ? highlightCounter++ : 0} onToggleMark={onToggleMark} />
                  </React.Fragment>
                ))}
              </div>
            </div>
            );
          })}

          {cards.length === 0 && (
            <div className="text-sm text-center mt-16 font-sans text-[#93918E]">
              Nothing was captured in this session.
            </div>
          )}

          {/* Recommendations below cards */}
          {responseEnabled && recommendations.length > 0 && (
            <div className="px-[20px] -mt-[8px]">
              <RecommendationTokens recommendations={recommendations} />
            </div>
          )}
        </div>
      </div>

      {/* Scroll-to-bottom gradient hint */}
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
      )}      {/* Bottom bar */}
      <div className="flex items-center justify-between px-[20px] pt-[12px] pb-[20px] shrink-0">
        <button
          className="font-sans font-bold text-sm text-muted hover:text-foreground transition-colors cursor-pointer bg-transparent border-none p-0"
          onClick={onAction ?? onClose}
        >
          {actionLabel}
        </button>
        <div className="flex items-center gap-4">
          {onResponseEnabledChange && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-[#93918E] hover:text-[#60594D] transition-colors cursor-pointer bg-transparent border-none p-0" title="Settings" aria-label="Settings">
                <SlidersHorizontalIcon size={18} />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-[160px] p-3">
              <SettingsControls
                variant="response-only"
                responseEnabled={responseEnabled}
                onResponseEnabledChange={onResponseEnabledChange}
              />
            </PopoverContent>
          </Popover>
          )}
          <button
            className="text-muted hover:text-foreground transition-colors cursor-pointer bg-transparent border-none"
            style={xReady ? undefined : { pointerEvents: "none" }}
            onClick={onClose}
            title="Close"
            aria-label="Close recap"
          >
            <XIcon size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
