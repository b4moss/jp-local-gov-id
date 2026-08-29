import { filterByDesignatedCity } from "./designatedCity";
import {
  normalizeLookupCode,
  normalizeMunicipalityCode,
  normalizePrefectureCode,
  normalizeSearchText,
} from "./normalize";
import { codePointBigrams, codePointTrigrams } from "./searchNgrams";
import {
  querySearchIndex,
  unionSearchHits,
  type SearchIndexHit,
} from "./searchIndex";
import type { LocalGovStore } from "./store";
import type {
  ListMunicipalitiesOptions,
  LocalGov,
  LocalGovClient,
  MatchField,
  SearchOptions,
  SearchTarget,
} from "./types";

function resolvePrefectureCode(
  store: LocalGovStore,
  pref: string,
): string | null {
  const asCode = normalizePrefectureCode(pref);
  if (asCode && store.prefectureByCode.has(asCode)) return asCode;

  const byName = store.prefectureByName.get(pref);
  return byName?.code ?? null;
}

function matchesText(
  item: LocalGov,
  queryNormalized: string,
  matchField: MatchField,
  mode: "includes" | "equals",
): boolean {
  const check = (value: string): boolean => {
    const normalized = normalizeSearchText(value);
    return mode === "includes"
      ? normalized.includes(queryNormalized)
      : normalized === queryNormalized;
  };

  if (matchField === "name") return check(item.name);
  if (matchField === "nameKana") return check(item.nameKana);
  return check(item.name) || check(item.nameKana);
}

/** Current-compatible hit order: prefecture code, then entity code. */
function sortSearchHits(items: LocalGov[]): LocalGov[] {
  return [...items].sort((a, b) => {
    const aPref = a.code.length === 2 ? a.code : a.prefectureCode;
    const bPref = b.code.length === 2 ? b.code : b.prefectureCode;
    if (aPref !== bPref) return aPref.localeCompare(bPref);
    if (a.code.length !== b.code.length) return a.code.length - b.code.length;
    return a.code.localeCompare(b.code);
  });
}

async function collectPrefectureScoped(
  store: LocalGovStore,
  target: SearchTarget,
  prefectureCode: string,
): Promise<LocalGov[]> {
  const prefs =
    target === "cities"
      ? []
      : store.prefectures.filter((p) => p.code === prefectureCode);

  let munis: LocalGov[] = [];
  if (target === "all" || target === "cities") {
    await store.ensureMunicipalities([prefectureCode]);
    munis = [...(store.getMunicipalities(prefectureCode) ?? [])];
  }

  return [...prefs, ...munis];
}

async function collectPrefecturesOnly(store: LocalGovStore): Promise<LocalGov[]> {
  return [...store.prefectures];
}

async function collectNationwideViaIndex(
  store: LocalGovStore,
  target: SearchTarget,
  queryNormalized: string,
  matchField: MatchField,
  designatedCity: SearchOptions["designatedCity"],
  mode: "includes" | "equals",
): Promise<LocalGov[]> {
  const prefs =
    target === "cities"
      ? []
      : store.prefectures.filter((item) =>
          matchesText(item, queryNormalized, matchField, mode),
        );

  if (target === "prefectures") {
    return prefs;
  }

  const codePoints = Array.from(queryNormalized);
  if (codePoints.length < 2) {
    return sortSearchHits(prefs);
  }

  const needTwoGram = true;
  const needThreeGram = codePoints.length >= 3;

  const indexes = await store.ensureSearchIndexes({
    twoGram: needTwoGram,
    threeGram: needThreeGram,
  });

  const designated = designatedCity ?? "both";
  const hitGroups: SearchIndexHit[][] = [];

  if (indexes.twoGram) {
    const bigrams = codePointBigrams(queryNormalized);
    if (bigrams.length > 0) {
      hitGroups.push(
        querySearchIndex(indexes.twoGram, {
          grams: bigrams,
          matchField,
          designatedCity: designated,
        }),
      );
    }
  }

  if (indexes.threeGram) {
    const trigrams = codePointTrigrams(queryNormalized);
    if (trigrams.length > 0) {
      hitGroups.push(
        querySearchIndex(indexes.threeGram, {
          grams: trigrams,
          matchField,
          designatedCity: designated,
        }),
      );
    }
  }

  const hits = unionSearchHits(hitGroups);

  if (hits.length === 0) {
    return sortSearchHits(prefs);
  }

  const prefCodes = [...new Set(hits.map((h) => h.prefCode))];
  await store.ensureMunicipalities(prefCodes, { persist: false });

  const munis: LocalGov[] = [];
  for (const hit of hits) {
    const item = store.getMunicipalityByCode(hit.muniCode);
    if (!item) continue;
    if (!matchesText(item, queryNormalized, matchField, mode)) continue;
    munis.push(item);
  }

  const filteredMunis = filterByDesignatedCity(
    munis,
    designatedCity ?? "both",
  );

  return sortSearchHits([...prefs, ...filteredMunis]);
}

/** Build a client from an in-memory store (internal). */
export function buildLocalGovClient(store: LocalGovStore): LocalGovClient {
  return {
    listPrefectures(): LocalGov[] {
      return [...store.prefectures];
    },

    getPrefectureByCode(code: string): LocalGov | null {
      const normalized = normalizePrefectureCode(code);
      if (!normalized) return null;
      return store.prefectureByCode.get(normalized) ?? null;
    },

    getPrefectureCodeByName(name: string): string | null {
      return store.prefectureByName.get(name)?.code ?? null;
    },

    getMunicipalityCountByPrefecture(
      pref: string,
      options?: ListMunicipalitiesOptions,
    ): number | null {
      const code = resolvePrefectureCode(store, pref);
      if (!code) return null;
      const counts = store.prefectureByCode.get(code)?.municipalityCounts;
      if (!counts) return null;
      return counts[options?.designatedCity ?? "both"];
    },

    async listMunicipalitiesByPrefecture(
      pref: string,
      options?: ListMunicipalitiesOptions,
    ): Promise<LocalGov[]> {
      const code = resolvePrefectureCode(store, pref);
      if (!code) return [];
      await store.ensureMunicipalities([code]);
      const munis = [...(store.getMunicipalities(code) ?? [])];
      return filterByDesignatedCity(munis, options?.designatedCity ?? "both");
    },

    async getMunicipalityByCode(code: string): Promise<LocalGov | null> {
      const municipalityCode = normalizeMunicipalityCode(code);
      if (!municipalityCode) return null;

      const prefCode = municipalityCode.slice(0, 2);
      if (!store.prefectureByCode.has(prefCode)) return null;

      await store.ensureMunicipalities([prefCode]);
      return store.getMunicipalityByCode(municipalityCode) ?? null;
    },

    async getByCode(code: string): Promise<LocalGov | null> {
      const normalized = normalizeLookupCode(code);
      if (!normalized) return null;

      if (normalized.kind === "prefecture") {
        return store.prefectureByCode.get(normalized.code) ?? null;
      }

      const prefCode = normalized.code.slice(0, 2);
      if (!store.prefectureByCode.has(prefCode)) return null;

      await store.ensureMunicipalities([prefCode]);
      return store.getMunicipalityByCode(normalized.code) ?? null;
    },

    async searchByText(
      text: string,
      options?: SearchOptions,
    ): Promise<LocalGov[]> {
      const target = options?.target ?? "all";
      const matchField = options?.matchField ?? "both";
      const designatedCity = options?.designatedCity ?? "both";
      const prefectureCode = options?.prefecture
        ? resolvePrefectureCode(store, options.prefecture)
        : undefined;

      if (options?.prefecture && !prefectureCode) return [];

      const queryNormalized = normalizeSearchText(text);
      // Normalized empty or under 2 code points → empty (Issue #63)
      if (Array.from(queryNormalized).length < 2) return [];

      if (prefectureCode) {
        const items = await collectPrefectureScoped(
          store,
          target,
          prefectureCode,
        );
        return filterByDesignatedCity(items, designatedCity).filter((item) =>
          matchesText(item, queryNormalized, matchField, "includes"),
        );
      }

      if (target === "prefectures") {
        const items = await collectPrefecturesOnly(store);
        return items.filter((item) =>
          matchesText(item, queryNormalized, matchField, "includes"),
        );
      }

      return collectNationwideViaIndex(
        store,
        target,
        queryNormalized,
        matchField,
        designatedCity,
        "includes",
      );
    },

    async getLocalGovCodeByName(
      name: string,
      options?: SearchOptions,
    ): Promise<string | null> {
      const target = options?.target ?? "all";
      const matchField = options?.matchField ?? "both";
      const designatedCity = options?.designatedCity ?? "both";
      const prefectureCode = options?.prefecture
        ? resolvePrefectureCode(store, options.prefecture)
        : undefined;

      if (options?.prefecture && !prefectureCode) return null;

      const queryNormalized = normalizeSearchText(name);
      if (Array.from(queryNormalized).length < 2) return null;

      let matches: LocalGov[];

      if (prefectureCode) {
        const items = await collectPrefectureScoped(
          store,
          target,
          prefectureCode,
        );
        matches = filterByDesignatedCity(items, designatedCity).filter((item) =>
          matchesText(item, queryNormalized, matchField, "equals"),
        );
      } else if (target === "prefectures") {
        const items = await collectPrefecturesOnly(store);
        matches = items.filter((item) =>
          matchesText(item, queryNormalized, matchField, "equals"),
        );
      } else {
        matches = await collectNationwideViaIndex(
          store,
          target,
          queryNormalized,
          matchField,
          designatedCity,
          "equals",
        );
      }

      if (matches.length !== 1) return null;
      return matches[0]?.code ?? null;
    },
  };
}
