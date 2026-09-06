import { describe, expect, it } from "vitest";
import { createStore } from "./store";
import type { LocalGovIndexFile, Prefecture } from "./types";

const index: LocalGovIndexFile = {
  schemaVersion: 2,
  paths: {
    prefectures: "prefectures.bin",
    municipalitiesByPrefecture: "munis/{code}.bin",
    searchNgrams: {
      twoGram: { regions: [], pattern: "x/{region}" },
      threeGram: { shardCount: 1, pattern: "y/{shard}" },
    },
  },
  prefectureCodes: [],
};

const prefs: Prefecture[] = [
  {
    code: "010006",
    name: "北海道",
    nameKana: "ホッカイドウ",
    municipalityCounts: { both: 1, city: 1, ward: 1 },
  },
];

describe("createStore", () => {
  it("falls back to prefecture org codes when index.prefectureCodes is empty", () => {
    const store = createStore(
      index,
      prefs,
      async () => [],
      async () => ({ twoGram: null, threeGram: null }),
    );
    expect(store.allPrefectureCodes).toEqual(["01"]);
  });

  it("dedupes in-flight municipality loads", async () => {
    let calls = 0;
    let resolveLoad!: () => void;
    const gate = new Promise<void>((r) => {
      resolveLoad = r;
    });
    const store = createStore(
      { ...index, prefectureCodes: ["01"] },
      prefs,
      async () => {
        calls += 1;
        await gate;
        return [
          {
            code: "011002",
            name: "札幌市",
            nameKana: "サッポロシ",
            prefectureCode: "01",
            prefectureName: "北海道",
            prefectureNameKana: "ホッカイドウ",
          },
        ];
      },
      async () => ({ twoGram: null, threeGram: null }),
    );

    const p1 = store.ensureMunicipalities(["01"]);
    const p2 = store.ensureMunicipalities(["01"]);
    resolveLoad();
    await Promise.all([p1, p2]);
    expect(calls).toBe(1);
    expect(store.getMunicipalities("01")).toHaveLength(1);
  });
});
