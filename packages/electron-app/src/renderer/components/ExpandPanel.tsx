/**
 * ExpandPanel — shadcn Drawer (vaul) from right side.
 * History: panel expands to full width.
 * Settings/About: CSS accordion animation.
 */

import React, { useState } from "react";
import { Drawer, DrawerContent } from "./ui/drawer.js";
import { SidebarButton } from "./ui/sidebar-button.js";
import { XIcon } from "./ui/x-icon.js";
import { ChevronIcon } from "./ui/chevron-icon.js";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs.js";

export type SttLanguage = "zh+en" | "en" | "zh" | "auto";

export interface SessionSummary {
  id: string;
  date: string;
  durationMin: number;
  topicSummary: string;
  mode: "online" | "offline" | "text";
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
}

type Section = "none" | "settings" | "about";
type PanelView = "menu" | "history";

const EXPAND_TRANSITION = "width 0.5s cubic-bezier(0.32, 0.72, 0, 1), border-radius 0.5s cubic-bezier(0.32, 0.72, 0, 1)";
const ACC_OPEN: React.CSSProperties = { maxHeight: 200, opacity: 1, transition: "max-height 0.25s ease-out, opacity 0.2s ease-out", overflow: "hidden" };
const ACC_CLOSED: React.CSSProperties = { maxHeight: 0, opacity: 0, transition: "max-height 0.25s ease-out, opacity 0.2s ease-out", overflow: "hidden" };

export function ExpandPanel({
  open, onClose, sttLanguage, onSttLanguageChange, responseEnabled = false, onResponseEnabledChange,
}: Props): React.JSX.Element {
  const [activeSection, setActiveSection] = useState<Section>("none");
  const [view, setView] = useState<PanelView>("menu");
  const toggle = (s: Section) => setActiveSection((p) => (p === s ? "none" : s));

  const handleClose = () => {
    onClose();
    setTimeout(() => { setView("menu"); setActiveSection("none"); }, 550);
  };

  const expanded = view === "history";

  return (
    <Drawer direction="right" open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DrawerContent
        style={{
          width: expanded ? "100%" : undefined,
          borderRadius: expanded ? 0 : undefined,
          transition: EXPAND_TRANSITION,
        }}
      >
        {view === "menu" && (
          <>
            <nav className="p-3 pt-12 flex flex-col gap-1 overflow-y-auto flex-1" aria-label="Main navigation">
              <SidebarButton onClick={() => { setActiveSection("none"); setView("history"); }}>History</SidebarButton>

              {/* Settings — accordion */}
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
                        <TabsList>
                          <TabsTrigger value="multi">Multi</TabsTrigger>
                          <TabsTrigger value="cn">中文</TabsTrigger>
                          <TabsTrigger value="en">EN</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-sans font-medium text-[#60594D]">Source</span>
                      <Tabs defaultValue="both">
                        <TabsList>
                          <TabsTrigger value="both">Both</TabsTrigger>
                          <TabsTrigger value="mic">Mic</TabsTrigger>
                          <TabsTrigger value="internal">Internal</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-sans font-medium text-[#60594D]">Response recommendation</span>
                      <Tabs value={responseEnabled ? "on" : "off"} onValueChange={(v) => onResponseEnabledChange?.(v === "on")}>
                        <TabsList>
                          <TabsTrigger value="on">On</TabsTrigger>
                          <TabsTrigger value="off">Off</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                  </div>
                </div>
              </div>

              {/* About — accordion */}
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
            </nav>

            <div className="flex items-center justify-end px-[20px] py-[20px]">
              <button
                className="text-muted hover:text-foreground transition-colors cursor-pointer bg-transparent border-none"
                onClick={handleClose}
                aria-label="Close menu"
              >
                <XIcon size={20} />
              </button>
            </div>
          </>
        )}

        {view === "history" && (
          <div className="flex flex-col h-full" style={{ paddingTop: 38 }}>
            <div className="pl-[20px] pt-[12px] shrink-0">
              <h1 className="font-serif font-normal text-[20px] text-[#60594D]">History</h1>
            </div>
            <div className="flex-1" />
            <div className="flex items-center justify-end px-[20px] pb-[20px] pt-[12px] shrink-0">
              <button className="text-muted hover:text-foreground transition-colors cursor-pointer bg-transparent border-none" onClick={handleClose} aria-label="Close history">
                <XIcon size={20} />
              </button>
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
