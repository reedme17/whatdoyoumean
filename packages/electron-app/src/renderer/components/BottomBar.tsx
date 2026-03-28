/**
 * BottomBar — listening session controls + pending text preview.
 * GSAP per-character blur + fade. Pending block always in DOM (no mount/unmount flash).
 */

import React, { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { MapPinPlusIcon } from "./ui/map-pin-plus-icon.js";
import { Square } from "lucide-react";
import { SlidersHorizontalIcon } from "./ui/sliders-icon.js";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover.js";
import type { SttLanguage } from "./ExpandPanel.js";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs.js";

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
  sttLanguage?: SttLanguage;
  onSttLanguageChange?: (lang: SttLanguage) => void;
  responseEnabled?: boolean;
  onResponseEnabledChange?: (v: boolean) => void;
  speakerName?: string;
}

export function BottomBar({ onFlag, onStop, analyser = null, isCapturing = false, pendingPreview = "", pendingTextRef, sttLanguage = "zh+en", onSttLanguageChange, responseEnabled = false, onResponseEnabledChange, speakerName }: Props): React.JSX.Element {
  const outerRef = useRef<HTMLDivElement>(null);
  const pendingBlockRef = useRef<HTMLDivElement>(null);
  const [showMarked, setShowMarked] = useState(false);

  // Debug: log BottomBar position on mount
  useEffect(() => {
    if (outerRef.current) {
      const r = outerRef.current.getBoundingClientRect();
      console.log(`[BottomBar] mount rect: top=${r.top.toFixed(0)} left=${r.left.toFixed(0)} w=${r.width.toFixed(0)} h=${r.height.toFixed(0)} innerH=${window.innerHeight}`);
    }
  }, []);
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
      className="flex flex-col items-start px-[20px] py-[20px] bg-[#F0EDE8] w-full -mb-[200px] relative overflow-visible"
      style={{ borderRadius: "16px 16px 10px 10px", paddingBottom: 220, gap: 0 }}
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
          {speakerName || "Speaker 1"}
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

        <div className="relative shrink-0">
          {showMarked && (
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-sans text-[#60594D] bg-white/90 px-2 py-0.5 rounded-md shadow-sm" style={{ animation: "fadeInUp 0.2s ease-out, fadeOut 0.3s ease-in 1s forwards" }}>
              Moment marked
            </div>
          )}
          <button
            className="text-[#93918E] hover:text-foreground transition-colors cursor-pointer bg-transparent border-none p-0"
            onClick={() => {
              onFlag();
              setShowMarked(true);
              setTimeout(() => setShowMarked(false), 1500);
            }}
            title="Mark this moment (⌘B)"
            aria-label="Mark this moment"
          >
            <MapPinPlusIcon size={20} />
          </button>
        </div>

        <div className="flex-1 min-w-0 flex items-center justify-end gap-[16px]">
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="text-[#93918E] hover:text-foreground transition-colors cursor-pointer bg-transparent border-none p-0"
                title="Settings"
                aria-label="Settings"
              >
                <SlidersHorizontalIcon size={18} />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-auto p-3">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-sans font-medium text-[#60594D]">Language</span>
                  <Tabs value={sttLanguage === "zh" ? "cn" : sttLanguage === "en" ? "en" : "multi"} onValueChange={(v) => onSttLanguageChange?.(v === "cn" ? "zh" : v === "en" ? "en" : "zh+en")}>
                    <TabsList>
                      <TabsTrigger value="multi">Multi</TabsTrigger>
                      <TabsTrigger value="cn">中文</TabsTrigger>
                      <TabsTrigger value="en">EN</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-sans font-medium text-[#60594D]">Source</span>
                  <Tabs defaultValue="both">
                    <TabsList>
                      <TabsTrigger value="both">Both</TabsTrigger>
                      <TabsTrigger value="mic">Mic</TabsTrigger>
                      <TabsTrigger value="internal">Internal</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-sans font-medium text-[#60594D]">Response recommendation</span>
                  <Tabs value={responseEnabled ? "on" : "off"} onValueChange={(v) => onResponseEnabledChange?.(v === "on")}>
                    <TabsList>
                      <TabsTrigger value="on">On</TabsTrigger>
                      <TabsTrigger value="off">Off</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <button
            className="flex items-center gap-[6px] text-sm font-sans font-medium text-[#93918E] hover:text-foreground transition-colors cursor-pointer bg-transparent border-none p-0 group"
            onClick={onStop}
            title="Stop session (⌘⇧S)"
            aria-label="Stop session"
          >
            <Square size={12} fill="currentColor" strokeWidth={0} className="group-hover:scale-[1.2]" style={{ transition: "transform 400ms ease-out" }} />
            End
          </button>
        </div>
      </div>
    </div>
  );
}
