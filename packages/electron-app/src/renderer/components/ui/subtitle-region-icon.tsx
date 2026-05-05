import React from "react";

export function SubtitleRegionIcon({
  size = 18,
  className = "",
}: {
  size?: number;
  className?: string;
}): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="5" width="16" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 9H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 12H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 19H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
