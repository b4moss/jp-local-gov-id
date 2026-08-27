import {
  DEFAULT_CACHE_TTL_SECONDS,
  getCachedData,
  setCachedData,
} from "./cache";
import { buildLocalGovClient } from "./api";
import {
  LocalGovSchemaError,
  normalizeDatasetInput,
  validateIndexFile,
  validateMunicipalitiesFile,
  validatePrefecturesFile,
} from "./schema";
import { createStore } from "./store";
import type {
  CreateLocalGovCacheOptions,
  CreateLocalGovOptions,
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

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch local gov data: ${response.status} ${response.statusText}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new LocalGovSchemaError(
      "Failed to parse local gov data as JSON from URL",
    );
  }

  return parsed;
}

async function fetchAndCache<T>(
  url: string,
  validate: (data: unknown) => T,
  cache: ResolvedCacheConfig,
  options?: { persist?: boolean },
): Promise<T> {
  const cached = getCachedData(url, { enabled: cache.enabled });
  if (cached !== null) {
    // Re-validate cached payloads so schema changes surface clearly
    return validate(cached);
  }

  const parsed = await fetchJson(url);
  const validated = validate(parsed);
  if (options?.persist !== false) {
    setCachedData(url, parsed, {
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
  const index = await fetchAndCache(indexUrl, validateIndexFile, cache);

  const prefecturesUrl = resolveSiblingUrl(
    indexUrl,
    index.paths.prefectures,
  );
  const prefecturesFile = await fetchAndCache(
    prefecturesUrl,
    validatePrefecturesFile,
    cache,
  );

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
        validateMunicipalitiesFile,
        cache,
        {
          persist: loadOptions?.persist,
        },
      );
      return file.municipalities;
    },
  );

  return buildLocalGovClient(store);
}

async function createFromData(data: unknown): Promise<LocalGovClient> {
  const input = normalizeDatasetInput(data);
  const index = validateIndexFile(input.index);
  const prefecturesFile = validatePrefecturesFile(input.prefectures);

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
  );

  return buildLocalGovClient(store);
}

/**
 * Load index + prefectures, validate schemas, then return a client.
 * Municipality JSON is loaded lazily (concurrency 6 for nationwide search).
 * Pass either `{ data }` (dataset) or `{ url }` (versioned index.json URL).
 *
 * For `url` mode, localStorage caching is on by default (`cache: true`,
 * `cacheTtlSeconds` defaults to 1 year). Nationwide string search still skips
 * writing municipality JSON to localStorage.
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
