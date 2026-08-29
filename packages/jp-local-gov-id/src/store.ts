import {
  MUNICIPALITY_FETCH_CONCURRENCY,
  mapWithConcurrency,
} from "./pool";
import type { SearchIndex } from "./searchIndex";
import type { LocalGov, LocalGovIndexFile } from "./types";

export type LoadMunicipalitiesOptions = {
  /** When false, URL fetches skip localStorage writes. Default true. */
  persist?: boolean;
};

export type LoadMunicipalitiesFn = (
  code: string,
  options?: LoadMunicipalitiesOptions,
) => Promise<readonly LocalGov[]>;

export type EnsureSearchIndexesNeed = {
  twoGram: boolean;
  threeGram: boolean;
};

export type SearchIndexes = {
  twoGram: SearchIndex | null;
  threeGram: SearchIndex | null;
};

export type EnsureSearchIndexesFn = (
  need: EnsureSearchIndexesNeed,
) => Promise<SearchIndexes>;

export type LocalGovStore = {
  index: LocalGovIndexFile;
  prefectures: readonly LocalGov[];
  prefectureByCode: ReadonlyMap<string, LocalGov>;
  prefectureByName: ReadonlyMap<string, LocalGov>;
  /** Prefetchures file asOf (for JLIX mismatch warn). */
  prefecturesAsOf?: string;
  ensureMunicipalities: (
    codes: readonly string[],
    options?: LoadMunicipalitiesOptions,
  ) => Promise<void>;
  getMunicipalities: (code: string) => readonly LocalGov[] | undefined;
  getMunicipalityByCode: (code: string) => LocalGov | undefined;
  allPrefectureCodes: readonly string[];
  /** Load / return hybrid JLIX indexes covering the requested layers. */
  ensureSearchIndexes: EnsureSearchIndexesFn;
};

export function createStore(
  index: LocalGovIndexFile,
  prefectures: readonly LocalGov[],
  loadMunicipalities: LoadMunicipalitiesFn,
  ensureSearchIndexes: EnsureSearchIndexesFn,
  options?: { prefecturesAsOf?: string },
): LocalGovStore {
  const prefectureByCode = new Map(
    prefectures.map((p) => [p.code, p] as const),
  );
  const prefectureByName = new Map(
    prefectures.map((p) => [p.name, p] as const),
  );

  const municipalitiesByPrefectureCode = new Map<string, readonly LocalGov[]>();
  const municipalityByCode = new Map<string, LocalGov>();
  const inFlight = new Map<string, Promise<void>>();

  const allPrefectureCodes =
    index.prefectureCodes.length > 0
      ? index.prefectureCodes
      : prefectures.map((p) => p.code);

  async function loadOne(
    code: string,
    options?: LoadMunicipalitiesOptions,
  ): Promise<void> {
    if (municipalitiesByPrefectureCode.has(code)) return;

    const existing = inFlight.get(code);
    if (existing) {
      await existing;
      return;
    }

    const promise = (async () => {
      const list = await loadMunicipalities(code, options);
      municipalitiesByPrefectureCode.set(code, list);
      for (const m of list) {
        municipalityByCode.set(m.code, m);
      }
    })().finally(() => {
      inFlight.delete(code);
    });

    inFlight.set(code, promise);
    await promise;
  }

  async function ensureMunicipalities(
    codes: readonly string[],
    options?: LoadMunicipalitiesOptions,
  ): Promise<void> {
    const needed = codes.filter((c) => !municipalitiesByPrefectureCode.has(c));
    if (needed.length === 0) return;

    await mapWithConcurrency(
      needed,
      MUNICIPALITY_FETCH_CONCURRENCY,
      async (code) => {
        await loadOne(code, options);
      },
    );
  }

  return {
    index,
    prefectures,
    prefectureByCode,
    prefectureByName,
    prefecturesAsOf: options?.prefecturesAsOf,
    ensureMunicipalities,
    getMunicipalities: (code) => municipalitiesByPrefectureCode.get(code),
    getMunicipalityByCode: (code) => municipalityByCode.get(code),
    allPrefectureCodes,
    ensureSearchIndexes,
  };
}
