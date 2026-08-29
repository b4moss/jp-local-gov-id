import {
  DEFAULT_CACHE_TTL_SECONDS,
  getCachedData,
  setCachedData,
} from "./cache";
import { buildLocalGovClient } from "./api";
import {
  decodeMunicipalitiesFile,
  decodePrefecturesFile,
  decodeSearchNgrams,
  LocalGovBinaryError,
} from "./binary";
import {
  LocalGovSchemaError,
  normalizeDatasetInput,
  validateIndexFile,
  validateMunicipalitiesFile,
  validatePrefecturesFile,
} from "./schema";
import {
  buildSearchIndex,
  toArrayBuffer,
  warnSearchIndexAsOfMismatch,
  type SearchIndex,
} from "./searchIndex";
import { createStore } from "./store";
import type {
  CreateLocalGovCacheOptions,
  CreateLocalGovOptions,
  LocalGov,
  LocalGovClient,
  LocalGovIndexFile,
} from "./types";

type ResolvedCacheConfig = {
  enabled: boolean;
  ttlSeconds: number;
};

function resolveCacheConfig(
  options: CreateLocalGovCacheOptions,
): ResolvedCacheConfig {
  const enabled = options.cache !== false;
  const ttlSeconds =
    options.cacheTtlSeconds === undefined
      ? DEFAULT_CACHE_TTL_SECONDS
      : options.cacheTtlSeconds;

  if (!Number.isFinite(ttlSeconds) || ttlSeconds < 0) {
    throw new TypeError(
      "cacheTtlSeconds must be a finite number greater than or equal to 0",
    );
  }

  return { enabled, ttlSeconds };
}

function hasData(
  options: CreateLocalGovOptions,
): options is { data: unknown; url?: never } & CreateLocalGovCacheOptions {
  return "data" in options && options.data !== undefined;
}

function hasUrl(
  options: CreateLocalGovOptions,
): options is { url: string; data?: never } & CreateLocalGovCacheOptions {
  return "url" in options && typeof options.url === "string";
}

function resolveSiblingUrl(indexUrl: string, relativePath: string): string {
  return new URL(relativePath, indexUrl).href;
}

function municipalitiesPath(
  index: LocalGovIndexFile,
  code: string,
): string {
  return index.paths.municipalitiesByPrefecture.replaceAll("{code}", code);
}

function isBinaryUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    return pathname.endsWith(".bin");
  } catch {
    return url.includes(".bin");
  }
}

async function fetchResponse(url: string): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch local gov data: ${response.status} ${response.statusText}`,
    );
  }
  return response;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetchResponse(url);
  try {
    return await response.json();
  } catch {
    throw new LocalGovSchemaError(
      "Failed to parse local gov data as JSON from URL",
    );
  }
}

async function fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetchResponse(url);
  try {
    return await response.arrayBuffer();
  } catch {
    throw new LocalGovSchemaError(
      "Failed to read local gov binary data from URL",
    );
  }
}

function prefectureLookup(
  prefectures: LocalGov[],
  code: string,
): {
  prefectureCode: string;
  prefectureName: string;
  prefectureNameKana: string;
} {
  const pref = prefectures.find((p) => p.code === code);
  if (!pref) {
    throw new LocalGovSchemaError(
      `Unknown prefecture code while decoding municipalities: ${code}`,
    );
  }
  return {
    prefectureCode: pref.code,
    prefectureName: pref.name,
    prefectureNameKana: pref.nameKana,
  };
}

async function loadPrefecturesPayload(
  url: string,
): Promise<unknown> {
  if (!isBinaryUrl(url)) {
    return fetchJson(url);
  }
  try {
    return decodePrefecturesFile(await fetchArrayBuffer(url));
  } catch (error) {
    if (error instanceof LocalGovBinaryError) {
      throw new LocalGovSchemaError(error.message);
    }
    throw error;
  }
}

async function loadMunicipalitiesPayload(
  url: string,
  prefectures: LocalGov[],
  code: string,
): Promise<unknown> {
  if (!isBinaryUrl(url)) {
    return fetchJson(url);
  }
  try {
    return decodeMunicipalitiesFile(
      await fetchArrayBuffer(url),
      prefectureLookup(prefectures, code),
    );
  } catch (error) {
    if (error instanceof LocalGovBinaryError) {
      throw new LocalGovSchemaError(error.message);
    }
    throw error;
  }
}

function decodeSearchIndexBytes(buffer: ArrayBuffer): SearchIndex {
  try {
    return buildSearchIndex(decodeSearchNgrams(buffer));
  } catch (error) {
    if (error instanceof LocalGovBinaryError) {
      throw new LocalGovSchemaError(error.message);
    }
    throw error;
  }
}

async function fetchAndCache<T>(
  url: string,
  load: () => Promise<unknown>,
  validate: (data: unknown) => T,
  cache: ResolvedCacheConfig,
  options?: { persist?: boolean },
): Promise<T> {
  const cached = getCachedData(url, { enabled: cache.enabled });
  if (cached !== null) {
    // Re-validate cached payloads so schema changes surface clearly
    return validate(cached);
  }

  const parsed = await load();
  const validated = validate(parsed);
  if (options?.persist !== false) {
    setCachedData(url, validated, {
      enabled: cache.enabled,
      ttlSeconds: cache.ttlSeconds,
    });
  }
  return validated;
}

async function createFromUrl(
  indexUrl: string,
  cache: ResolvedCacheConfig,
): Promise<LocalGovClient> {
  const index = await fetchAndCache(
    indexUrl,
    async () => fetchJson(indexUrl),
    validateIndexFile,
    cache,
  );

  const prefecturesUrl = resolveSiblingUrl(
    indexUrl,
    index.paths.prefectures,
  );
  const prefecturesFile = await fetchAndCache(
    prefecturesUrl,
    async () => loadPrefecturesPayload(prefecturesUrl),
    validatePrefecturesFile,
    cache,
  );

  let searchIndex: SearchIndex | null = null;
  let searchIndexInFlight: Promise<SearchIndex> | null = null;

  const store = createStore(
    index,
    prefecturesFile.prefectures,
    async (code, loadOptions) => {
      const url = resolveSiblingUrl(
        indexUrl,
        municipalitiesPath(index, code),
      );
      const file = await fetchAndCache(
        url,
        async () =>
          loadMunicipalitiesPayload(url, prefecturesFile.prefectures, code),
        validateMunicipalitiesFile,
        cache,
        {
          persist: loadOptions?.persist,
        },
      );
      return file.municipalities;
    },
    async () => {
      if (searchIndex) return searchIndex;
      if (searchIndexInFlight) return searchIndexInFlight;

      searchIndexInFlight = (async () => {
        const url = resolveSiblingUrl(indexUrl, index.paths.searchNgrams);
        // JLIX: memory only — do not use localStorage (Issue #63)
        const buffer = await fetchArrayBuffer(url);
        const built = decodeSearchIndexBytes(buffer);
        warnSearchIndexAsOfMismatch(built.asOf, prefecturesFile.asOf);
        searchIndex = built;
        return built;
      })().finally(() => {
        searchIndexInFlight = null;
      });

      return searchIndexInFlight;
    },
    { prefecturesAsOf: prefecturesFile.asOf },
  );

  return buildLocalGovClient(store);
}

async function createFromData(data: unknown): Promise<LocalGovClient> {
  const input = normalizeDatasetInput(data);
  const index = validateIndexFile(input.index);
  const prefecturesFile = validatePrefecturesFile(input.prefectures);

  // Node / { data }: eager decode when bytes are present (Issue #63)
  let searchIndex: SearchIndex | null = null;
  if (input.searchNgrams) {
    searchIndex = decodeSearchIndexBytes(toArrayBuffer(input.searchNgrams));
    warnSearchIndexAsOfMismatch(searchIndex.asOf, prefecturesFile.asOf);
  }

  const store = createStore(
    index,
    prefecturesFile.prefectures,
    async (code) => {
      if (input.municipalitiesByCode && code in input.municipalitiesByCode) {
        const file = validateMunicipalitiesFile(
          input.municipalitiesByCode[code],
        );
        return file.municipalities;
      }

      if (input.loadMunicipalities) {
        const raw = await input.loadMunicipalities(code);
        const file = validateMunicipalitiesFile(raw);
        return file.municipalities;
      }

      throw new LocalGovSchemaError(
        `No municipalities data for prefecture ${code}: provide municipalitiesByCode or loadMunicipalities`,
      );
    },
    async () => {
      if (searchIndex) return searchIndex;
      throw new LocalGovSchemaError(
        "Dataset is missing searchNgrams (JLIX bytes) required for nationwide string search",
      );
    },
    { prefecturesAsOf: prefecturesFile.asOf },
  );

  return buildLocalGovClient(store);
}

/**
 * Load index + prefectures, validate schemas, then return a client.
 * Municipality payloads are loaded lazily (concurrency 6).
 * Nationwide city search uses JLIX (`paths.searchNgrams`) then loads only
 * candidate prefecture `.bin` files (memory-only for those loads and for JLIX).
 * Pass either `{ data }` (dataset) or `{ url }` (versioned index.json URL).
 *
 * For `url` mode, localStorage caching is on by default (`cache: true`,
 * `cacheTtlSeconds` defaults to 1 year). Cached values are decoded objects
 * stored via `JSON.stringify` (minified). JLIX and nationwide municipality
 * loads skip localStorage.
 */
export async function createLocalGovClient(
  options: CreateLocalGovOptions,
): Promise<LocalGovClient> {
  if (!options || typeof options !== "object") {
    throw new TypeError(
      "createLocalGovClient requires options with either `data` or `url`",
    );
  }

  const dataProvided = hasData(options);
  const urlProvided = hasUrl(options);

  if (dataProvided && urlProvided) {
    throw new TypeError(
      "createLocalGovClient accepts either `data` or `url`, not both",
    );
  }

  if (!dataProvided && !urlProvided) {
    throw new TypeError(
      "createLocalGovClient requires either `data` or `url`",
    );
  }

  if (urlProvided) {
    const cache = resolveCacheConfig(options);
    return createFromUrl(options.url, cache);
  }

  // Validate cache options even for data mode so bad values fail fast
  resolveCacheConfig(options);
  return createFromData(options.data);
}
