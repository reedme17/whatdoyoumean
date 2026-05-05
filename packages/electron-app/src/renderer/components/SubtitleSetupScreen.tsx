import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./ui/button.js";
import { XIcon } from "./ui/x-icon.js";
import { createDesktopStream, stopMediaStream } from "../lib/desktop-stream.js";

export interface SubtitleRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DesktopSource {
  id: string;
  name: string;
}

interface Props {
  source: DesktopSource | null;
  sources: DesktopSource[];
  permissionStatus?: string | null;
  onConfirm: (config: {
    sourceId: string;
    sourceName: string;
    region: SubtitleRegion;
  }) => void;
  onClose: () => void;
}

type DragMode = "move" | "resize-se" | "resize-sw" | "resize-ne" | "resize-nw";
type CaptureMode = "free" | "window";

const MIN_REGION_SIZE = 80;
const DEFAULT_REGION: SubtitleRegion = {
  x: 0.12,
  y: 0.72,
  width: 0.76,
  height: 0.18,
};
const APP_WINDOW_NAME_PATTERNS = [/^啥意思$/i, /^what do you mean$/i, /^whatdoyoumean$/i, /^electron$/i];

export function SubtitleSetupScreen({
  source,
  sources,
  permissionStatus,
  onConfirm,
  onClose,
}: Props): React.JSX.Element {
  const [captureMode, setCaptureMode] = useState<CaptureMode>("free");
  const [selectedSourceId, setSelectedSourceId] = useState<string>(source?.id ?? "");
  const [videoReady, setVideoReady] = useState(false);
  const [region, setRegion] = useState<SubtitleRegion | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{
    mode: DragMode;
    startX: number;
    startY: number;
    region: SubtitleRegion;
  } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const screenSources = useMemo(
    () => sources.filter((candidate) => candidate.id.startsWith("screen:")),
    [sources],
  );
  const windowSources = useMemo(
    () =>
      sources.filter(
        (candidate) =>
          candidate.id.startsWith("window:") &&
          !APP_WINDOW_NAME_PATTERNS.some((pattern) => pattern.test(candidate.name.trim())),
      ),
    [sources],
  );
  const fallbackSource = useMemo(
    () => source ?? screenSources[0] ?? windowSources[0] ?? null,
    [screenSources, source, windowSources],
  );

  const selectedSource = useMemo(
    () => sources.find((candidate) => candidate.id === selectedSourceId) ?? fallbackSource,
    [fallbackSource, selectedSourceId, sources],
  );

  useEffect(() => {
    if (captureMode === "free") {
      const preferredScreen = screenSources.find((candidate) => candidate.id === selectedSourceId) ?? screenSources[0];
      if (preferredScreen && preferredScreen.id !== selectedSourceId) {
        setSelectedSourceId(preferredScreen.id);
      }
      return;
    }

    const preferredWindow = windowSources.find((candidate) => candidate.id === selectedSourceId) ?? windowSources[0];
    if (preferredWindow && preferredWindow.id !== selectedSourceId) {
      setSelectedSourceId(preferredWindow.id);
    }
  }, [captureMode, screenSources, selectedSourceId, windowSources]);

  useEffect(() => {
    let cancelled = false;
    setVideoReady(false);
    setStreamError(null);

    if (!selectedSourceId) return;

    stopMediaStream(streamRef.current);
    streamRef.current = null;

    createDesktopStream(selectedSourceId)
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
  }, [selectedSourceId]);

  useEffect(() => {
    if (!videoReady || region) return;
    setRegion(DEFAULT_REGION);
  }, [videoReady, region]);

  useEffect(() => {
    window.electronAPI?.resizeWindow?.(760).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (captureMode === "free") {
      setRegion((current) => current ?? DEFAULT_REGION);
      return;
    }
    setDragState(null);
  }, [captureMode]);

  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (!previewRef.current) return;
      const bounds = previewRef.current.getBoundingClientRect();
      const dx = (event.clientX - dragState.startX) / bounds.width;
      const dy = (event.clientY - dragState.startY) / bounds.height;
      const next = { ...dragState.region };

      if (dragState.mode === "move") {
        next.x = clamp(dragState.region.x + dx, 0, 1 - dragState.region.width);
        next.y = clamp(dragState.region.y + dy, 0, 1 - dragState.region.height);
      } else {
        resizeRegion(next, dragState.mode, dx, dy);
      }

      setRegion(next);
    };

    const handlePointerUp = () => setDragState(null);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState]);

  const startDrag = (event: React.PointerEvent, mode: DragMode) => {
    event.preventDefault();
    event.stopPropagation();
    if (!region) return;
    setDragState({
      mode,
      startX: event.clientX,
      startY: event.clientY,
      region,
    });
  };

  return (
    <div className="flex flex-col h-full bg-background screen-enter" role="main" aria-label="Subtitle capture setup">
      <div className="flex items-start justify-between px-[20px] pt-[12px] shrink-0">
        <div className="space-y-1">
          <h1 className="font-serif font-normal text-[20px] text-[#60594D]">Screen capture</h1>
          <p className="font-sans text-sm text-[#93918E]">
            Adjust the default subtitle box, then confirm.
          </p>
        </div>
        <button
          className="text-muted hover:text-foreground transition-colors cursor-pointer bg-transparent border-none"
          onClick={onClose}
          title="Close"
          aria-label="Close subtitle capture setup"
        >
          <XIcon size={20} />
        </button>
      </div>

      <div className="px-[20px] pt-[14px] shrink-0">
        {permissionStatus && permissionStatus !== "granted" && (
          <p className="mt-3 text-xs font-sans text-[#A16B46]">
            Screen recording permission is currently `{permissionStatus}`. If preview fails, enable it in macOS Settings and reopen the app.
          </p>
        )}
        {streamError && (
          <p className="mt-3 text-xs font-sans text-[#A16B46]">
            Preview unavailable: {streamError}
          </p>
        )}
      </div>

      <div className="flex-1 px-[20px] py-[20px] overflow-hidden">
        <div className="mb-3 inline-flex rounded-[14px] bg-[#F0EDE8] p-1">
          <button
            className={`rounded-[10px] px-4 py-2 font-sans text-sm transition-colors ${
              captureMode === "free"
                ? "bg-white text-[#60594D] shadow-[0_2px_10px_rgba(96,89,77,0.08)]"
                : "text-[#93918E] hover:text-[#60594D]"
            }`}
            onClick={() => setCaptureMode("free")}
            type="button"
          >
            Free select
          </button>
          <button
            className={`rounded-[10px] px-4 py-2 font-sans text-sm transition-colors ${
              captureMode === "window"
                ? "bg-white text-[#60594D] shadow-[0_2px_10px_rgba(96,89,77,0.08)]"
                : "text-[#93918E] hover:text-[#60594D]"
            }`}
            onClick={() => setCaptureMode("window")}
            type="button"
          >
            Choose window
          </button>
        </div>

        {captureMode === "window" && windowSources.length > 0 && (
          <div className="mb-3">
            <select
              className="w-full rounded-[14px] border border-[#DED8CE] bg-white px-4 py-3 font-sans text-sm text-[#4E493F] outline-none"
              value={selectedSourceId}
              onChange={(event) => setSelectedSourceId(event.target.value)}
            >
              {windowSources.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-3 font-sans text-xs uppercase tracking-[0.18em] text-[#A6A095]">
          Live preview
        </div>

        <div className="w-full">
          <div ref={previewRef} className="relative w-full overflow-hidden rounded-[18px] bg-[#EBE5DA] shadow-inner">
            <video
              ref={videoRef}
              className="block w-full"
              muted
              playsInline
              onLoadedMetadata={() => {
                setVideoReady(true);
                videoRef.current?.play().catch(() => undefined);
              }}
            />

            {videoReady && region && captureMode === "free" && (
              <div
                className="absolute border-2 border-[#E67E45] bg-[rgba(230,126,69,0.12)]"
                style={{
                  left: `${region.x * 100}%`,
                  top: `${region.y * 100}%`,
                  width: `${region.width * 100}%`,
                  height: `${region.height * 100}%`,
                }}
                onPointerDown={(event) => startDrag(event, "move")}
              >
                {(["resize-nw", "resize-ne", "resize-sw", "resize-se"] as DragMode[]).map((mode) => (
                  <button
                    key={mode}
                    className="absolute h-4 w-4 rounded-full border-2 border-white bg-[#E67E45] shadow"
                    style={cornerStyle(mode)}
                    onPointerDown={(event) => startDrag(event, mode)}
                    aria-label={`Resize subtitle region ${mode}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 px-[20px] pt-[12px] pb-[20px] shrink-0">
        <Button
          variant="normal"
          disabled={!selectedSource || (captureMode === "free" && !region)}
          onClick={() => {
            if (!selectedSource) return;
            onConfirm({
              sourceId: selectedSource.id,
              sourceName: selectedSource.name,
              region: captureMode === "window" ? { x: 0, y: 0, width: 1, height: 1 } : (region ?? DEFAULT_REGION),
            });
          }}
        >
          Confirm
        </Button>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resizeRegion(region: SubtitleRegion, mode: DragMode, dx: number, dy: number): void {
  const right = region.x + region.width;
  const bottom = region.y + region.height;

  if (mode === "resize-se" || mode === "resize-ne") {
    region.width = clamp(right + dx - region.x, MIN_REGION_SIZE / 800, 1 - region.x);
  }
  if (mode === "resize-se" || mode === "resize-sw") {
    region.height = clamp(bottom + dy - region.y, MIN_REGION_SIZE / 450, 1 - region.y);
  }
  if (mode === "resize-nw" || mode === "resize-sw") {
    const nextX = clamp(region.x + dx, 0, right - MIN_REGION_SIZE / 800);
    region.width = right - nextX;
    region.x = nextX;
  }
  if (mode === "resize-nw" || mode === "resize-ne") {
    const nextY = clamp(region.y + dy, 0, bottom - MIN_REGION_SIZE / 450);
    region.height = bottom - nextY;
    region.y = nextY;
  }
}

function cornerStyle(mode: DragMode): React.CSSProperties {
  switch (mode) {
    case "resize-nw":
      return { left: -8, top: -8, cursor: "nwse-resize" };
    case "resize-ne":
      return { right: -8, top: -8, cursor: "nesw-resize" };
    case "resize-sw":
      return { left: -8, bottom: -8, cursor: "nesw-resize" };
    case "resize-se":
      return { right: -8, bottom: -8, cursor: "nwse-resize" };
    default:
      return {};
  }
}
