import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils.js";

interface ChevronDownIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

export function ChevronDownIcon({ className, size = 20, ...props }: ChevronDownIconProps) {
  return (
    <div className={cn(className)} {...props}>
      <svg
        fill="none"
        height={size}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}
