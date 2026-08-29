import { describe, expect, it } from "vitest";
import { normalizeSearchText } from "./normalize";
import {
  THREE_GRAM_SHARD_COUNT,
  codePointBigrams,
  codePointTrigrams,
  gramShardIndex,
} from "./searchNgrams";

describe("codePointBigrams (TC-N)", () => {
  it("TC-N01/N03: splits by code points into adjacent pairs", () => {
    expect(codePointBigrams("中央区")).toEqual(["中央", "央区"]);
    expect(codePointBigrams("大阪府")).toEqual(["大阪", "阪府"]);
  });

  it("TC-N02: length under 2 yields empty", () => {
    expect(codePointBigrams("")).toEqual([]);
    expect(codePointBigrams("区")).toEqual([]);
  });

  it("TC-N01: halfwidth dakuten stays on code-point boundaries", () => {
    const normalized = normalizeSearchText("ガ");
    const grams = codePointBigrams(normalized + "ﾜ");
    expect(normalized).toBe("ｶﾞ");
    expect(Array.from(normalized)).toEqual(["ｶ", "ﾞ"]);
    expect(grams.length).toBeGreaterThanOrEqual(1);
    expect(grams.every((g) => Array.from(g).length === 2)).toBe(true);
  });

  it("TC-N04: connects with normalizeSearchText", () => {
    const n = normalizeSearchText("ちよだ");
    expect(n).toBe("ﾁﾖﾀﾞ");
    expect(codePointBigrams(n)).toEqual(["ﾁﾖ", "ﾖﾀ", "ﾀﾞ"]);
  });
});

describe("codePointTrigrams (TC-N)", () => {
  it("TC-N02/N03: length under 3 empty; length 3 yields one trigram", () => {
    expect(codePointTrigrams("中央")).toEqual([]);
    expect(codePointTrigrams("中央区")).toEqual(["中央区"]);
  });

  it("TC-N05: shard index is stable in 0..shardCount-1", () => {
    const id = gramShardIndex("那覇市", THREE_GRAM_SHARD_COUNT);
    expect(id).toBeGreaterThanOrEqual(0);
    expect(id).toBeLessThan(THREE_GRAM_SHARD_COUNT);
    expect(gramShardIndex("那覇市", THREE_GRAM_SHARD_COUNT)).toBe(id);
  });
});
