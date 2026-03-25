/**
 * BottomBar — editorial session controls.
 * Waveform left, flag center (red when active), stop right.
 */

import React from "react";
import { Waveform } from "./Waveform.js";

interface Props {
  onFlag: () => void;
  onStop: () => void;
  analyser?: AnalyserNode | null;
  isCapturing?: boolean;
}

export function BottomBar({ onFlag, onStop, analyser = null, isCapturing = false }: Props): React.JSX.Element {
  return (
    <div
      role="toolbar"
      aria-label="Session controls"
      className="flex items-center justify-between px-8 py-3 border-t border-border bg-background"
    >
      <div role="status" aria-live="polite" className="flex items-center gap-2">
        <Waveform analyser={analyser} isCapturing={isCapturing} />
      </div>

      <button
        className="text-lg hover:text-[var(--color-editorial-red)] transition-colors cursor-pointer bg-transparent border-none"
        onClick={onFlag}
        title="Flag this moment (⌘B)"
        aria-label="Flag this moment"
      >
        ⚑
      </button>

      <button
        className="text-xs tracking-[0.15em] uppercase text-muted hover:text-foreground transition-colors cursor-pointer bg-transparent border-none font-sans"
        onClick={onStop}
        title="Stop session (⌘⇧S)"
        aria-label="Stop session"
      >
        ■ End
      </button>
    </div>
  );
}
