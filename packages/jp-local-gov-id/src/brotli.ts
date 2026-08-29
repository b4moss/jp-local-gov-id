/**
 * Brotli helpers for data payloads (#74 / #63).
 * Browser: DecompressionStream("br") when supported.
 * Node / unsupported environments: zlib.brotliDecompressSync.
 */

function toUint8Array(input: ArrayBuffer | Uint8Array): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

function u8ToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
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

async function decompressWithNodeZlib(
  bytes: Uint8Array,
): Promise<ArrayBuffer> {
  const zlib = await import("node:zlib");
  const out = zlib.brotliDecompressSync(Buffer.from(bytes));
  return u8ToArrayBuffer(out);
}

/**
 * Decompress Brotli bytes to an ArrayBuffer.
 * Prefers Web `DecompressionStream("br")` when it works; otherwise Node zlib.
 */
export async function decompressBrotli(
  input: ArrayBuffer | Uint8Array,
): Promise<ArrayBuffer> {
  const bytes = toUint8Array(input);

  if (typeof DecompressionStream === "function") {
    try {
      const format = "br" as CompressionFormat;
      const stream = new Blob([bytes as BlobPart])
        .stream()
        .pipeThrough(new DecompressionStream(format));
      return await new Response(stream).arrayBuffer();
    } catch {
      // jsdom / incomplete runtimes expose DecompressionStream without "br"
    }
  }

  return decompressWithNodeZlib(bytes);
}

/** If `url` is `.br`, decompress; otherwise return the buffer as-is. */
export async function maybeDecompressPayload(
  url: string,
  buffer: ArrayBuffer,
): Promise<ArrayBuffer> {
  if (!isBrotliPayloadUrl(url)) return buffer;
  return decompressBrotli(buffer);
}
