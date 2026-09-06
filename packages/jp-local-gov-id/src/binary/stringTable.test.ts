import { describe, expect, it } from "vitest";
import { LocalGovBinaryError } from "./errors";
import {
  assertMagic,
  createStringTableBuilder,
  readCString,
} from "./stringTable";

describe("stringTable", () => {
  it("rejects negative relative offsets", () => {
    const bytes = new Uint8Array([65, 0]);
    expect(() => readCString(bytes, 0, -1, bytes.length)).toThrow(
      LocalGovBinaryError,
    );
  });

  it("rejects unterminated strings", () => {
    const bytes = new Uint8Array([65, 66, 67]); // no NUL
    expect(() => readCString(bytes, 0, 0, bytes.length)).toThrow(
      LocalGovBinaryError,
    );
  });

  it("rejects magic when buffer is too short", () => {
    expect(() => assertMagic(new Uint8Array([1, 2, 3]), "JLPR", "JLPR")).toThrow(
      LocalGovBinaryError,
    );
  });

  it("builds and reuses string offsets", () => {
    const table = createStringTableBuilder();
    const a = table.add("foo");
    const b = table.add("foo");
    const c = table.add("bar");
    expect(a).toBe(b);
    expect(c).not.toBe(a);
    const bytes = new Uint8Array(table.byteLength);
    const end = table.writeTo(bytes, 0);
    expect(end).toBe(table.byteLength);
    expect(readCString(bytes, 0, a, end)).toBe("foo");
    expect(readCString(bytes, 0, c, end)).toBe("bar");
  });
});
