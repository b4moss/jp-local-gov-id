import { resolve } from "node:path";
import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";

const entry = resolve(import.meta.dirname, "src/index.ts");
const external = ["node:zlib", "brotli-wasm"];

/**
 * Library builds (#65 / #67):
 * - npm: ESM + CJS (readable; Node externals stay external)
 * - CDN: IIFE + IIFE minify (browser `<script>`; same externals — prefer
 *   DecompressionStream("brotli") in modern browsers)
 *
 * Vitest ignores `build` and uses `test` from this config.
 */
export default defineConfig({
  plugins: [
    dts({
      include: ["src"],
      exclude: ["src/**/*.test.ts"],
      rollupTypes: true,
    }),
  ],
  build: {
    // CDN builds append into dist without wiping ESM/CJS (see scripts/build.mjs).
    emptyOutDir: true,
    lib: {
      entry,
      name: "JpLocalGovId",
      formats: ["es", "cjs"],
      fileName: (format) =>
        format === "es" ? "jp-local-gov-id.js" : "jp-local-gov-id.cjs",
    },
    rollupOptions: {
      external,
    },
    minify: false,
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
