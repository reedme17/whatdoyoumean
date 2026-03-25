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
