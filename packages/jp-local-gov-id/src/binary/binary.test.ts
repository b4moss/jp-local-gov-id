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
  prefectureCodeFromMunicipalityCode,
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
    expect(file.schemaVersion).toBe(2);
    expect(file.prefectures[0]).toMatchObject({
      code: "010006",
      name: "北海道",
      municipalityCounts: { both: 195, city: 185, ward: 194 },
    });
    expect(file.prefectures[0]).not.toHaveProperty("prefectureCode");
    expect(file.prefectures[1].code).toBe("270008");
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


describe("JLDT encode/decode error paths", () => {
  it("rejects invalid hasWard / isWard / code on encode", () => {
    expect(() =>
      encodeMunicipalities(
        [{ code: 11002, name: "x", nameKana: "y", hasWard: 2 as 0 | 1, isWard: 0 }],
        { asOf: "R6.1.1" },
      ),
    ).toThrow(/hasWard must be 0 or 1/);
    expect(() =>
      encodeMunicipalities(
        [{ code: 11002, name: "x", nameKana: "y", hasWard: 0, isWard: 2 as 0 | 1 }],
        { asOf: "R6.1.1" },
      ),
    ).toThrow(/isWard must be 0 or 1/);
    expect(() =>
      encodeMunicipalities(
        [{ code: -1, name: "x", nameKana: "y", hasWard: 0, isWard: 0 }],
        { asOf: "R6.1.1" },
      ),
    ).toThrow(/code out of u4 range/);
  });

  it("rejects invalid version / asOf / record_count on encode", () => {
    expect(() =>
      encodeMunicipalities(sampleMunis, { asOf: "R6.1.1", version: 256 }),
    ).toThrow(/version out of u1 range/);
    expect(() =>
      encodeMunicipalities(sampleMunis, { asOf: "a".repeat(256) }),
    ).toThrow(/asOf exceeds u1 length/);
    const tooMany: MunicipalityBinRecord[] = Array.from({ length: 0x10000 }, (_, i) => ({
      code: i,
      name: "n",
      nameKana: "k",
      hasWard: 0 as const,
      isWard: 0 as const,
    }));
    expect(() => encodeMunicipalities(tooMany, { asOf: "R6.1.1" })).toThrow(
      /record_count exceeds u2/,
    );
  });

  it("round-trips empty municipality records", () => {
    const buf = encodeMunicipalities([], { asOf: "R6.1.1" });
    const decoded = decodeMunicipalities(buf);
    expect(decoded.records).toEqual([]);
    expect(decoded.asOf).toBe("R6.1.1");
  });

  it("rejects truncated JLDT buffers at each stage", () => {
    const buf = encodeMunicipalities(sampleMunis, { asOf: "R6.1.1" });
    expect(() => decodeMunicipalities(buf.slice(0, 4))).toThrow(LocalGovBinaryError);
    expect(() => decodeMunicipalities(buf.slice(0, 5))).toThrow(
      /buffer too short for version\/asOfLen/,
    );
    // version + asOfLen present but asOf/record_count truncated
    const view = new DataView(buf);
    const asOfLen = view.getUint8(5);
    const cut = 4 + 1 + 1 + asOfLen; // before record_count
    expect(() => decodeMunicipalities(buf.slice(0, cut))).toThrow(
      /buffer too short for asOf\/record_count/,
    );
    // header ok but records truncated
    const headerEnd = 4 + 1 + 1 + asOfLen + 2;
    expect(() => decodeMunicipalities(buf.slice(0, headerEnd + 4))).toThrow(
      /buffer too short for records/,
    );
  });

  it("rejects unsupported JLDT version", () => {
    const buf = encodeMunicipalities(sampleMunis, { asOf: "R6.1.1" });
    const bytes = new Uint8Array(buf.slice(0));
    bytes[4] = 9;
    expect(() => decodeMunicipalities(bytes.buffer)).toThrow(/Unsupported version/);
  });

  it("rejects invalid magic for JLDT", () => {
    const buf = encodeMunicipalities(sampleMunis, { asOf: "R6.1.1" });
    const bytes = new Uint8Array(buf.slice(0));
    bytes[0] = 0;
    expect(() => decodeMunicipalities(bytes.buffer)).toThrow(LocalGovBinaryError);
  });

  it("rejects trailing bytes for JLDT", () => {
    const buf = encodeMunicipalities(sampleMunis, { asOf: "R6.1.1" });
    const withTrailing = new Uint8Array(buf.byteLength + 1);
    withTrailing.set(new Uint8Array(buf));
    expect(() => decodeMunicipalities(withTrailing.buffer)).toThrow(
      /trailing or unused bytes/,
    );
  });

  it("rejects bad hasWard flag in decoded payload", () => {
    const buf = encodeMunicipalities(sampleMunis, { asOf: "R6.1.1" });
    const copy = buf.slice(0);
    const view = new DataView(copy);
    const asOfLen = view.getUint8(5);
    const recordStart = 4 + 1 + 1 + asOfLen + 2;
    // hasWard is at offset +12 within record (code4 + name4 + kana4)
    view.setUint8(recordStart + 12, 3);
    expect(() => decodeMunicipalities(copy)).toThrow(/hasWard must be 0 or 1/);
  });

  it("derives prefecture code from municipality code", () => {
    expect(prefectureCodeFromMunicipalityCode(11002)).toBe("01");
    expect(prefectureCodeFromMunicipalityCode("131016")).toBe("13");
  });
});

describe("JLPR encode/decode extra error paths", () => {
  it("rejects invalid field ranges on encode", () => {
    expect(() =>
      encodePrefectures(
        [{ ...samplePrefs[0]!, prefCode: 256 }],
        { asOf: "R6.1.1" },
      ),
    ).toThrow(/prefCode out of u1 range/);
    expect(() =>
      encodePrefectures(
        [{ ...samplePrefs[0]!, muniCode: -1 }],
        { asOf: "R6.1.1" },
      ),
    ).toThrow(/muniCode out of u4 range/);
    expect(() =>
      encodePrefectures(samplePrefs, { asOf: "R6.1.1", version: 300 }),
    ).toThrow(/version out of u1 range/);
    expect(() =>
      encodePrefectures(samplePrefs, { asOf: "b".repeat(256) }),
    ).toThrow(/asOf exceeds u1 length/);
    const tooMany: PrefectureBinRecord[] = Array.from({ length: 0x10000 }, (_, i) => ({
      prefCode: i % 200,
      name: "n",
      nameKana: "k",
      muniCode: i,
      muniCountBoth: 1,
      muniCountCity: 1,
      muniCountWard: 1,
    }));
    expect(() => encodePrefectures(tooMany, { asOf: "R6.1.1" })).toThrow(
      /record_count exceeds u2/,
    );
  });

  it("round-trips empty prefecture records", () => {
    const buf = encodePrefectures([], { asOf: "R6.1.1" });
    expect(decodePrefectures(buf).records).toEqual([]);
  });

  it("rejects truncated JLPR buffers", () => {
    const buf = encodePrefectures(samplePrefs, { asOf: "R6.1.1" });
    expect(() => decodePrefectures(buf.slice(0, 5))).toThrow(
      /buffer too short for version\/asOfLen/,
    );
    const view = new DataView(buf);
    const asOfLen = view.getUint8(5);
    expect(() => decodePrefectures(buf.slice(0, 4 + 1 + 1 + asOfLen))).toThrow(
      /buffer too short for asOf\/record_count/,
    );
    const headerEnd = 4 + 1 + 1 + asOfLen + 2;
    expect(() => decodePrefectures(buf.slice(0, headerEnd + 2))).toThrow(
      /buffer too short for records/,
    );
  });
});

describe("JLIX encode/decode extra error paths", () => {
  it("rejects invalid posting fields on encode", () => {
    expect(() =>
      encodeSearchNgrams(
        [{ ...sampleNgrams[0]!, gramType: 3 as 0 | 1 }],
        { asOf: "R6.1.1" },
      ),
    ).toThrow(/gramType must be 0\|1/);
    expect(() =>
      encodeSearchNgrams(
        [{ ...sampleNgrams[0]!, kind: 3 as 0 | 1 }],
        { asOf: "R6.1.1" },
      ),
    ).toThrow(/kind must be 0\|1/);
    expect(() =>
      encodeSearchNgrams(
        [{ ...sampleNgrams[0]!, hasWard: 2 as 0 | 1 }],
        { asOf: "R6.1.1" },
      ),
    ).toThrow(/hasWard must be 0 or 1/);
    expect(() =>
      encodeSearchNgrams(
        [{ ...sampleNgrams[0]!, muniCode: -1 }],
        { asOf: "R6.1.1" },
      ),
    ).toThrow(/muniCode out of u4 range/);
    expect(() =>
      encodeSearchNgrams(
        [{ ...sampleNgrams[0]!, prefCode: 300 }],
        { asOf: "R6.1.1" },
      ),
    ).toThrow(/prefCode out of u1 range/);
    expect(() =>
      encodeSearchNgrams(sampleNgrams, { asOf: "R6.1.1", version: 999 }),
    ).toThrow(/version out of u1 range/);
    expect(() =>
      encodeSearchNgrams(sampleNgrams, { asOf: "c".repeat(256) }),
    ).toThrow(/asOf exceeds u1 length/);
  });

  it("round-trips empty ngram postings", () => {
    const buf = encodeSearchNgrams([], { asOf: "R6.1.1" });
    expect(decodeSearchNgrams(buf).records).toEqual([]);
  });

  it("rejects truncated JLIX buffers", () => {
    const buf = encodeSearchNgrams(sampleNgrams, { asOf: "R6.1.1" });
    expect(() => decodeSearchNgrams(buf.slice(0, 5))).toThrow(
      /buffer too short for version\/asOfLen/,
    );
    const view = new DataView(buf);
    const asOfLen = view.getUint8(5);
    expect(() => decodeSearchNgrams(buf.slice(0, 4 + 1 + 1 + asOfLen))).toThrow(
      /buffer too short for asOf\/record_count/,
    );
    const headerEnd = 4 + 1 + 1 + asOfLen + 2;
    expect(() => decodeSearchNgrams(buf.slice(0, headerEnd + 2))).toThrow(
      /buffer too short for records/,
    );
  });

  it("rejects bad flag bytes on decode", () => {
    const buf = encodeSearchNgrams(sampleNgrams, { asOf: "R6.1.1" });
    const copy = buf.slice(0);
    const view = new DataView(copy);
    const asOfLen = view.getUint8(5);
    const recordStart = 4 + 1 + 1 + asOfLen + 2;
    // hasWard at +11 within posting (gramOff4 + type1 + kind1 + muni4 + pref1 = 11)
    view.setUint8(recordStart + 11, 5);
    expect(() => decodeSearchNgrams(copy)).toThrow(/hasWard must be 0 or 1/);
  });
});
