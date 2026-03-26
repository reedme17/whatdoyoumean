import * as React from "react";
import { useCallback, useRef } from "react";
import { motion, useAnimation } from "motion/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils.js";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-border bg-transparent hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground text-muted",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        normal: "rounded-[18px] bg-secondary text-[#5B5449] font-bold hover:bg-border",
      },
      size: {
        default: "h-10 px-6 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, onClick, ...props }, ref) => {
    const controls = useAnimation();
    const pendingClick = useRef<React.MouseEvent<HTMLButtonElement> | null>(null);

    const handleClick = useCallback(
      async (e: React.MouseEvent<HTMLButtonElement>) => {
        // Store the event, wait for scale-back animation, then fire onClick
        pendingClick.current = e;
        await controls.start({ scale: 1, transition: { duration: 0.15, ease: "easeOut" } });
        onClick?.(e);
      },
      [controls, onClick]
    );

    return (
      <motion.button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref as React.Ref<HTMLButtonElement>}
        animate={controls}
        whileTap={{ scale: 0.96 }}
        onClick={handleClick}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
