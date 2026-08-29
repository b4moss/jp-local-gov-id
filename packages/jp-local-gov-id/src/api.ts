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
  Municipality,
  Prefecture,
  SearchOptions,
  SearchTarget,
} from "./types";
import { isPrefecture, prefectureOrgCode } from "./types";

/** Resolve to 2-digit organizational prefecture code. */
function resolvePrefectureOrgCode(
  store: LocalGovStore,
  pref: string,
): string | null {
  const asOrg = normalizePrefectureCode(pref);
  if (asOrg && store.prefectureByOrgCode.has(asOrg)) return asOrg;

  const asEntity = normalizeMunicipalityCode(pref);
  if (asEntity) {
    const byEntity = store.prefectureByEntityCode.get(asEntity);
    if (byEntity) return prefectureOrgCode(byEntity);
  }

  const byName = store.prefectureByName.get(pref);
  return byName ? prefectureOrgCode(byName) : null;
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

/** Current-compatible hit order: prefecture org code, then entity code. */
function sortSearchHits(items: LocalGov[]): LocalGov[] {
  return [...items].sort((a, b) => {
    const aPref = isPrefecture(a) ? prefectureOrgCode(a) : a.prefectureCode;
    const bPref = isPrefecture(b) ? prefectureOrgCode(b) : b.prefectureCode;
    if (aPref !== bPref) return aPref.localeCompare(bPref);
    if (a.code.length !== b.code.length) return a.code.length - b.code.length;
    return a.code.localeCompare(b.code);
  });
}

async function collectPrefectureScoped(
  store: LocalGovStore,
  target: SearchTarget,
  prefectureOrg: string,
): Promise<LocalGov[]> {
  const prefs: Prefecture[] =
    target === "cities"
      ? []
      : store.prefectures.filter((p) => prefectureOrgCode(p) === prefectureOrg);

  let munis: Municipality[] = [];
  if (target === "all" || target === "cities") {
    await store.ensureMunicipalities([prefectureOrg]);
    munis = [...(store.getMunicipalities(prefectureOrg) ?? [])];
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

  const munis: Municipality[] = [];
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
    listPrefectures(): Prefecture[] {
      return [...store.prefectures];
    },

    getPrefectureByCode(code: string): Prefecture | null {
      const asOrg = normalizePrefectureCode(code);
      if (asOrg) return store.prefectureByOrgCode.get(asOrg) ?? null;

      const asEntity = normalizeMunicipalityCode(code);
      if (asEntity) return store.prefectureByEntityCode.get(asEntity) ?? null;

      return null;
    },

    getPrefectureCodeByName(name: string): string | null {
      const pref = store.prefectureByName.get(name);
      return pref ? prefectureOrgCode(pref) : null;
    },

    getMunicipalityCountByPrefecture(
      pref: string,
      options?: ListMunicipalitiesOptions,
    ): number | null {
      const orgCode = resolvePrefectureOrgCode(store, pref);
      if (!orgCode) return null;
      const counts = store.prefectureByOrgCode.get(orgCode)?.municipalityCounts;
      if (!counts) return null;
      return counts[options?.designatedCity ?? "both"];
    },

    async listMunicipalitiesByPrefecture(
      pref: string,
      options?: ListMunicipalitiesOptions,
    ): Promise<Municipality[]> {
      const orgCode = resolvePrefectureOrgCode(store, pref);
      if (!orgCode) return [];
      await store.ensureMunicipalities([orgCode]);
      const munis = [...(store.getMunicipalities(orgCode) ?? [])];
      return filterByDesignatedCity(munis, options?.designatedCity ?? "both");
    },

    async getMunicipalityByCode(code: string): Promise<Municipality | null> {
      const municipalityCode = normalizeMunicipalityCode(code);
      if (!municipalityCode) return null;

      // Prefecture entity codes are 6-digit but not municipalities.
      if (store.prefectureByEntityCode.has(municipalityCode)) return null;

      const prefCode = municipalityCode.slice(0, 2);
      if (!store.prefectureByOrgCode.has(prefCode)) return null;

      await store.ensureMunicipalities([prefCode]);
      return store.getMunicipalityByCode(municipalityCode) ?? null;
    },

    async getByCode(code: string): Promise<LocalGov | null> {
      const normalized = normalizeLookupCode(code);
      if (!normalized) return null;

      if (normalized.kind === "prefecture") {
        return store.prefectureByOrgCode.get(normalized.code) ?? null;
      }

      const entityPref = store.prefectureByEntityCode.get(normalized.code);
      if (entityPref) return entityPref;

      const prefCode = normalized.code.slice(0, 2);
      if (!store.prefectureByOrgCode.has(prefCode)) return null;

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
      const prefectureOrg = options?.prefecture
        ? resolvePrefectureOrgCode(store, options.prefecture)
        : undefined;

      if (options?.prefecture && !prefectureOrg) return [];

      const queryNormalized = normalizeSearchText(text);
      // Normalized empty or under 2 code points → empty (Issue #63)
      if (Array.from(queryNormalized).length < 2) return [];

      if (prefectureOrg) {
        const items = await collectPrefectureScoped(
          store,
          target,
          prefectureOrg,
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
      const prefectureOrg = options?.prefecture
        ? resolvePrefectureOrgCode(store, options.prefecture)
        : undefined;

      if (options?.prefecture && !prefectureOrg) return null;

      const queryNormalized = normalizeSearchText(name);
      if (Array.from(queryNormalized).length < 2) return null;

      let matches: LocalGov[];

      if (prefectureOrg) {
        const items = await collectPrefectureScoped(
          store,
          target,
          prefectureOrg,
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
