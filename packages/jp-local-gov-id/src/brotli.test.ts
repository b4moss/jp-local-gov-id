import { brotliCompressSync, brotliDecompressSync } from "node:zlib";
import { describe, expect, it } from "vitest";
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
    const compressed = brotliCompressSync(Buffer.from(raw));
    const out = new Uint8Array(await decompressBrotli(compressed));
    expect(Buffer.from(out).equals(Buffer.from(raw))).toBe(true);
    expect(
      Buffer.from(
        await maybeDecompressPayload("https://x/a.bin.br", compressed.buffer.slice(
          compressed.byteOffset,
          compressed.byteOffset + compressed.byteLength,
        )),
      ).equals(Buffer.from(raw)),
    ).toBe(true);
    const plain = new Uint8Array([1, 2, 3]).buffer;
    expect(await maybeDecompressPayload("https://x/a.bin", plain)).toBe(plain);
  });

  it("node zlib sync decompress matches", () => {
    const raw = Buffer.from("sync-check");
    const compressed = brotliCompressSync(raw);
    expect(brotliDecompressSync(compressed).equals(raw)).toBe(true);
  });
});
