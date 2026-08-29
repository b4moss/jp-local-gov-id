import { describe, expect, it } from "vitest";
import {
  BINARY_FORMAT_VERSION,
  decodeMunicipalities,
  decodeMunicipalitiesFile,
  decodePrefectures,
  decodePrefecturesFile,
  decodeSearchNgrams,
  encodeMunicipalities,
  encodePrefectures,
  encodeSearchNgrams,
  GRAM_TYPE_KANA,
  GRAM_TYPE_NAME,
  KIND_MUNI,
  KIND_PREF,
  LocalGovBinaryError,
  MAGIC_JLDT,
  MAGIC_JLIX,
  MAGIC_JLPR,
  MUNICIPALITY_RECORD_SIZE,
  NGRAM_POSTING_RECORD_SIZE,
  PREFECTURE_RECORD_SIZE,
  type MunicipalityBinRecord,
  type PrefectureBinRecord,
  type SearchNgramPostingRecord,
} from "./index";

const samplePrefs: PrefectureBinRecord[] = [
  {
    prefCode: 1,
    name: "北海道",
    nameKana: "ﾎｯｶｲﾄﾞｳ",
    muniCode: 10006,
    muniCountBoth: 195,
    muniCountCity: 185,
    muniCountWard: 194,
  },
  {
    prefCode: 27,
    name: "大阪府",
    nameKana: "ｵｵｻｶﾌ",
    muniCode: 270008,
    muniCountBoth: 74,
    muniCountCity: 43,
    muniCountWard: 72,
  },
];

const sampleMunis: MunicipalityBinRecord[] = [
  {
    code: 11002,
    name: "札幌市",
    nameKana: "ｻｯﾎﾟﾛｼ",
    hasWard: 1,
    isWard: 0,
  },
  {
    code: 11011,
    name: "札幌市中央区",
    nameKana: "ｻｯﾎﾟﾛｼﾁｭｳｵｳｸ",
    hasWard: 0,
    isWard: 1,
  },
];

const sampleNgrams: SearchNgramPostingRecord[] = [
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
    gram: "ｵｵｻ",
    gramType: GRAM_TYPE_KANA,
    kind: KIND_PREF,
    muniCode: 270008,
    prefCode: 27,
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

describe("binary constants (TC-B03)", () => {
  it("record sizes match ksy / issue #73 / #63", () => {
    expect(PREFECTURE_RECORD_SIZE).toBe(16);
    expect(1 + 4 + 4 + 4 + 1 + 1 + 1).toBe(PREFECTURE_RECORD_SIZE);
    expect(MUNICIPALITY_RECORD_SIZE).toBe(14);
    expect(4 + 4 + 4 + 1 + 1).toBe(MUNICIPALITY_RECORD_SIZE);
    expect(NGRAM_POSTING_RECORD_SIZE).toBe(13);
    expect(4 + 1 + 1 + 4 + 1 + 1 + 1).toBe(NGRAM_POSTING_RECORD_SIZE);
  });
});

describe("JLPR (TC-B01)", () => {
  it("round-trips prefecture records", () => {
    const buf = encodePrefectures(samplePrefs, { asOf: "R6.1.1" });
    const decoded = decodePrefectures(buf);
    expect(decoded.version).toBe(BINARY_FORMAT_VERSION);
    expect(decoded.asOf).toBe("R6.1.1");
    expect(decoded.records).toEqual(samplePrefs);

    const file = decodePrefecturesFile(buf);
    expect(file.schemaVersion).toBe(1);
    expect(file.prefectures[0]).toMatchObject({
      code: "01",
      prefectureCode: "01",
      name: "北海道",
      municipalityCounts: { both: 195, city: 185, ward: 194 },
    });
    expect(file.prefectures[1].code).toBe("27");
    expect(file.prefectures[0]).not.toHaveProperty("hasWard");
    expect(file.prefectures[0]).not.toHaveProperty("muniCode");
  });
});

describe("JLDT (TC-B02)", () => {
  it("round-trips municipality records without exposing flags publicly", () => {
    const buf = encodeMunicipalities(sampleMunis, { asOf: "R6.1.1" });
    const decoded = decodeMunicipalities(buf);
    expect(decoded.records).toEqual(sampleMunis);

    const file = decodeMunicipalitiesFile(buf, {
      prefectureCode: "01",
      prefectureName: "北海道",
      prefectureNameKana: "ﾎｯｶｲﾄﾞｳ",
    });
    expect(file.municipalities[0]).toEqual({
      code: "011002",
      name: "札幌市",
      nameKana: "ｻｯﾎﾟﾛｼ",
      prefectureCode: "01",
      prefectureName: "北海道",
      prefectureNameKana: "ﾎｯｶｲﾄﾞｳ",
    });
    expect(file.municipalities[0]).not.toHaveProperty("hasWard");
    expect(file.municipalities[0]).not.toHaveProperty("isWard");
  });
});

describe("JLIX (TC-B #63)", () => {
  it("TC-B01: round-trips ngram postings", () => {
    const buf = encodeSearchNgrams(sampleNgrams, { asOf: "R6.1.1" });
    const decoded = decodeSearchNgrams(buf);
    expect(decoded.version).toBe(BINARY_FORMAT_VERSION);
    expect(decoded.asOf).toBe("R6.1.1");
    expect(decoded.records).toHaveLength(sampleNgrams.length);
    expect(decoded.records.map((r) => r.gram)).toEqual(
      [...sampleNgrams]
        .sort((a, b) =>
          a.gram !== b.gram
            ? a.gram < b.gram
              ? -1
              : 1
            : a.gramType !== b.gramType
              ? a.gramType - b.gramType
              : a.muniCode - b.muniCode,
        )
        .map((r) => r.gram),
    );
  });

  it("TC-B03: keeps pref_code and muni_code distinct for Osaka", () => {
    const buf = encodeSearchNgrams(
      [
        {
          gram: "阪府",
          gramType: GRAM_TYPE_NAME,
          kind: KIND_PREF,
          muniCode: 270008,
          prefCode: 27,
          hasWard: 0,
          isWard: 0,
        },
      ],
      { asOf: "R6.1.1" },
    );
    const [row] = decodeSearchNgrams(buf).records;
    expect(row?.prefCode).toBe(27);
    expect(row?.muniCode).toBe(270008);
    expect(row?.kind).toBe(KIND_PREF);
  });

  it("TC-B04: reuses gram string-table offsets", () => {
    const buf = encodeSearchNgrams(
      [
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
      ],
      { asOf: "R6.1.1" },
    );
    const view = new DataView(buf);
    const asOfLen = view.getUint8(5);
    const recordStart = 4 + 1 + 1 + asOfLen + 2;
    const gramOff0 = view.getUint32(recordStart, true);
    const gramOff1 = view.getUint32(recordStart + NGRAM_POSTING_RECORD_SIZE, true);
    expect(gramOff0).toBe(gramOff1);
  });

  it("TC-B05: deterministic encode regardless of input order", () => {
    const reversed = [...sampleNgrams].reverse();
    const a = new Uint8Array(encodeSearchNgrams(sampleNgrams, { asOf: "R6.1.1" }));
    const b = new Uint8Array(encodeSearchNgrams(reversed, { asOf: "R6.1.1" }));
    expect(a).toEqual(b);
  });

  it("TC-B06: rejects record_count above u2", () => {
    const tooMany: SearchNgramPostingRecord[] = Array.from(
      { length: 0x10000 },
      (_, i) => ({
        gram: "ab",
        gramType: GRAM_TYPE_NAME as const,
        kind: KIND_MUNI as const,
        muniCode: i,
        prefCode: 1,
        hasWard: 0 as const,
        isWard: 0 as const,
      }),
    );
    expect(() => encodeSearchNgrams(tooMany, { asOf: "R6.1.1" })).toThrow(
      /record_count exceeds u2/,
    );
  });

  it("TC-B07: invalid magic", () => {
    const buf = encodeSearchNgrams(sampleNgrams, { asOf: "R6.1.1" });
    const bytes = new Uint8Array(buf.slice(0));
    bytes[0] = 0x00;
    expect(() => decodeSearchNgrams(bytes.buffer)).toThrow(LocalGovBinaryError);
  });

  it("TC-B08: unsupported version", () => {
    const buf = encodeSearchNgrams(sampleNgrams, { asOf: "R6.1.1" });
    const bytes = new Uint8Array(buf.slice(0));
    bytes[4] = 2;
    expect(() => decodeSearchNgrams(bytes.buffer)).toThrow(/Unsupported version/);
  });

  it("TC-B09: truncated buffer", () => {
    const buf = encodeSearchNgrams(sampleNgrams, { asOf: "R6.1.1" });
    expect(() => decodeSearchNgrams(buf.slice(0, 8))).toThrow(LocalGovBinaryError);
  });

  it("TC-B10: bad string offset", () => {
    const buf = encodeSearchNgrams(sampleNgrams, { asOf: "R6.1.1" });
    const copy = buf.slice(0);
    const view = new DataView(copy);
    const asOfLen = view.getUint8(5);
    const recordStart = 4 + 1 + 1 + asOfLen + 2;
    view.setUint32(recordStart, 0xffffff, true);
    expect(() => decodeSearchNgrams(copy)).toThrow(LocalGovBinaryError);
  });

  it("TC-B11: trailing bytes", () => {
    const buf = encodeSearchNgrams(sampleNgrams, { asOf: "R6.1.1" });
    const withTrailing = new Uint8Array(buf.byteLength + 1);
    withTrailing.set(new Uint8Array(buf));
    withTrailing[withTrailing.length - 1] = 0xff;
    expect(() => decodeSearchNgrams(withTrailing.buffer)).toThrow(
      /trailing or unused bytes/,
    );
  });

  it("TC-B12: magic string", () => {
    expect(MAGIC_JLIX).toBe("JLIX");
  });
});

describe("string table sharing (TC-B04)", () => {
  it("reuses offsets for identical strings", () => {
    const records: PrefectureBinRecord[] = [
      {
        prefCode: 1,
        name: "同名",
        nameKana: "ﾄﾞｳﾒｲ",
        muniCode: 1,
        muniCountBoth: 1,
        muniCountCity: 1,
        muniCountWard: 1,
      },
      {
        prefCode: 2,
        name: "同名",
        nameKana: "ﾄﾞｳﾒｲ",
        muniCode: 2,
        muniCountBoth: 1,
        muniCountCity: 1,
        muniCountWard: 1,
      },
    ];
    const buf = encodePrefectures(records, { asOf: "R6.1.1" });
    const view = new DataView(buf);
    const asOfLen = view.getUint8(5);
    const recordStart = 4 + 1 + 1 + asOfLen + 2;
    const nameOff0 = view.getUint32(recordStart + 1, true);
    const kanaOff0 = view.getUint32(recordStart + 5, true);
    const nameOff1 = view.getUint32(recordStart + PREFECTURE_RECORD_SIZE + 1, true);
    const kanaOff1 = view.getUint32(recordStart + PREFECTURE_RECORD_SIZE + 5, true);
    expect(nameOff0).toBe(nameOff1);
    expect(kanaOff0).toBe(kanaOff1);
    expect(nameOff0).not.toBe(kanaOff0);
  });
});

describe("strict decode errors", () => {
  it("TC-B05: invalid magic", () => {
    const buf = encodePrefectures(samplePrefs, { asOf: "R6.1.1" });
    const bytes = new Uint8Array(buf.slice(0));
    bytes[0] = 0x00;
    expect(() => decodePrefectures(bytes.buffer)).toThrow(LocalGovBinaryError);
  });

  it("TC-B06: unsupported version", () => {
    const buf = encodePrefectures(samplePrefs, { asOf: "R6.1.1" });
    const bytes = new Uint8Array(buf.slice(0));
    bytes[4] = 2;
    expect(() => decodePrefectures(bytes.buffer)).toThrow(/Unsupported version/);
  });

  it("TC-B07: truncated buffer", () => {
    const buf = encodePrefectures(samplePrefs, { asOf: "R6.1.1" });
    const truncated = buf.slice(0, 8);
    expect(() => decodePrefectures(truncated)).toThrow(LocalGovBinaryError);
  });

  it("TC-B08: bad string offset", () => {
    const buf = encodePrefectures(samplePrefs, { asOf: "R6.1.1" });
    const copy = buf.slice(0);
    const view = new DataView(copy);
    const asOfLen = view.getUint8(5);
    const recordStart = 4 + 1 + 1 + asOfLen + 2;
    view.setUint32(recordStart + 1, 0xffffff, true);
    expect(() => decodePrefectures(copy)).toThrow(LocalGovBinaryError);
  });

  it("TC-B09: trailing bytes", () => {
    const buf = encodePrefectures(samplePrefs, { asOf: "R6.1.1" });
    const withTrailing = new Uint8Array(buf.byteLength + 1);
    withTrailing.set(new Uint8Array(buf));
    withTrailing[withTrailing.length - 1] = 0xff;
    expect(() => decodePrefectures(withTrailing.buffer)).toThrow(
      /trailing or unused bytes/,
    );
  });

  it("TC-B10: magic strings", () => {
    expect(MAGIC_JLPR).toBe("JLPR");
    expect(MAGIC_JLDT).toBe("JLDT");
    expect(MAGIC_JLIX).toBe("JLIX");
  });
});
