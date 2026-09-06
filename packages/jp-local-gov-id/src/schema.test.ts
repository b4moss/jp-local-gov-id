import { describe, expect, it } from "vitest";
import {
  isLocalGov,
  LOCAL_GOV_SCHEMA_VERSION,
  LocalGovSchemaError,
  normalizeDatasetInput,
  validateIndexFile,
  validateMunicipalitiesFile,
  validatePrefecturesFile,
} from "./schema";

const validPrefecture = {
  code: "010006",
  name: "北海道",
  nameKana: "ホッカイドウ",
};

const validMunicipality = {
  code: "011002",
  name: "札幌市",
  nameKana: "サッポロシ",
  prefectureCode: "01",
  prefectureName: "北海道",
  prefectureNameKana: "ホッカイドウ",
};

const validSearchNgrams = {
  twoGram: {
    pattern: "search-ngrams/2gram/{region}.bin.br",
    regions: ["tokyo", "osaka"],
  },
  threeGram: {
    pattern: "search-ngrams/3gram/{shard}.bin.br",
    shardCount: 3,
  },
};

const validIndex = {
  schemaVersion: LOCAL_GOV_SCHEMA_VERSION,
  paths: {
    prefectures: "prefectures.bin.br",
    municipalitiesByPrefecture: "prefectures/{code}.bin.br",
    searchNgrams: validSearchNgrams,
  },
  prefectureCodes: ["01", "13"],
};

describe("isLocalGov", () => {
  it("accepts prefecture and municipality shapes", () => {
    expect(isLocalGov(validPrefecture)).toBe(true);
    expect(isLocalGov(validMunicipality)).toBe(true);
  });

  it("rejects null, arrays, and legacy prefecture* fields on prefectures", () => {
    expect(isLocalGov(null)).toBe(false);
    expect(isLocalGov([])).toBe(false);
    expect(
      isLocalGov({
        ...validPrefecture,
        prefectureCode: "01",
      }),
    ).toBe(false);
    expect(isLocalGov({ code: "01", name: "北海道" })).toBe(false);
  });
});

describe("validateIndexFile", () => {
  it("accepts a valid index", () => {
    expect(validateIndexFile(validIndex).prefectureCodes).toEqual(["01", "13"]);
  });

  it("rejects non-objects and bad schemaVersion", () => {
    expect(() => validateIndexFile(null)).toThrow(LocalGovSchemaError);
    expect(() => validateIndexFile([])).toThrow(/must be a non-null object/);
    expect(() =>
      validateIndexFile({ ...validIndex, schemaVersion: "2" }),
    ).toThrow(/schemaVersion must be a number/);
    expect(() =>
      validateIndexFile({ ...validIndex, schemaVersion: 1 }),
    ).toThrow(/Unsupported schemaVersion|expected/);
  });

  it("rejects missing paths / path strings / prefectureCodes", () => {
    expect(() => validateIndexFile({ ...validIndex, paths: null })).toThrow(
      /paths object/,
    );
    expect(() =>
      validateIndexFile({
        ...validIndex,
        paths: { ...validIndex.paths, prefectures: 1 },
      }),
    ).toThrow(/prefectures and municipalitiesByPrefecture/);
    expect(() =>
      validateIndexFile({ ...validIndex, prefectureCodes: "01" }),
    ).toThrow(/prefectureCodes as a string array/);
  });

  it("rejects invalid searchNgrams specs", () => {
    expect(() =>
      validateIndexFile({
        ...validIndex,
        paths: { ...validIndex.paths, searchNgrams: null },
      }),
    ).toThrow(/searchNgrams must be an object/);

    expect(() =>
      validateIndexFile({
        ...validIndex,
        paths: {
          ...validIndex.paths,
          searchNgrams: { ...validSearchNgrams, twoGram: null },
        },
      }),
    ).toThrow(/twoGram must be an object/);

    expect(() =>
      validateIndexFile({
        ...validIndex,
        paths: {
          ...validIndex.paths,
          searchNgrams: {
            ...validSearchNgrams,
            twoGram: { pattern: "no-placeholder", regions: ["tokyo"] },
          },
        },
      }),
    ).toThrow(/\{region\}/);

    expect(() =>
      validateIndexFile({
        ...validIndex,
        paths: {
          ...validIndex.paths,
          searchNgrams: {
            ...validSearchNgrams,
            twoGram: { pattern: "x/{region}.bin", regions: [] },
          },
        },
      }),
    ).toThrow(/regions must be a non-empty string array/);

    expect(() =>
      validateIndexFile({
        ...validIndex,
        paths: {
          ...validIndex.paths,
          searchNgrams: { ...validSearchNgrams, threeGram: null },
        },
      }),
    ).toThrow(/threeGram must be an object/);

    expect(() =>
      validateIndexFile({
        ...validIndex,
        paths: {
          ...validIndex.paths,
          searchNgrams: {
            ...validSearchNgrams,
            threeGram: { pattern: "x.bin", shardCount: 3 },
          },
        },
      }),
    ).toThrow(/\{shard\}/);

    expect(() =>
      validateIndexFile({
        ...validIndex,
        paths: {
          ...validIndex.paths,
          searchNgrams: {
            ...validSearchNgrams,
            threeGram: { pattern: "x/{shard}.bin", shardCount: 0 },
          },
        },
      }),
    ).toThrow(/shardCount must be a positive integer/);
  });
});

describe("validatePrefecturesFile / validateMunicipalitiesFile", () => {
  it("accepts valid envelopes", () => {
    expect(
      validatePrefecturesFile({
        schemaVersion: LOCAL_GOV_SCHEMA_VERSION,
        prefectures: [validPrefecture],
      }).prefectures,
    ).toHaveLength(1);
    expect(
      validateMunicipalitiesFile({
        schemaVersion: LOCAL_GOV_SCHEMA_VERSION,
        prefectureCode: "01",
        municipalities: [validMunicipality],
      }).municipalities,
    ).toHaveLength(1);
  });

  it("rejects invalid prefectures / municipalities envelopes", () => {
    expect(() =>
      validatePrefecturesFile({
        schemaVersion: LOCAL_GOV_SCHEMA_VERSION,
        prefectures: [{ code: "01" }],
      }),
    ).toThrow(/prefectures array of Prefecture objects/);

    expect(() =>
      validateMunicipalitiesFile({
        schemaVersion: LOCAL_GOV_SCHEMA_VERSION,
        municipalities: [validMunicipality],
      }),
    ).toThrow(/string prefectureCode/);

    expect(() =>
      validateMunicipalitiesFile({
        schemaVersion: LOCAL_GOV_SCHEMA_VERSION,
        prefectureCode: "01",
        municipalities: [{ code: "011002" }],
      }),
    ).toThrow(/municipalities array of Municipality objects/);
  });
});

describe("normalizeDatasetInput", () => {
  it("normalizes index + prefectures dataset", () => {
    const normalized = normalizeDatasetInput({
      index: validIndex,
      prefectures: {
        schemaVersion: LOCAL_GOV_SCHEMA_VERSION,
        prefectures: [validPrefecture],
      },
      municipalitiesByCode: { "01": { ok: true } },
      loadMunicipalities: async () => null,
      searchNgramShards: { a: new Uint8Array([1]) },
    });
    expect(normalized.index).toEqual(validIndex);
    expect(normalized.municipalitiesByCode).toEqual({ "01": { ok: true } });
    expect(typeof normalized.loadMunicipalities).toBe("function");
    expect(normalized.searchNgramShards?.a).toBeInstanceOf(Uint8Array);
  });

  it("rejects invalid dataset shapes and shard values", () => {
    expect(() => normalizeDatasetInput(null)).toThrow(
      /non-null object with index and prefectures/,
    );
    expect(() => normalizeDatasetInput({ index: validIndex })).toThrow(
      /must include index and prefectures/,
    );
    expect(() =>
      normalizeDatasetInput({
        index: validIndex,
        prefectures: {},
        searchNgramShards: [],
      }),
    ).toThrow(/searchNgramShards must be a Record/);
    expect(() =>
      normalizeDatasetInput({
        index: validIndex,
        prefectures: {},
        searchNgramShards: { a: "nope" },
      }),
    ).toThrow(/searchNgramShards\[a\] must be ArrayBuffer or Uint8Array/);
  });
});
