import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils.js";

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-border bg-transparent hover:bg-accent",
      },
      size: {
        default: "h-10 px-3",
        sm: "h-8 px-2 text-xs",
        lg: "h-11 px-5",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ToggleProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof toggleVariants> {
  pressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
}

const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  ({ className, variant, size, pressed = false, onPressedChange, onClick, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={pressed}
      data-state={pressed ? "on" : "off"}
      className={cn(
        toggleVariants({ variant, size }),
        pressed && "bg-accent text-accent-foreground",
        className
      )}
      onClick={(e) => {
        onPressedChange?.(!pressed);
        onClick?.(e);
      }}
      {...props}
    />
  )
);
Toggle.displayName = "Toggle";

export { Toggle, toggleVariants };
