/**
 * HomeScreen — editorial idle state.
 * Large serif title, BEGIN button, audio source toggle.
 */

import React from "react";
import { Button } from "./ui/button.js";
import { Toggle } from "./ui/toggle.js";
import { KeyboardIcon } from "./ui/keyboard-icon.js";
import { Menu } from "lucide-react";

interface Props {
  onStart: () => void;
  onTextMode: () => void;
  audioSource: "mic" | "mic+system";
  onToggleAudioSource: () => void;
  onExpand: () => void;
  panelOpen: boolean;
}

export function HomeScreen({ onStart, onTextMode, audioSource, onToggleAudioSource, onExpand, panelOpen }: Props): React.JSX.Element {
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
          className="text-muted hover:text-foreground transition-colors cursor-pointer bg-transparent border-none"
          onClick={onTextMode}
          aria-label="Switch to text input mode"
          title="Text Mode (⌘T)"
        >
          <KeyboardIcon size={20} />
        </button>
        {!panelOpen && (
          <button
            className="text-muted hover:text-foreground transition-colors cursor-pointer bg-transparent border-none"
            onClick={onExpand}
            title="Menu (⌘/)"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
