/**
 * ChevronLeft Icon — indicates expandable section (collapsed state).
 */
import React from "react";

interface Props { size?: number; className?: string }

export function ChevronLeftIcon({ size = 16, className }: Props): React.JSX.Element {
  return (
    <svg className={className} fill="none" height={size} width={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}
