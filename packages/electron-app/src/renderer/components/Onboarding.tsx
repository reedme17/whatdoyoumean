/**
 * Onboarding — first-launch welcome screen.
 * Enter button expands its background color to cover the entire screen,
 * then fades to background color revealing HomeScreen.
 */

import React, { useRef, useCallback, useState } from "react";
import gsap from "gsap";
import { Button } from "./ui/button.js";

interface Props {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: Props): React.JSX.Element {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [transitioning, setTransitioning] = useState(false);

  const handleEnter = useCallback(() => {
    if (transitioning) return;
    setTransitioning(true);

    const btn = buttonRef.current;
    const overlay = overlayRef.current;
    if (!btn || !overlay) { onComplete(); return; }

    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    // Calculate the radius needed to cover the entire screen from button center
    const maxDist = Math.max(
      Math.hypot(cx, cy),
      Math.hypot(window.innerWidth - cx, cy),
      Math.hypot(cx, window.innerHeight - cy),
      Math.hypot(window.innerWidth - cx, window.innerHeight - cy),
    );

    // Position overlay as a circle at button center
    gsap.set(overlay, {
      display: "block",
      position: "fixed",
      left: cx,
      top: cy,
      width: 0,
      height: 0,
      borderRadius: "50%",
      backgroundColor: "#F0EDE8",
      zIndex: 9999,
      xPercent: -50,
      yPercent: -50,
    });

    const tl = gsap.timeline();

    // Phase 1: expand circle to cover screen
    tl.to(overlay, {
      width: maxDist * 2,
      height: maxDist * 2,
      duration: 0.8,
      ease: "power2.in",
    });

    // Phase 2: fade color to background
    tl.to(overlay, {
      backgroundColor: "#FAF8F5",
      duration: 0.8,
      ease: "power1.out",
      onComplete: () => onComplete(),
    });
  }, [transitioning, onComplete]);

  return (
    <div
      className="relative flex flex-col items-center justify-center w-full h-full bg-background overflow-hidden"
      role="main"
      aria-label="Welcome"
      style={{ animation: "fadeInUp 0.5s ease-out" }}
    >
      {/* Hero image */}
      <div className="w-[466px] max-w-[90%] mb-6">
        <img
          src="./assets/onboarding.png"
          alt="What Do You Mean — conversation understanding"
          className="w-full h-auto rounded-lg"
          draggable={false}
        />
      </div>

      {/* Tagline */}
      <p className="text-sm font-sans text-foreground text-center mb-6">
        Hear meaning, not words, live.
      </p>

      {/* Enter button */}
      <Button ref={buttonRef} variant="normal" onClick={handleEnter}>
        Enter
      </Button>

      {/* Expanding overlay — hidden until animation */}
      <div ref={overlayRef} style={{ display: "none" }} />
    </div>
  );
}
