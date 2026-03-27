/**
 * HistoryPage — full-screen history view.
 * Title matches RecapScreen position. Content placeholder for future.
 */

import React from "react";
import { XIcon } from "./ui/x-icon.js";

interface Props {
  onClose: () => void;
}

export function HistoryPage({ onClose }: Props): React.JSX.Element {
  return (
    <div className="flex flex-col h-full bg-background" role="main" aria-label="History">
      {/* Title */}
      <div className="pl-[20px] pt-[12px] shrink-0">
        <h1 className="font-serif font-normal text-[20px] text-[#60594D]">History</h1>
      </div>

      {/* Content area — placeholder */}
      <div className="flex-1" />

      {/* Bottom bar — X close at right */}
      <div className="flex items-center justify-end px-[20px] pb-[20px] pt-[12px] shrink-0">
        <button
          className="text-muted hover:text-foreground transition-colors cursor-pointer bg-transparent border-none"
          onClick={onClose}
          aria-label="Close history"
        >
          <XIcon size={20} />
        </button>
      </div>
    </div>
  );
}
