/**
 * RecommendationTokens — response suggestions as pills.
 * Corner-down-right icon + pill-shaped tokens in a row.
 */

import React, { useState } from "react";
import type { Recommendation } from "@wdym/shared";
import { CornerDownRightIcon } from "./ui/corner-down-right-icon.js";

interface Props {
  recommendations: Recommendation[];
}

export function RecommendationTokens({ recommendations }: Props): React.JSX.Element | null {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (recommendations.length === 0) return null;

  const handleCopy = async (rec: Recommendation) => {
    try {
      await navigator.clipboard.writeText(rec.text);
      setCopiedId(rec.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // clipboard may not be available
    }
  };

  return (
    <div
      role="region"
      aria-label="Recommendations"
      className="flex items-center gap-2 px-[20px] py-2 bg-background"
    >
      <CornerDownRightIcon size={14} className="text-[#93918E] shrink-0" />
      <div className="flex flex-wrap gap-1.5">
        {recommendations.map((rec) => (
          <button
            key={rec.id}
            className="text-[10px] px-2.5 py-0.5 rounded-full border border-border bg-transparent hover:bg-[#F0EDE8] text-[#60594D] hover:text-[#5B5449] transition-colors cursor-pointer font-sans font-medium"
            onClick={() => handleCopy(rec)}
            title={rec.reasoning}
            aria-label={`Copy recommendation: ${rec.text}`}
          >
            {copiedId === rec.id ? "Copied" : rec.text}
          </button>
        ))}
      </div>
    </div>
  );
}
