/**
 * Electron main process entry point.
 *
 * - Creates BrowserWindow with React renderer
 * - Sets up IPC handlers for audio capture control
 * - Targets macOS 13 (Ventura) and later
 */

import { app, BrowserWindow, ipcMain, desktopCapturer, systemPreferences } from "electron";
import * as path from "node:path";
import { StubAudioCaptureEngine } from "./audio-capture-stub.js";

// Enforce macOS 13+ (Ventura)
const MIN_MACOS_VERSION = "13.0.0";

let mainWindow: BrowserWindow | null = null;
const audioCaptureEngine = new StubAudioCaptureEngine();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 640,
    minHeight: 480,
    title: "啥意思",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Load the renderer HTML
  const rendererPath = path.join(__dirname, "..", "renderer", "index.html");
  mainWindow.loadFile(rendererPath);

  // Open DevTools in development
  mainWindow.webContents.openDevTools({ mode: "detach" });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── IPC Handlers — Audio Capture ───────────────────────────────────────────────

function registerIpcHandlers(): void {
  ipcMain.handle("audio:start", async (_event, config) => {
    await audioCaptureEngine.startCapture(config);
    sendToRenderer("session:state", { state: "active" });
  });

  ipcMain.handle("audio:pause", async () => {
    audioCaptureEngine.pauseCapture();
    sendToRenderer("session:state", { state: "paused" });
  });

  ipcMain.handle("audio:resume", async () => {
    audioCaptureEngine.resumeCapture();
    sendToRenderer("session:state", { state: "active" });
  });

  ipcMain.handle("audio:stop", async () => {
    const result = await audioCaptureEngine.stopCapture();
    sendToRenderer("session:state", { state: "ended" });
    return result;
  });

  ipcMain.handle("audio:devices", async () => {
    return audioCaptureEngine.getAvailableDevices();
  });

  ipcMain.handle("audio:check-permissions", async () => {
    return audioCaptureEngine.checkPermissions();
  });

  ipcMain.handle("audio:request-permissions", async () => {
    return audioCaptureEngine.requestPermissions();
  });

  ipcMain.handle("audio:state", async () => {
    return audioCaptureEngine.state;
  });

  // ── Desktop Capturer for system audio ──
  ipcMain.handle("desktop:getSources", async () => {
    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      fetchWindowIcons: false,
    });
    return sources.map((s) => ({ id: s.id, name: s.name }));
  });

  ipcMain.handle("desktop:getScreenPermission", async () => {
    // Check if screen recording permission is granted (macOS)
    if (process.platform === "darwin") {
      const status = systemPreferences.getMediaAccessStatus("screen");
      return status; // "granted" | "denied" | "not-determined" | "restricted"
    }
    return "granted";
  });
}

/** Send an event from main process to the renderer */
function sendToRenderer(type: string, payload: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("server-event", { type, payload });
  }
}

// ── Forward audio engine events to renderer ────────────────────────────────────

audioCaptureEngine.on("state-change", (state) => {
  sendToRenderer("capture:state-change", { state });
});

audioCaptureEngine.on("source-unavailable", (error) => {
  sendToRenderer("capture:source-unavailable", error);
});

audioCaptureEngine.on("noise-warning", (level) => {
  sendToRenderer("capture:noise-warning", { level });
});

// ── App lifecycle ──────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Request microphone permission on macOS before creating window
  if (process.platform === "darwin") {
    const micStatus = systemPreferences.getMediaAccessStatus("microphone");
    console.log("[Main] Microphone permission status:", micStatus);
    if (micStatus !== "granted") {
      const granted = await systemPreferences.askForMediaAccess("microphone");
      console.log("[Main] Microphone permission granted:", granted);
    }
  }

  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    // macOS: re-create window when dock icon is clicked and no windows exist
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // On macOS, apps typically stay active until Cmd+Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});
