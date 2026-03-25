/**
 * HomeScreen — editorial idle state.
 * Large serif title, BEGIN button, audio source toggle.
 */

import React from "react";
import { Button } from "./ui/button.js";
import { Toggle } from "./ui/toggle.js";

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
      <div className="flex flex-col items-center justify-center flex-1 gap-6">
        <p className="text-xs tracking-[0.2em] uppercase text-muted font-serif">What Do You Mean</p>

        <Button
          variant="outline"
          className="mt-8 px-12 py-3 h-auto text-xs tracking-[0.25em] uppercase font-semibold"
          onClick={onStart}
          aria-label="Start listening session"
        >
          Begin
        </Button>

        <Toggle
          variant="outline"
          size="sm"
          pressed={isSystem}
          onPressedChange={onToggleAudioSource}
          className="mt-2 text-xs text-muted"
          aria-label={isSystem ? "Switch to microphone only" : "Enable system audio capture"}
        >
          {isSystem ? "🎤🔊 Mic + System" : "🎤 Microphone Only"}
        </Toggle>
      </div>

      <div className="flex justify-between items-center px-8 py-5">
        <button
          className="text-xs tracking-[0.15em] uppercase text-muted hover:text-foreground transition-colors cursor-pointer bg-transparent border-none font-sans"
          onClick={onTextMode}
          aria-label="Switch to text input mode"
        >
          Text Mode
        </button>
        <button
          className="text-lg text-muted hover:text-foreground transition-colors cursor-pointer bg-transparent border-none"
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
