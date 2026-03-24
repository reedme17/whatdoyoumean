/**
 * HistoryView — list of past sessions with search.
 * Tapping a session opens it in Recap view.
 */

import React, { useState } from "react";
import type { SessionSummary } from "./ExpandPanel.js";
import { base, colors } from "../styles.js";

interface Props {
  sessions: SessionSummary[];
  onOpenSession: (sessionId: string) => void;
}

export function HistoryView({ sessions, onOpenSession }: Props): React.JSX.Element {
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? sessions.filter(
        (s) =>
          s.topicSummary.toLowerCase().includes(search.toLowerCase()) ||
          s.date.includes(search)
      )
    : sessions;

  return (
    <div style={{ padding: "0 0 12px 0" }} role="region" aria-label="Session history">
      {/* Search */}
      <div style={{ padding: "8px 16px" }}>
        <input
          style={base.input}
          placeholder="Search sessions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search sessions"
        />
      </div>

      {/* Session list */}
      {filtered.length === 0 && (
        <div style={{ padding: "16px", fontSize: 13, color: colors.muted, textAlign: "center" }}>
          {search ? "No matching sessions." : "No sessions yet."}
        </div>
      )}

      {filtered.map((session) => (
        <button
          key={session.id}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            padding: "10px 16px",
            border: "none",
            borderBottom: `1px solid ${colors.border}`,
            background: "transparent",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
          onClick={() => onOpenSession(session.id)}
        >
          <div style={{ fontSize: 13, fontWeight: 500 }}>
            {session.date} — {session.durationMin}min
            {session.mode === "text" && " (text mode)"}
          </div>
          <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
            {session.topicSummary || "Untitled session"}
          </div>
        </button>
      ))}
    </div>
  );
}
