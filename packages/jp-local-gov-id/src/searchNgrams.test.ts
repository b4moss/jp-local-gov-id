import { describe, expect, it } from "vitest";
import { normalizeSearchText } from "./normalize";
import { codePointBigrams } from "./searchNgrams";

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
    // ｶ + ﾞ are separate code points after normalization of ガ
    const normalized = normalizeSearchText("ガ");
    const grams = codePointBigrams(normalized + "ﾜ");
    expect(normalized).toBe("ｶﾞ");
    expect(Array.from(normalized)).toEqual(["ｶ", "ﾞ"]);
    expect(grams.length).toBeGreaterThanOrEqual(1);
    expect(grams.every((g) => Array.from(g).length === 2)).toBe(true);
  });

  it("TC-N04: connects with normalizeSearchText", () => {
    // ちよだ → チヨダ → ﾁﾖﾀﾞ (ﾞ is its own code point after ﾀ)
    const n = normalizeSearchText("ちよだ");
    expect(n).toBe("ﾁﾖﾀﾞ");
    expect(codePointBigrams(n)).toEqual(["ﾁﾖ", "ﾖﾀ", "ﾀﾞ"]);
  });
});
