/**
 * CornerDownRight Icon — static, indicates reply/response.
 */
import React from "react";

interface Props { size?: number; className?: string }

export function CornerDownRightIcon({ size = 14, className }: Props): React.JSX.Element {
  return (
    <svg className={className} fill="none" height={size} width={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <polyline points="15 10 20 15 15 20" />
      <path d="M4 4v7a4 4 0 0 0 4 4h12" />
    </svg>
  );
}
