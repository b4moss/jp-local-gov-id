import {
  CACHE_TTL_MS as CACHIAN_CACHE_TTL_MS,
  CachianEnvironmentError,
  createCache,
  DEFAULT_CACHE_TTL_SECONDS as CACHIAN_DEFAULT_CACHE_TTL_SECONDS,
} from "@b4moss/cachian";
import type { CachePurgeOptions } from "@b4moss/cachian";
import { localStorageDriver } from "@b4moss/cachian/drivers/localStorage";
import { get } from "@b4moss/cachian/methods/get";
import { purge } from "@b4moss/cachian/methods/purge";
import { set } from "@b4moss/cachian/methods/set";

/** Default cache TTL for URL-fetched data: 1 year (in seconds). */
export const DEFAULT_CACHE_TTL_SECONDS = CACHIAN_DEFAULT_CACHE_TTL_SECONDS;

/** @deprecated Prefer DEFAULT_CACHE_TTL_SECONDS. Kept for existing imports. */
export const CACHE_TTL_MS = CACHIAN_CACHE_TTL_MS;

/** Physical localStorage key prefix (keeps purge({ all: true }) scoped). */
export const CACHE_KEY_PREFIX = "jp-local-gov-id:";

export type { CachePurgeOptions };

export type LocalGovCache = {
  get(key: string): Promise<unknown | null>;
  set(
    key: string,
    data: unknown,
    options?: { ttlSeconds?: number },
  ): Promise<void>;
  purge(options: CachePurgeOptions): Promise<void>;
};

export type CreateLocalGovCacheInstanceOptions = {
  /** Default: true */
  enabled?: boolean;
  /** Default: DEFAULT_CACHE_TTL_SECONDS */
  ttlSeconds?: number;
};

const noopCache: LocalGovCache = {
  async get() {
    return null;
  },
  async set() {},
  async purge() {},
};

/**
 * Create a per-client cachian instance (localStorage + get/set/purge only).
 * When localStorage is unavailable, returns a silent no-op cache.
 */
export function createLocalGovCache(
  options: CreateLocalGovCacheInstanceOptions = {},
): LocalGovCache {
  const enabled = options.enabled !== false;
  const ttlSeconds =
    options.ttlSeconds === undefined
      ? DEFAULT_CACHE_TTL_SECONDS
      : options.ttlSeconds;

  try {
    return createCache({
      driver: localStorageDriver(),
      methods: [get, set, purge],
      enabled,
      ttlSeconds,
      keyPrefix: CACHE_KEY_PREFIX,
    });
  } catch (error) {
    if (error instanceof CachianEnvironmentError) {
      return noopCache;
    }
    // Defensive: treat any driver/bootstrap failure like "storage unavailable".
    return noopCache;
  }
}
