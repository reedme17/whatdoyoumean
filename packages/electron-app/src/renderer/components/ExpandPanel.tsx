/**
 * ExpandPanel — shadcn Drawer (vaul) from right side.
 * X close button at bottom-right, same position as menu icon.
 */

import React, { useState } from "react";
import { Drawer, DrawerContent } from "./ui/drawer.js";
import { SidebarButton } from "./ui/sidebar-button.js";
import { Button } from "./ui/button.js";
import { HistoryView } from "./HistoryView.js";
import { XIcon } from "./ui/x-icon.js";

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
}

type Section = "none" | "signin" | "profile" | "history" | "settings" | "terminology" | "about";

export function ExpandPanel({
  open, onClose, userId, isGuest, sessions, onOpenSession, onLogin, onLogout,
}: Props): React.JSX.Element {
  const [activeSection, setActiveSection] = useState<Section>("none");
  const toggle = (s: Section) => setActiveSection((p) => (p === s ? "none" : s));

  return (
    <Drawer direction="right" open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DrawerContent>
        <nav className="p-3 pt-12 flex flex-col gap-1 overflow-y-auto flex-1" aria-label="Main navigation">
          {isGuest && (
            <>
              <Button variant="outline" className="w-full mb-2 text-xs tracking-[0.15em] uppercase" onClick={() => toggle("signin")}>Sign In</Button>
              {activeSection === "signin" && (
                <div className="px-3 pb-3">
                  <div className="text-xs text-muted mb-3 font-sans">Unlock History, Memory, Sync.</div>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => { onLogin("user_apple_" + Date.now()); onClose(); }}>Apple</Button>
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => { onLogin("user_google_" + Date.now()); onClose(); }}>Google</Button>
                  </div>
                </div>
              )}
            </>
          )}
          {!isGuest && <SidebarButton active={activeSection === "profile"} onClick={() => toggle("profile")}>Profile</SidebarButton>}
          {!isGuest && activeSection === "profile" && (
            <div className="px-3 py-2 text-xs text-muted font-sans">
              <div className="mb-1">{userId}</div>
              <div className="mb-2">{sessions.length} sessions</div>
            </div>
          )}
          <SidebarButton active={activeSection === "history"} locked={isGuest} onClick={() => toggle("history")}>History</SidebarButton>
          {!isGuest && activeSection === "history" && (
            <div className="max-h-[250px] overflow-y-auto"><HistoryView sessions={sessions} onOpenSession={onOpenSession} /></div>
          )}
          <SidebarButton active={activeSection === "settings"} onClick={() => toggle("settings")}>Settings</SidebarButton>
          {activeSection === "settings" && (
            <div className="px-3 py-2 text-xs text-muted font-sans leading-relaxed">
              <div className="mb-1">Language: English / 中文</div>
              <div>STT: Auto</div>
            </div>
          )}
          <SidebarButton active={activeSection === "terminology"} locked={isGuest} onClick={() => toggle("terminology")}>Terminology</SidebarButton>
          {!isGuest && activeSection === "terminology" && (
            <div className="px-3 py-2 text-xs text-muted font-sans italic">No learned terms yet.</div>
          )}
          <SidebarButton active={activeSection === "about"} onClick={() => toggle("about")}>About</SidebarButton>
          {activeSection === "about" && (
            <div className="px-3 py-2 text-xs text-muted font-sans">
              <div className="font-serif text-sm text-foreground mb-1">啥意思</div>
              <div>v0.1.0</div>
            </div>
          )}
          {!isGuest && <div className="mt-auto pt-4"><SidebarButton onClick={onLogout}>Sign Out</SidebarButton></div>}
        </nav>

        {/* X close button — positioned at bottom-right of drawer, matching menu icon position */}
        <div className="flex justify-end px-[19px] py-[19px]">
          <button
            className="text-muted hover:text-foreground transition-colors cursor-pointer bg-transparent border-none"
            onClick={onClose}
            aria-label="Close menu"
          >
            <XIcon size={20} />
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
