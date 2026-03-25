import { build } from "esbuild";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";

// Ensure output dir exists
if (!existsSync("dist/renderer")) {
  mkdirSync("dist/renderer", { recursive: true });
}

// 1. Build Tailwind CSS (use local binary, not npx)
console.log("⏳ Building Tailwind CSS...");
execSync(
  "node ../../node_modules/@tailwindcss/cli/dist/index.mjs -i src/renderer/globals.css -o dist/renderer/styles.css --minify",
  { stdio: "inherit" }
);
console.log("✅ Tailwind CSS → dist/renderer/styles.css");

// 1b. Copy font files referenced by @fontsource
import { cpSync, readdirSync } from "node:fs";
const fontDirs = ["merriweather", "mulish", "source-code-pro"];
if (!existsSync("dist/renderer/files")) {
  mkdirSync("dist/renderer/files", { recursive: true });
}
for (const font of fontDirs) {
  const srcDir = `../../node_modules/@fontsource/${font}/files`;
  try {
    const files = readdirSync(srcDir);
    for (const f of files) {
      cpSync(`${srcDir}/${f}`, `dist/renderer/files/${f}`, { force: true });
    }
  } catch {
    console.warn(`⚠ Font files not found: ${srcDir}`);
  }
}
console.log("✅ Font files copied → dist/renderer/files/");

// 1c. Copy asset files (images)
import { cpSync as cpSyncFs } from "node:fs";
const assetsSrc = "src/renderer/assets";
const assetsDst = "dist/renderer/assets";
try {
  cpSyncFs(assetsSrc, assetsDst, { recursive: true, force: true });
  console.log("✅ Assets copied → dist/renderer/assets/");
} catch {
  console.warn("⚠ No assets directory found");
}

// 2. Bundle React app
await build({
  entryPoints: ["src/renderer/index.tsx"],
  bundle: true,
  outfile: "dist/renderer/index.js",
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  external: [],
  sourcemap: true,
});

console.log("✅ Renderer bundled → dist/renderer/index.js");
