import { describe, expect, it } from "vitest";
import {
  ENCODE_MESSAGES,
  fmt as encodeFmt,
  msg as encodeMsg,
  type EncodeMessageKey,
} from "./messages.encode";
import { fmt, msg, MESSAGES, type MessageKey } from "./messages";
import {
  SEARCH_MESSAGES,
  fmt as searchFmt,
  msg as searchMsg,
  type SearchMessageKey,
} from "./messages.search";

describe("messages catalog helpers", () => {
  it("msg returns static runtime catalog strings", () => {
    expect(msg("binary.jlpr.shortRecords")).toBe(
      "JLPR: buffer too short for records",
    );
    expect(msg("schema.indexPathsObject")).toBe(
      MESSAGES["schema.indexPathsObject"],
    );
  });

  it("encode msg returns encode catalog strings", () => {
    expect(encodeMsg("binary.asOfExceedsU1")).toBe("asOf exceeds u1 length");
    expect(encodeMsg("data.unknownPrefectureCode")).toBe(
      ENCODE_MESSAGES["data.unknownPrefectureCode"],
    );
  });

  it("search msg returns search catalog strings", () => {
    expect(searchMsg("search.nPositiveInteger")).toBe(
      SEARCH_MESSAGES["search.nPositiveInteger"],
    );
  });

  it("fmt substitutes placeholders", () => {
    expect(fmt("binary.unsupportedVersion", { version: 9 })).toBe(
      "Unsupported version: 9",
    );
    expect(fmt("schema.searchNgramShardsEntry", { key: "a" })).toBe(
      MESSAGES["schema.searchNgramShardsEntry"].replace("{key}", "a"),
    );
    expect(encodeFmt("binary.versionOutOfU1", { version: 300 })).toBe(
      "version out of u1 range: 300",
    );
  });

  it("msg throws on unknown keys", () => {
    expect(() => msg("no.such.key" as MessageKey)).toThrow(/Unknown message key/);
    expect(() => encodeMsg("no.such.key" as EncodeMessageKey)).toThrow(
      /Unknown message key/,
    );
    expect(() => searchMsg("no.such.key" as SearchMessageKey)).toThrow(
      /Unknown message key/,
    );
  });

  it("fmt throws when a required placeholder is missing", () => {
    expect(() => fmt("binary.unsupportedVersion", {})).toThrow(
      /Missing message placeholder "version"/,
    );
  });

  it("fmt throws on nullish placeholder values", () => {
    expect(() =>
      fmt("binary.unsupportedVersion", {
        version: null as unknown as number,
      }),
    ).toThrow(/must not be null or undefined/);
  });

  it("runtime / encode / search catalogs are disjoint and cover namespaces", () => {
    const runtimeKeys = Object.keys(MESSAGES) as MessageKey[];
    const encodeKeys = Object.keys(ENCODE_MESSAGES) as EncodeMessageKey[];
    const searchKeys = Object.keys(SEARCH_MESSAGES) as SearchMessageKey[];
    expect(runtimeKeys.some((k) => k.startsWith("schema."))).toBe(true);
    expect(runtimeKeys.some((k) => k.startsWith("create."))).toBe(true);
    expect(runtimeKeys.some((k) => k.startsWith("binary."))).toBe(true);
    expect(runtimeKeys.some((k) => k.startsWith("search."))).toBe(false);
    expect(runtimeKeys.some((k) => k.startsWith("data."))).toBe(false);
    expect(encodeKeys).toContain("data.unknownPrefectureCode");
    expect(encodeKeys).toContain("binary.jlpr.encodeSizeMismatch");
    expect(searchKeys.some((k) => k.startsWith("search."))).toBe(true);
    for (const key of encodeKeys) {
      expect(runtimeKeys).not.toContain(key);
      expect(searchKeys).not.toContain(key);
    }
    for (const key of searchKeys) {
      expect(runtimeKeys).not.toContain(key);
    }
  });

  it("src throw/warn sites do not hardcode user-facing English literals", async () => {
    const { readdir, readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const root = join(import.meta.dirname);

    async function walk(dir: string): Promise<string[]> {
      const entries = await readdir(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...(await walk(path)));
          continue;
        }
        if (
          !entry.name.endsWith(".ts") ||
          entry.name.endsWith(".test.ts") ||
          entry.name.startsWith("messages")
        ) {
          continue;
        }
        files.push(path);
      }
      return files;
    }

    const leftovers: string[] = [];
    for (const file of await walk(root)) {
      const text = await readFile(file, "utf8");
      const re = /(?:throw new \w+|console\.warn)\(\s*/g;
      let match: RegExpExecArray | null;
      while ((match = re.exec(text)) !== null) {
        const after = text
          .slice(match.index + match[0].length, match.index + match[0].length + 48)
          .trimStart();
        if (
          after.startsWith("msg(") ||
          after.startsWith("fmt(") ||
          after.startsWith("encodeMsg(") ||
          after.startsWith("encodeFmt(") ||
          after.startsWith("searchMsg(") ||
          after.startsWith("searchFmt(") ||
          after.startsWith("error.message") ||
          after.startsWith("err.message")
        ) {
          continue;
        }
        if (
          after.startsWith("`") ||
          after.startsWith('"') ||
          after.startsWith("'")
        ) {
          const line = text.slice(0, match.index).split("\n").length;
          leftovers.push(`${file}:${line}`);
        }
      }
    }
    expect(leftovers).toEqual([]);
  });
});
