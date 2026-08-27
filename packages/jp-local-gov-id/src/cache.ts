/** Default cache TTL for URL-fetched data: 1 year (in seconds). */
export const DEFAULT_CACHE_TTL_SECONDS = 365 * 24 * 60 * 60;

/** @deprecated Prefer DEFAULT_CACHE_TTL_SECONDS. Kept for existing imports. */
export const CACHE_TTL_MS = DEFAULT_CACHE_TTL_SECONDS * 1000;

export type CacheWriteOptions = {
  /** Default: true */
  enabled?: boolean;
  /** TTL in seconds. Default: DEFAULT_CACHE_TTL_SECONDS (1 year). */
  ttlSeconds?: number;
};

type CacheEntry = {
  expiresAt: number;
  data: unknown;
};

function getLocalStorage(): Storage | null {
  try {
    if (typeof globalThis.localStorage === "undefined") return null;
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function isCacheEntry(value: unknown): value is CacheEntry {
  if (value === null || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return typeof o.expiresAt === "number" && "data" in o;
}

function resolveTtlMs(ttlSeconds?: number): number {
  const seconds =
    ttlSeconds === undefined ? DEFAULT_CACHE_TTL_SECONDS : ttlSeconds;
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new TypeError(
      "cacheTtlSeconds must be a finite number greater than or equal to 0",
    );
  }
  return seconds * 1000;
}

/** Read cached JSON for a versioned URL. Returns null on miss / expiry / unavailable. */
export function getCachedData(
  url: string,
  options?: { enabled?: boolean },
): unknown | null {
  if (options?.enabled === false) return null;

  const storage = getLocalStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(url);
    if (raw == null) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isCacheEntry(parsed)) {
      storage.removeItem(url);
      return null;
    }

    if (Date.now() >= parsed.expiresAt) {
      storage.removeItem(url);
      return null;
    }

    return parsed.data;
  } catch {
    try {
      storage.removeItem(url);
    } catch {
      // ignore
    }
    return null;
  }
}

/** Store fetch result under the versioned URL key. No-op without localStorage. */
export function setCachedData(
  url: string,
  data: unknown,
  options?: CacheWriteOptions,
): void {
  if (options?.enabled === false) return;

  const storage = getLocalStorage();
  if (!storage) return;

  const entry: CacheEntry = {
    expiresAt: Date.now() + resolveTtlMs(options?.ttlSeconds),
    data,
  };

  try {
    storage.setItem(url, JSON.stringify(entry));
  } catch {
    // QuotaExceeded or private mode — skip cache
  }
}
