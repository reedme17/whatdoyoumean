/**
 * RecommendationTokens — floating recommendation badges.
 * Tap to copy text to clipboard.
 */

import React, { useState } from "react";
import type { Recommendation } from "@wdym/shared";
import { base, colors } from "../styles.js";

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
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        padding: "8px 16px",
        borderTop: `1px solid ${colors.border}`,
        background: colors.bg,
      }}
    >
      <span style={{ fontSize: 11, color: colors.muted, alignSelf: "center" }}>
        Recommendations
      </span>
      {recommendations.map((rec) => (
        <button
          key={rec.id}
          style={{
            ...base.badge,
            background: copiedId === rec.id ? colors.fg : colors.bg,
            color: copiedId === rec.id ? colors.bg : colors.fg,
            transition: "all 0.15s",
          }}
          onClick={() => handleCopy(rec)}
          title={rec.reasoning}
          aria-label={`Copy recommendation: ${rec.text}`}
        >
          {copiedId === rec.id ? "Copied!" : rec.text}
        </button>
      ))}
    </div>
  );
}
