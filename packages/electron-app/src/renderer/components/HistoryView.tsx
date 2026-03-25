/**
 * HistoryView — list of past sessions with search.
 * Tapping a session opens it in Recap view.
 */

import React, { useState } from "react";
import type { SessionSummary } from "./ExpandPanel.js";
import { Input } from "./ui/input.js";

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
    <div className="pb-3" role="region" aria-label="Session history">
      {/* Search */}
      <div className="px-4 py-2">
        <Input
          placeholder="Search sessions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search sessions"
        />
      </div>

      {/* Session list */}
      {filtered.length === 0 && (
        <div className="p-4 text-sm text-muted text-center">
          {search ? "No matching sessions." : "No sessions yet."}
        </div>
      )}

      {filtered.map((session) => (
        <button
          key={session.id}
          className="block w-full text-left px-4 py-2.5 border-b border-border bg-transparent cursor-pointer hover:bg-accent font-[inherit]"
          onClick={() => onOpenSession(session.id)}
        >
          <div className="text-sm font-medium">
            {session.date} — {session.durationMin}min
            {session.mode === "text" && " (text mode)"}
          </div>
          <div className="text-xs text-muted mt-0.5">
            {session.topicSummary || "Untitled session"}
          </div>
        </button>
      ))}
    </div>
  );
}
