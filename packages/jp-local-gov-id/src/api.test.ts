import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dataset from "@b4moss/jp-local-gov-id-data";
import { createLocalGovClient } from "./create";
import { CACHE_TTL_MS } from "./cache";
import { MUNICIPALITY_FETCH_CONCURRENCY } from "./pool";
import { LocalGovSchemaError } from "./schema";
import type { LocalGovClient, LocalGovIndexFile } from "./types";

async function client(): Promise<LocalGovClient> {
  return createLocalGovClient({ data: dataset });
}

const indexUrl =
  "https://cdn.example.com/jp-local-gov-id-data/0.2.0/index.json";

const dataDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../jp-local-gov-id-data",
);

function readBin(relativePath: string): ArrayBuffer {
  const bytes = readFileSync(join(dataDir, relativePath));
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
}

function fileMap(): Map<string, unknown> {
  const map = new Map<string, unknown>();
  map.set(indexUrl, dataset.index);
  map.set(
    "https://cdn.example.com/jp-local-gov-id-data/0.2.0/prefectures.bin",
    readBin("prefectures.bin"),
  );
  for (const code of (dataset.index as LocalGovIndexFile).prefectureCodes) {
    map.set(
      `https://cdn.example.com/jp-local-gov-id-data/0.2.0/prefectures/${code}.bin`,
      readBin(`prefectures/${code}.bin`),
    );
  }
  return map;
}

describe("createLocalGovClient", () => {
  it("requires data or url", async () => {
    await expect(
      createLocalGovClient({} as { data: unknown }),
    ).rejects.toThrow(/data|url/);
  });

  it("rejects both data and url", async () => {
    await expect(
      createLocalGovClient({ data: dataset, url: indexUrl } as never),
    ).rejects.toThrow(/either/);
  });

  it("throws LocalGovSchemaError for invalid shape", async () => {
    await expect(createLocalGovClient({ data: { foo: 1 } })).rejects.toBeInstanceOf(
      LocalGovSchemaError,
    );
    await expect(createLocalGovClient({ data: null })).rejects.toBeInstanceOf(
      LocalGovSchemaError,
    );
    await expect(
      createLocalGovClient({
        data: {
          index: { schemaVersion: 1 },
          prefectures: { schemaVersion: 1, prefectures: [{ code: 1 }] },
        },
      }),
    ).rejects.toBeInstanceOf(LocalGovSchemaError);
  });

  it("throws LocalGovSchemaError for unsupported schemaVersion", async () => {
    await expect(
      createLocalGovClient({
        data: {
          index: {
            ...(dataset.index as LocalGovIndexFile),
            schemaVersion: 999,
          },
          prefectures: dataset.prefectures,
        },
      }),
    ).rejects.toBeInstanceOf(LocalGovSchemaError);
  });
});

describe("listPrefectures", () => {
  it("returns all 47 prefectures", async () => {
    const prefs = (await client()).listPrefectures();
    expect(prefs).toHaveLength(47);
    expect(prefs.map((p) => p.code)).toContain("13");
    expect(prefs.find((p) => p.code === "13")?.name).toBe("東京都");
  });
});

describe("getPrefectureCodeByName", () => {
  it("returns 2-digit code for an exact prefecture name", async () => {
    const c = await client();
    expect(c.getPrefectureCodeByName("東京都")).toBe("13");
    expect(c.getPrefectureCodeByName("北海道")).toBe("01");
  });

  it("returns null when not found", async () => {
    const c = await client();
    expect(c.getPrefectureCodeByName("東京")).toBeNull();
    expect(c.getPrefectureCodeByName("存在しない県")).toBeNull();
  });
});

describe("getPrefectureByCode", () => {
  it("resolves prefecture by padded and unpadded code", async () => {
    const c = await client();
    expect(c.getPrefectureByCode("13")?.name).toBe("東京都");
    expect(c.getPrefectureByCode("1")?.name).toBe("北海道");
    expect(c.getPrefectureByCode("01")?.name).toBe("北海道");
  });

  it("returns null for invalid or unknown codes", async () => {
    const c = await client();
    expect(c.getPrefectureByCode("99")).toBeNull();
    expect(c.getPrefectureByCode("131016")).toBeNull();
    expect(c.getPrefectureByCode("")).toBeNull();
  });
});

describe("getMunicipalityCountByPrefecture", () => {
  it("TC-A01: resolves code and name to the same both count", async () => {
    const c = await client();
    const byPadded = c.getMunicipalityCountByPrefecture("01");
    const byUnpadded = c.getMunicipalityCountByPrefecture("1");
    const byName = c.getMunicipalityCountByPrefecture("北海道");

    expect(byPadded).toBe(195);
    expect(byUnpadded).toBe(195);
    expect(byName).toBe(195);
  });

  it("TC-A02: Hokkaido designatedCity modes", async () => {
    const c = await client();
    expect(c.getMunicipalityCountByPrefecture("01")).toBe(195);
    expect(
      c.getMunicipalityCountByPrefecture("01", { designatedCity: "both" }),
    ).toBe(195);
    expect(
      c.getMunicipalityCountByPrefecture("01", { designatedCity: "city" }),
    ).toBe(185);
    expect(
      c.getMunicipalityCountByPrefecture("01", { designatedCity: "ward" }),
    ).toBe(194);
  });

  it("TC-A03/A05: Tokyo modes are equal (special wards included)", async () => {
    const c = await client();
    const both = c.getMunicipalityCountByPrefecture("13");
    const city = c.getMunicipalityCountByPrefecture("東京都", {
      designatedCity: "city",
    });
    const ward = c.getMunicipalityCountByPrefecture("13", {
      designatedCity: "ward",
    });

    expect(both).toBe(62);
    expect(city).toBe(62);
    expect(ward).toBe(62);
  });

  it("TC-A04: Okinawa modes are equal", async () => {
    const c = await client();
    expect(c.getMunicipalityCountByPrefecture("47")).toBe(41);
    expect(
      c.getMunicipalityCountByPrefecture("沖縄県", { designatedCity: "city" }),
    ).toBe(41);
    expect(
      c.getMunicipalityCountByPrefecture("47", { designatedCity: "ward" }),
    ).toBe(41);
  });

  it("TC-A06: unknown prefecture returns null", async () => {
    const c = await client();
    expect(c.getMunicipalityCountByPrefecture("99")).toBeNull();
    expect(c.getMunicipalityCountByPrefecture("存在しない県")).toBeNull();
    expect(c.getMunicipalityCountByPrefecture("")).toBeNull();
  });

  it("TC-A07: municipalityCounts is on prefecture records", async () => {
    const c = await client();
    const expected = { both: 195, city: 185, ward: 194 };

    expect(c.getPrefectureByCode("01")?.municipalityCounts).toEqual(expected);
    expect(
      c.listPrefectures().find((p) => p.code === "01")?.municipalityCounts,
    ).toEqual(expected);
  });

  it("TC-A08: returns sync number without loading municipalities", async () => {
    const c = await client();
    const result = c.getMunicipalityCountByPrefecture("01");

    expect(result).toBe(195);
    expect(result).not.toBeInstanceOf(Promise);
  });
});

describe("listMunicipalitiesByPrefecture", () => {
  it("accepts name, padded code, and unpadded code", async () => {
    const c = await client();
    const byName = await c.listMunicipalitiesByPrefecture("北海道");
    const byPadded = await c.listMunicipalitiesByPrefecture("01");
    const byUnpadded = await c.listMunicipalitiesByPrefecture("1");

    expect(byName.length).toBeGreaterThan(0);
    expect(byPadded).toEqual(byName);
    expect(byUnpadded).toEqual(byName);
  });

  it("includes designated city body and ward by default (both)", async () => {
    const munis = await (await client()).listMunicipalitiesByPrefecture("01");
    expect(munis.find((m) => m.code === "011002")?.name).toBe("札幌市");
    expect(munis.find((m) => m.code === "011011")?.name).toBe("札幌市中央区");
  });

  it("designatedCity city keeps body and excludes wards", async () => {
    const munis = await (
      await client()
    ).listMunicipalitiesByPrefecture("01", { designatedCity: "city" });
    expect(munis.some((m) => m.name === "札幌市")).toBe(true);
    expect(munis.some((m) => m.name === "札幌市中央区")).toBe(false);
    expect(munis.every((m) => !/^.+市.+区$/.test(m.name))).toBe(true);
  });

  it("designatedCity ward keeps wards and excludes body", async () => {
    const munis = await (
      await client()
    ).listMunicipalitiesByPrefecture("01", { designatedCity: "ward" });
    expect(munis.some((m) => m.name === "札幌市")).toBe(false);
    expect(munis.some((m) => m.name === "札幌市中央区")).toBe(true);
  });

  it("designatedCity modes keep Tokyo special wards", async () => {
    const c = await client();
    const city = await c.listMunicipalitiesByPrefecture("13", {
      designatedCity: "city",
    });
    const ward = await c.listMunicipalitiesByPrefecture("13", {
      designatedCity: "ward",
    });
    expect(city.some((m) => m.name === "千代田区")).toBe(true);
    expect(ward.some((m) => m.name === "千代田区")).toBe(true);
  });

  it("returns empty array when prefecture is unknown", async () => {
    const c = await client();
    expect(await c.listMunicipalitiesByPrefecture("99")).toEqual([]);
    expect(await c.listMunicipalitiesByPrefecture("存在しない県")).toEqual([]);
  });
});

describe("getMunicipalityByCode", () => {
  it("resolves municipality by 6-digit code", async () => {
    expect((await (await client()).getMunicipalityByCode("131016"))?.name).toBe(
      "千代田区",
    );
  });

  it("returns null for prefecture codes and invalid input", async () => {
    const c = await client();
    expect(await c.getMunicipalityByCode("13")).toBeNull();
    expect(await c.getMunicipalityByCode("1")).toBeNull();
    expect(await c.getMunicipalityByCode("999999")).toBeNull();
  });
});

describe("getByCode", () => {
  it("resolves prefecture by 2-digit and unpadded code", async () => {
    const c = await client();
    expect((await c.getByCode("13"))?.name).toBe("東京都");
    expect((await c.getByCode("1"))?.name).toBe("北海道");
    expect((await c.getByCode("01"))?.name).toBe("北海道");
  });

  it("resolves municipality by 6-digit code", async () => {
    expect((await (await client()).getByCode("131016"))?.name).toBe("千代田区");
  });

  it("resolves designated city body and ward", async () => {
    const c = await client();
    expect((await c.getByCode("271004"))?.name).toBe("大阪市");
    expect((await c.getByCode("011011"))?.name).toBe("札幌市中央区");
  });

  it("returns null when not found", async () => {
    const c = await client();
    expect(await c.getByCode("999999")).toBeNull();
    expect(await c.getByCode("")).toBeNull();
    expect(await c.getByCode("123")).toBeNull();
  });
});

describe("searchByText", () => {
  it("partial-matches names", async () => {
    const hits = await (await client()).searchByText("千代田");
    expect(hits.some((h) => h.code === "131016" && h.name === "千代田区")).toBe(
      true,
    );
  });

  it("filters by target prefectures", async () => {
    const hits = await (await client()).searchByText("大阪", {
      target: "prefectures",
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.name).toBe("大阪府");
  });

  it("filters by target cities", async () => {
    const hits = await (await client()).searchByText("大阪", { target: "cities" });
    expect(hits.every((h) => h.code.length === 6)).toBe(true);
    expect(hits.some((h) => h.name === "大阪市")).toBe(true);
    expect(hits.some((h) => h.name === "大阪府")).toBe(false);
  });

  it("filters by prefecture with unpadded code", async () => {
    const hits = await (await client()).searchByText("中央", {
      prefecture: "1",
      target: "cities",
    });
    expect(hits.some((h) => h.name === "札幌市中央区")).toBe(true);
    expect(hits.every((h) => h.prefectureCode === "01")).toBe(true);
  });

  it("returns empty array when nothing matches", async () => {
    const c = await client();
    expect(await c.searchByText("存在しない自治体名xyz")).toEqual([]);
    expect(await c.searchByText("区", { prefecture: "99" })).toEqual([]);
  });

  it("matches halfwidth kana, fullwidth kana, and hiragana", async () => {
    const c = await client();
    const half = await c.searchByText("ﾁﾖﾀﾞ", {
      prefecture: "13",
      target: "cities",
    });
    const full = await c.searchByText("チヨダ", {
      prefecture: "13",
      target: "cities",
    });
    const hira = await c.searchByText("ちよだ", {
      prefecture: "13",
      target: "cities",
    });

    expect(half.some((h) => h.code === "131016")).toBe(true);
    expect(full.some((h) => h.code === "131016")).toBe(true);
    expect(hira.some((h) => h.code === "131016")).toBe(true);
  });

  it("respects matchField name vs nameKana", async () => {
    const c = await client();
    const byName = await c.searchByText("千代田", {
      prefecture: "13",
      target: "cities",
      matchField: "name",
    });
    const kanaOnNameOnly = await c.searchByText("ﾁﾖﾀﾞ", {
      prefecture: "13",
      target: "cities",
      matchField: "name",
    });
    const byKana = await c.searchByText("ﾁﾖﾀﾞ", {
      prefecture: "13",
      target: "cities",
      matchField: "nameKana",
    });

    expect(byName.some((h) => h.code === "131016")).toBe(true);
    expect(kanaOnNameOnly).toEqual([]);
    expect(byKana.some((h) => h.code === "131016")).toBe(true);
  });
});

describe("getLocalGovCodeByName", () => {
  it("returns code for a unique exact match", async () => {
    const c = await client();
    expect(await c.getLocalGovCodeByName("千代田区")).toBe("131016");
    expect(await c.getLocalGovCodeByName("札幌市中央区")).toBe("011011");
    expect(await c.getLocalGovCodeByName("東京都", { target: "prefectures" })).toBe(
      "13",
    );
  });

  it("returns null when multiple exact hits exist", async () => {
    const c = await client();
    expect(await c.getLocalGovCodeByName("府中市")).toBeNull();
    expect(await c.getLocalGovCodeByName("伊達市")).toBeNull();
  });

  it("returns code when prefecture filter makes the match unique", async () => {
    const c = await client();
    expect(await c.getLocalGovCodeByName("府中市", { prefecture: "13" })).toBe(
      "132063",
    );
    expect(await c.getLocalGovCodeByName("府中市", { prefecture: "34" })).toBe(
      "342084",
    );
  });

  it("returns null for partial names (exact match only)", async () => {
    const c = await client();
    expect(await c.getLocalGovCodeByName("千代田")).toBeNull();
    expect(await c.getLocalGovCodeByName("東京")).toBeNull();
  });

  it("returns null when not found", async () => {
    const c = await client();
    expect(await c.getLocalGovCodeByName("存在しない市")).toBeNull();
    expect(
      await c.getLocalGovCodeByName("千代田区", { prefecture: "01" }),
    ).toBeNull();
  });

  it("resolves unique exact kana match", async () => {
    const c = await client();
    expect(
      await c.getLocalGovCodeByName("ﾁﾖﾀﾞｸ", {
        prefecture: "13",
        target: "cities",
      }),
    ).toBe("131016");
    expect(
      await c.getLocalGovCodeByName("ちよだく", {
        prefecture: "13",
        target: "cities",
      }),
    ).toBe("131016");
  });
});

describe("createLocalGovClient url + cache + lazy load", () => {
  const store = new Map<string, string>();

  afterEach(() => {
    vi.unstubAllGlobals();
    store.clear();
  });

  function stubLocalStorage() {
    const localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    };
    vi.stubGlobal("localStorage", localStorage);
  }

  function stubFetch(files: Map<string, unknown>) {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = files.get(url);
      if (body === undefined) {
        return {
          ok: false,
          status: 404,
          statusText: "Not Found",
          json: async () => {
            throw new Error("no body");
          },
          arrayBuffer: async () => {
            throw new Error("no body");
          },
        };
      }
      if (body instanceof ArrayBuffer) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer: async () => body.slice(0),
          json: async () => {
            throw new Error("not json");
          },
        };
      }
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => body,
        arrayBuffer: async () => {
          throw new Error("not binary");
        },
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("fetches index + prefectures on init, municipalities lazily", async () => {
    stubLocalStorage();
    const files = fileMap();
    const fetchMock = stubFetch(files);

    const c = await createLocalGovClient({ url: indexUrl });
    expect(c.listPrefectures()).toHaveLength(47);
    // index + prefectures only
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(store.has(indexUrl)).toBe(true);

    const cached = JSON.parse(store.get(indexUrl)!);
    expect(cached.expiresAt).toBeGreaterThan(Date.now());
    expect(cached.expiresAt).toBeLessThanOrEqual(
      Date.now() + CACHE_TTL_MS + 1000,
    );
    expect(cached.data.schemaVersion).toBe(1);

    expect((await c.getByCode("131016"))?.name).toBe("千代田区");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).endsWith("/prefectures/13.bin"),
      ),
    ).toBe(true);

    // Second getByCode for same pref should not re-fetch
    expect((await c.getByCode("131024"))?.name).toBe("中央区");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("nationwide search fetches unloaded prefectures with concurrency 6", async () => {
    stubLocalStorage();
    const files = fileMap();
    let inFlight = 0;
    let maxInFlight = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = files.get(url);
      if (body === undefined) {
        return { ok: false, status: 404, statusText: "Not Found" };
      }

      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;

      if (body instanceof ArrayBuffer) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer: async () => body.slice(0),
        };
      }
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => body,
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const c = await createLocalGovClient({ url: indexUrl });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const hits = await c.searchByText("中央", { target: "cities" });
    expect(hits.some((h) => h.name === "札幌市中央区")).toBe(true);
    expect(hits.some((h) => h.name === "中央区")).toBe(true);

    // 2 init + 47 prefecture municipality files
    expect(fetchMock).toHaveBeenCalledTimes(2 + 47);
    expect(maxInFlight).toBe(MUNICIPALITY_FETCH_CONCURRENCY);
    expect(MUNICIPALITY_FETCH_CONCURRENCY).toBe(6);

    // Nationwide search keeps municipality payloads in memory only
    for (const key of store.keys()) {
      expect(key).not.toMatch(/\/prefectures\/\d{2}\.bin$/);
    }
    expect(store.has(indexUrl)).toBe(true);
    expect(
      store.has(
        "https://cdn.example.com/jp-local-gov-id-data/0.2.0/prefectures.bin",
      ),
    ).toBe(true);

    // Second nationwide search reuses memory (no extra fetch)
    await c.searchByText("中央", { target: "cities" });
    expect(fetchMock).toHaveBeenCalledTimes(2 + 47);
  });

  it("getByCode persists municipality payload to localStorage", async () => {
    stubLocalStorage();
    const fetchMock = stubFetch(fileMap());
    const c = await createLocalGovClient({ url: indexUrl });

    await c.getByCode("131016");
    expect(
      store.has(
        "https://cdn.example.com/jp-local-gov-id-data/0.2.0/prefectures/13.bin",
      ),
    ).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("prefecture-scoped search persists municipality payload to localStorage", async () => {
    stubLocalStorage();
    const fetchMock = stubFetch(fileMap());
    const c = await createLocalGovClient({ url: indexUrl });

    await c.searchByText("中央", { prefecture: "01", target: "cities" });
    expect(
      store.has(
        "https://cdn.example.com/jp-local-gov-id-data/0.2.0/prefectures/01.bin",
      ),
    ).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("prefectures-only search does not fetch municipality files", async () => {
    stubLocalStorage();
    const fetchMock = stubFetch(fileMap());

    const c = await createLocalGovClient({ url: indexUrl });
    const hits = await c.searchByText("東京", { target: "prefectures" });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.name).toBe("東京都");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("propagates HTTP errors without caching", async () => {
    stubLocalStorage();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      }),
    );

    await expect(createLocalGovClient({ url: indexUrl })).rejects.toThrow(/404/);
    expect(store.has(indexUrl)).toBe(false);
  });

  it("treats invalid JSON as schema error", async () => {
    stubLocalStorage();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
      }),
    );

    await expect(createLocalGovClient({ url: indexUrl })).rejects.toBeInstanceOf(
      LocalGovSchemaError,
    );
  });

  it("skips cache when localStorage is unavailable", async () => {
    vi.stubGlobal("localStorage", undefined);
    const fetchMock = stubFetch(fileMap());

    const c = await createLocalGovClient({ url: indexUrl });
    expect(c.listPrefectures()).toHaveLength(47);

    await createLocalGovClient({ url: indexUrl });
    // Each init: index + prefectures
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("reuses cached index on second createLocalGovClient", async () => {
    stubLocalStorage();
    const fetchMock = stubFetch(fileMap());

    await createLocalGovClient({ url: indexUrl });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await createLocalGovClient({ url: indexUrl });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("skips localStorage when cache is false", async () => {
    stubLocalStorage();
    const fetchMock = stubFetch(fileMap());

    await createLocalGovClient({ url: indexUrl, cache: false });
    expect(store.size).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await createLocalGovClient({ url: indexUrl, cache: false });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("uses cacheTtlSeconds when writing cache entries", async () => {
    stubLocalStorage();
    stubFetch(fileMap());
    const before = Date.now();

    await createLocalGovClient({ url: indexUrl, cacheTtlSeconds: 60 });

    const cached = JSON.parse(store.get(indexUrl)!);
    expect(cached.expiresAt).toBeGreaterThanOrEqual(before + 60_000);
    expect(cached.expiresAt).toBeLessThanOrEqual(Date.now() + 60_000 + 1000);
  });

  it("rejects invalid cacheTtlSeconds", async () => {
    stubLocalStorage();
    stubFetch(fileMap());

    await expect(
      createLocalGovClient({ url: indexUrl, cacheTtlSeconds: -1 }),
    ).rejects.toThrow(/cacheTtlSeconds/);
  });
});
