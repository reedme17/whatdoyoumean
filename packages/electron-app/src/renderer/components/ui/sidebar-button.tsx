/**
 * SidebarButton — shadcn sidebar-style menu item.
 * Full-width, left-aligned, subtle hover, active state.
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
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-sans transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        active && "bg-accent text-accent-foreground font-medium",
        locked && "opacity-40 cursor-not-allowed",
        !active && !locked && "text-muted",
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
