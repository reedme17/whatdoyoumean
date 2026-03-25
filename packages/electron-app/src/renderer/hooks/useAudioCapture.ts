/**
 * useAudioCapture — captures microphone audio in the renderer process,
 * accumulates ~4-second chunks, encodes as 16kHz mono WAV, and sends
 * base64-encoded audio to the backend via WebSocket.
 *
 * Falls back gracefully if getUserMedia is unavailable.
 */

import { useRef, useState, useCallback } from "react";

/** Desired output sample rate for Groq Whisper */
const TARGET_SAMPLE_RATE = 16000;
/** Chunk duration in seconds */
const CHUNK_DURATION_SEC = 4;

interface UseAudioCaptureOptions {
  /** WebSocket send function from useSocket */
  send: (event: { type: string; [key: string]: unknown }) => void;
  /** Capture mode: "online" captures mic + system audio, "offline" captures mic only */
  mode?: "online" | "offline";
}

export interface UseAudioCaptureReturn {
  startCapture: () => Promise<void>;
  stopCapture: () => void;
  isCapturing: boolean;
  error: string | null;
}

/**
 * Encode PCM Float32 samples into a WAV file as a base64 string.
 * Output: 16-bit PCM, mono, at the given sample rate.
 */
function encodeWavBase64(samples: Float32Array, sampleRate: number): string {
  const numSamples = samples.length;
  const bytesPerSample = 2; // 16-bit
  const dataSize = numSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");

  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
  view.setUint16(32, bytesPerSample, true); // block align
  view.setUint16(34, 16, true); // bits per sample

  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Write PCM samples (clamp to [-1, 1] then scale to 16-bit)
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  // Convert to base64
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Downsample audio from source rate to target rate using linear interpolation.
 */
function downsample(buffer: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return buffer;
  const ratio = fromRate / toRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const low = Math.floor(srcIndex);
    const high = Math.min(low + 1, buffer.length - 1);
    const frac = srcIndex - low;
    result[i] = buffer[low] * (1 - frac) + buffer[high] * frac;
  }
  return result;
}

export function useAudioCapture({ send, mode = "offline" }: UseAudioCaptureOptions): UseAudioCaptureReturn {
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const systemStreamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const accumulatorRef = useRef<Float32Array[]>([]);
  const accumulatedSamplesRef = useRef(0);
  const capturingRef = useRef(false);

  const flushChunk = useCallback(() => {
    const chunks = accumulatorRef.current;
    if (chunks.length === 0) return;

    // Merge accumulated buffers
    const totalSamples = accumulatedSamplesRef.current;
    const merged = new Float32Array(totalSamples);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    // Reset accumulator
    accumulatorRef.current = [];
    accumulatedSamplesRef.current = 0;

    // Downsample to 16kHz
    const ctx = contextRef.current;
    const sourceSampleRate = ctx?.sampleRate ?? 44100;
    const downsampled = downsample(merged, sourceSampleRate, TARGET_SAMPLE_RATE);

    // Encode as WAV base64
    const audioBase64 = encodeWavBase64(downsampled, TARGET_SAMPLE_RATE);

    // Send to backend
    send({
      type: "audio:chunk",
      audioBase64,
      format: "wav",
      sampleRate: TARGET_SAMPLE_RATE,
    });

    console.log(
      `[AudioCapture] Sent chunk: ${downsampled.length} samples, ` +
      `${(downsampled.length / TARGET_SAMPLE_RATE).toFixed(1)}s, ` +
      `${Math.round(audioBase64.length / 1024)}KB base64`
    );
  }, [send]);

  const startCapture = useCallback(async () => {
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("getUserMedia not available");
      console.warn("[AudioCapture] getUserMedia not available — falling back to stub");
      return;
    }

    try {
      // 1. Get microphone stream
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: { ideal: TARGET_SAMPLE_RATE },
          noiseSuppression: true,
          autoGainControl: true,
          echoCancellation: true,
        },
      });
      streamRef.current = micStream;

      // 2. Try to get system audio (online mode only)
      let systemStream: MediaStream | null = null;
      if (mode === "online" && (window as any).electronAPI?.getDesktopSources) {
        try {
          const sources = await (window as any).electronAPI.getDesktopSources();
          // Pick the first screen source (usually "Entire Screen")
          const screenSource = sources.find((s: { name: string }) =>
            s.name.includes("Entire Screen") || s.name.includes("Screen")
          ) ?? sources[0];

          if (screenSource) {
            systemStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                mandatory: {
                  chromeMediaSource: "desktop",
                  chromeMediaSourceId: screenSource.id,
                },
              } as any,
              video: {
                mandatory: {
                  chromeMediaSource: "desktop",
                  chromeMediaSourceId: screenSource.id,
                  maxWidth: 1,
                  maxHeight: 1,
                  maxFrameRate: 1,
                },
              } as any,
            });
            // Stop the video track — we only need audio
            systemStream.getVideoTracks().forEach((t) => t.stop());
            systemStreamRef.current = systemStream;
            console.log("[AudioCapture] System audio captured via desktopCapturer");
          }
        } catch (sysErr) {
          console.warn("[AudioCapture] System audio capture failed (may need Screen Recording permission):", sysErr);
          // Continue with mic only
        }
      }

      // 3. Set up AudioContext and mix streams
      const audioContext = new AudioContext({ sampleRate: undefined });
      contextRef.current = audioContext;

      const micSource = audioContext.createMediaStreamSource(micStream);

      // If we have system audio, mix it with mic
      let mixedSource: AudioNode;
      if (systemStream && systemStream.getAudioTracks().length > 0) {
        const sysSource = audioContext.createMediaStreamSource(systemStream);
        const merger = audioContext.createChannelMerger(2);
        micSource.connect(merger, 0, 0);
        sysSource.connect(merger, 0, 1);
        // Convert stereo merger output to mono
        const monoMixer = audioContext.createGain();
        merger.connect(monoMixer);
        mixedSource = monoMixer;
        console.log("[AudioCapture] Mixing mic + system audio");
      } else {
        mixedSource = micSource;
        console.log("[AudioCapture] Mic only (no system audio)");
      }

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      const samplesPerChunk = audioContext.sampleRate * CHUNK_DURATION_SEC;

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!capturingRef.current) return;

        const inputData = e.inputBuffer.getChannelData(0);
        // Copy the buffer (it gets reused)
        const copy = new Float32Array(inputData.length);
        copy.set(inputData);

        accumulatorRef.current.push(copy);
        accumulatedSamplesRef.current += copy.length;

        // Flush when we've accumulated enough for one chunk
        if (accumulatedSamplesRef.current >= samplesPerChunk) {
          flushChunk();
        }
      };

      mixedSource.connect(processor);
      processor.connect(audioContext.destination);

      capturingRef.current = true;
      setIsCapturing(true);
      console.log(`[AudioCapture] Started — native rate: ${audioContext.sampleRate}Hz`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error("[AudioCapture] Failed to start:", msg);
    }
  }, [flushChunk]);

  const stopCapture = useCallback(() => {
    capturingRef.current = false;

    // Flush any remaining audio
    if (accumulatorRef.current.length > 0) {
      flushChunk();
    }

    // Cleanup
    processorRef.current?.disconnect();
    processorRef.current = null;

    if (contextRef.current?.state !== "closed") {
      contextRef.current?.close();
    }
    contextRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    systemStreamRef.current?.getTracks().forEach((t) => t.stop());
    systemStreamRef.current = null;

    setIsCapturing(false);
    setError(null);
    console.log("[AudioCapture] Stopped");
  }, [flushChunk]);

  return { startCapture, stopCapture, isCapturing, error };
}
