import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliDecompressSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import dataset from "@b4moss/jp-local-gov-id-data";
import {
  decodeSearchNgrams,
  GRAM_TYPE_NAME,
  KIND_PREF,
} from "./binary";
import { createLocalGovClient } from "./create";
import { LocalGovSchemaError, validateIndexFile } from "./schema";
import type { LocalGovIndexFile } from "./types";

const dataDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../jp-local-gov-id-data",
);

describe("search-ngrams generate contract (TC-G #63)", () => {
  it("TC-G02: index paths include searchNgrams as .bin.br", () => {
    const index = dataset.index as LocalGovIndexFile;
    expect(index.paths.searchNgrams).toBe("search-ngrams.bin.br");
    expect(index.paths.prefectures).toBe("prefectures.bin.br");
    expect(index.paths.municipalitiesByPrefecture).toBe(
      "prefectures/{code}.bin.br",
    );
  });

  it("TC-G05/G07: CSV row count matches JLIX and dataset raw bytes decode", () => {
    const csvLines = readFileSync(join(dataDir, "search-ngrams.csv"), "utf8")
      .trim()
      .split("\n");
    const dataRows = csvLines.length - 1;
    expect(dataRows).toBeGreaterThan(10_000);

    const bin = readFileSync(join(dataDir, "search-ngrams.bin"));
    const decoded = decodeSearchNgrams(
      bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength),
    );
    expect(decoded.records).toHaveLength(dataRows);
    expect(decoded.asOf).toBe((dataset.prefectures as { asOf?: string }).asOf);

    expect(dataset.searchNgrams).toBeInstanceOf(Uint8Array);
    const fromDataset = decodeSearchNgrams(
      dataset.searchNgrams.buffer.slice(
        dataset.searchNgrams.byteOffset,
        dataset.searchNgrams.byteOffset + dataset.searchNgrams.byteLength,
      ),
    );
    expect(fromDataset.records).toHaveLength(dataRows);
  });

  it("npm ships Brotli payloads that round-trip to JLIX", () => {
    const br = readFileSync(join(dataDir, "search-ngrams.bin.br"));
    const raw = brotliDecompressSync(br);
    const decoded = decodeSearchNgrams(
      raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
    );
    expect(decoded.records.length).toBeGreaterThan(10_000);
  });

  it("TC-G03: Osaka pref posting keeps distinct codes", () => {
    const decoded = decodeSearchNgrams(
      dataset.searchNgrams.buffer.slice(
        dataset.searchNgrams.byteOffset,
        dataset.searchNgrams.byteOffset + dataset.searchNgrams.byteLength,
      ),
    );
    const osaka = decoded.records.find(
      (r) =>
        r.kind === KIND_PREF &&
        r.gramType === GRAM_TYPE_NAME &&
        r.muniCode === 270008,
    );
    expect(osaka).toBeDefined();
    expect(osaka?.prefCode).toBe(27);
    expect(osaka?.muniCode).toBe(270008);
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
});
