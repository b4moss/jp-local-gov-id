import { LocalGovBinaryError } from "./errors";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export type StringTableBuilder = {
  add(value: string): number;
  byteLength: number;
  writeTo(bytes: Uint8Array, offset: number): number;
};

export function createStringTableBuilder(): StringTableBuilder {
  const chunks: Uint8Array[] = [];
  const offsets = new Map<string, number>();
  let size = 0;

  return {
    add(value: string): number {
      const existing = offsets.get(value);
      if (existing !== undefined) return existing;
      const encoded = textEncoder.encode(value);
      const offset = size;
      chunks.push(encoded);
      offsets.set(value, offset);
      size += encoded.length + 1;
      return offset;
    },
    get byteLength() {
      return size;
    },
    writeTo(bytes: Uint8Array, offset: number): number {
      let pos = offset;
      for (const chunk of chunks) {
        bytes.set(chunk, pos);
        pos += chunk.length;
        bytes[pos++] = 0;
      }
      return pos;
    },
  };
}

export function readCString(
  bytes: Uint8Array,
  stringTableOffset: number,
  relativeOffset: number,
  endExclusive: number,
): string {
  if (relativeOffset < 0) {
    throw new LocalGovBinaryError(`Invalid string offset: ${relativeOffset}`);
  }
  const start = stringTableOffset + relativeOffset;
  if (start >= endExclusive) {
    throw new LocalGovBinaryError(
      `String offset out of range: ${relativeOffset}`,
    );
  }
  let end = start;
  while (end < endExclusive && bytes[end] !== 0) end++;
  if (end >= endExclusive) {
    throw new LocalGovBinaryError(
      `Unterminated string at offset ${relativeOffset}`,
    );
  }
  return textDecoder.decode(bytes.subarray(start, end));
}

export function encodeUtf8(value: string): Uint8Array {
  return textEncoder.encode(value);
}

export function decodeUtf8(bytes: Uint8Array): string {
  return textDecoder.decode(bytes);
}

export function assertMagic(
  bytes: Uint8Array,
  expected: string,
  label: string,
): void {
  if (bytes.length < 4) {
    throw new LocalGovBinaryError(`${label}: buffer too short for magic`);
  }
  const magic = decodeUtf8(bytes.subarray(0, 4));
  if (magic !== expected) {
    throw new LocalGovBinaryError(
      `${label}: invalid magic (expected ${expected}, got ${JSON.stringify(magic)})`,
    );
  }
}
