"use client";

import type { HTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "../../lib/utils.js";

interface MdIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const MdIcon = forwardRef<HTMLDivElement, MdIconProps>(
  ({ className, size = 28, ...props }, ref) => {
    return (
      <div ref={ref} className={cn(className)} {...props}>
        <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 28 24" width={size} xmlns="http://www.w3.org/2000/svg">
          {/* File shape — taller, from y=1 to y=23 */}
          <path d="m18 4-2.414-2.414A2 2 0 0 0 14.172 1H6a2 2 0 0 0-2 2v18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2" />
          {/* "MD" text — large, extending past right edge */}
          <text x="18" y="17" textAnchor="middle" fill="currentColor" stroke="none" fontSize="13" fontWeight="800" fontFamily="system-ui, sans-serif" letterSpacing="-0.5">MD</text>
        </svg>
      </div>
    );
  }
);

MdIcon.displayName = "MdIcon";

export { MdIcon };
