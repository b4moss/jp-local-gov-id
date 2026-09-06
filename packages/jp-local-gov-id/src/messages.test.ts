import { describe, expect, it } from "vitest";
import { fmt, msg, MESSAGES, type MessageKey } from "./messages";

describe("messages catalog helpers", () => {
  it("msg returns static catalog strings", () => {
    expect(msg("binary.asOfExceedsU1")).toBe("asOf exceeds u1 length");
    expect(msg("schema.indexPathsObject")).toBe(
      MESSAGES["schema.indexPathsObject"],
    );
  });

  it("fmt substitutes placeholders", () => {
    expect(fmt("binary.unsupportedVersion", { version: 9 })).toBe(
      "Unsupported version: 9",
    );
    expect(fmt("schema.searchNgramShardsEntry", { key: "a" })).toBe(
      MESSAGES["schema.searchNgramShardsEntry"].replace("{key}", "a"),
    );
  });

  it("msg throws on unknown keys", () => {
    expect(() => msg("no.such.key" as MessageKey)).toThrow(/Unknown message key/);
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

  it("catalog covers expected namespaces", () => {
    const keys = Object.keys(MESSAGES) as MessageKey[];
    expect(keys.some((k) => k.startsWith("schema."))).toBe(true);
    expect(keys.some((k) => k.startsWith("create."))).toBe(true);
    expect(keys.some((k) => k.startsWith("binary."))).toBe(true);
    expect(keys.some((k) => k.startsWith("data."))).toBe(true);
    expect(keys).toContain("data.unknownPrefectureCode");
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
