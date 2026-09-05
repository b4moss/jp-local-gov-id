import { afterEach, describe, expect, it, vi } from "vitest";
import { getCachedData, setCachedData } from "./cache";

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

describe("cache helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns null when disabled or localStorage is unavailable", () => {
    expect(getCachedData("https://x/index.json", { enabled: false })).toBeNull();
    Reflect.deleteProperty(globalThis, "localStorage");
    expect(getCachedData("https://x/index.json")).toBeNull();
    setCachedData("https://x/index.json", { ok: true });
  });

  it("round-trips values and respects ttl", () => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    setCachedData("https://x/index.json", { v: 1 }, { ttlSeconds: 10 });
    expect(getCachedData("https://x/index.json")).toEqual({ v: 1 });

    vi.setSystemTime(new Date("2026-01-01T00:00:11Z"));
    expect(getCachedData("https://x/index.json")).toBeNull();
    expect(storage.getItem("https://x/index.json")).toBeNull();
  });

  it("drops malformed or non-entry JSON", () => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    storage.setItem("https://x/bad.json", "{not-json");
    expect(getCachedData("https://x/bad.json")).toBeNull();

    storage.setItem("https://x/obj.json", JSON.stringify({ foo: 1 }));
    expect(getCachedData("https://x/obj.json")).toBeNull();
    expect(storage.getItem("https://x/obj.json")).toBeNull();
  });

  it("ignores set failures and rejects invalid ttl", () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new Error("quota");
    };
    vi.stubGlobal("localStorage", storage);
    expect(() =>
      setCachedData("https://x/index.json", { ok: true }),
    ).not.toThrow();

    expect(() =>
      setCachedData("https://x/index.json", { ok: true }, { ttlSeconds: -1 }),
    ).toThrow(/cacheTtlSeconds/);
  });

  it("returns null when localStorage getter throws", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    expect(getCachedData("https://x/index.json")).toBeNull();
  });
});
