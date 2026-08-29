import { decodeSearchNgrams, LocalGovBinaryError } from "./binary";
import { LocalGovSchemaError } from "./schema";
import {
  buildSearchIndex,
  mergeSearchIndexes,
  toArrayBuffer,
  warnSearchIndexAsOfMismatch,
  type SearchIndex,
} from "./searchIndex";
import { allThreeGramShardIds } from "./searchNgrams";
import {
  mapWithStaggeredConcurrency,
  SEARCH_INDEX_FETCH_CONCURRENCY,
  SEARCH_INDEX_FETCH_STAGGER_MS,
  type StaggerDelayFn,
} from "./staggerPool";
import type {
  EnsureSearchIndexesFn,
  EnsureSearchIndexesNeed,
  SearchIndexes,
} from "./store";
import type { SearchNgramsPathSpec } from "./types";

export function twoGramPartitionPath(
  spec: SearchNgramsPathSpec,
  region: string,
): string {
  return spec.twoGram.pattern.replaceAll("{region}", region);
}

export function threeGramPartitionPath(
  spec: SearchNgramsPathSpec,
  shardId: string,
): string {
  return spec.threeGram.pattern.replaceAll("{shard}", shardId);
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

export type CreateHybridSearchIndexLoaderOptions = {
  spec: SearchNgramsPathSpec;
  prefecturesAsOf?: string;
  /** Load raw (possibly still compressed if caller decompresses) JLIX bytes. */
  loadPartitionBytes: (relativePath: string) => Promise<ArrayBuffer>;
  delay?: StaggerDelayFn;
  /**
   * When true, first ensure that needs a layer loads every partition of that
   * layer (Node/`data` eager). When false, still loads all partitions of the
   * requested layers (regions cannot be filtered by query).
   */
  eagerAllOnFirstUse?: boolean;
};

/**
 * Hybrid JLIX loader: staggered concurrent fetch of 2-gram regions and/or
 * 3-gram shards, memory-cached per partition.
 */
export function createHybridSearchIndexLoader(
  options: CreateHybridSearchIndexLoaderOptions,
): EnsureSearchIndexesFn {
  const partitionCache = new Map<string, SearchIndex>();
  const partitionInFlight = new Map<string, Promise<SearchIndex>>();
  let warnedAsOf = false;

  async function loadPartition(
    cacheKey: string,
    relativePath: string,
  ): Promise<SearchIndex> {
    const cached = partitionCache.get(cacheKey);
    if (cached) return cached;

    const pending = partitionInFlight.get(cacheKey);
    if (pending) return pending;

    const promise = (async () => {
      const buffer = await options.loadPartitionBytes(relativePath);
      const built = decodeSearchIndexBytes(buffer);
      if (!warnedAsOf) {
        warnSearchIndexAsOfMismatch(built.asOf, options.prefecturesAsOf);
        warnedAsOf = true;
      }
      partitionCache.set(cacheKey, built);
      return built;
    })().finally(() => {
      partitionInFlight.delete(cacheKey);
    });

    partitionInFlight.set(cacheKey, promise);
    return promise;
  }

  async function loadPartitions(
    jobs: readonly { cacheKey: string; relativePath: string }[],
  ): Promise<SearchIndex[]> {
    if (jobs.length === 0) return [];
    return mapWithStaggeredConcurrency(
      jobs,
      SEARCH_INDEX_FETCH_CONCURRENCY,
      SEARCH_INDEX_FETCH_STAGGER_MS,
      async (job) => loadPartition(job.cacheKey, job.relativePath),
      options.delay,
    );
  }

  return async (need: EnsureSearchIndexesNeed): Promise<SearchIndexes> => {
    const jobs: { cacheKey: string; relativePath: string }[] = [];

    if (need.twoGram) {
      for (const region of options.spec.twoGram.regions) {
        jobs.push({
          cacheKey: `2:${region}`,
          relativePath: twoGramPartitionPath(options.spec, region),
        });
      }
    }
    if (need.threeGram) {
      for (const shardId of allThreeGramShardIds(options.spec.threeGram.shardCount)) {
        jobs.push({
          cacheKey: `3:${shardId}`,
          relativePath: threeGramPartitionPath(options.spec, shardId),
        });
      }
    }

    // Skip already-cached partitions from the staggered queue (still correct;
    // cached loads are sync-fast via loadPartition).
    const toFetch = jobs.filter((j) => !partitionCache.has(j.cacheKey));
    if (toFetch.length > 0) {
      await loadPartitions(toFetch);
    }

    // Ensure any race still resolves
    await Promise.all(
      jobs.map((j) => loadPartition(j.cacheKey, j.relativePath)),
    );

    const twoParts = need.twoGram
      ? options.spec.twoGram.regions.map(
          (r) => partitionCache.get(`2:${r}`)!,
        )
      : [];
    const threeParts = need.threeGram
      ? allThreeGramShardIds(options.spec.threeGram.shardCount).map(
          (s) => partitionCache.get(`3:${s}`)!,
        )
      : [];

    return {
      twoGram: need.twoGram ? mergeSearchIndexes(twoParts) : null,
      threeGram: need.threeGram ? mergeSearchIndexes(threeParts) : null,
    };
  };
}

/** Build loader that reads from an in-memory shard map (dataset mode). */
export function createDatasetSearchIndexLoader(options: {
  spec: SearchNgramsPathSpec;
  prefecturesAsOf?: string;
  shards: Record<string, ArrayBuffer | Uint8Array>;
}): EnsureSearchIndexesFn {
  return createHybridSearchIndexLoader({
    spec: options.spec,
    prefecturesAsOf: options.prefecturesAsOf,
    loadPartitionBytes: async (relativePath) => {
      // Dataset keys are partition ids (region or shard), not full paths.
      const regionMatch = relativePath.match(
        /search-ngrams\/2gram\/([^/]+)\.bin(?:\.br)?$/,
      );
      if (regionMatch) {
        const key = regionMatch[1]!;
        const bytes = options.shards[key];
        if (!bytes) {
          throw new LocalGovSchemaError(
            `Dataset searchNgramShards missing 2-gram region "${key}"`,
          );
        }
        return toArrayBuffer(bytes);
      }
      const shardMatch = relativePath.match(
        /search-ngrams\/3gram\/([^/]+)\.bin(?:\.br)?$/,
      );
      if (shardMatch) {
        const key = shardMatch[1]!;
        const bytes = options.shards[key];
        if (!bytes) {
          throw new LocalGovSchemaError(
            `Dataset searchNgramShards missing 3-gram shard "${key}"`,
          );
        }
        return toArrayBuffer(bytes);
      }
      throw new LocalGovSchemaError(
        `Unrecognized search index path for dataset: ${relativePath}`,
      );
    },
    // Dataset reads are local — no network stagger needed, but keep semantics.
    delay: async () => {},
  });
}
