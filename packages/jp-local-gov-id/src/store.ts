import {
  MUNICIPALITY_FETCH_CONCURRENCY,
  mapWithConcurrency,
} from "./pool";
import type { SearchIndex } from "./searchIndex";
import type {
  LocalGovIndexFile,
  Municipality,
  Prefecture,
} from "./types";
import { prefectureOrgCode } from "./types";

export type LoadMunicipalitiesOptions = {
  /** When false, URL fetches skip localStorage writes. Default true. */
  persist?: boolean;
};

export type LoadMunicipalitiesFn = (
  code: string,
  options?: LoadMunicipalitiesOptions,
) => Promise<readonly Municipality[]>;

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
  prefectures: readonly Prefecture[];
  /** Keyed by 2-digit prefecture (organizational) code. */
  prefectureByOrgCode: ReadonlyMap<string, Prefecture>;
  /** Keyed by 6-digit 地方公共団体コード. */
  prefectureByEntityCode: ReadonlyMap<string, Prefecture>;
  prefectureByName: ReadonlyMap<string, Prefecture>;
  /** Prefectures file asOf (for JLIX mismatch warn). */
  prefecturesAsOf?: string;
  ensureMunicipalities: (
    codes: readonly string[],
    options?: LoadMunicipalitiesOptions,
  ) => Promise<void>;
  getMunicipalities: (code: string) => readonly Municipality[] | undefined;
  getMunicipalityByCode: (code: string) => Municipality | undefined;
  allPrefectureCodes: readonly string[];
  /** Load / return hybrid JLIX indexes covering the requested layers. */
  ensureSearchIndexes: EnsureSearchIndexesFn;
};

export function createStore(
  index: LocalGovIndexFile,
  prefectures: readonly Prefecture[],
  loadMunicipalities: LoadMunicipalitiesFn,
  ensureSearchIndexes: EnsureSearchIndexesFn,
  options?: { prefecturesAsOf?: string },
): LocalGovStore {
  const prefectureByOrgCode = new Map(
    prefectures.map((p) => [prefectureOrgCode(p), p] as const),
  );
  const prefectureByEntityCode = new Map(
    prefectures.map((p) => [p.code, p] as const),
  );
  const prefectureByName = new Map(
    prefectures.map((p) => [p.name, p] as const),
  );

  const municipalitiesByPrefectureCode = new Map<
    string,
    readonly Municipality[]
  >();
  const municipalityByCode = new Map<string, Municipality>();
  const inFlight = new Map<string, Promise<void>>();

  const allPrefectureCodes =
    index.prefectureCodes.length > 0
      ? index.prefectureCodes
      : prefectures.map((p) => prefectureOrgCode(p));

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
    prefectureByOrgCode,
    prefectureByEntityCode,
    prefectureByName,
    prefecturesAsOf: options?.prefecturesAsOf,
    ensureMunicipalities,
    getMunicipalities: (code) => municipalitiesByPrefectureCode.get(code),
    getMunicipalityByCode: (code) => municipalityByCode.get(code),
    allPrefectureCodes,
    ensureSearchIndexes,
  };
}
