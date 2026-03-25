import * as React from "react";
import { cn } from "../../lib/utils.js";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-lg border border-border bg-card text-card-foreground", className)} {...props} />
  )
);
Card.displayName = "Card";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-3 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-2 p-3 pb-1.5 text-xs text-muted", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

export { Card, CardContent, CardHeader };
