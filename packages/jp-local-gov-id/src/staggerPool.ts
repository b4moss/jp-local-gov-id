/** Nationwide search-index fetch concurrency (#63). */
export const SEARCH_INDEX_FETCH_CONCURRENCY = 3;

/** Delay between scheduled starts of search-index fetches (ms). */
export const SEARCH_INDEX_FETCH_STAGGER_MS = 100;

export type StaggerDelayFn = (ms: number) => Promise<void>;

const defaultDelay: StaggerDelayFn = (ms) =>
  ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run async work with max concurrency and staggered start times.
 * Item `i` is scheduled to start at `i * staggerMs` from the first call;
 * in-flight work never exceeds `concurrency`.
 */
export async function mapWithStaggeredConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  staggerMs: number,
  fn: (item: T, index: number) => Promise<R>,
  delay: StaggerDelayFn = defaultDelay,
): Promise<R[]> {
  if (items.length === 0) return [];

  const limit = Math.max(1, Math.min(concurrency, items.length));
  let active = 0;
  const results = new Array<R>(items.length);
  const waiters: Array<() => void> = [];

  function notify(): void {
    const w = waiters.shift();
    if (w) w();
  }

  async function acquire(): Promise<void> {
    if (active < limit) {
      active += 1;
      return;
    }
    await new Promise<void>((resolve) => {
      waiters.push(() => {
        active += 1;
        resolve();
      });
    });
  }

  function release(): void {
    active -= 1;
    notify();
  }

  await Promise.all(
    items.map(async (item, index) => {
      await delay(index * staggerMs);
      await acquire();
      try {
        results[index] = await fn(item, index);
      } finally {
        release();
      }
    }),
  );

  return results;
}
