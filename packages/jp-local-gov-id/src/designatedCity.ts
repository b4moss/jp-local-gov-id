import type { DesignatedCityMode, LocalGov } from "./types";

/** Designated-city ward: e.g. 札幌市中央区 (not Tokyo special wards like 千代田区). */
const DESIGNATED_CITY_WARD_RE = /^.+市.+区$/;

export function isDesignatedCityWard(name: string): boolean {
  return DESIGNATED_CITY_WARD_RE.test(name);
}

/** Extract city body name from a ward name (e.g. 札幌市中央区 → 札幌市). */
export function designatedCityBodyNameFromWard(wardName: string): string | null {
  if (!isDesignatedCityWard(wardName)) return null;
  const idx = wardName.indexOf("市");
  if (idx < 0) return null;
  return wardName.slice(0, idx + 1);
}

/**
 * Filter municipalities by designated-city mode.
 * - both: no filter (default)
 * - city: exclude designated-city wards
 * - ward: exclude designated-city bodies (exact name match to ward prefixes)
 *
 * Towns, regular cities, and Tokyo special wards are kept in all modes.
 * Prefecture records (2-digit codes) are never filtered.
 */
export function filterByDesignatedCity(
  items: LocalGov[],
  mode: DesignatedCityMode = "both",
): LocalGov[] {
  if (mode === "both") return items;

  const municipalities = items.filter((item) => item.code.length === 6);
  const bodyNames = new Set<string>();
  for (const item of municipalities) {
    const body = designatedCityBodyNameFromWard(item.name);
    if (body) bodyNames.add(body);
  }

  return items.filter((item) => {
    if (item.code.length !== 6) return true;

    if (mode === "city") {
      return !isDesignatedCityWard(item.name);
    }

    // mode === "ward"
    return !bodyNames.has(item.name);
  });
}
