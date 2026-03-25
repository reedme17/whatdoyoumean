/**
 * HomeScreen — idle state.
 * Large START button center, audio source toggle, Text Mode bottom-left, expand (≡) bottom-right.
 */

import React from "react";
import { Button } from "./ui/button.js";
import { Toggle } from "./ui/toggle.js";
import { Badge } from "./ui/badge.js";

interface Props {
  onStart: () => void;
  onTextMode: () => void;
  onExpand: () => void;
  audioSource: "mic" | "mic+system";
  onToggleAudioSource: () => void;
}

export function HomeScreen({ onStart, onTextMode, onExpand, audioSource, onToggleAudioSource }: Props): React.JSX.Element {
  const isSystem = audioSource === "mic+system";

  return (
    <div className="flex flex-col w-full h-full bg-background text-foreground" role="main" aria-label="Home">
      {/* Center: START button + audio source toggle */}
      <div className="flex flex-col items-center justify-center flex-1 gap-4">
        <Button
          className="text-xl font-semibold px-14 py-5 h-auto tracking-widest rounded-lg"
          onClick={onStart}
          aria-label="Start listening session"
        >
          START
        </Button>

        <Toggle
          variant="outline"
          size="sm"
          pressed={isSystem}
          onPressedChange={onToggleAudioSource}
          aria-label={isSystem ? "Switch to microphone only" : "Enable system audio capture"}
        >
          {isSystem ? "🎤🔊 Mic + System" : "🎤 Mic Only"}
          {isSystem && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-1">
              ⚠ experimental
            </Badge>
          )}
        </Toggle>
      </div>

      {/* Bottom bar: Text Mode left, expand right */}
      <div className="flex justify-between items-center px-6 py-4">
        <Button variant="ghost" onClick={onTextMode} aria-label="Switch to text input mode">
          Text Mode
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-xl"
          onClick={onExpand}
          title="Menu (⌘/)"
          aria-label="Open menu"
        >
          ≡
        </Button>
      </div>
    </div>
  );
}
