import { describe, expect, it } from "vitest";
import {
  encodeSearchNgrams,
  GRAM_TYPE_NAME,
  KIND_MUNI,
} from "./binary";
import { LocalGovSchemaError } from "./schema";
import {
  createDatasetSearchIndexLoader,
  createHybridSearchIndexLoader,
} from "./searchIndexLoader";
import type { SearchNgramsPathSpec } from "./types";

const spec: SearchNgramsPathSpec = {
  twoGram: {
    regions: ["tokyo"],
    pattern: "search-ngrams/2gram/{region}.bin.br",
  },
  threeGram: {
    shardCount: 1,
    pattern: "search-ngrams/3gram/{shard}.bin.br",
  },
};

function validJlix(): ArrayBuffer {
  return encodeSearchNgrams(
    [
      {
        gram: "中央",
        gramType: GRAM_TYPE_NAME,
        kind: KIND_MUNI,
        muniCode: 131016,
        prefCode: 13,
        hasWard: 0,
        isWard: 0,
      },
    ],
    { asOf: "R6.1.1" },
  );
}

describe("createHybridSearchIndexLoader", () => {
  it("wraps LocalGovBinaryError as LocalGovSchemaError", async () => {
    const loader = createHybridSearchIndexLoader({
      spec,
      loadPartitionBytes: async () => new ArrayBuffer(4),
    });
    await expect(
      loader({ twoGram: true, threeGram: false }),
    ).rejects.toBeInstanceOf(LocalGovSchemaError);
  });

  it("rethrows non-binary errors", async () => {
    const loader = createHybridSearchIndexLoader({
      spec,
      loadPartitionBytes: async () => {
        throw new TypeError("boom");
      },
    });
    await expect(
      loader({ twoGram: true, threeGram: false }),
    ).rejects.toBeInstanceOf(TypeError);
  });

  it("loads valid partitions", async () => {
    const loader = createHybridSearchIndexLoader({
      spec,
      prefecturesAsOf: "R6.1.1",
      loadPartitionBytes: async () => validJlix(),
      delay: async () => {},
    });
    const indexes = await loader({ twoGram: true, threeGram: true });
    expect(indexes.twoGram).not.toBeNull();
    expect(indexes.threeGram).not.toBeNull();
  });
});

describe("createDatasetSearchIndexLoader", () => {
  it("throws when 2-gram region shard is missing", async () => {
    const loader = createDatasetSearchIndexLoader({
      spec,
      shards: {},
    });
    await expect(loader({ twoGram: true, threeGram: false })).rejects.toThrow(
      /missing 2-gram region/,
    );
  });

  it("throws when 3-gram shard is missing", async () => {
    const loader = createDatasetSearchIndexLoader({
      spec,
      shards: { tokyo: validJlix() },
    });
    await expect(loader({ twoGram: false, threeGram: true })).rejects.toThrow(
      /missing 3-gram shard/,
    );
  });

  it("throws on unrecognized path", async () => {
    const loader = createDatasetSearchIndexLoader({
      spec: {
        twoGram: {
          regions: ["tokyo"],
          pattern: "other/{region}.bin",
        },
        threeGram: {
          shardCount: 1,
          pattern: "search-ngrams/3gram/{shard}.bin.br",
        },
      },
      shards: { tokyo: validJlix() },
    });
    await expect(loader({ twoGram: true, threeGram: false })).rejects.toThrow(
      /Unrecognized search index path/,
    );
  });
});
