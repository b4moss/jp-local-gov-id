import { resolve } from "node:path";
import { defineConfig } from "vite";

const entry = resolve(import.meta.dirname, "src/index.ts");
const external = ["node:zlib", "brotli-wasm"];

/**
 * CDN IIFE builds (#65 / #67). Invoked twice from scripts/build.mjs
 * (unminified + minified). Does not emit .d.ts (npm build owns that).
 */
export default defineConfig(({ mode }) => {
  const minify = mode === "minify";
  return {
    build: {
      emptyOutDir: false,
      lib: {
        entry,
        name: "JpLocalGovId",
        formats: ["iife"],
        fileName: () =>
          minify ? "jp-local-gov-id.iife.min.js" : "jp-local-gov-id.iife.js",
      },
      rollupOptions: {
        external,
        output: {
          // Dynamic import("node:zlib") / import("brotli-wasm") stay as
          // runtime imports when those paths run; browsers use DecompressionStream.
          globals: {
            "node:zlib": "zlib",
            "brotli-wasm": "BrotliWasm",
          },
        },
      },
      minify: minify ? "esbuild" : false,
    },
  };
});
