/**
 * BottomBar — session control bar for live sessions.
 * Left: "● Listening..." status
 * Center: Flag button (⚑)
 * Right: Stop button (■)
 */

import React from "react";
import { base, colors } from "../styles.js";

interface Props {
  onFlag: () => void;
  onStop: () => void;
}

export function BottomBar({ onFlag, onStop }: Props): React.JSX.Element {
  return (
    <div
      role="toolbar"
      aria-label="Session controls"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 20px",
        borderTop: `1px solid ${colors.border}`,
        background: colors.bg,
      }}
    >
      {/* Left: listening indicator */}
      <div role="status" aria-live="polite" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: colors.fg,
            animation: "pulse 2s infinite",
          }}
        />
        <span style={{ color: colors.muted }}>Listening...</span>
      </div>

      {/* Center: flag */}
      <button
        style={{ ...base.btnOutline, padding: "8px 16px", fontSize: 16 }}
        onClick={onFlag}
        title="Flag this moment (⌘B)"
        aria-label="Flag this moment"
      >
        ⚑
      </button>

      {/* Right: stop */}
      <button
        style={{ ...base.btn, padding: "8px 16px", fontSize: 14 }}
        onClick={onStop}
        title="Stop session (⌘⇧S)"
        aria-label="Stop session"
      >
        ■ Stop
      </button>
    </div>
  );
}
