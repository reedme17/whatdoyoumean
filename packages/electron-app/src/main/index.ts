/**
 * Electron main process entry point.
 *
 * - Creates BrowserWindow with React renderer
 * - Sets up IPC handlers for audio capture control
 * - Targets macOS 13 (Ventura) and later
 */

import { app, BrowserWindow, ipcMain, desktopCapturer, systemPreferences } from "electron";
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { StubAudioCaptureEngine } from "./audio-capture-stub.js";

// Enforce macOS 13+ (Ventura)
const MIN_MACOS_VERSION = "13.0.0";
const execFileAsync = promisify(execFile);
const OCR_SCRIPT_PATH = path.join(os.tmpdir(), "wdym-subtitle-ocr.swift");
const OCR_IMAGE_PATH = path.join(os.tmpdir(), "wdym-subtitle-capture.png");
const OCR_CACHE_DIR = path.join(os.tmpdir(), "wdym-swift-cache");

let mainWindow: BrowserWindow | null = null;
const audioCaptureEngine = new StubAudioCaptureEngine();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 640,
    height: 480,
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

  // Open DevTools only in development
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

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

  ipcMain.handle("subtitle:ocr", async (_event, imageDataUrl: string) => {
    return runSubtitleOCR(imageDataUrl);
  });

  ipcMain.handle("window:resize", async (_event, height: number) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const bounds = mainWindow.getBounds();
    const nextHeight = Math.max(480, Math.round(height));
    mainWindow.setBounds({ ...bounds, height: nextHeight });
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

async function runSubtitleOCR(imageDataUrl: string): Promise<string> {
  if (process.platform !== "darwin") {
    throw new Error("Subtitle OCR is currently supported on macOS only.");
  }

  if (!imageDataUrl.startsWith("data:image/png;base64,")) {
    throw new Error("Subtitle OCR expects a PNG data URL.");
  }

  const base64 = imageDataUrl.replace("data:image/png;base64,", "");
  await fs.writeFile(OCR_IMAGE_PATH, Buffer.from(base64, "base64"));
  await ensureOCRScript();

  const { stdout, stderr } = await execFileAsync("swift", [OCR_SCRIPT_PATH, OCR_IMAGE_PATH], {
    timeout: 15000,
    maxBuffer: 1024 * 1024 * 4,
    env: {
      ...process.env,
      HOME: OCR_CACHE_DIR,
      CLANG_MODULE_CACHE_PATH: path.join(OCR_CACHE_DIR, "clang-modules"),
      SWIFT_MODULE_CACHE_PATH: path.join(OCR_CACHE_DIR, "swift-modules"),
    },
  });

  console.log("[OCR] stdout:", stdout.slice(0, 200));
  console.log("[OCR] stderr:", stderr.slice(0, 500));

  return stdout.trim();
}

async function ensureOCRScript(): Promise<void> {
  await fs.mkdir(path.join(OCR_CACHE_DIR, "clang-modules"), { recursive: true });
  await fs.mkdir(path.join(OCR_CACHE_DIR, "swift-modules"), { recursive: true });

  try {
    await fs.access(OCR_SCRIPT_PATH);
    return;
  } catch {
    // fall through
  }

  await fs.writeFile(
    OCR_SCRIPT_PATH,
    `
import Foundation
import Vision
import AppKit

let args = CommandLine.arguments
guard args.count > 1 else {
  FileHandle.standardError.write(Data("Missing image path\\n".utf8))
  exit(1)
}

let imagePath = args[1]
let imageURL = URL(fileURLWithPath: imagePath)

guard
  let image = NSImage(contentsOf: imageURL),
  let tiff = image.tiffRepresentation,
  let bitmap = NSBitmapImageRep(data: tiff),
  let cgImage = bitmap.cgImage
else {
  FileHandle.standardError.write(Data("Unable to read image\\n".utf8))
  exit(2)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.recognitionLanguages = ["en-US"]

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

do {
  try handler.perform([request])
  let observations = (request.results ?? []).sorted { lhs, rhs in
    if abs(lhs.boundingBox.midY - rhs.boundingBox.midY) > 0.03 {
      return lhs.boundingBox.midY > rhs.boundingBox.midY
    }
    return lhs.boundingBox.minX < rhs.boundingBox.minX
  }

  for observation in observations {
    if let candidate = observation.topCandidates(1).first {
      let box = observation.boundingBox
      FileHandle.standardError.write(Data("OCR: \\\"\\(candidate.string)\\\" conf=\\(candidate.confidence) box=\\(box.width)x\\(box.height)\\n".utf8))
    }
  }

  let lines = observations.compactMap { observation -> String? in
    guard let candidate = observation.topCandidates(1).first else { return nil }
    if candidate.confidence < 0.4 { return nil }
    let box = observation.boundingBox
    if box.width * box.height < 0.01 && candidate.string.count < 4 { return nil }
    return candidate.string
  }
  FileHandle.standardOutput.write(Data(lines.joined(separator: "\\n").utf8))
} catch {
  FileHandle.standardError.write(Data("OCR failed: \\(error.localizedDescription)\\n".utf8))
  exit(3)
}
`.trimStart(),
    "utf8",
  );
}
