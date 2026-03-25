/**
 * RecommendationTokens — floating recommendation badges.
 * Tap to copy text to clipboard.
 */

import React, { useState } from "react";
import type { Recommendation } from "@wdym/shared";
import { Badge } from "./ui/badge.js";

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
      className="flex flex-wrap gap-2 px-4 py-2 border-t border-border bg-background"
    >
      <span className="text-[11px] text-muted self-center">Recommendations</span>
      {recommendations.map((rec) => (
        <Badge
          key={rec.id}
          className={
            copiedId === rec.id
              ? "bg-foreground text-background transition-all duration-150"
              : "transition-all duration-150"
          }
          onClick={() => handleCopy(rec)}
          title={rec.reasoning}
          aria-label={`Copy recommendation: ${rec.text}`}
        >
          {copiedId === rec.id ? "Copied!" : rec.text}
        </Badge>
      ))}
    </div>
  );
}
