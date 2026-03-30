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
/** Chunk duration in seconds — short for low-latency streaming */
const CHUNK_DURATION_SEC = 0.25;

/** Audio source mode */
export type AudioSourceMode = "mic" | "internal" | "mic+internal";

interface UseAudioCaptureOptions {
  /** WebSocket send function from useSocket */
  send: (event: { type: string; [key: string]: unknown }) => void;
  /** Capture mode: "online" captures mic + system audio, "offline" captures mic only */
  mode?: "online" | "offline";
  /** Audio source: "mic" (default), "internal" (system audio only), "mic+internal" (both, future) */
  audioSource?: AudioSourceMode;
  /** @deprecated Use audioSource instead */
  captureSystem?: boolean;
}

export interface UseAudioCaptureReturn {
  startCapture: () => Promise<void>;
  stopCapture: () => void;
  isCapturing: boolean;
  error: string | null;
  /** AnalyserNode for real-time waveform visualization */
  analyser: AnalyserNode | null;
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

/** RMS energy threshold — below this, the chunk is considered silence */
const SILENCE_RMS_THRESHOLD = 0.003;

/**
 * Calculate RMS (root mean square) energy of audio samples.
 * Returns a value between 0 (silence) and 1 (max volume).
 */
function calculateRMS(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

export function useAudioCapture({ send, mode = "offline", audioSource = "mic", captureSystem = false }: UseAudioCaptureOptions): UseAudioCaptureReturn {
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const systemStreamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const accumulatorRef = useRef<Float32Array[]>([]);
  const accumulatedSamplesRef = useRef(0);
  const capturingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

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

    const wavBase64 = encodeWavBase64(downsampled, TARGET_SAMPLE_RATE);

    // Send to backend
    send({
      type: "audio:chunk",
      audioBase64: wavBase64,
      format: "wav",
      sampleRate: TARGET_SAMPLE_RATE,
    });

    // Log only occasionally to avoid flooding console at 4 chunks/sec
    // (disabled — too noisy even at 10%)
  }, [send]);

  const startCapture = useCallback(async () => {
    setError(null);

    console.log("[AudioCapture] startCapture called, audioSource:", audioSource);
    const useInternal = audioSource === "internal";

    // ── Internal mode: capture system audio via MediaRecorder (no AudioContext) ──
    if (useInternal) {
      if (!(window as any).electronAPI?.getDesktopSources) {
        setError("System audio capture requires Electron desktop API");
        console.warn("[AudioCapture] electronAPI.getDesktopSources not available");
        return;
      }

      try {
        const sources = await (window as any).electronAPI.getDesktopSources();
        const screenSource = sources.find((s: { name: string }) =>
          s.name.includes("Entire Screen") || s.name.includes("Screen")
        ) ?? sources[0];

        if (!screenSource) {
          setError("No screen source available for system audio");
          return;
        }

        const systemStream = await navigator.mediaDevices.getUserMedia({
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
        systemStream.getVideoTracks().forEach((t) => t.stop());
        systemStreamRef.current = systemStream;
        console.log("[AudioCapture] System audio stream acquired, tracks:", systemStream.getAudioTracks().length);

        // Use MediaRecorder to capture audio, then decode accumulated blobs
        const audioOnlyStream = new MediaStream(systemStream.getAudioTracks());
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
        const recorder = new MediaRecorder(audioOnlyStream, { mimeType });
        mediaRecorderRef.current = recorder;

        // Accumulate all blobs from session start — needed because webm needs headers from first chunk
        const allChunks: Blob[] = [];
        let lastSentBlobSize = 0;

        recorder.ondataavailable = (e: BlobEvent) => {
          if (!capturingRef.current || e.data.size === 0) return;
          allChunks.push(e.data);
          console.log(`[AudioCapture] MediaRecorder chunk: ${e.data.size} bytes, total chunks: ${allChunks.length}`);
        };

        // Periodically decode accumulated audio and send new portion
        const decodeInterval = setInterval(async () => {
          if (!capturingRef.current || allChunks.length === 0) return;

          try {
            const fullBlob = new Blob(allChunks, { type: mimeType });
            if (fullBlob.size <= lastSentBlobSize) return; // no new data

            const arrayBuf = await fullBlob.arrayBuffer();
            // OfflineAudioContext needs enough frames — use 30s buffer at target rate
            const offlineCtx = new OfflineAudioContext(1, TARGET_SAMPLE_RATE * 30, TARGET_SAMPLE_RATE);
            const audioBuf = await offlineCtx.decodeAudioData(arrayBuf);
            const fullPcm = audioBuf.getChannelData(0);

            // Only send the new portion since last send
            const prevSamples = Math.round((lastSentBlobSize / fullBlob.size) * fullPcm.length);
            const newPcm = fullPcm.slice(Math.max(0, prevSamples));
            lastSentBlobSize = fullBlob.size;

            if (newPcm.length < 100) return; // too small

            const downsampled = audioBuf.sampleRate !== TARGET_SAMPLE_RATE
              ? downsample(new Float32Array(newPcm), audioBuf.sampleRate, TARGET_SAMPLE_RATE)
              : new Float32Array(newPcm);

            const wavBase64 = encodeWavBase64(downsampled, TARGET_SAMPLE_RATE);
            send({
              type: "audio:chunk",
              audioBase64: wavBase64,
              format: "wav",
              sampleRate: TARGET_SAMPLE_RATE,
            });
            console.log(`[AudioCapture] Sent internal audio: ${downsampled.length} samples`);
          } catch (decodeErr) {
            console.warn("[AudioCapture] Internal decode error:", (decodeErr as Error).message);
          }
        }, 1000); // decode every 1 second

        // Store interval for cleanup
        (recorder as any)._decodeInterval = decodeInterval;

        recorder.start(500); // collect chunks every 500ms

        capturingRef.current = true;
        setIsCapturing(true);
        console.log("[AudioCapture] Started INTERNAL mode via MediaRecorder");
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        console.error("[AudioCapture] Internal audio capture failed:", msg);
        return;
      }
    }
    // ── Mic mode (default) ──
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("getUserMedia not available");
      console.warn("[AudioCapture] getUserMedia not available — falling back to stub");
      return;
    }

    try {
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

      const audioContext = new AudioContext();
      contextRef.current = audioContext;

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const micSource = audioContext.createMediaStreamSource(micStream);

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
      micSource.connect(analyser);

      const samplesPerChunk = audioContext.sampleRate * CHUNK_DURATION_SEC;

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!capturingRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const copy = new Float32Array(inputData.length);
        copy.set(inputData);
        accumulatorRef.current.push(copy);
        accumulatedSamplesRef.current += copy.length;
        if (accumulatedSamplesRef.current >= samplesPerChunk) {
          flushChunk();
        }
      };

      micSource.connect(processor);
      processor.connect(audioContext.destination);

      capturingRef.current = true;
      setIsCapturing(true);
      console.log(`[AudioCapture] Started MIC mode — native rate: ${audioContext.sampleRate}Hz`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error("[AudioCapture] Failed to start:", msg);
    }
  }, [flushChunk, audioSource]);

  const stopCapture = useCallback(() => {
    capturingRef.current = false;

    // Stop MediaRecorder if active (internal mode)
    if (mediaRecorderRef.current) {
      if ((mediaRecorderRef.current as any)._decodeInterval) {
        clearInterval((mediaRecorderRef.current as any)._decodeInterval);
      }
      if (mediaRecorderRef.current.state !== "inactive") {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
    }
    mediaRecorderRef.current = null;

    // Flush any remaining audio
    if (accumulatorRef.current.length > 0) {
      flushChunk();
    }

    // Cleanup
    processorRef.current?.disconnect();
    processorRef.current = null;

    analyserRef.current?.disconnect();
    analyserRef.current = null;

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

  return { startCapture, stopCapture, isCapturing, error, analyser: analyserRef.current };
}
