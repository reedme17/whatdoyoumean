/**
 * HomeScreen — idle state after login.
 * Large START button center, Text Mode bottom-left, expand (≡) bottom-right.
 */

import React from "react";
import { base, colors } from "../styles.js";

interface Props {
  onStart: () => void;
  onTextMode: () => void;
  onExpand: () => void;
}

export function HomeScreen({ onStart, onTextMode, onExpand }: Props): React.JSX.Element {
  return (
    <div style={base.screen} role="main" aria-label="Home">
      {/* Center: START button */}
      <div style={base.center}>
        <button
          style={{
            ...base.btn,
            fontSize: 20,
            fontWeight: 600,
            padding: "18px 56px",
            borderRadius: 8,
            letterSpacing: 2,
          }}
          onClick={onStart}
          aria-label="Start listening session"
        >
          START
        </button>
      </div>

      {/* Bottom bar: Text Mode left, expand right */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 24px",
        }}
      >
        <button style={base.btnGhost} onClick={onTextMode} aria-label="Switch to text input mode">
          Text Mode
        </button>
        <button
          style={{ ...base.btnGhost, fontSize: 20, padding: "4px 8px" }}
          onClick={onExpand}
          title="Menu (⌘/)"
          aria-label="Open menu"
        >
          ≡
        </button>
      </div>
    </div>
  );
}
