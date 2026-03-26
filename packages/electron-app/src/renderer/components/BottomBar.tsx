/**
 * BottomBar — listening session controls + pending text preview.
 * GSAP per-character blur + fade. Pending block always in DOM (no mount/unmount flash).
 */

import React, { useRef, useEffect } from "react";
import gsap from "gsap";
import { MapPinPlusIcon } from "./ui/map-pin-plus-icon.js";
import { Waveform } from "./Waveform.js";
import { Square } from "lucide-react";

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
      // Set content first so we can measure
      gsap.set(block, { height: "auto", overflow: "hidden", visibility: "visible" });
      const h = block.offsetHeight;
      gsap.set(block, { height: 0, opacity: 0 });
      gsap.set(outer, { gap: 0 });

      gsap.to(block, { height: h, opacity: 1, duration: 0.35, ease: "power2.out", onComplete: () => {
        gsap.set(block, { height: "auto" });
        animatingRef.current = false;
      }});
      gsap.to(outer, { gap: 20, duration: 0.35, ease: "power2.out" });
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
        tl.to(speaker, { opacity: 0, filter: "blur(8px)", duration: 0.25, ease: "power2.in" }, 0);
      }
      if (charSpans && charSpans.length > 0) {
        tl.to(charSpans, { opacity: 0, filter: "blur(6px)", duration: 0.3, ease: "power2.in", stagger: 0.015 }, 0);
      }
      tl.to(block, { height: 0, overflow: "hidden", duration: 0.4, ease: "power2.out" }, 0.1);
      tl.to(outer, { gap: 0, duration: 0.4, ease: "power2.out" }, 0.1);
    }
  }, [pendingPreview]);

  // Determine text to show (current or keep last during exit animation)
  const textToShow = pendingPreview || prevPreviewRef.current || "";

  return (
    <div
      ref={outerRef}
      role="toolbar"
      aria-label="Session controls"
      className="flex flex-col items-start px-[19px] py-[14px] bg-[#F0EDE8] w-full -mb-[100px]"
      style={{ borderRadius: "16px 16px 10px 10px", paddingBottom: 114, gap: 0 }}
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
          <span className="font-sans font-medium text-sm text-[#93918E] whitespace-nowrap">
            Listening...
          </span>
          <Waveform analyser={analyser} isCapturing={isCapturing} width={60} height={16} />
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
            className="flex items-center gap-[6px] text-sm font-sans font-medium text-[#93918E] hover:text-foreground transition-colors cursor-pointer bg-transparent border-none p-0"
            onClick={onStop}
            title="Stop session (⌘⇧S)"
            aria-label="Stop session"
          >
            <Square size={10} fill="currentColor" strokeWidth={0} />
            End
          </button>
        </div>
      </div>
    </div>
  );
}
