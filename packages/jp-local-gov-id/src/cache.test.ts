import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CACHE_KEY_PREFIX,
  createLocalGovCache,
} from "./cache";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe("createLocalGovCache (cachian)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when disabled or localStorage is unavailable", async () => {
    const disabled = createLocalGovCache({ enabled: false });
    expect(await disabled.get("https://x/index.json")).toBeNull();

    Reflect.deleteProperty(globalThis, "localStorage");
    const unavailable = createLocalGovCache();
    expect(await unavailable.get("https://x/index.json")).toBeNull();
    await expect(
      unavailable.set("https://x/index.json", { ok: true }),
    ).resolves.toBeUndefined();
    await expect(unavailable.purge({ all: true })).resolves.toBeUndefined();
  });

  it("round-trips values under the key prefix", async () => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);

    const cache = createLocalGovCache({ ttlSeconds: 60 });
    await cache.set("https://x/index.json", { v: 1 });
    expect(await cache.get("https://x/index.json")).toEqual({ v: 1 });

    const physicalKey = `${CACHE_KEY_PREFIX}https://x/index.json`;
    expect(storage.getItem(physicalKey)).toBeTruthy();
    const entry = JSON.parse(storage.getItem(physicalKey)!);
    expect(entry.data).toEqual({ v: 1 });
    expect(typeof entry.expiresAt).toBe("number");
    expect(typeof entry.createdAt).toBe("number");
    // Logical URL key must not be written without prefix.
    expect(storage.getItem("https://x/index.json")).toBeNull();
  });

  it("drops malformed or non-entry JSON", async () => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    const physicalKey = `${CACHE_KEY_PREFIX}https://x/bad.json`;
    storage.setItem(physicalKey, "{not-json");
    const cache = createLocalGovCache();
    expect(await cache.get("https://x/bad.json")).toBeNull();

    storage.setItem(
      `${CACHE_KEY_PREFIX}https://x/obj.json`,
      JSON.stringify({ foo: 1 }),
    );
    expect(await cache.get("https://x/obj.json")).toBeNull();
  });

  it("ignores set failures", async () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new Error("quota");
    };
    vi.stubGlobal("localStorage", storage);
    const cache = createLocalGovCache();
    await expect(
      cache.set("https://x/index.json", { ok: true }),
    ).resolves.toBeUndefined();
  });

  it("returns null when localStorage getter throws", async () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    const cache = createLocalGovCache();
    expect(await cache.get("https://x/index.json")).toBeNull();
  });

  it("purge({ all: true }) only removes prefixed keys", async () => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    storage.setItem("other-app:key", "keep");
    const cache = createLocalGovCache();
    await cache.set("https://x/a.json", { a: 1 });
    await cache.set("https://x/b.json", { b: 2 });

    await cache.purge({ all: true });
    expect(await cache.get("https://x/a.json")).toBeNull();
    expect(await cache.get("https://x/b.json")).toBeNull();
    expect(storage.getItem("other-app:key")).toBe("keep");
  });

  it("purge({ keys }) removes only listed logical keys", async () => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    const cache = createLocalGovCache();
    await cache.set("https://x/a.json", { a: 1 });
    await cache.set("https://x/b.json", { b: 2 });

    await cache.purge({ keys: ["https://x/a.json"] });
    expect(await cache.get("https://x/a.json")).toBeNull();
    expect(await cache.get("https://x/b.json")).toEqual({ b: 2 });
  });
});
