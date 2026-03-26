/**
 * WaveEdge — SVG wave animation on top edge of BottomBar.
 * Animates when speaking (pendingPreview is non-empty).
 * Uses GSAP to animate SVG path control points.
 */

import React, { useRef, useEffect } from "react";
import gsap from "gsap";

interface Props {
  active: boolean;
  color?: string;
  height?: number;
}

export function WaveEdge({ active, color = "#F0EDE8", height = 12 }: Props): React.JSX.Element {
  const pathRef = useRef<SVGPathElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;

    if (active) {
      // Animate wave: alternate between two wave shapes
      const flat = `M0,${height} Q160,${height} 320,${height} Q480,${height} 640,${height} L640,${height + 4} L0,${height + 4} Z`;
      const wave1 = `M0,${height} L160,${height} Q320,${height - 8} 480,${height} L640,${height} L640,${height + 4} L0,${height + 4} Z`;
      const wave2 = `M0,${height} L160,${height} Q320,${height + 7} 480,${height} L640,${height} L640,${height + 4} L0,${height + 4} Z`;

      const tl = gsap.timeline({ repeat: -1, yoyo: true });
      tl.to(path, { attr: { d: wave1 }, duration: 0.8, ease: "sine.inOut" });
      tl.to(path, { attr: { d: wave2 }, duration: 0.8, ease: "sine.inOut" });
      tlRef.current = tl;

      return () => { tl.kill(); };
    } else {
      // Reset to flat
      if (tlRef.current) {
        tlRef.current.kill();
        tlRef.current = null;
      }
      const flat = `M0,${height} L640,${height} L640,${height + 4} L0,${height + 4} Z`;
      gsap.to(path, { attr: { d: flat }, duration: 0.3, ease: "power2.out" });
    }
  }, [active, height]);

  const flat = `M0,${height} L640,${height} L640,${height + 4} L0,${height + 4} Z`;

  return (
    <svg
      className="w-full pointer-events-none"
      viewBox={`0 0 640 ${height + 4}`}
      preserveAspectRatio="none"
      style={{ height: height + 4, marginBottom: -(height + 4) / 2, position: "relative", zIndex: 1 }}
    >
      <path ref={pathRef} d={flat} fill={color} />
    </svg>
  );
}
