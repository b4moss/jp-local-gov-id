import { filterByDesignatedCity } from "./designatedCity";
import { normalizeSearchText } from "./normalize";
import { codePointBigrams, codePointTrigrams } from "./searchNgrams";
import {
  querySearchIndex,
  unionSearchHits,
  type SearchIndexHit,
} from "./searchIndex";
import type { LocalGovStore } from "./store";
import type {
  LocalGov,
  MatchField,
  Municipality,
  SearchOptions,
  SearchTarget,
} from "./types";
import { isPrefecture, prefectureOrgCode } from "./types";

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

export async function collectNationwideViaIndex(
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

