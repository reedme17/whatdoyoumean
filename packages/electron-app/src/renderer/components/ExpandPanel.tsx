/**
 * ExpandPanel — slide-out right panel using Sheet component.
 * Guest mode: shows Sign In at top, locked features marked with 🔒.
 * Signed in: full access to Profile, History, Settings, Terminology, About.
 */

import React, { useState } from "react";
import { Sheet, SheetHeader, SheetContent, SheetClose } from "./ui/sheet.js";
import { Button } from "./ui/button.js";
import { Separator } from "./ui/separator.js";
import { HistoryView } from "./HistoryView.js";
import { cn } from "../lib/utils.js";

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
  open,
  onClose,
  userId,
  isGuest,
  sessions,
  onOpenSession,
  onLogin,
  onLogout,
}: Props): React.JSX.Element | null {
  const [activeSection, setActiveSection] = useState<Section>("none");

  const toggle = (section: Section) =>
    setActiveSection((prev) => (prev === section ? "none" : section));

  const menuItem = (label: string, section: Section, locked = false) => (
    <React.Fragment key={section}>
      <button
        className={cn(
          "w-full text-left px-5 py-3 text-sm bg-transparent cursor-pointer font-[inherit]",
          locked && "opacity-50 cursor-not-allowed",
          activeSection === section ? "font-semibold text-foreground" : "text-muted",
          !locked && "hover:bg-accent"
        )}
        onClick={() => !locked && toggle(section)}
        disabled={locked}
      >
        {label}{locked ? " 🔒" : ""}
      </button>
      <Separator />
    </React.Fragment>
  );

  return (
    <Sheet open={open} onClose={onClose} className="w-80" aria-label="Navigation menu">
      <SheetHeader>
        <span />
        <SheetClose onClose={onClose} />
      </SheetHeader>

      <SheetContent aria-label="Main navigation">
        {/* Guest mode: Sign In button at top */}
        {isGuest && (
          <>
            <Button
              className="w-[calc(100%-40px)] mx-5 my-3"
              onClick={() => toggle("signin")}
            >
              Sign In
            </Button>
            {activeSection === "signin" && (
              <div className="px-5 pb-3">
                <div className="text-xs text-muted mb-3">
                  Sign in to unlock History, Memory, Sync, and more.
                </div>
                <div className="flex flex-col gap-2">
                  <Button variant="outline" onClick={() => { onLogin("user_apple_" + Date.now()); onClose(); }}>
                    Sign in with Apple
                  </Button>
                  <Button variant="outline" onClick={() => { onLogin("user_google_" + Date.now()); onClose(); }}>
                    Sign in with Google
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => { onLogin("user_email_" + Date.now()); onClose(); }}>
                    Sign in with Email
                  </Button>
                </div>
              </div>
            )}
            <Separator />
          </>
        )}

        {/* Signed in: Profile */}
        {!isGuest && menuItem("Profile", "profile")}
        {!isGuest && activeSection === "profile" && (
          <div className="px-5 py-3 text-sm text-muted">
            <div className="mb-2">User: {userId}</div>
            <div className="mb-2">Sessions: {sessions.length}</div>
            <Button variant="outline" onClick={onLogout}>Sign Out</Button>
          </div>
        )}

        {/* History: locked in guest mode */}
        {menuItem("History", "history", isGuest)}
        {!isGuest && activeSection === "history" && (
          <div className="max-h-[300px] overflow-y-auto">
            <HistoryView sessions={sessions} onOpenSession={onOpenSession} />
          </div>
        )}

        {/* Settings */}
        {menuItem("Settings", "settings")}
        {activeSection === "settings" && (
          <div className="px-5 py-3 text-sm text-muted">
            <div className="mb-2">Language: English / 中文</div>
            <div className="mb-2">STT Mode: Auto</div>
            {!isGuest && (
              <>
                <div className="mb-2">LLM Provider: Auto</div>
                <div>Memory: Enabled</div>
              </>
            )}
          </div>
        )}

        {/* Terminology: locked in guest mode */}
        {menuItem("Terminology", "terminology", isGuest)}
        {!isGuest && activeSection === "terminology" && (
          <div className="px-5 py-3 text-sm text-muted">
            No learned terms yet. Terms will appear here as you use the app.
          </div>
        )}

        {/* About */}
        {menuItem("About", "about")}
        {activeSection === "about" && (
          <div className="px-5 py-3 text-sm text-muted">
            <div className="font-semibold mb-1">啥意思 — What Do You Mean</div>
            <div>Version 0.1.0</div>
            <div className="mt-2">Real-time conversation understanding tool.</div>
          </div>
        )}

        {/* Signed in: Sign Out at bottom */}
        {!isGuest && (
          <>
            <button
              className="w-full text-left px-5 py-3 text-sm text-muted bg-transparent cursor-pointer hover:bg-accent font-[inherit]"
              onClick={onLogout}
            >
              Sign Out
            </button>
            <Separator />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
