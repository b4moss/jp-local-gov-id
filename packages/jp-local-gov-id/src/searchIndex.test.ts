import { describe, expect, it, vi } from "vitest";
import {
  GRAM_TYPE_KANA,
  GRAM_TYPE_NAME,
  KIND_MUNI,
  KIND_PREF,
  type SearchNgramPostingRecord,
} from "./binary";
import {
  buildSearchIndex,
  querySearchIndex,
  warnSearchIndexAsOfMismatch,
} from "./searchIndex";

const records: SearchNgramPostingRecord[] = [
  {
    gram: "中央",
    gramType: GRAM_TYPE_NAME,
    kind: KIND_MUNI,
    muniCode: 11011,
    prefCode: 1,
    hasWard: 0,
    isWard: 1,
  },
  {
    gram: "中央",
    gramType: GRAM_TYPE_NAME,
    kind: KIND_MUNI,
    muniCode: 131024,
    prefCode: 13,
    hasWard: 0,
    isWard: 0,
  },
  {
    gram: "中央",
    gramType: GRAM_TYPE_KANA,
    kind: KIND_MUNI,
    muniCode: 999999,
    prefCode: 99,
    hasWard: 0,
    isWard: 0,
  },
  {
    gram: "阪府",
    gramType: GRAM_TYPE_NAME,
    kind: KIND_PREF,
    muniCode: 270008,
    prefCode: 27,
    hasWard: 0,
    isWard: 0,
  },
];

describe("querySearchIndex", () => {
  const index = buildSearchIndex({
    version: 1,
    asOf: "R6.1.1",
    records,
  });

  it("intersects and returns municipality hits only", () => {
    const hits = querySearchIndex(index, {
      grams: ["中央"],
      matchField: "name",
      designatedCity: "both",
    });
    expect(hits.map((h) => h.muniCode).sort()).toEqual(["011011", "131024"]);
  });

  it("returns empty when a gram is missing", () => {
    expect(
      querySearchIndex(index, {
        grams: ["中央", "存在"],
        matchField: "both",
        designatedCity: "both",
      }),
    ).toEqual([]);
  });

  it("filters designatedCity city mode (drops wards)", () => {
    const hits = querySearchIndex(index, {
      grams: ["中央"],
      matchField: "name",
      designatedCity: "city",
    });
    expect(hits.map((h) => h.muniCode)).toEqual(["131024"]);
  });

  it("warns on asOf mismatch without throwing", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnSearchIndexAsOfMismatch("R6.1.1", "R5.1.1");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
