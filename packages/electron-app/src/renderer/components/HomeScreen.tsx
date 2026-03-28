/**
 * HomeScreen — editorial idle state.
 * Button morphs into bottom bar using fixed positioning for pixel-perfect animation.
 */

import React, { useState, useCallback, useRef } from "react";
import { motion, useAnimation } from "motion/react";
import { KeyboardIcon } from "./ui/keyboard-icon.js";
import { Menu } from "lucide-react";
import type { SttLanguage } from "./ExpandPanel.js";

interface Props {
  onStart: () => void;
  onTextMode: () => void;
  audioSource: "mic" | "mic+system";
  onToggleAudioSource: () => void;
  onExpand: () => void;
  panelOpen: boolean;
  sttLanguage: SttLanguage;
}

export function HomeScreen({ onStart, onTextMode, onExpand, panelOpen }: Props): React.JSX.Element {
  const [transitioning, setTransitioning] = useState(false);
  const [morphStyle, setMorphStyle] = useState<React.CSSProperties | null>(null);
  const [placeholderSize, setPlaceholderSize] = useState<{ w: number; h: number } | null>(null);
  const controls = useAnimation();
  const textControls = useAnimation();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const kbRef = useRef<HTMLButtonElement>(null);
  const [kbFixedStyle, setKbFixedStyle] = useState<React.CSSProperties | null>(null);

  const handleStart = useCallback(async () => {
    if (transitioning) return;
    setTransitioning(true);

    const button = buttonRef.current;
    if (!button) { onStart(); return; }

    const rect = button.getBoundingClientRect();

    // Save button size for placeholder before going fixed
    setPlaceholderSize({ w: rect.width, h: rect.height });

    // Fix keyboard icon in place too
    const kb = kbRef.current;
    if (kb) {
      const kbRect = kb.getBoundingClientRect();
      setKbFixedStyle({ position: "fixed", top: kbRect.top, left: kbRect.left, zIndex: 9998 });
    }

    // Switch button to fixed position at its current screen location
    setMorphStyle({
      position: "fixed",
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      borderRadius: 18,
      zIndex: 9999,
    });

    // Fade out everything else
    textControls.start({ opacity: 0, transition: { duration: 0.15 } });

    // Small delay to let fixed positioning apply
    await new Promise((r) => setTimeout(r, 50));

    // Animate to bottom bar position (bottom of window, full width)
    // BottomBar is ~158px tall with -mb-[100px], so top edge is at innerHeight - 60
    // but the element itself extends 100px below. Match that exactly.
    // Morph endpoint must match BottomBar's actual getBoundingClientRect() in LiveSession.
    // Measured: BottomBar top=413, height=267, innerHeight=480 → offset = innerHeight - top = 67
    // BottomBar has: py-[20px] + content + paddingBottom:220 - mb-[200px] = ~267px total, ~67px visible
    // If BottomBar layout changes, re-measure with the debug log in BottomBar.tsx
    await controls.start({
      top: window.innerHeight - 67,
      left: 0,
      width: window.innerWidth,
      height: 267,
      borderRadius: "16px 16px 10px 10px",
      transition: {
        type: "tween",
        ease: [0.7, 0.01, 0.23, 1.13],
        duration: 0.7,
      },
    });

    onStart();
  }, [transitioning, controls, textControls, onStart]);

  return (
    <div
      className="flex flex-col items-start justify-between w-full h-full bg-background p-[10px] overflow-hidden"
      role="main"
      aria-label="Home"
    >
      {/* Top — titlebar spacer */}
      <motion.div className="w-full shrink-0 h-[14px]" animate={textControls} />

      {/* Center — tagline + button group */}
      <div className="flex flex-col gap-[20px] items-center w-full shrink-0">
        <motion.p
          className="font-serif font-normal text-[20px] text-[#60594D]"
          animate={textControls}
        >
          Ready to interpret for you.
        </motion.p>
        <div className="flex items-center justify-center gap-[12px]">
          <div style={placeholderSize ? { width: placeholderSize.w, height: placeholderSize.h } : undefined}>
            <motion.button
            ref={buttonRef}
            animate={controls}
            whileTap={transitioning ? undefined : { scale: 0.96 }}
            className="flex items-center justify-center gap-2 px-4 py-2 min-h-[36px] bg-[#F0EDE8] font-sans font-bold text-sm text-[#5B5449] cursor-pointer border-none hover:bg-[#E8E4DE]"
            style={morphStyle ?? { borderRadius: 18 }}
            onClick={handleStart}
            aria-label="Start listening session"
          >
            <motion.span animate={textControls} className="whitespace-nowrap">Start listening</motion.span>
          </motion.button>
          </div>
          <motion.button
            ref={kbRef}
            className="text-muted hover:text-foreground transition-colors cursor-pointer bg-transparent border-none p-0 shrink-0"
            onClick={onTextMode}
            aria-label="Switch to text input mode"
            title="Text Mode (⌘T)"
            animate={textControls}
            style={kbFixedStyle ?? undefined}
          >
            <KeyboardIcon size={20} />
          </motion.button>
        </div>
      </div>

      {/* Bottom — menu icon */}
      <motion.div className="flex flex-col items-end p-[10px] w-full shrink-0" animate={textControls}>
        <button
          className="text-muted hover:text-foreground transition-colors cursor-pointer bg-transparent border-none p-0"
          onClick={onExpand}
          title="Menu (⌘/)"
          aria-label="Open menu"
          style={{ visibility: panelOpen ? "hidden" : "visible" }}
        >
          <Menu size={20} />
        </button>
      </motion.div>
    </div>
  );
}
