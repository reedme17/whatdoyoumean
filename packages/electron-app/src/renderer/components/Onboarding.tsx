/**
 * Onboarding — first-launch welcome screen.
 * Enter button expands its background color to cover the entire screen,
 * then fades to background color revealing HomeScreen.
 */

import React, { useRef, useCallback, useState, useEffect } from "react";
import gsap from "gsap";
import { Button } from "./ui/button.js";

/* Arm config: id, shoulder pivot in SVG coords, rest angle, swing range */
const ARMS = [
  { id: "right-arm1", sx: 482, sy: 381, rest: -10, min: -50, max: 10 },
  { id: "left-arm1",  sx: 428, sy: 384, rest: 0,   min: -10, max: 40 },
  { id: "right-arm2", sx: 1013, sy: 381, rest: 10,  min: -5, max: 25 },
  { id: "left-arm2",  sx: 927, sy: 383, rest: -10,   min: -25, max: 5 },
];

const SLOGANS = [
  "Hear meaning, not words, live.",
  "Words land differently in every ear. Let's close the gap!",
];

interface Props {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: Props): React.JSX.Element {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<HTMLObjectElement>(null);
  const [transitioning, setTransitioning] = useState(false);
  const interacting = useRef(false);

  /* Cycling slogan with per-character blur animation */
  const sloganRef = useRef<HTMLParagraphElement>(null);
  const sloganIdx = useRef(0);

  useEffect(() => {
    const el = sloganRef.current;
    if (!el) return;
    let cancelled = false;

    const show = () => {
      if (cancelled) return;
      const text = SLOGANS[sloganIdx.current % SLOGANS.length];
      el.innerHTML = text.split("").map((c) =>
        `<span data-sc style="display:inline-block;white-space:pre;opacity:0;filter:blur(6px)">${c}</span>`
      ).join("");

      const chars = el.querySelectorAll<HTMLSpanElement>("[data-sc]");
      /* Fade in per char */
      gsap.to(chars, {
        opacity: 1, filter: "blur(0px)", duration: 0.5, ease: "power2.out", stagger: 0.02,
        onComplete: () => {
          if (cancelled) return;
          /* Hold 2s then fade out */
          setTimeout(() => {
            if (cancelled) return;
            const spans = el.querySelectorAll<HTMLSpanElement>("[data-sc]");
            gsap.to(spans, {
              opacity: 0, filter: "blur(6px)", duration: 0.5, ease: "power2.in", stagger: 0.015,
              onComplete: () => {
                sloganIdx.current++;
                show();
              },
            });
          }, 2000);
        },
      });
    };

    show();
    return () => { cancelled = true; };
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);

  /* Wire up mouse interaction once SVG loads */
  useEffect(() => {
    const obj = svgRef.current;
    const container = containerRef.current;
    if (!obj || !container) return;

    let svgDoc: Document | null = null;
    let cleanup: (() => void) | undefined;
    let idleTimelines: gsap.core.Timeline[] = [];

    const tryInit = () => {
      try { svgDoc = obj.contentDocument; } catch { svgDoc = null; }
      if (!svgDoc?.querySelector("svg")) return;

      /* Kill CSS animations permanently — GSAP handles everything */
      for (const a of ARMS) {
        const el = svgDoc.getElementById(a.id);
        if (el) el.style.animation = "none";
      }

      /* Start GSAP idle swing for each arm — starts from current position */
      const startIdle = () => {
        idleTimelines = [];
        for (const a of ARMS) {
          const el = svgDoc!.getElementById(a.id);
          if (!el) continue;
          const swing = (a.max - a.min) * 0.4;
          const lo = a.rest - swing / 2;
          const hi = a.rest + swing / 2;
          const dur = 1.2 + Math.random() * 0.4;
          const tl = gsap.timeline({ repeat: -1, yoyo: true });
          tl.to(el, { rotation: hi, svgOrigin: `${a.sx} ${a.sy}`, duration: dur, ease: "sine.inOut" });
          tl.to(el, { rotation: lo, svgOrigin: `${a.sx} ${a.sy}`, duration: dur, ease: "sine.inOut" });
          idleTimelines.push(tl);
        }
      };

      const stopIdle = () => {
        for (const tl of idleTimelines) tl.kill();
        idleTimelines = [];
      };

      startIdle();

      const onMove = (e: MouseEvent) => {
        if (!svgDoc) return;
        const rect = obj.getBoundingClientRect();
        const scaleX = 1408 / rect.width;
        const scaleY = 768 / rect.height;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;

        if (!interacting.current) {
          interacting.current = true;
          stopIdle();
        }

        for (const a of ARMS) {
          const el = svgDoc.getElementById(a.id);
          if (!el) continue;
          const angle = Math.atan2(my - a.sy, mx - a.sx) * (180 / Math.PI);
          const target = Math.max(a.min, Math.min(a.max, angle * 0.15));
          gsap.to(el, {
            rotation: target,
            svgOrigin: `${a.sx} ${a.sy}`,
            duration: 0.4,
            ease: "power2.out",
            overwrite: true,
          });
        }
      };

      const onLeave = () => {
        if (!interacting.current || !svgDoc) return;
        for (const a of ARMS) {
          const el = svgDoc.getElementById(a.id);
          if (!el) continue;
          gsap.to(el, {
            rotation: a.rest,
            svgOrigin: `${a.sx} ${a.sy}`,
            duration: 1.2,
            ease: "elastic.out(1, 0.3)",
            overwrite: true,
          });
        }
        setTimeout(() => {
          interacting.current = false;
          startIdle();
        }, 1400);
      };

      /* Listen on the container div (transparent overlay captures events) */
      container.addEventListener("mousemove", onMove);
      container.addEventListener("mouseleave", onLeave);

      cleanup = () => {
        container.removeEventListener("mousemove", onMove);
        container.removeEventListener("mouseleave", onLeave);
      };
    };

    obj.addEventListener("load", tryInit);
    /* If already loaded */
    tryInit();

    return () => {
      obj.removeEventListener("load", tryInit);
      cleanup?.();
    };
  }, []);

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
      {/* Hero image — scales with the smaller viewport dimension */}
      <div ref={containerRef} className="relative mb-6" style={{ width: "min(90vw, 92vh)" }}>
        <object
          ref={svgRef}
          data="./assets/onboarding-Vectorized.svg"
          type="image/svg+xml"
          className="w-full h-auto rounded-lg"
          aria-label="What Do You Mean — conversation understanding"
        />
        {/* Transparent overlay to capture mouse events above the <object> */}
        <div className="absolute inset-0" style={{ cursor: "default" }} />
      </div>

      {/* Tagline — cycling slogans */}
      <p ref={sloganRef} className="text-sm font-sans text-foreground text-center mb-6 min-h-[1.5em]" />

      {/* Enter button */}
      <Button ref={buttonRef} variant="normal" onClick={handleEnter}>
        Enter
      </Button>

      {/* Expanding overlay — hidden until animation */}
      <div ref={overlayRef} style={{ display: "none" }} />
    </div>
  );
}
