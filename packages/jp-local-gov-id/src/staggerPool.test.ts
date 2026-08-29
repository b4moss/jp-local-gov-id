import { describe, expect, it, vi } from "vitest";
import {
  mapWithStaggeredConcurrency,
  SEARCH_INDEX_FETCH_CONCURRENCY,
  SEARCH_INDEX_FETCH_STAGGER_MS,
} from "./staggerPool";

describe("mapWithStaggeredConcurrency (TC-L)", () => {
  it("TC-L01/L02: caps concurrency and staggers starts", async () => {
    vi.useFakeTimers();
    const started: number[] = [];
    let inFlight = 0;
    let maxInFlight = 0;

    const delays: number[] = [];
    const delay = (ms: number) => {
      delays.push(ms);
      return new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      });
    };

    const work = mapWithStaggeredConcurrency(
      [0, 1, 2, 3, 4],
      SEARCH_INDEX_FETCH_CONCURRENCY,
      SEARCH_INDEX_FETCH_STAGGER_MS,
      async (item) => {
        started.push(item);
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise<void>((resolve) => setTimeout(resolve, 250));
        inFlight -= 1;
        return item;
      },
      delay,
    );

    // Advance enough for all staggered starts + work
    await vi.advanceTimersByTimeAsync(2000);
    const result = await work;

    expect(result).toEqual([0, 1, 2, 3, 4]);
    expect(delays).toEqual([0, 100, 200, 300, 400]);
    expect(maxInFlight).toBeLessThanOrEqual(SEARCH_INDEX_FETCH_CONCURRENCY);
    expect(maxInFlight).toBe(SEARCH_INDEX_FETCH_CONCURRENCY);

    vi.useRealTimers();
  });
});
