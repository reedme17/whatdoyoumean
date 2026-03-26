/**
 * BottomBar — listening session controls + pending text preview.
 * Bubble expands upward when pending text arrives. Listening row stays at bottom.
 */

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { MapPinPlusIcon } from "./ui/map-pin-plus-icon.js";
import { Waveform } from "./Waveform.js";
import { Square } from "lucide-react";

interface Props {
  onFlag: () => void;
  onStop: () => void;
  analyser?: AnalyserNode | null;
  isCapturing?: boolean;
  pendingPreview?: string;
}

export function BottomBar({ onFlag, onStop, analyser = null, isCapturing = false, pendingPreview = "" }: Props): React.JSX.Element {
  return (
    <motion.div
      layout
      role="toolbar"
      aria-label="Session controls"
      className="flex flex-col gap-[20px] items-start px-[19px] py-[14px] bg-[#F0EDE8] w-full -mb-[100px]"
      style={{ borderRadius: "16px 16px 10px 10px", paddingBottom: 114 }}
      transition={{ type: "tween", ease: [0.4, 0, 0.2, 1], duration: 0.3 }}
    >
      {/* Pending text — appears above controls, pushes bubble up */}
      <AnimatePresence>
        {pendingPreview && (
          <motion.div
            className="flex flex-col gap-[4px]"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <span className="font-sans font-semibold text-sm text-[#60594D]">Speaker 1</span>
            <span className="font-sans font-medium text-sm text-[#171717]">{pendingPreview}...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls row — always at bottom */}
      <div className="flex items-center justify-between w-full">
        {/* Left — Listening + waveform */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="font-sans font-medium text-sm text-[#93918E] whitespace-nowrap">
            Listening...
          </span>
          <Waveform analyser={analyser} isCapturing={isCapturing} width={60} height={16} />
        </div>

        {/* Center — Flag/bookmark */}
        <button
          className="shrink-0 text-[#93918E] hover:text-foreground transition-colors cursor-pointer bg-transparent border-none p-0"
          onClick={onFlag}
          title="Flag this moment (⌘B)"
          aria-label="Flag this moment"
        >
          <MapPinPlusIcon size={20} />
        </button>

        {/* Right — End session */}
        <div className="flex-1 min-w-0 flex items-center justify-end gap-[6px]">
          <button
            className="flex items-center gap-[6px] text-sm font-sans font-medium text-[#93918E] hover:text-foreground transition-colors cursor-pointer bg-transparent border-none p-0"
            onClick={onStop}
            title="Stop session (⌘⇧S)"
            aria-label="Stop session"
          >
            <Square size={10} fill="currentColor" strokeWidth={0} />
            End
          </button>
        </div>
      </div>
    </motion.div>
  );
}
