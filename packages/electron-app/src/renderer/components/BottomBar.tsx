/**
 * BottomBar — session control bar for live sessions.
 * Left: waveform visualization
 * Center: Flag button (⚑)
 * Right: Stop button (■)
 */

import React from "react";
import { Button } from "./ui/button.js";
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
      className="flex items-center justify-between px-5 py-2.5 border-t border-border bg-background"
    >
      {/* Left: waveform */}
      <div role="status" aria-live="polite" className="flex items-center gap-2">
        <Waveform analyser={analyser} isCapturing={isCapturing} />
      </div>

      {/* Center: flag */}
      <Button variant="outline" className="px-4 py-2 text-base" onClick={onFlag} title="Flag this moment (⌘B)" aria-label="Flag this moment">
        ⚑
      </Button>

      {/* Right: stop */}
      <Button className="px-4 py-2 text-sm" onClick={onStop} title="Stop session (⌘⇧S)" aria-label="Stop session">
        ■ Stop
      </Button>
    </div>
  );
}
