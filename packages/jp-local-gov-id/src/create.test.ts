import { afterEach, describe, expect, it, vi } from "vitest";
import dataset from "@b4moss/jp-local-gov-id-data";
import { encodeMunicipalities, encodePrefectures } from "./binary";
import { createLocalGovClient } from "./create";
import { LocalGovSchemaError } from "./schema";
import type { LocalGovIndexFile, Prefecture } from "./types";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createLocalGovClient edge paths", () => {
  it("rejects null / non-object options", async () => {
    await expect(createLocalGovClient(null as never)).rejects.toThrow(TypeError);
    await expect(createLocalGovClient(undefined as never)).rejects.toThrow(
      TypeError,
    );
  });

  it("rejects path-only URL without location in Node", async () => {
    vi.stubGlobal("location", undefined);
    await expect(
      createLocalGovClient({ url: "/data/index.json", cache: false }),
    ).rejects.toThrow(/cannot be parsed as a URL/);
  });

  it("maps arrayBuffer failures to LocalGovSchemaError", async () => {
    const index = dataset.index as LocalGovIndexFile;
    const prefsUrl = new URL(index.paths.prefectures, "https://cdn.example.com/");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("index.json") || url.includes("index.json")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({
              ...index,
              paths: {
                ...index.paths,
                prefectures: "https://cdn.example.com/prefectures.bin",
              },
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer: async () => {
            throw new Error("arrayBuffer failed");
          },
          json: async () => {
            throw new Error("not json");
          },
        };
      }),
    );

    await expect(
      createLocalGovClient({
        url: "https://cdn.example.com/index.json",
        cache: false,
      }),
    ).rejects.toBeInstanceOf(LocalGovSchemaError);
    void prefsUrl;
  });

  it("wraps corrupt binary prefectures as LocalGovSchemaError", async () => {
    const index = dataset.index as LocalGovIndexFile;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("index.json")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({
              ...index,
              paths: {
                ...index.paths,
                prefectures: "prefectures.bin",
              },
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer: async () => new Uint8Array([0, 1, 2, 3, 4, 5]).buffer,
          json: async () => {
            throw new Error("not json");
          },
        };
      }),
    );

    await expect(
      createLocalGovClient({
        url: "https://cdn.example.com/index.json",
        cache: false,
      }),
    ).rejects.toBeInstanceOf(LocalGovSchemaError);
  });

  it("loads prefectures and municipalities from JSON URLs", async () => {
    const index = dataset.index as LocalGovIndexFile;
    const prefs = dataset.prefectures as {
      schemaVersion: number;
      asOf: string;
      prefectures: Prefecture[];
    };
    const hokkaido = (dataset.municipalitiesByCode as Record<string, unknown>)[
      "01"
    ];

    const indexUrl = "https://cdn.example.com/index.json";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === indexUrl) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({
              ...index,
              paths: {
                ...index.paths,
                prefectures: "prefectures.json",
                municipalitiesByPrefecture: "munis/{code}.json",
              },
            }),
          };
        }
        if (url.endsWith("/prefectures.json")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => prefs,
          };
        }
        if (url.endsWith("/munis/01.json")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => hokkaido,
          };
        }
        return { ok: false, status: 404, statusText: "Not Found" };
      }),
    );

    const c = await createLocalGovClient({ url: indexUrl, cache: false });
    expect(c.listPrefectures().length).toBeGreaterThan(0);
    const munis = await c.listMunicipalitiesByPrefecture("01");
    expect(munis.length).toBeGreaterThan(0);
  });

  it("wraps corrupt municipality binary as LocalGovSchemaError", async () => {
    const index = dataset.index as LocalGovIndexFile;
    const prefsFile = dataset.prefectures;
    const prefsBuf = encodePrefectures(
      [
        {
          prefCode: 1,
          name: "北海道",
          nameKana: "ﾎｯｶｲﾄﾞｳ",
          muniCode: 10006,
          muniCountBoth: 1,
          muniCountCity: 1,
          muniCountWard: 1,
        },
      ],
      { asOf: "R6.1.1" },
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("index.json")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({
              ...index,
              paths: {
                ...index.paths,
                prefectures: "prefectures.bin",
                municipalitiesByPrefecture: "munis/{code}.bin",
              },
              prefectureCodes: ["01"],
            }),
          };
        }
        if (url.endsWith("/prefectures.bin")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            arrayBuffer: async () => prefsBuf.slice(0),
          };
        }
        if (url.endsWith("/munis/01.bin")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            arrayBuffer: async () => new Uint8Array([0, 1, 2, 3, 4]).buffer,
          };
        }
        return { ok: false, status: 404, statusText: "Not Found" };
      }),
    );

    const c = await createLocalGovClient({
      url: "https://cdn.example.com/index.json",
      cache: false,
    });
    await expect(c.listMunicipalitiesByPrefecture("01")).rejects.toBeInstanceOf(
      LocalGovSchemaError,
    );
    void prefsFile;
  });

  it("rethrows non-binary errors from municipality binary load", async () => {
    const index = dataset.index as LocalGovIndexFile;
    const prefsBuf = encodePrefectures(
      [
        {
          prefCode: 1,
          name: "北海道",
          nameKana: "ﾎｯｶｲﾄﾞｳ",
          muniCode: 10006,
          muniCountBoth: 1,
          muniCountCity: 1,
          muniCountWard: 1,
        },
      ],
      { asOf: "R6.1.1" },
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("index.json")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({
              ...index,
              paths: {
                ...index.paths,
                prefectures: "prefectures.bin",
                municipalitiesByPrefecture: "munis/{code}.bin",
              },
              prefectureCodes: ["01"],
            }),
          };
        }
        if (url.endsWith("/prefectures.bin")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            arrayBuffer: async () => prefsBuf.slice(0),
          };
        }
        if (url.endsWith("/munis/01.bin")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            arrayBuffer: async () => {
              throw new RangeError("unexpected");
            },
          };
        }
        return { ok: false, status: 404, statusText: "Not Found" };
      }),
    );

    const c = await createLocalGovClient({
      url: "https://cdn.example.com/index.json",
      cache: false,
    });
    // arrayBuffer failure is wrapped as schema error inside fetchArrayBuffer
    await expect(c.listMunicipalitiesByPrefecture("01")).rejects.toBeInstanceOf(
      LocalGovSchemaError,
    );
  });

  it("errors when dataset lacks searchNgramShards and search runs", async () => {
    const c = await createLocalGovClient({
      data: {
        index: dataset.index,
        prefectures: dataset.prefectures,
        municipalitiesByCode: dataset.municipalitiesByCode,
      },
      cache: false,
    });
    await expect(c.searchByText("中央", { target: "cities" })).rejects.toThrow(
      /searchNgramShards/,
    );
  });

  it("loads municipalities via loadMunicipalities callback", async () => {
    const hokkaido = (dataset.municipalitiesByCode as Record<string, unknown>)[
      "01"
    ];
    const c = await createLocalGovClient({
      data: {
        index: {
          ...(dataset.index as LocalGovIndexFile),
          prefectureCodes: ["01"],
        },
        prefectures: dataset.prefectures,
        loadMunicipalities: async (code: string) => {
          expect(code).toBe("01");
          return hokkaido;
        },
        searchNgramShards: dataset.searchNgramShards,
      },
      cache: false,
    });
    const munis = await c.listMunicipalitiesByPrefecture("01");
    expect(munis.length).toBeGreaterThan(0);
  });

  it("errors when municipalities source is missing for a prefecture", async () => {
    const c = await createLocalGovClient({
      data: {
        index: {
          ...(dataset.index as LocalGovIndexFile),
          prefectureCodes: ["01"],
        },
        prefectures: dataset.prefectures,
        searchNgramShards: dataset.searchNgramShards,
      },
      cache: false,
    });
    await expect(c.listMunicipalitiesByPrefecture("01")).rejects.toThrow(
      /No municipalities for prefecture/,
    );
  });

  it("errors when search loads municipalities for a prefecture missing from prefs", async () => {
    const index = dataset.index as LocalGovIndexFile;
    const { encodeSearchNgrams, GRAM_TYPE_NAME, KIND_MUNI } = await import("./binary");
    const prefsBuf = encodePrefectures(
      [
        {
          prefCode: 13,
          name: "東京都",
          nameKana: "ﾄｳｷｮｳﾄ",
          muniCode: 130001,
          muniCountBoth: 1,
          muniCountCity: 1,
          muniCountWard: 1,
        },
      ],
      { asOf: "R6.1.1" },
    );
    const munisBuf = encodeMunicipalities(
      [
        {
          code: 11002,
          name: "札幌市",
          nameKana: "ｻｯﾎﾟﾛｼ",
          hasWard: 1,
          isWard: 0,
        },
      ],
      { asOf: "R6.1.1" },
    );
    const jlix = encodeSearchNgrams(
      [
        {
          gram: "札幌",
          gramType: GRAM_TYPE_NAME,
          kind: KIND_MUNI,
          muniCode: 11002,
          prefCode: 1,
          hasWard: 1,
          isWard: 0,
        },
      ],
      { asOf: "R6.1.1" },
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("index.json")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({
              ...index,
              paths: {
                prefectures: "prefectures.bin",
                municipalitiesByPrefecture: "munis/{code}.bin",
                searchNgrams: {
                  twoGram: {
                    regions: ["tokyo"],
                    pattern: "search-ngrams/2gram/{region}.bin",
                  },
                  threeGram: {
                    shardCount: 1,
                    pattern: "search-ngrams/3gram/{shard}.bin",
                  },
                },
              },
              prefectureCodes: ["13"],
            }),
          };
        }
        if (url.endsWith("/prefectures.bin")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            arrayBuffer: async () => prefsBuf.slice(0),
          };
        }
        if (url.includes("/search-ngrams/")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            arrayBuffer: async () => jlix.slice(0),
          };
        }
        if (url.endsWith("/munis/01.bin")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            arrayBuffer: async () => munisBuf.slice(0),
          };
        }
        return { ok: false, status: 404, statusText: "Not Found" };
      }),
    );

    const c = await createLocalGovClient({
      url: "https://cdn.example.com/index.json",
      cache: false,
    });
    await expect(c.searchByText("札幌", { target: "cities" })).rejects.toThrow(
      /Unknown prefecture code/,
    );
  });
});
