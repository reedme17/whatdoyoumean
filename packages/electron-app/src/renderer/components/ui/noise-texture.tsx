/**
 * NoiseTexture — animated film grain overlay.
 * Based on @componentry/noise-texture pattern.
 * Uses SVG feTurbulence for grain effect.
 */

import React, { useEffect, useRef } from "react";

interface NoiseTextureProps {
  opacity?: number;
  speed?: number;
  grain?: "fine" | "medium" | "coarse";
  blend?: "overlay" | "soft-light" | "multiply" | "screen";
  animate?: boolean;
  className?: string;
}

const GRAIN_FREQ = {
  fine: 0.8,
  medium: 0.65,
  coarse: 0.45,
};

export function NoiseTexture({
  opacity = 0.15,
  speed = 10,
  grain = "medium",
  blend = "overlay",
  animate = true,
  className = "",
}: NoiseTextureProps): React.JSX.Element {
  const svgRef = useRef<SVGSVGElement>(null);
  const seedRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!animate || !svgRef.current) return;

    const turbulence = svgRef.current.querySelector("feTurbulence");
    if (!turbulence) return;

    let lastTime = 0;
    const interval = 1000 / speed;

    const tick = (time: number) => {
      if (time - lastTime >= interval) {
        seedRef.current = (seedRef.current + 1) % 100;
        turbulence.setAttribute("seed", String(seedRef.current));
        lastTime = time;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate, speed]);

  return (
    <svg
      ref={svgRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      style={{ opacity, mixBlendMode: blend }}
      aria-hidden="true"
    >
      <filter id="noise-filter">
        <feTurbulence
          type="fractalNoise"
          baseFrequency={GRAIN_FREQ[grain]}
          numOctaves={4}
          seed={0}
          stitchTiles="stitch"
        />
      </filter>
      <rect width="100%" height="100%" filter="url(#noise-filter)" />
    </svg>
  );
}
