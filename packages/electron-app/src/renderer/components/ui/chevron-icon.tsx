/**
 * Animated Chevron Icon — rotates from left-pointing to down-pointing.
 * Uses CSS transition for smooth rotation.
 */
import React from "react";

interface Props {
  size?: number;
  expanded?: boolean;
  className?: string;
}

export function ChevronIcon({ size = 14, expanded = false, className }: Props): React.JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      height={size}
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        transform: expanded ? "rotate(-90deg)" : "rotate(0deg)",
        transition: "transform 0.25s ease-out",
      }}
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}
