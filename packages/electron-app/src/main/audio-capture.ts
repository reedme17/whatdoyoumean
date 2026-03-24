/**
 * Audio Capture Engine — Stub Implementation
 *
 * This module defines the AudioCaptureEngine interface matching the design.md spec
 * and provides a stub implementation. The real ScreenCaptureKit/CoreAudio integration
 * will be implemented as a native Node addon in a future task.
 */

import { EventEmitter } from "node:events";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CaptureConfig {
  mode: "online" | "offline";
  sampleRate: 16000 | 44100;
  channels: 1 | 2;
  noiseSuppression: boolean;
  autoGain: boolean;
}

export interface AudioChunk {
  data: Float32Array;
  timestamp: number;
  channel: "system" | "microphone" | "mixed";
  durationMs: number;
}

export interface AudioDevice {
  id: string;
  name: string;
  type: "input" | "output" | "system";
  isDefault: boolean;
}

export interface AudioSourceError {
  code: string;
  message: string;
  deviceId?: string;
}

export interface CaptureResult {
  durationMs: number;
  totalChunks: number;
  droppedChunks: number;
}

export type CaptureState = "idle" | "capturing" | "paused";

// ── Permission types ───────────────────────────────────────────────────────────

export interface PermissionStatus {
  screenRecording: "granted" | "denied" | "not-determined";
  microphone: "granted" | "denied" | "not-determined";
}

// ── AudioCaptureEngine interface ───────────────────────────────────────────────

export interface AudioCaptureEngine {
  readonly state: CaptureState;

  startCapture(config: CaptureConfig): Promise<void>;
  pauseCapture(): void;
  resumeCapture(): void;
  stopCapture(): Promise<CaptureResult>;

  setAudioSource(deviceId: string): Promise<void>;
  getAvailableDevices(): Promise<AudioDevice[]>;
  checkPermissions(): Promise<PermissionStatus>;
  requestPermissions(): Promise<PermissionStatus>;

  on(event: "audio-chunk", listener: (chunk: AudioChunk) => void): void;
  on(event: "source-unavailable", listener: (error: AudioSourceError) => void): void;
  on(event: "noise-warning", listener: (level: number) => void): void;
  on(event: "state-change", listener: (state: CaptureState) => void): void;
}
