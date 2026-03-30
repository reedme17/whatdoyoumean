/**
 * ExpandPanel — shadcn Drawer (vaul) from right side.
 * History: panel expands to full width with left sidebar + right detail.
 * Settings/About: CSS accordion animation.
 */

import React, { useState } from "react";
import type { CoreMeaningCard, Recommendation } from "@wdym/shared";
import { Drawer, DrawerContent } from "./ui/drawer.js";
import { SidebarButton } from "./ui/sidebar-button.js";
import { XIcon } from "./ui/x-icon.js";
import { ChevronIcon } from "./ui/chevron-icon.js";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs.js";
import { CoreMeaningCardView } from "./CoreMeaningCard.js";
import { RecommendationTokens } from "./RecommendationTokens.js";
import { DownloadPopover } from "./DownloadPopover.js";

export type SttLanguage = "zh+en" | "en" | "zh" | "auto";

export interface SessionSummary {
  id: string;
  date: string;
  timestamp: number;
  durationMin: number;
  topicSummary: string;
  mode: "online" | "offline" | "text";
  cards?: CoreMeaningCard[];
  recommendations?: Recommendation[];
  transcriptTexts?: string[];
  speakers?: Map<string, string>;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  const days = Math.floor(hrs / 24);
  if (days < 7) return days + "d ago";
  return new Date(ts).toLocaleDateString();
}

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  isGuest: boolean;
  sessions: SessionSummary[];
  onOpenSession: (sessionId: string) => void;
  onLogin: (userId: string) => void;
  onLogout: () => void;
  sttLanguage: SttLanguage;
  onSttLanguageChange: (lang: SttLanguage) => void;
  responseEnabled?: boolean;
  onResponseEnabledChange?: (v: boolean) => void;
  onViewOnboarding?: () => void;
}

type Section = "none" | "settings" | "about";
type PanelView = "menu" | "history";

const EXPAND_TRANSITION = "width 0.5s cubic-bezier(0.32, 0.72, 0, 1), border-radius 0.5s cubic-bezier(0.32, 0.72, 0, 1)";
const ACC_OPEN: React.CSSProperties = { maxHeight: 200, opacity: 1, transition: "max-height 0.25s ease-out, opacity 0.2s ease-out", overflow: "hidden" };
const ACC_CLOSED: React.CSSProperties = { maxHeight: 0, opacity: 0, transition: "max-height 0.25s ease-out, opacity 0.2s ease-out", overflow: "hidden" };

export function ExpandPanel({
  open, onClose, sessions, sttLanguage, onSttLanguageChange, responseEnabled = false, onResponseEnabledChange, onViewOnboarding,
}: Props): React.JSX.Element {
  const [activeSection, setActiveSection] = useState<Section>("none");
  const [view, setView] = useState<PanelView>("menu");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const toggle = (s: Section) => setActiveSection((p) => (p === s ? "none" : s));

  const handleClose = () => {
    onClose();
    setTimeout(() => { setView("menu"); setActiveSection("none"); setSelectedSessionId(null); }, 550);
  };

  const expanded = view === "history";
  const sortedSessions = [...sessions].sort((a, b) => b.timestamp - a.timestamp);
  const selectedSession = sortedSessions.find((s) => s.id === selectedSessionId) ?? null;

  const buildExportMd = (s: SessionSummary): string => {
    const now = new Date(s.timestamp);
    const sections = ["# WDYM - \u5565\u610f\u601d", "> " + now.toISOString().slice(0, 10) + " " + now.toTimeString().slice(0, 8) + "\n", "## Analysis\n"];
    const cs = s.cards ?? [];
    const spk = s.speakers ?? new Map();
    const groups: { key: string; cards: CoreMeaningCard[] }[] = [];
    for (const c of cs) {
      const k = c.speakerId ?? "";
      const last = groups[groups.length - 1];
      if (last && last.key === k) last.cards.push(c);
      else groups.push({ key: k, cards: [c] });
    }
    if (s.mode === "online") {
      for (const g of groups) {
        sections.push("### " + (spk.get(g.key) ?? "Speaker 1") + "\n");
        for (const c of g.cards) sections.push("- **" + c.category + "**" + (c.isHighlighted ? " \u2b50" : "") + " \u2014 " + c.content);
        sections.push("");
      }
    } else {
      for (const c of cs) sections.push("- **" + c.category + "**" + (c.isHighlighted ? " \u2b50" : "") + " \u2014 " + c.content);
      sections.push("");
    }
    const recs = s.recommendations ?? [];
    if (recs.length > 0) { sections.push("## Response Recommendations\n"); for (const r of recs) sections.push("- " + r.text); sections.push(""); }
    sections.push("## Original Transcript\n");
    const tt = s.transcriptTexts ?? [];
    sections.push(tt.length > 0 ? tt.join(" ") : "_(No transcript recorded)_");
    return sections.join("\n");
  };

  return (
    <Drawer direction="right" open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DrawerContent style={{ width: expanded ? "100%" : undefined, borderRadius: expanded ? 0 : undefined, transition: EXPAND_TRANSITION }}>
        {view === "menu" && (
          <>
            <nav className="p-3 pt-12 flex flex-col gap-1 overflow-y-auto flex-1" aria-label="Main navigation">
              <SidebarButton onClick={() => { setActiveSection("none"); setView("history"); }}>History</SidebarButton>
              <SidebarButton active={activeSection === "settings"} onClick={() => toggle("settings")}>
                <span className="flex-1 text-left">Settings</span>
                <ChevronIcon size={14} expanded={activeSection === "settings"} />
              </SidebarButton>
              <div style={activeSection === "settings" ? ACC_OPEN : ACC_CLOSED}>
                <div className="px-3 py-2 text-xs text-muted font-sans leading-relaxed">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-sans font-medium text-[#60594D]">Language</span>
                      <Tabs value={sttLanguage === "zh" ? "cn" : sttLanguage === "en" ? "en" : "multi"} onValueChange={(v) => onSttLanguageChange(v === "cn" ? "zh" : v === "en" ? "en" : "zh+en")}>
                        <TabsList><TabsTrigger value="multi">Multi</TabsTrigger><TabsTrigger value="cn">中文</TabsTrigger><TabsTrigger value="en">EN</TabsTrigger></TabsList>
                      </Tabs>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-sans font-medium text-[#60594D]">Source</span>
                      <Tabs defaultValue="both"><TabsList><TabsTrigger value="both">Both</TabsTrigger><TabsTrigger value="mic">Mic</TabsTrigger><TabsTrigger value="internal">Internal</TabsTrigger></TabsList></Tabs>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-sans font-medium text-[#60594D]">Response recommendation</span>
                      <Tabs value={responseEnabled ? "on" : "off"} onValueChange={(v) => onResponseEnabledChange?.(v === "on")}><TabsList><TabsTrigger value="on">On</TabsTrigger><TabsTrigger value="off">Off</TabsTrigger></TabsList></Tabs>
                    </div>
                  </div>
                </div>
              </div>
              <SidebarButton active={activeSection === "about"} onClick={() => toggle("about")}>
                <span className="flex-1 text-left">About</span>
                <ChevronIcon size={14} expanded={activeSection === "about"} />
              </SidebarButton>
              <div style={activeSection === "about" ? ACC_OPEN : ACC_CLOSED}>
                <div className="px-3 py-2 text-xs text-muted font-sans flex flex-col gap-0.5">
                  <div className="font-sans text-sm text-[#60594D]">啥意思</div>
                  <div className="font-sans text-[11px] text-muted">What Do You Mean</div>
                  <div>v0.1.0</div>
                  <div>Ting Yan</div>
                </div>
              </div>
              <SidebarButton onClick={() => { handleClose(); setTimeout(() => onViewOnboarding?.(), 550); }}>View onboarding</SidebarButton>
            </nav>
            <div className="flex items-center justify-end px-[20px] py-[20px]">
              <button className="text-muted hover:text-foreground transition-colors cursor-pointer bg-transparent border-none" onClick={handleClose} aria-label="Close menu"><XIcon size={20} /></button>
            </div>
          </>
        )}

        {view === "history" && (
          <div className="flex h-full" style={{ paddingTop: 38 }}>
            {/* Left sidebar */}
            <div className="w-[200px] shrink-0 flex flex-col">
              <div className="px-[20px] pt-[12px] pb-[8px] shrink-0">
                <h1 className="font-serif font-normal text-[20px] text-[#60594D]">History</h1>
              </div>
              <div className="flex-1 overflow-y-auto px-[8px]">
                {sortedSessions.length === 0 && (
                  <div className="px-[12px] py-[20px] text-xs font-sans text-[#93918E]">No sessions yet</div>
                )}
                {sortedSessions.map((s) => (
                  <button
                    key={s.id}
                    className={`w-full text-left px-[12px] py-[8px] rounded-[6px] border-none cursor-pointer transition-colors font-sans text-[#60594D] ${
                      selectedSessionId === s.id ? "bg-[#F0EDE8]" : "bg-transparent hover:bg-[#F0EDE8]/50"
                    }`}
                    onClick={() => setSelectedSessionId(s.id)}
                  >
                    <div className="font-semibold text-[12px] truncate">{s.topicSummary}</div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#93918E]">
                      <span>{relativeTime(s.timestamp)}</span>
                      <span>·</span>
                      <span>{s.mode === "online" ? "Audio" : "Text"}</span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="h-[20px] shrink-0" />
            </div>

            {/* Divider — aligned with title top, with bottom margin */}
            <div className="w-px bg-border mt-[12px] mb-[20px] shrink-0" />

            {/* Right detail */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {!selectedSession && (
                <div className="flex-1 flex items-center justify-center">
                  <span className="font-sans text-sm text-[#93918E]">Select a session to view</span>
                </div>
              )}
              {selectedSession && (
                <div className="flex-1 flex flex-col overflow-y-auto">
                  {/* Header — aligned with History title */}
                  <div className="flex items-end justify-between px-[20px] pt-[20px] pb-[8px] shrink-0 sticky top-0 z-10 bg-background">
                    <div className="flex items-center gap-2 text-[10px] font-sans text-[#93918E]">
                      <span>{relativeTime(selectedSession.timestamp)}</span>
                      <span>·</span>
                      <span>{selectedSession.mode === "online" ? "Audio" : "Text"}</span>
                    </div>
                    <DownloadPopover
                      onCopy={() => { navigator.clipboard.writeText(buildExportMd(selectedSession)); }}
                      onExportMd={() => {
                        const md = buildExportMd(selectedSession);
                        const blob = new Blob([md], { type: "text/markdown" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        const d = new Date(selectedSession.timestamp);
                        a.download = "wdym-" + d.toISOString().slice(0, 10) + "-" + d.toTimeString().slice(0, 8).replace(/:/g, "") + ".md";
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-[10px] px-[20px]">
                    {(() => {
                      const sessionCards = selectedSession.cards ?? [];
                      const spk = selectedSession.speakers ?? new Map();
                      const groups: { speakerKey: string; speaker: string; cards: CoreMeaningCard[] }[] = [];
                      for (const card of sessionCards) {
                        const key = card.speakerId ?? "";
                        const name = spk.get(key) ?? "Speaker 1";
                        const last = groups[groups.length - 1];
                        if (last && last.speakerKey === key) last.cards.push(card);
                        else groups.push({ speakerKey: key, speaker: name, cards: [card] });
                      }
                      if (sessionCards.length === 0) {
                        return <div className="text-sm text-center mt-16 font-sans text-[#93918E]">Nothing was captured in this session.</div>;
                      }
                      return groups.map((group, gi) => (
                        <div key={gi} className="flex flex-col gap-[10px] px-[20px] py-[12px]">
                          {selectedSession.mode === "online" && (
                            <span className="font-sans font-semibold text-sm text-[#60594D]">{group.speaker}</span>
                          )}
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
                    {(selectedSession.recommendations ?? []).length > 0 && (
                      <div className="px-[20px] -mt-[8px]"><RecommendationTokens recommendations={selectedSession.recommendations!} /></div>
                    )}
                    {(selectedSession.transcriptTexts ?? []).length > 0 && (
                      <div className="px-[20px] py-[12px]">
                        <div className="font-sans font-semibold text-xs text-[#60594D] mb-2">Original transcript</div>
                        <div className="font-sans text-xs text-[#93918E] leading-relaxed">{selectedSession.transcriptTexts!.join(" ")}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-end px-[20px] py-[12px] shrink-0">
                <button className="text-muted hover:text-foreground transition-colors cursor-pointer bg-transparent border-none" onClick={handleClose} aria-label="Close history"><XIcon size={20} /></button>
              </div>
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
