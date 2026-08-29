import { resolve } from "node:path";
import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    dts({
      include: ["src"],
      exclude: ["src/**/*.test.ts"],
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, "src/index.ts"),
      name: "JpLocalGovId",
      formats: ["es"],
      fileName: "jp-local-gov-id",
    },
    rollupOptions: {
      external: ["node:zlib", "brotli-wasm"],
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
