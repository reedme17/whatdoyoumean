/**
 * Sheet — slide-out panel component (simplified shadcn Sheet without Radix dependency).
 * Renders a backdrop + side panel with animation-ready classes.
 */

import * as React from "react";
import { cn } from "../../lib/utils.js";
import { Button } from "./button.js";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  className?: string;
  children: React.ReactNode;
}

function Sheet({ open, onClose, side = "right", className, children }: SheetProps): React.JSX.Element | null {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        role="presentation"
        className="fixed inset-0 bg-black/15 z-[99]"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed top-0 bottom-0 z-[100] flex flex-col bg-background border-border overflow-hidden",
          side === "right" ? "right-0 border-l" : "left-0 border-r",
          className
        )}
      >
        {children}
      </div>
    </>
  );
}

function SheetHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center justify-between px-5 py-3 border-b border-border", className)} {...props}>
      {children}
    </div>
  );
}

function SheetContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <nav className={cn("flex-1 overflow-y-auto", className)} {...props}>
      {children}
    </nav>
  );
}

function SheetClose({ onClose }: { onClose: () => void }) {
  return (
    <Button variant="ghost" onClick={onClose} aria-label="Close">
      ✕
    </Button>
  );
}

export { Sheet, SheetHeader, SheetContent, SheetClose };
