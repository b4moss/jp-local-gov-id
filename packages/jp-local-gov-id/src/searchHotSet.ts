import {
  designatedCityBodyNameFromWard,
  isDesignatedCityWard,
} from "./designatedCity";

/** 2-gram region ids (index.json `twoGram.regions` / file names). */
export const TWO_GRAM_REGIONS = [
  "tokyo",
  "kanagawa",
  "saitama",
  "chiba",
  "osaka",
  "chukyo",
  "hyogo",
  "kyoto",
  "fukuoka",
  "designated-other",
] as const;

export type TwoGramRegion = (typeof TWO_GRAM_REGIONS)[number];

/** Prefectures: every municipality is hot (2-gram). */
const FULL_PREF_CODES = new Set(["11", "13", "14", "27"]);

/** Prefectures: all `市` (non-ward) are hot. */
const ALL_CITIES_PREF_CODES = new Set(["21", "23", "24", "28", "40"]);

/** Kyoto southern cities (plus Kyoto city via designated-city rules). */
const KYOTO_SOUTH_CITIES = new Set([
  "宇治市",
  "城陽市",
  "向日市",
  "長岡京市",
  "八幡市",
  "京田辺市",
  "木津川市",
  "亀岡市",
]);

/** Chiba western cities (plus Chiba city via designated-city rules). */
const CHIBA_WEST_CITIES = new Set([
  "市川市",
  "船橋市",
  "松戸市",
  "野田市",
  "習志野市",
  "柏市",
  "流山市",
  "八千代市",
  "我孫子市",
  "鎌ケ谷市",
  "浦安市",
  "四街道市",
  "印西市",
  "白井市",
]);

export type HotSetInput = {
  code: string;
  name: string;
  prefectureCode: string;
  /** Designated-city body flag from wardFlags. */
  hasWard: 0 | 1;
  /** Designated-city ward flag. */
  isWard: 0 | 1;
};

function isPlainCity(name: string): boolean {
  return name.endsWith("市") && !isDesignatedCityWard(name);
}

/** Tokyo special wards (千代田区 etc.): 区 without 市…区 pattern. */
function isTokyoSpecialWard(name: string, prefectureCode: string): boolean {
  return (
    prefectureCode === "13" &&
    name.endsWith("区") &&
    !isDesignatedCityWard(name)
  );
}

/**
 * Whether this municipality is indexed with 2-grams (hot).
 * Prefectures are never hot (linear search only).
 */
export function isHotMunicipality(m: HotSetInput): boolean {
  const pref = m.prefectureCode.padStart(2, "0");

  if (FULL_PREF_CODES.has(pref)) return true;

  if (m.hasWard === 1 || m.isWard === 1) return true;
  if (isTokyoSpecialWard(m.name, pref)) return true;
  // Defensive: ward name pattern even if flags missing
  if (isDesignatedCityWard(m.name)) return true;
  if (designatedCityBodyNameFromWard(m.name)) return true;

  if (ALL_CITIES_PREF_CODES.has(pref) && isPlainCity(m.name)) return true;

  if (pref === "26" && KYOTO_SOUTH_CITIES.has(m.name)) return true;
  if (pref === "12" && CHIBA_WEST_CITIES.has(m.name)) return true;

  return false;
}

/**
 * Assign a unique 2-gram region for a hot municipality.
 * Cold municipalities → null.
 */
export function assignTwoGramRegion(m: HotSetInput): TwoGramRegion | null {
  if (!isHotMunicipality(m)) return null;

  const pref = m.prefectureCode.padStart(2, "0");

  if (pref === "13") return "tokyo";
  if (pref === "14") return "kanagawa";
  if (pref === "11") return "saitama";
  if (pref === "27") return "osaka";
  if (pref === "12") return "chiba";
  if (pref === "23" || pref === "24" || pref === "21") return "chukyo";
  if (pref === "28") return "hyogo";
  if (pref === "26") return "kyoto";
  if (pref === "40") return "fukuoka";

  return "designated-other";
}
