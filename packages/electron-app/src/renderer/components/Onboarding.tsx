/**
 * Onboarding — first-launch welcome screen.
 * Shows hero image, tagline, and Start button.
 * Currently shows every launch for testing; will add localStorage check later.
 */

import React from "react";
import { Button } from "./ui/button.js";

interface Props {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: Props): React.JSX.Element {
  return (
    <div
      className="flex flex-col items-center justify-center w-full h-full bg-background"
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

      {/* Start button — pill shape */}
      <Button variant="normal" onClick={onComplete}>
        Start
      </Button>
    </div>
  );
}
