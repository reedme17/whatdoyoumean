/**
 * RecommendationTokens — response suggestions as pills.
 * Corner-down-right icon + pill-shaped tokens in a row.
 */

import React from "react";
import type { Recommendation } from "@wdym/shared";
import { CornerDownRightIcon } from "./ui/corner-down-right-icon.js";

interface Props {
  recommendations: Recommendation[];
}

export function RecommendationTokens({ recommendations }: Props): React.JSX.Element | null {
  const valid = recommendations.filter((r) => r.text?.trim());

  if (valid.length === 0) {
    if (recommendations.length === 0) return null;
    return (
      <div className="flex items-center gap-2 py-0 bg-background screen-enter">
        <CornerDownRightIcon size={14} className="text-[#93918E] shrink-0" />
        <span className="text-[10px] font-sans text-[#93918E]">No available response recommendation</span>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Recommendations"
      className="flex items-center gap-2 py-0 bg-background screen-enter"
    >
      <CornerDownRightIcon size={14} className="text-[#93918E] shrink-0" />
      <div className="flex flex-wrap gap-1.5">
        {valid.map((rec) => (
          <span
            key={rec.id}
            className="text-[10px] px-2.5 py-0.5 rounded-full border border-border bg-transparent text-[#60594D] font-sans font-medium"
            title={rec.reasoning}
          >
            {rec.text}
          </span>
        ))}
      </div>
    </div>
  );
}
