/**
 * Electron preload script — exposes IPC bridge to the renderer via contextBridge.
 *
 * The renderer accesses these methods through `window.electronAPI`.
 */

import { contextBridge, ipcRenderer } from "electron";

export interface ElectronAPI {
  startSession(config: {
    mode: "online" | "offline";
    sampleRate: 16000 | 44100;
    channels: 1 | 2;
    noiseSuppression: boolean;
    autoGain: boolean;
  }): Promise<void>;
  pauseSession(): Promise<void>;
  resumeSession(): Promise<void>;
  stopSession(): Promise<{ durationMs: number; totalChunks: number; droppedChunks: number }>;
  getAudioDevices(): Promise<Array<{ id: string; name: string; type: string; isDefault: boolean }>>;
  checkPermissions(): Promise<{ screenRecording: string; microphone: string }>;
  requestPermissions(): Promise<{ screenRecording: string; microphone: string }>;
  getCaptureState(): Promise<string>;

  /** Subscribe to events pushed from the main process */
  onServerEvent(
    callback: (event: { type: string; payload: unknown }) => void
  ): () => void;
}

contextBridge.exposeInMainWorld("electronAPI", {
  // ── Session lifecycle ────────────────────────────────────────────────────────
  startSession: (config: ElectronAPI extends { startSession: (c: infer C) => unknown } ? C : never) =>
    ipcRenderer.invoke("audio:start", config),

  pauseSession: () => ipcRenderer.invoke("audio:pause"),

  resumeSession: () => ipcRenderer.invoke("audio:resume"),

  stopSession: () => ipcRenderer.invoke("audio:stop"),

  // ── Device & permissions ─────────────────────────────────────────────────────
  getAudioDevices: () => ipcRenderer.invoke("audio:devices"),

  checkPermissions: () => ipcRenderer.invoke("audio:check-permissions"),

  requestPermissions: () => ipcRenderer.invoke("audio:request-permissions"),

  getCaptureState: () => ipcRenderer.invoke("audio:state"),

  // ── Server → Renderer events ─────────────────────────────────────────────────
  onServerEvent: (callback: (event: { type: string; payload: unknown }) => void) => {
    const handler = (_ipcEvent: Electron.IpcRendererEvent, data: { type: string; payload: unknown }) => {
      callback(data);
    };
    ipcRenderer.on("server-event", handler);
    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener("server-event", handler);
    };
  },
} satisfies ElectronAPI);
