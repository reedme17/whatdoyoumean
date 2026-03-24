/**
 * Stub implementation of AudioCaptureEngine.
 *
 * Logs all actions to console. The real ScreenCaptureKit/CoreAudio integration
 * will replace this as a native Node addon.
 */

import { EventEmitter } from "node:events";
import type {
  AudioCaptureEngine,
  AudioChunk,
  AudioDevice,
  AudioSourceError,
  CaptureConfig,
  CaptureResult,
  CaptureState,
  PermissionStatus,
} from "./audio-capture.js";

export class StubAudioCaptureEngine extends EventEmitter implements AudioCaptureEngine {
  private _state: CaptureState = "idle";
  private _startTime = 0;
  private _totalChunks = 0;
  private _pausedDuration = 0;
  private _pauseStart = 0;

  get state(): CaptureState {
    return this._state;
  }

  async startCapture(config: CaptureConfig): Promise<void> {
    if (this._state !== "idle") {
      throw new Error(`Cannot start capture: current state is "${this._state}"`);
    }
    console.log("[AudioCapture STUB] startCapture", config);
    this._state = "capturing";
    this._startTime = Date.now();
    this._totalChunks = 0;
    this._pausedDuration = 0;
    this.emit("state-change", this._state);
  }

  pauseCapture(): void {
    if (this._state !== "capturing") {
      throw new Error(`Cannot pause: current state is "${this._state}"`);
    }
    console.log("[AudioCapture STUB] pauseCapture");
    this._state = "paused";
    this._pauseStart = Date.now();
    this.emit("state-change", this._state);
  }

  resumeCapture(): void {
    if (this._state !== "paused") {
      throw new Error(`Cannot resume: current state is "${this._state}"`);
    }
    console.log("[AudioCapture STUB] resumeCapture");
    this._pausedDuration += Date.now() - this._pauseStart;
    this._state = "capturing";
    this.emit("state-change", this._state);
  }

  async stopCapture(): Promise<CaptureResult> {
    if (this._state === "idle") {
      throw new Error("Cannot stop: no active capture");
    }
    console.log("[AudioCapture STUB] stopCapture");
    const durationMs = Date.now() - this._startTime - this._pausedDuration;
    const result: CaptureResult = {
      durationMs,
      totalChunks: this._totalChunks,
      droppedChunks: 0,
    };
    this._state = "idle";
    this.emit("state-change", this._state);
    return result;
  }

  async setAudioSource(deviceId: string): Promise<void> {
    console.log("[AudioCapture STUB] setAudioSource", deviceId);
  }

  async getAvailableDevices(): Promise<AudioDevice[]> {
    console.log("[AudioCapture STUB] getAvailableDevices");
    // Return a mock default device
    return [
      {
        id: "default-mic",
        name: "Built-in Microphone",
        type: "input",
        isDefault: true,
      },
      {
        id: "default-output",
        name: "Built-in Output",
        type: "system",
        isDefault: true,
      },
    ];
  }

  async checkPermissions(): Promise<PermissionStatus> {
    console.log("[AudioCapture STUB] checkPermissions");
    // Stub: report not-determined so the app can prompt
    return {
      screenRecording: "not-determined",
      microphone: "not-determined",
    };
  }

  async requestPermissions(): Promise<PermissionStatus> {
    console.log("[AudioCapture STUB] requestPermissions — would trigger macOS permission dialogs");
    // Stub: simulate granted
    return {
      screenRecording: "granted",
      microphone: "granted",
    };
  }
}
