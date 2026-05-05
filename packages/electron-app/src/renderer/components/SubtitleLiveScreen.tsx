import React, { useEffect, useRef, useState } from "react";
import type { CoreMeaningCard } from "@wdym/shared";
import { Button } from "./ui/button.js";
import { CoreMeaningCardView } from "./CoreMeaningCard.js";
import { createDesktopStream, stopMediaStream } from "../lib/desktop-stream.js";
import type { SubtitleRegion } from "./SubtitleSetupScreen.js";
import { Square } from "lucide-react";

interface Props {
  sourceId: string;
  sourceName: string;
  region: SubtitleRegion;
  statusMessage: string;
  accumulatedText: string;
  cards: CoreMeaningCard[];
  isCapturing: boolean;
  analyzing: boolean;
  onCapture: () => void;
  onEnd: () => void;
}

export function SubtitleLiveScreen({
  sourceId,
  sourceName,
  region,
  statusMessage,
  accumulatedText,
  cards,
  isCapturing,
  analyzing,
  onCapture,
  onEnd,
}: Props): React.JSX.Element {
  useEffect(() => {
    window.electronAPI?.resizeWindow?.(860).catch(() => undefined);
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background screen-enter" role="main" aria-label="Screen subtitle session">
      <div className="shrink-0 px-[20px] pt-[12px]">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-serif font-normal text-[20px] text-[#60594D]">Screen capture</h1>
            <p className="mt-2 font-sans text-xs text-[#A16B46]">
              {statusMessage}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-[20px] py-[16px]">
        <SubtitleLivePreview sourceId={sourceId} region={region} />

        {cards.length > 0 && (
          <section className="mt-4 rounded-[20px] border border-[#DED8CE] bg-white p-4 shadow-[0_10px_25px_rgba(96,89,77,0.05)]">
            <div className="mb-3 font-sans text-xs uppercase tracking-[0.18em] text-[#A6A095]">
              Meaning cards
            </div>
            <div className="max-h-[320px] overflow-y-auto flex flex-col gap-3">
              {cards.map((card) => (
                <CoreMeaningCardView key={card.id} card={card} />
              ))}
            </div>
          </section>
        )}

        <div className="mt-4 rounded-[20px] border border-[#DED8CE] bg-[#F7F3ED] p-4 shadow-[0_10px_30px_rgba(96,89,77,0.08)]">
          <div className="font-sans text-xs uppercase tracking-[0.18em] text-[#A6A095]">
            OCR transcript
          </div>
          <div className="mt-3 max-h-[320px] overflow-y-auto whitespace-pre-wrap font-sans text-[15px] leading-7 text-[#4E493F]">
            {accumulatedText ? (
              accumulatedText
            ) : (
              <span className="text-[#93918E]">
                No OCR text accumulated yet. Capture the subtitle region when a few new lines appear.
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 px-[20px] pb-[20px] pt-[12px]">
        <div className="flex items-center rounded-[18px] bg-[#F0EDE8] px-4 py-4">
          <div className="flex-1" />
          <Button
            variant="normal"
            onClick={onCapture}
            disabled={isCapturing}
          >
            {isCapturing ? "Capturing..." : "Capture"}
          </Button>
          <div className="flex-1 flex justify-end">
            <button
              className="flex items-center gap-[6px] text-sm font-sans font-semibold text-[#93918E] hover:text-foreground transition-colors cursor-pointer bg-transparent border-none p-0 group"
              onClick={onEnd}
              aria-label="End screen capture"
            >
              <Square
                size={12}
                fill="currentColor"
                strokeWidth={0}
                className="group-hover:scale-[1.2]"
                style={{ transition: "transform 400ms ease-out" }}
              />
              End
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubtitleLivePreview({
  sourceId,
  region,
}: {
  sourceId: string;
  region: SubtitleRegion;
}): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [captureAspectRatio, setCaptureAspectRatio] = useState<number>(16 / 9);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let cancelled = false;
    setVideoReady(false);
    setStreamError(null);

    stopMediaStream(streamRef.current);
    streamRef.current = null;

    createDesktopStream(sourceId)
      .then((stream) => {
        if (cancelled) {
          stopMediaStream(stream);
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setStreamError(error instanceof Error ? error.message : String(error));
        }
      });

    return () => {
      cancelled = true;
      stopMediaStream(streamRef.current);
      streamRef.current = null;
    };
  }, [sourceId]);

  return (
    <section className="rounded-[20px] border border-[#DED8CE] bg-white p-4 shadow-[0_10px_25px_rgba(96,89,77,0.05)]">
      <button
        className="flex w-full items-center justify-between bg-transparent border-none p-0 cursor-pointer"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        aria-label="Toggle live preview"
      >
        <span className="font-sans text-xs uppercase tracking-[0.18em] text-[#A6A095]">
          Live preview
        </span>
        <svg
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[#A6A095] transition-transform"
          style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div className={collapsed ? "hidden" : ""}>
        <div className="mt-3 flex justify-center">
          <div
            className="relative w-full max-w-full overflow-hidden rounded-[18px] bg-[#EBE5DA] shadow-inner"
            style={{ aspectRatio: String(captureAspectRatio) }}
          >
            <video
              ref={videoRef}
              className="absolute block max-w-none"
              muted
              playsInline
              style={{
                width: `${100 / region.width}%`,
                height: `${100 / region.height}%`,
                left: `-${(region.x / region.width) * 100}%`,
                top: `-${(region.y / region.height) * 100}%`,
              }}
              onLoadedMetadata={() => {
                const video = videoRef.current;
                if (video?.videoWidth && video?.videoHeight) {
                  const ratio =
                    (region.width * video.videoWidth) /
                    (region.height * video.videoHeight);
                  setCaptureAspectRatio(Number.isFinite(ratio) && ratio > 0 ? ratio : 16 / 9);
                }
                setVideoReady(true);
                videoRef.current?.play().catch(() => undefined);
              }}
            />
          </div>
        </div>
        {streamError && (
          <p className="mt-3 font-sans text-xs text-[#A16B46]">
            Preview unavailable: {streamError}
          </p>
        )}
      </div>
    </section>
  );
}
