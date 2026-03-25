/**
 * Waveform — real-time audio waveform visualization using canvas.
 * Reads frequency data from an AnalyserNode and draws bars.
 */

import React, { useRef, useEffect } from "react";

interface Props {
  analyser: AnalyserNode | null;
  isCapturing: boolean;
  width?: number;
  height?: number;
  barCount?: number;
}

export function Waveform({
  analyser,
  isCapturing,
  width = 120,
  height = 24,
  barCount = 20,
}: Props): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser || !isCapturing) {
      // Draw flat line when not capturing
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, width, height);
          ctx.fillStyle = "#E8E4DE";
          const barW = width / barCount;
          for (let i = 0; i < barCount; i++) {
            ctx.fillRect(i * barW + 1, height / 2 - 1, barW - 2, 2);
          }
        }
      }
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const barW = width / barCount;

    const draw = () => {
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#1A1A1A";

      // Sample evenly from frequency data
      const step = Math.floor(dataArray.length / barCount);
      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * step] / 255;
        const barH = Math.max(2, value * height);
        const y = (height - barH) / 2;
        ctx.fillRect(i * barW + 1, y, barW - 2, barH);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [analyser, isCapturing, width, height, barCount]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="opacity-80"
      aria-hidden="true"
    />
  );
}
