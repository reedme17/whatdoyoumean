/**
 * BottomBar — listening session controls with layout animation.
 * Shares layoutId="session-bar" with HomeScreen button for morph transition.
 */

import React from "react";
import { motion } from "motion/react";
import { MapPinPlusIcon } from "./ui/map-pin-plus-icon.js";
import { Square } from "lucide-react";

interface Props {
  onFlag: () => void;
  onStop: () => void;
  analyser?: AnalyserNode | null;
  isCapturing?: boolean;
}

export function BottomBar({ onFlag, onStop }: Props): React.JSX.Element {
  return (
    <motion.div
      role="toolbar"
      aria-label="Session controls"
      className="flex items-start justify-between h-[148px] px-[19px] pt-[14px] bg-[#F0EDE8] w-full -mb-[100px]"
      style={{ borderRadius: "16px 16px 10px 10px" }}
    >
      {/* Left — Listening status */}
      <motion.div
        className="flex-1 min-w-0 min-h-px"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.25 }}
      >
        <span className="font-sans font-medium text-sm text-[#93918E]">
          Listening...
        </span>
      </motion.div>

      {/* Center — Flag/bookmark */}
      <motion.button
        className="shrink-0 text-[#93918E] hover:text-foreground transition-colors cursor-pointer bg-transparent border-none p-0"
        onClick={onFlag}
        title="Flag this moment (⌘B)"
        aria-label="Flag this moment"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.25 }}
      >
        <MapPinPlusIcon size={20} />
      </motion.button>

      {/* Right — End session */}
      <motion.div
        className="flex-1 min-w-0 min-h-px flex items-center justify-end gap-[6px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.25 }}
      >
        <button
          className="flex items-center gap-[6px] text-sm font-sans font-medium text-[#93918E] hover:text-foreground transition-colors cursor-pointer bg-transparent border-none p-0"
          onClick={onStop}
          title="Stop session (⌘⇧S)"
          aria-label="Stop session"
        >
          <Square size={10} fill="currentColor" strokeWidth={0} />
          End
        </button>
      </motion.div>
    </motion.div>
  );
}
