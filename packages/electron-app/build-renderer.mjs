import { build } from "esbuild";

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
