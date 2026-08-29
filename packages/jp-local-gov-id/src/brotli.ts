/**
 * Brotli helpers for data payloads (#74 / #63).
 * 1) Web DecompressionStream("brotli") when supported
 * 2) Browser fallback: brotli-wasm
 * 3) Node: zlib.brotliDecompressSync (Uint8Array; no Buffer)
 *
 * Note: HTTP Content-Encoding uses the token "br"; the Streams API format is "brotli".
 */

function toUint8Array(input: ArrayBuffer | Uint8Array): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

function u8ToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function isNodeRuntime(): boolean {
  return (
    typeof process !== "undefined" &&
    typeof process.versions === "object" &&
    typeof process.versions.node === "string"
  );
}

/** True when the URL path looks like a Brotli-compressed payload. */
export function isBrotliPayloadUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    return pathname.endsWith(".br");
  } catch {
    return url.includes(".br");
  }
}

/** True when the URL path is a JLPR/JLDT/JLIX payload (raw `.bin` or `.bin.br`). */
export function isBinaryPayloadUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    return pathname.endsWith(".bin") || pathname.endsWith(".bin.br");
  } catch {
    return url.includes(".bin");
  }
}

async function decompressWithDecompressionStream(
  bytes: Uint8Array,
  format: string,
): Promise<ArrayBuffer> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream(format as CompressionFormat));
  return await new Response(stream).arrayBuffer();
}

async function decompressWithNodeZlib(
  bytes: Uint8Array,
): Promise<ArrayBuffer> {
  const zlib = await import("node:zlib");
  const out = zlib.brotliDecompressSync(bytes);
  return u8ToArrayBuffer(out);
}

let brotliWasmPromise: Promise<{
  decompress: (input: Uint8Array) => Uint8Array;
}> | null = null;

async function decompressWithBrotliWasm(
  bytes: Uint8Array,
): Promise<ArrayBuffer> {
  if (!brotliWasmPromise) {
    brotliWasmPromise = import("brotli-wasm").then(async (mod) => {
      // Default export is a Promise in browser builds; sync API in Node build.
      const api = "default" in mod ? await mod.default : mod;
      return api as { decompress: (input: Uint8Array) => Uint8Array };
    });
  }
  const api = await brotliWasmPromise;
  return u8ToArrayBuffer(api.decompress(bytes));
}

/**
 * Decompress Brotli bytes to an ArrayBuffer.
 * Prefers Web `DecompressionStream("brotli")`, then brotli-wasm, then Node zlib.
 */
export async function decompressBrotli(
  input: ArrayBuffer | Uint8Array,
): Promise<ArrayBuffer> {
  const bytes = toUint8Array(input);

  if (typeof DecompressionStream === "function") {
    // Spec format is "brotli". Also try "br" for older experimental implementations.
    for (const format of ["brotli", "br"] as const) {
      try {
        return await decompressWithDecompressionStream(bytes, format);
      } catch {
        // Unsupported format or incomplete runtime (e.g. jsdom).
      }
    }
  }

  // Prefer Node zlib before wasm (faster; avoids wasm network loads under fetch mocks).
  if (isNodeRuntime()) {
    return decompressWithNodeZlib(bytes);
  }

  try {
    return await decompressWithBrotliWasm(bytes);
  } catch {
    // Optional / unavailable in some graphs.
  }

  throw new TypeError(
    'Brotli decompression requires DecompressionStream("brotli"), brotli-wasm, or a Node.js runtime',
  );
}

/** If `url` is `.br`, decompress; otherwise return the buffer as-is. */
export async function maybeDecompressPayload(
  url: string,
  buffer: ArrayBuffer,
): Promise<ArrayBuffer> {
  if (!isBrotliPayloadUrl(url)) return buffer;
  return decompressBrotli(buffer);
}
