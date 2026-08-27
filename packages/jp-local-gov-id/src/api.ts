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
  prefectureCode?: string,
): Promise<LocalGov[]> {
  const prefs =
    target === "cities"
      ? []
      : prefectureCode
        ? store.prefectures.filter((p) => p.code === prefectureCode)
        : [...store.prefectures];

  let munis: LocalGov[] = [];
  if (needsMunicipalities(target)) {
    if (prefectureCode) {
      await store.ensureMunicipalities([prefectureCode]);
      munis = [...(store.getMunicipalities(prefectureCode) ?? [])];
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
      const items = await collectByTarget(
        store,
        target,
        prefectureCode ?? undefined,
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
      const prefectureCode = options?.prefecture
        ? resolvePrefectureCode(store, options.prefecture)
        : undefined;

      if (options?.prefecture && !prefectureCode) return null;

      const queryNormalized = normalizeSearchText(name);
      const items = await collectByTarget(
        store,
        target,
        prefectureCode ?? undefined,
      );
      const matches = filterByDesignatedCity(items, designatedCity).filter(
        (item) => matchesText(item, queryNormalized, matchField, "equals"),
      );

      if (matches.length !== 1) return null;
      return matches[0]?.code ?? null;
    },
  };
}
