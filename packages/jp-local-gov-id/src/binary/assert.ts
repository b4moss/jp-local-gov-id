import { fmt } from "../messages";
import { LocalGovBinaryError } from "./errors";
import { readCString } from "./stringTable";

export function requireU8(n: number, field: string): number {
  if (!Number.isInteger(n) || n < 0 || n > 0xff) {
    throw new LocalGovBinaryError(fmt("binary.fieldOutOfU1", { field, n }));
  }
  return n;
}

export function requireU32(n: number, field: string): number {
  if (!Number.isInteger(n) || n < 0 || n > 0xffff_ffff) {
    throw new LocalGovBinaryError(fmt("binary.fieldOutOfU4", { field, n }));
  }
  return n;
}

export function requireFlag(n: number, field: string): 0 | 1 {
  if (n !== 0 && n !== 1) {
    throw new LocalGovBinaryError(fmt("binary.fieldMustBe0Or1", { field, n }));
  }
  return n;
}

export function stringEndExclusive(
  bytes: Uint8Array,
  stringTableOffset: number,
  relativeOffset: number,
  endExclusive: number,
): number {
  readCString(bytes, stringTableOffset, relativeOffset, endExclusive);
  let p = stringTableOffset + relativeOffset;
  while (bytes[p] !== 0) p++;
  return p + 1;
}

export function assertPayloadEndsAt(
  label: string,
  expectedEnd: number,
  actualEnd: number,
): void {
  if (expectedEnd !== actualEnd) {
    throw new LocalGovBinaryError(
      fmt("binary.trailingOrUnusedBytes", { label, expectedEnd, actualEnd }),
    );
  }
}
