/**
 * Animated MapPinPlus Icon — bookmark/flag action.
 * Plus sign pulses on hover.
 */

import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils.js";

export interface MapPinPlusIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface MapPinPlusIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const MapPinPlusIcon = forwardRef<MapPinPlusIconHandle, MapPinPlusIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 20, ...props }, ref) => {
    const [isHovered, setIsHovered] = useState(false);
    const controls = useAnimation();
    const isControlledRef = useRef(false);

    if (ref && typeof ref === "object") {
      isControlledRef.current = true;
      (ref as React.MutableRefObject<MapPinPlusIconHandle>).current = {
        startAnimation: () => setIsHovered(true),
        stopAnimation: () => setIsHovered(false),
      };
    }

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isControlledRef.current) setIsHovered(true);
        onMouseEnter?.(e);
      },
      [onMouseEnter]
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isControlledRef.current) setIsHovered(false);
        onMouseLeave?.(e);
      },
      [onMouseLeave]
    );

    useEffect(() => {
      if (isHovered) {
        controls.start({
          scale: [1, 1.3, 1],
          transition: { duration: 0.4, ease: "easeInOut" },
        });
      } else {
        controls.stop();
        controls.set({ scale: 1 });
      }
    }, [isHovered, controls]);

    return (
      <div
        className={cn(className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
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
          {/* Pin body */}
          <path d="M19.43 12.935c.357-.763.57-1.595.57-2.435a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 1.202 0 32 32 0 0 0 2.56-2.327" />
          {/* Pin dot */}
          <circle cx="12" cy="10" r="3" />
          {/* Plus sign — animated */}
          <motion.path d="M16 18h6" animate={controls} />
          <motion.path d="M19 15v6" animate={controls} />
        </svg>
      </div>
    );
  }
);

MapPinPlusIcon.displayName = "MapPinPlusIcon";

export { MapPinPlusIcon };
