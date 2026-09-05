import { brotliCompressSync, brotliDecompressSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import {
  decompressBrotli,
  isBinaryPayloadUrl,
  isBrotliPayloadUrl,
  maybeDecompressPayload,
} from "./brotli";

describe("brotli helpers (#74)", () => {
  it("detects payload URL kinds", () => {
    expect(isBinaryPayloadUrl("https://x/a.bin")).toBe(true);
    expect(isBinaryPayloadUrl("https://x/a.bin.br")).toBe(true);
    expect(isBinaryPayloadUrl("https://x/index.json")).toBe(false);
    expect(isBrotliPayloadUrl("https://x/a.bin.br")).toBe(true);
    expect(isBrotliPayloadUrl("https://x/a.bin")).toBe(false);
  });

  it("round-trips brotli decompress", async () => {
    const raw = new TextEncoder().encode("JLIX-test-payload");
    const compressed = brotliCompressSync(raw);
    const out = new Uint8Array(await decompressBrotli(compressed));
    expect(out).toEqual(raw);
    const compressedAb = compressed.buffer.slice(
      compressed.byteOffset,
      compressed.byteOffset + compressed.byteLength,
    );
    const viaMaybe = new Uint8Array(
      await maybeDecompressPayload("https://x/a.bin.br", compressedAb),
    );
    expect(viaMaybe).toEqual(raw);
    const plain = new Uint8Array([1, 2, 3]).buffer;
    expect(await maybeDecompressPayload("https://x/a.bin", plain)).toBe(plain);
  });

  it("node zlib sync decompress matches", () => {
    const raw = new TextEncoder().encode("sync-check");
    const compressed = brotliCompressSync(raw);
    expect(new Uint8Array(brotliDecompressSync(compressed))).toEqual(raw);
  });

  it("does not reference Buffer on the Node zlib path", async () => {
    const raw = new TextEncoder().encode("no-buffer");
    const compressed = brotliCompressSync(raw);
    // Simulate a browser-like environment where DecompressionStream exists but
    // rejects the format, and Buffer is missing.
    const OriginalDS = globalThis.DecompressionStream;
    vi.stubGlobal(
      "DecompressionStream",
      class {
        constructor() {
          throw new TypeError('unsupported format');
        }
      },
    );
    const hadBuffer = "Buffer" in globalThis;
    const originalBuffer = globalThis.Buffer;
    // @ts-expect-error intentional deletion for the test
    delete globalThis.Buffer;

    try {
      const out = new Uint8Array(await decompressBrotli(compressed));
      expect(out).toEqual(raw);
    } finally {
      if (OriginalDS) vi.stubGlobal("DecompressionStream", OriginalDS);
      else Reflect.deleteProperty(globalThis, "DecompressionStream");
      if (hadBuffer) globalThis.Buffer = originalBuffer;
    }
  });

  it("falls back to brotli-wasm when DecompressionStream and Node zlib are unavailable", async () => {
    const raw = new TextEncoder().encode("wasm-fallback");
    const compressed = brotliCompressSync(raw);

    Reflect.deleteProperty(globalThis, "DecompressionStream");
    const originalVersions = process.versions;
    Object.defineProperty(process, "versions", {
      configurable: true,
      value: { ...originalVersions, node: undefined },
    });

    vi.resetModules();
    vi.doMock("brotli-wasm", () => ({
      decompress: (input: Uint8Array) => brotliDecompressSync(input),
    }));

    try {
      const { decompressBrotli: decompress } = await import("./brotli");
      const out = new Uint8Array(await decompress(compressed));
      expect(out).toEqual(raw);
    } finally {
      Object.defineProperty(process, "versions", {
        configurable: true,
        value: originalVersions,
      });
      vi.doUnmock("brotli-wasm");
      vi.resetModules();
    }
  });

  it("throws when no brotli backend is available", async () => {
    const raw = new TextEncoder().encode("no-backend");
    const compressed = brotliCompressSync(raw);

    Reflect.deleteProperty(globalThis, "DecompressionStream");
    const originalVersions = process.versions;
    Object.defineProperty(process, "versions", {
      configurable: true,
      value: { ...originalVersions, node: undefined },
    });

    vi.resetModules();
    vi.doMock("brotli-wasm", () => {
      throw new Error("wasm unavailable");
    });

    try {
      const { decompressBrotli: decompress } = await import("./brotli");
      await expect(decompress(compressed)).rejects.toThrow(
        /Brotli decompression requires DecompressionStream\("brotli"\)/,
      );
    } finally {
      Object.defineProperty(process, "versions", {
        configurable: true,
        value: originalVersions,
      });
      vi.doUnmock("brotli-wasm");
      vi.resetModules();
    }
  });

  it("treats non-URL strings containing .br / .bin as payload hints", () => {
    expect(isBrotliPayloadUrl("/data/prefectures.bin.br")).toBe(true);
    expect(isBinaryPayloadUrl("/data/prefectures.bin")).toBe(true);
    expect(isBrotliPayloadUrl("not a url")).toBe(false);
  });
});
