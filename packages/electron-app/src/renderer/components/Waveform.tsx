/**
 * Waveform — real-time audio visualization.
 * Two modes:
 * - "bars": vertical bars (frequency domain) — for small inline use
 * - "wave": smooth organic wave (time domain) — for full-width display above BottomBar
 * Wave mode: only upper half, filled with barColor, bottom edge is flat baseline.
 */

import React, { useRef, useEffect } from "react";

interface Props {
  analyser: AnalyserNode | null;
  isCapturing: boolean;
  width?: number;
  height?: number;
  barCount?: number;
  color?: string;
  idleColor?: string;
  mode?: "bars" | "wave";
}

export function Waveform({
  analyser,
  isCapturing,
  width = 120,
  height = 24,
  barCount = 20,
  color = "#1A1A1A",
  idleColor = "#E8E4DE",
  mode = "bars",
}: Props): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // HiDPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    if (!analyser || !isCapturing) {
      ctx.clearRect(0, 0, w, h);
      if (mode === "bars") {
        ctx.fillStyle = idleColor;
        const barW = w / barCount;
        for (let i = 0; i < barCount; i++) {
          ctx.fillRect(i * barW + barW * 0.3, h - 2, barW * 0.4, 2);
        }
      }
      // wave mode: nothing visible when idle
      return;
    }

    if (mode === "bars") {
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const barW = w / barCount;

      const draw = () => {
        analyser.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = color;
        const step = Math.floor(dataArray.length / barCount);
        for (let i = 0; i < barCount; i++) {
          const value = dataArray[i * step] / 255;
          const barH = Math.max(2, value * h);
          const y = h - barH;
          ctx.fillRect(i * barW + barW * 0.3, y, barW * 0.4, barH);
        }
        rafRef.current = requestAnimationFrame(draw);
      };
      draw();
    } else {
      // Wave mode: smooth organic waveform from time-domain data
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const points = 128;
      const step = Math.max(1, Math.floor(dataArray.length / points));
      // EMA buffer for temporal smoothing
      const emaBuffer = new Float32Array(points);
      const alpha = 0.06; // lower = smoother/slower decay

      const draw = () => {
        analyser.getByteTimeDomainData(dataArray);
        ctx.clearRect(0, 0, w, h);

        // Build amplitude envelope with EMA temporal smoothing
        for (let i = 0; i < points; i++) {
          const idx = Math.min(i * step, dataArray.length - 1);
          const raw = Math.abs(dataArray[idx] - 128) / 128;
          emaBuffer[i] = emaBuffer[i] * (1 - alpha) + raw * alpha;
        }

        // Spatial smoothing (moving average, window 5)
        const smoothed: number[] = [];
        for (let i = 0; i < points; i++) {
          let sum = 0;
          let count = 0;
          for (let j = -5; j <= 5; j++) {
            const idx = i + j;
            if (idx >= 0 && idx < points) { sum += emaBuffer[idx]; count++; }
          }
          smoothed.push(sum / count);
        }

        // Draw filled shape
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, h);

        for (let i = 0; i < smoothed.length; i++) {
          const t = i / (smoothed.length - 1); // 0-1 across width
          const x = t * w;

          // Center window: only middle 50% has amplitude, edges fade with cosine
          let windowFade = 0;
          if (t >= 0.25 && t <= 0.75) {
            windowFade = 1;
          } else if (t < 0.25) {
            windowFade = 0.5 * (1 - Math.cos(Math.PI * (t / 0.25)));
          } else {
            windowFade = 0.5 * (1 - Math.cos(Math.PI * ((1 - t) / 0.25)));
          }

          const amplitude = smoothed[i] * h * 2.5 * windowFade;
          const y = h - Math.min(amplitude, h - 1);

          if (i === 0) {
            ctx.lineTo(x, y);
          } else {
            const prevX = ((i - 1) / (smoothed.length - 1)) * w;
            const cpX = (prevX + x) / 2;
            const prevT = (i - 1) / (smoothed.length - 1);
            let prevFade = 0;
            if (prevT >= 0.25 && prevT <= 0.75) prevFade = 1;
            else if (prevT < 0.25) prevFade = 0.5 * (1 - Math.cos(Math.PI * (prevT / 0.25)));
            else prevFade = 0.5 * (1 - Math.cos(Math.PI * ((1 - prevT) / 0.25)));
            const prevAmp = smoothed[i - 1] * h * 2.5 * prevFade;
            const prevY = h - Math.min(prevAmp, h - 1);
            ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
          }
        }

        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();

        rafRef.current = requestAnimationFrame(draw);
      };
      draw();
    }

    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser, isCapturing, width, height, barCount, color, idleColor, mode]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{ height, opacity: mode === "wave" ? 1 : 0.8 }}
      aria-hidden="true"
    />
  );
}
