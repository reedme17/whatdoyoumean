/**
 * ExpandPanel — slide-out right panel.
 * Guest mode: shows Sign In at top, locked features marked with 🔒.
 * Signed in: full access to Profile, History, Settings, Terminology, About.
 */

import React, { useState } from "react";
import { base, colors } from "../styles.js";
import { LoginScreen } from "./LoginScreen.js";
import { HistoryView } from "./HistoryView.js";

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

  if (!open) return null;

  const menuItem = (label: string, section: Section, locked = false) => (
    <button
      key={section}
      style={{
        ...base.btnGhost,
        width: "100%",
        textAlign: "left",
        padding: "12px 20px",
        fontSize: 14,
        fontWeight: activeSection === section ? 600 : 400,
        color: locked ? colors.muted : activeSection === section ? colors.fg : colors.muted,
        borderBottom: `1px solid ${colors.border}`,
        borderRadius: 0,
        opacity: locked ? 0.5 : 1,
      }}
      onClick={() => {
        if (locked) return;
        setActiveSection(activeSection === section ? "none" : section);
      }}
      disabled={locked}
    >
      {label}{locked ? " 🔒" : ""}
    </button>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        role="presentation"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.15)",
          zIndex: 99,
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label="Navigation menu"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 320,
          background: colors.bg,
          borderLeft: `1px solid ${colors.border}`,
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ ...base.topBar, justifyContent: "flex-end" }}>
          <button style={base.btnGhost} onClick={onClose} aria-label="Close menu">
            ✕
          </button>
        </div>

        {/* Menu items */}
        <nav style={{ flex: 1, overflowY: "auto" }} aria-label="Main navigation">

          {/* Guest mode: Sign In button at top */}
          {isGuest && (
            <>
              <button
                style={{
                  ...base.btn,
                  width: "calc(100% - 40px)",
                  margin: "12px 20px",
                  textAlign: "center",
                }}
                onClick={() => setActiveSection(activeSection === "signin" ? "none" : "signin")}
              >
                Sign In
              </button>
              {activeSection === "signin" && (
                <div style={{ padding: "0 20px 12px" }}>
                  <div style={{ fontSize: 12, color: colors.muted, marginBottom: 12 }}>
                    Sign in to unlock History, Memory, Sync, and more.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <button style={base.btnOutline} onClick={() => { onLogin("user_apple_" + Date.now()); onClose(); }}>
                      Sign in with Apple
                    </button>
                    <button style={base.btnOutline} onClick={() => { onLogin("user_google_" + Date.now()); onClose(); }}>
                      Sign in with Google
                    </button>
                    <button style={{ ...base.btnGhost, fontSize: 12 }} onClick={() => { onLogin("user_email_" + Date.now()); onClose(); }}>
                      Sign in with Email
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Signed in: Profile */}
          {!isGuest && menuItem("Profile", "profile")}
          {!isGuest && activeSection === "profile" && (
            <div style={{ padding: "12px 20px", fontSize: 13, color: colors.muted }}>
              <div style={{ marginBottom: 8 }}>User: {userId}</div>
              <div style={{ marginBottom: 8 }}>Sessions: {sessions.length}</div>
              <button style={base.btnOutline} onClick={onLogout}>
                Sign Out
              </button>
            </div>
          )}

          {/* History: locked in guest mode */}
          {menuItem("History", "history", isGuest)}
          {!isGuest && activeSection === "history" && (
            <div style={{ maxHeight: 300, overflowY: "auto" }}>
              <HistoryView sessions={sessions} onOpenSession={onOpenSession} />
            </div>
          )}

          {/* Settings: available in both modes (limited in guest) */}
          {menuItem("Settings", "settings")}
          {activeSection === "settings" && (
            <div style={{ padding: "12px 20px", fontSize: 13, color: colors.muted }}>
              <div style={{ marginBottom: 8 }}>Language: English / 中文</div>
              <div style={{ marginBottom: 8 }}>STT Mode: Auto</div>
              {!isGuest && (
                <>
                  <div style={{ marginBottom: 8 }}>LLM Provider: Auto</div>
                  <div>Memory: Enabled</div>
                </>
              )}
            </div>
          )}

          {/* Terminology: locked in guest mode */}
          {menuItem("Terminology", "terminology", isGuest)}
          {!isGuest && activeSection === "terminology" && (
            <div style={{ padding: "12px 20px", fontSize: 13, color: colors.muted }}>
              No learned terms yet. Terms will appear here as you use the app.
            </div>
          )}

          {/* About: always available */}
          {menuItem("About", "about")}
          {activeSection === "about" && (
            <div style={{ padding: "12px 20px", fontSize: 13, color: colors.muted }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>啥意思 — What Do You Mean</div>
              <div>Version 0.1.0</div>
              <div style={{ marginTop: 8 }}>
                Real-time conversation understanding tool.
              </div>
            </div>
          )}

          {/* Signed in: Sign Out at bottom */}
          {!isGuest && (
            <button
              style={{
                ...base.btnGhost,
                width: "100%",
                textAlign: "left",
                padding: "12px 20px",
                fontSize: 14,
                color: colors.muted,
                borderBottom: `1px solid ${colors.border}`,
                borderRadius: 0,
              }}
              onClick={onLogout}
            >
              Sign Out
            </button>
          )}
        </nav>
      </div>
    </>
  );
}
