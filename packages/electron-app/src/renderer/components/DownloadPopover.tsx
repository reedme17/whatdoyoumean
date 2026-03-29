/**
 * DownloadPopover — download icon that opens a popover with Copy and MD export options.
 */

import React, { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover.js";
import { DownloadIcon } from "./ui/download-icon.js";
import { CopyIcon } from "./ui/copy-icon.js";
import { MdIcon } from "./ui/md-icon.js";

interface Props {
  onCopy: () => void;
  onExportMd: () => void;
}

export function DownloadPopover({ onCopy, onExportMd }: Props): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-muted hover:text-foreground transition-colors cursor-pointer bg-transparent border-none p-0" title="Download">
          <DownloadIcon size={18} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-auto px-4 py-3">
        <div className="flex items-center gap-4">
          <button
            className="relative text-muted hover:text-foreground transition-colors cursor-pointer bg-transparent border-none p-0"
            onClick={() => {
              onCopy();
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            title="Copy to clipboard"
          >
            <CopyIcon size={18} />
            {copied && (
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-sans text-[#60594D] bg-white/90 px-2 py-0.5 rounded-md shadow-sm" style={{ animation: "fadeInUp 0.2s ease-out" }}>
                Copied
              </div>
            )}
          </button>
          <button
            className="text-muted hover:text-foreground transition-colors cursor-pointer bg-transparent border-none p-0"
            onClick={onExportMd}
            title="Export as Markdown"
          >
            <MdIcon size={18} />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
