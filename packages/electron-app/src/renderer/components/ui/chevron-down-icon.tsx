/**
 * ChevronDown Icon — indicates expandable section (expanded state).
 */
import React from "react";

interface Props { size?: number; className?: string }

export function ChevronDownIcon({ size = 16, className }: Props): React.JSX.Element {
  return (
    <svg className={className} fill="none" height={size} width={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
