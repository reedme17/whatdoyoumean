/**
 * BottomBar — listening session controls + pending text preview.
 * GSAP per-character blur + fade. Pending block always in DOM (no mount/unmount flash).
 */

import React, { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { MapPinPlusIcon } from "./ui/map-pin-plus-icon.js";
import { Square } from "lucide-react";

// Sequence: 0→1→2→3→pause(3s)→2→1→0→pause(3s), 0.5s per step
const DOT_SEQUENCE = [0, 1, 2, 3, 3, 3, 3, 3, 3, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0];

function ListeningDots(): React.JSX.Element {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % DOT_SEQUENCE.length), 500);
    return () => clearInterval(id);
  }, []);
  const dots = ".".repeat(DOT_SEQUENCE[idx]);
  return (
    <span className="font-sans font-medium text-sm text-[#93918E] whitespace-nowrap" style={{ minWidth: 80 }}>
      Listening{dots}
    </span>
  );
}

interface Props {
  onFlag: () => void;
  onStop: () => void;
  analyser?: AnalyserNode | null;
  isCapturing?: boolean;
  pendingPreview?: string;
  pendingTextRef?: React.RefObject<HTMLDivElement>;
}

export function BottomBar({ onFlag, onStop, analyser = null, isCapturing = false, pendingPreview = "", pendingTextRef }: Props): React.JSX.Element {
  const outerRef = useRef<HTMLDivElement>(null);
  const pendingBlockRef = useRef<HTMLDivElement>(null);
  const speakerRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const prevPreviewRef = useRef("");
  const animatingRef = useRef(false);
  const lastHeightRef = useRef(0);

  useEffect(() => {
    const prev = prevPreviewRef.current;
    const curr = pendingPreview;
    prevPreviewRef.current = curr;

    const block = pendingBlockRef.current;
    const outer = outerRef.current;
    if (!block || !outer) return;

    // Text appeared — expand
    if (!prev && curr) {
      animatingRef.current = true;
      lastHeightRef.current = 0;
      // Set content first so we can measure
      gsap.set(block, { height: "auto", overflow: "hidden", visibility: "visible" });
      const h = block.offsetHeight;
      gsap.set(block, { height: 0, opacity: 0 });
      gsap.set(outer, { gap: 0 });

      gsap.to(block, { height: h, opacity: 1, duration: 0.8, ease: "expo.out", onComplete: () => {
        gsap.set(block, { height: "auto" });
        animatingRef.current = false;
      }});
      gsap.to(outer, { gap: 20, duration: 0.8, ease: "expo.out" });
    }

    // Text disappeared — shrink with char blur
    if (prev && !curr) {
      animatingRef.current = true;

      // Collect char spans
      const charSpans = textRef.current?.querySelectorAll<HTMLSpanElement>("[data-char]");
      const speaker = speakerRef.current;

      const tl = gsap.timeline({
        onComplete: () => {
          gsap.set(block, { visibility: "hidden", height: 0, overflow: "hidden" });
          gsap.set(outer, { gap: 0 });
          // Reset char styles for next time
          if (charSpans) charSpans.forEach((s) => gsap.set(s, { clearProps: "all" }));
          if (speaker) gsap.set(speaker, { clearProps: "all" });
          animatingRef.current = false;
        },
      });

      if (speaker) {
        tl.to(speaker, { opacity: 0, filter: "blur(8px)", duration: 0.8, ease: "power2.in" }, 0);
      }
      if (charSpans && charSpans.length > 0) {
        tl.to(charSpans, { opacity: 0, filter: "blur(6px)", duration: 0.8, ease: "power2.in", stagger: 0.015 }, 0);
      }
      tl.to(block, { height: 0, overflow: "hidden", duration: 0.8, ease: "expo.out" }, 0.1);
      tl.to(outer, { gap: 0, duration: 0.8, ease: "expo.out" }, 0.1);
    }
  }, [pendingPreview]);

  // Animate height changes when pending text grows (more lines)
  useEffect(() => {
    const block = pendingBlockRef.current;
    if (!block) return;
    let tweening = false;
    const ro = new ResizeObserver(() => {
      if (animatingRef.current || tweening) return;
      const h = block.offsetHeight;
      const prev = lastHeightRef.current;
      if (prev > 0 && h !== prev && block.style.visibility !== "hidden") {
        tweening = true;
        gsap.fromTo(block, { height: prev }, { height: h, duration: 0.4, ease: "expo.out", onComplete: () => {
          gsap.set(block, { height: "auto" });
          lastHeightRef.current = block.offsetHeight;
          tweening = false;
        }});
      } else {
        lastHeightRef.current = h;
      }
    });
    ro.observe(block);
    return () => ro.disconnect();
  }, []);

  // Determine text to show (current or keep last during exit animation)
  const textToShow = pendingPreview || prevPreviewRef.current || "";

  return (
    <div
      ref={outerRef}
      role="toolbar"
      aria-label="Session controls"
      className="flex flex-col items-start px-[20px] py-[20px] bg-[#F0EDE8] w-full -mb-[100px] relative overflow-visible"
      style={{ borderRadius: "16px 16px 10px 10px", paddingBottom: 120, gap: 0 }}
    >
      {/* Pending block — always in DOM, hidden when empty */}
      <div
        ref={(el) => {
          (pendingBlockRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          if (pendingTextRef && el) {
            (pendingTextRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          }
        }}
        className="flex flex-col gap-[4px]"
        style={{ height: 0, overflow: "hidden", visibility: "hidden" }}
      >
        <span ref={speakerRef} className="font-sans font-semibold text-sm text-[#60594D]">
          Speaker 1
        </span>
        <span ref={textRef} className="font-sans font-medium text-sm text-[#171717]">
          {(pendingPreview || textToShow).split("").map((char, i) => (
            <span
              key={i}
              data-char
              style={{ display: "inline-block", whiteSpace: "pre" }}
            >
              {char}
            </span>
          ))}
          <span data-char style={{ display: "inline-block" }}>...</span>
        </span>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between w-full">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <ListeningDots />
        </div>

        <button
          className="shrink-0 text-[#93918E] hover:text-foreground transition-colors cursor-pointer bg-transparent border-none p-0"
          onClick={onFlag}
          title="Flag this moment (⌘B)"
          aria-label="Flag this moment"
        >
          <MapPinPlusIcon size={20} />
        </button>

        <div className="flex-1 min-w-0 flex items-center justify-end gap-[6px]">
          <button
            className="flex items-center gap-[6px] text-sm font-sans font-medium text-[#93918E] hover:text-foreground transition-colors cursor-pointer bg-transparent border-none p-0 group"
            onClick={onStop}
            title="Stop session (⌘⇧S)"
            aria-label="Stop session"
          >
            <Square size={10} fill="currentColor" strokeWidth={0} className="group-hover:scale-[1.2]" style={{ transition: "transform 400ms ease-out" }} />
            End
          </button>
        </div>
      </div>
    </div>
  );
}
