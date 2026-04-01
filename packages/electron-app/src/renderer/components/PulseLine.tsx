/**
 * PulseLine — wave edge overlay for BottomBar top.
 * Peaks extend bar upward (bar color), troughs cut into bar (bg color).
 * Placed in absolute container above BottomBar.
 */

import React, { useRef, useEffect } from "react";

interface Props {
  analyser: AnalyserNode | null;
  isCapturing: boolean;
  barColor?: string;
  bgColor?: string;
}

export function PulseLine({
  analyser,
  isCapturing,
  barColor = "#F0EDE8",
  bgColor = "#FAF8F5",
}: Props): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const midY = h / 2;
    const amplitude = h / 2;
    const inset = 24;

    const drawFlat = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = barColor;
      ctx.fillRect(0, midY, w, h - midY);
    };

    if (!analyser || !isCapturing) {
      drawFlat();
      return;
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      analyser.getByteTimeDomainData(dataArray);
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = barColor;
      ctx.fillRect(0, midY, w, h - midY);

      const points = 80;
      const step = Math.floor(dataArray.length / points);

      const wavePts: [number, number][] = [];
      for (let i = 0; i <= points; i++) {
        const t = i / points;
        const x = t * w;
        const idx = Math.min(i * step, dataArray.length - 1);
        const v = (dataArray[idx] - 128) / 128;

        let fade = 1;
        if (x < inset) fade = x / inset;
        else if (x > w - inset) fade = (w - x) / inset;

        const y = midY + v * amplitude * 2 * fade;
        wavePts.push([x, y]);
      }

      // Peaks: bar color above midY
      ctx.fillStyle = barColor;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      for (const [x, y] of wavePts) ctx.lineTo(x, Math.min(y, midY));
      ctx.lineTo(w, midY);
      ctx.closePath();
      ctx.fill();

      // Troughs: bg color below midY
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      for (const [x, y] of wavePts) ctx.lineTo(x, Math.max(y, midY));
      ctx.lineTo(w, midY);
      ctx.closePath();
      ctx.fill();

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser, isCapturing, barColor, bgColor]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
}
