import { filterByDesignatedCity } from "./designatedCity";
import {
  normalizeLookupCode,
  normalizeMunicipalityCode,
  normalizePrefectureCode,
  normalizeSearchText,
} from "./normalize";
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
import { prefectureOrgCode } from "./types";

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

function needsMunicipalities(target: SearchTarget): boolean {
  return target === "all" || target === "cities";
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

async function collectByTarget(
  store: LocalGovStore,
  target: SearchTarget,
  prefectureOrg?: string,
): Promise<LocalGov[]> {
  const prefs: Prefecture[] =
    target === "cities"
      ? []
      : prefectureOrg
        ? store.prefectures.filter((p) => prefectureOrgCode(p) === prefectureOrg)
        : [...store.prefectures];

  let munis: Municipality[] = [];
  if (needsMunicipalities(target)) {
    if (prefectureOrg) {
      await store.ensureMunicipalities([prefectureOrg]);
      munis = [...(store.getMunicipalities(prefectureOrg) ?? [])];
    } else {
      // Nationwide search: keep in memory only; do not write localStorage
      await store.ensureMunicipalities(store.allPrefectureCodes, {
        persist: false,
      });
      munis = store.allPrefectureCodes.flatMap(
        (code) => store.getMunicipalities(code) ?? [],
      );
    }
  }

  return [...prefs, ...munis];
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
      const items = await collectByTarget(
        store,
        target,
        prefectureOrg ?? undefined,
      );
      return filterByDesignatedCity(items, designatedCity).filter((item) =>
        matchesText(item, queryNormalized, matchField, "includes"),
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
      const items = await collectByTarget(
        store,
        target,
        prefectureOrg ?? undefined,
      );
      const matches = filterByDesignatedCity(items, designatedCity).filter(
        (item) => matchesText(item, queryNormalized, matchField, "equals"),
      );

      if (matches.length !== 1) return null;
      return matches[0]?.code ?? null;
    },
  };
}
