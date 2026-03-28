/**
 * SidebarButton — menu item for ExpandPanel drawer.
 * Colors match design tokens: #60594D default, #5B5449 active.
 */

import React from "react";
import { cn } from "../../lib/utils.js";

interface SidebarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  locked?: boolean;
}

const SidebarButton = React.forwardRef<HTMLButtonElement, SidebarButtonProps>(
  ({ className, active, locked, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-sans transition-colors cursor-pointer",
        "text-[#60594D] hover:bg-[#F0EDE8] hover:text-[#5B5449]",
        active && "bg-[#F0EDE8] text-[#5B5449] font-semibold",
        locked && "opacity-40 cursor-not-allowed",
        className
      )}
      disabled={locked}
      {...props}
    >
      {children}
      {locked && <span className="ml-auto text-[10px]">·</span>}
    </button>
  )
);

SidebarButton.displayName = "SidebarButton";

export { SidebarButton };
