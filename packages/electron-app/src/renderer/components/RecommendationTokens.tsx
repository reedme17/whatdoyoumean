/**
 * RecommendationTokens — editorial recommendation pills.
 * Uppercase, letter-spaced, warm gray border.
 */

import React, { useState } from "react";
import type { Recommendation } from "@wdym/shared";

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
      className="flex flex-wrap gap-2 px-8 py-3 border-t border-border bg-background"
    >
      {recommendations.map((rec) => (
        <button
          key={rec.id}
          className="text-[11px] tracking-[0.05em] px-3 py-1 border border-border bg-transparent hover:bg-secondary text-muted hover:text-foreground transition-colors cursor-pointer font-sans"
          onClick={() => handleCopy(rec)}
          title={rec.reasoning}
          aria-label={`Copy recommendation: ${rec.text}`}
        >
          {copiedId === rec.id ? "Copied" : rec.text}
        </button>
      ))}
    </div>
  );
}
