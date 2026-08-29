import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliDecompressSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import dataset from "@b4moss/jp-local-gov-id-data";
import {
  decodeSearchNgrams,
  KIND_MUNI,
} from "./binary";
import { createLocalGovClient } from "./create";
import { LocalGovSchemaError, validateIndexFile } from "./schema";
import {
  THREE_GRAM_SHARD_COUNT,
  gramShardId,
} from "./searchNgrams";
import {
  TWO_GRAM_REGIONS,
  assignTwoGramRegion,
  isHotMunicipality,
} from "./searchHotSet";
import type { LocalGovIndexFile } from "./types";

const dataDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../jp-local-gov-id-data",
);

function decodeBin(relativePath: string) {
  const bin = readFileSync(join(dataDir, relativePath));
  return decodeSearchNgrams(
    bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength),
  );
}

describe("search-ngrams generate contract (TC-G #63 hybrid)", () => {
  it("TC-G02: index paths describe hybrid twoGram / threeGram", () => {
    const index = dataset.index as LocalGovIndexFile;
    expect(index.paths.searchNgrams.twoGram.pattern).toBe(
      "search-ngrams/2gram/{region}.bin.br",
    );
    expect(index.paths.searchNgrams.twoGram.regions).toEqual([
      ...TWO_GRAM_REGIONS,
    ]);
    expect(index.paths.searchNgrams.threeGram).toEqual({
      shardCount: THREE_GRAM_SHARD_COUNT,
      pattern: "search-ngrams/3gram/{shard}.bin.br",
    });
    expect(index.paths.prefectures).toBe("prefectures.bin.br");
  });

  it("TC-G01/G05/G06/G07: partitions decode and sum to CSV rows", () => {
    const csvLines = readFileSync(join(dataDir, "search-ngrams.csv"), "utf8")
      .trim()
      .split("\n");
    const dataRows = csvLines.length - 1;
    expect(dataRows).toBeGreaterThan(10_000);

    let total = 0;
    for (const region of TWO_GRAM_REGIONS) {
      const decoded = decodeBin(`search-ngrams/2gram/${region}.bin`);
      expect(decoded.records.every((r) => r.kind === KIND_MUNI)).toBe(true);
      total += decoded.records.length;
    }
    for (let i = 0; i < THREE_GRAM_SHARD_COUNT; i++) {
      const decoded = decodeBin(`search-ngrams/3gram/${i}.bin`);
      for (const r of decoded.records) {
        expect(gramShardId(r.gram, THREE_GRAM_SHARD_COUNT)).toBe(String(i));
        expect(r.kind).toBe(KIND_MUNI);
      }
      total += decoded.records.length;
    }
    expect(total).toBe(dataRows);

    expect(dataset.searchNgramShards).toBeTypeOf("object");
    for (const region of TWO_GRAM_REGIONS) {
      expect(dataset.searchNgramShards[region]).toBeInstanceOf(Uint8Array);
    }
    for (let i = 0; i < THREE_GRAM_SHARD_COUNT; i++) {
      expect(dataset.searchNgramShards[String(i)]).toBeInstanceOf(Uint8Array);
    }
  });

  it("npm ships Brotli payloads that round-trip to JLIX", () => {
    for (const region of TWO_GRAM_REGIONS) {
      const br = readFileSync(
        join(dataDir, `search-ngrams/2gram/${region}.bin.br`),
      );
      const raw = brotliDecompressSync(br);
      decodeSearchNgrams(
        raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
      );
    }
    for (let i = 0; i < THREE_GRAM_SHARD_COUNT; i++) {
      const br = readFileSync(join(dataDir, `search-ngrams/3gram/${i}.bin.br`));
      const raw = brotliDecompressSync(br);
      decodeSearchNgrams(
        raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
      );
    }
    expect(readdirSync(join(dataDir, "search-ngrams/2gram")).length).toBeGreaterThan(0);
  });

  it("TC-G04/G05: hot/cold partition samples and no overlap", () => {
    const csv = readFileSync(join(dataDir, "search-ngrams.csv"), "utf8")
      .trim()
      .split("\n")
      .slice(1)
      .map((line) => {
        const [
          ,
          ,
          ,
          muniCode,
          ,
          ,
          ,
          indexKind,
          partition,
        ] = line.split(",");
        return {
          muniCode: muniCode!,
          indexKind: indexKind!,
          partition: partition!,
        };
      });

    const byMuni = new Map<string, Set<string>>();
    for (const row of csv) {
      const set = byMuni.get(row.muniCode) ?? new Set();
      set.add(row.indexKind);
      byMuni.set(row.muniCode, set);
    }
    for (const kinds of byMuni.values()) {
      expect(kinds.size).toBe(1);
    }

    const find = (code: string) =>
      csv.find((r) => r.muniCode === String(Number(code)));
    expect(find("131016")?.indexKind).toBe("2gram");
    expect(find("131016")?.partition).toBe("tokyo");
    expect(find("472018")?.indexKind).toBe("3gram");
    expect(find("261009")?.indexKind).toBe("2gram"); // 京都市
    expect(find("262021")?.indexKind).toBe("3gram"); // 舞鶴市
    expect(find("212032")?.indexKind).toBe("2gram"); // 高山市 (岐阜全市)
  });

  it("TC-B13: no pref kind postings", () => {
    for (const region of TWO_GRAM_REGIONS) {
      const decoded = decodeBin(`search-ngrams/2gram/${region}.bin`);
      expect(decoded.records.every((r) => r.kind === KIND_MUNI)).toBe(true);
    }
  });
});

describe("index searchNgrams required (TC-S01)", () => {
  it("rejects index without paths.searchNgrams", async () => {
    const index = dataset.index as LocalGovIndexFile;
    const { searchNgrams: _drop, ...pathsWithout } = index.paths;
    void _drop;
    expect(() =>
      validateIndexFile({
        ...index,
        paths: pathsWithout,
      }),
    ).toThrow(LocalGovSchemaError);

    await expect(
      createLocalGovClient({
        data: {
          index: { ...index, paths: pathsWithout },
          prefectures: dataset.prefectures,
        },
      }),
    ).rejects.toBeInstanceOf(LocalGovSchemaError);
  });

  it("rejects string searchNgrams path (legacy)", () => {
    const index = dataset.index as LocalGovIndexFile;
    expect(() =>
      validateIndexFile({
        ...index,
        paths: { ...index.paths, searchNgrams: "search-ngrams.bin.br" },
      }),
    ).toThrow(LocalGovSchemaError);
  });
});

describe("hot set helpers", () => {
  it("assigns tokyo / cold correctly", () => {
    expect(
      assignTwoGramRegion({
        code: "131016",
        name: "千代田区",
        prefectureCode: "13",
        hasWard: 0,
        isWard: 0,
      }),
    ).toBe("tokyo");
    expect(
      isHotMunicipality({
        code: "472018",
        name: "那覇市",
        prefectureCode: "47",
        hasWard: 0,
        isWard: 0,
      }),
    ).toBe(false);
  });
});
