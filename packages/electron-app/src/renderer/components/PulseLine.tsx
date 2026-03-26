/**
 * PulseLine — thin canvas line at top of BottomBar.
 * Reads AnalyserNode frequency data to create a subtle pulse effect.
 * Flat line when silent, gentle wave when speaking.
 */

import React, { useRef, useEffect } from "react";

interface Props {
  analyser: AnalyserNode | null;
  isCapturing: boolean;
  color?: string;
  height?: number;
}

export function PulseLine({
  analyser,
  isCapturing,
  color = "#D4D0CA",
  height = 3,
}: Props): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const midY = h / 2;

    if (!analyser || !isCapturing) {
      // Flat line
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(w, midY);
      ctx.stroke();
      return;
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      analyser.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      const sliceWidth = w / dataArray.length;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0; // 0-2 range, 1 = center
        const y = midY + (v - 1) * h * 2; // amplify

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }

      ctx.stroke();
      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser, isCapturing, color, height]);

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={height * 2}
      className="w-full pointer-events-none"
      style={{ height: height * 2 }}
      aria-hidden="true"
    />
  );
}
