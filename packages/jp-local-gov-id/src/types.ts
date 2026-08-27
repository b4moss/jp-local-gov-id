export type MunicipalityCounts = {
  both: number;
  city: number;
  ward: number;
};

/** Prefecture-as-local-gov. `code` is the 6-digit 地方公共団体コード. */
export type Prefecture = {
  code: string;
  name: string;
  nameKana: string;
  /** Present on prefecture records only (from `prefectures.json`). */
  municipalityCounts?: MunicipalityCounts;
};

/** Municipality (市区町村). Includes belonging prefecture fields. */
export type Municipality = {
  code: string;
  name: string;
  nameKana: string;
  prefectureCode: string;
  prefectureName: string;
  prefectureNameKana: string;
};

export type LocalGov = Prefecture | Municipality;

export type SearchTarget = "all" | "prefectures" | "cities";

export type MatchField = "name" | "nameKana" | "both";

/**
 * How to include designated cities (政令指定都市) and their wards.
 * - both: city body and wards (default)
 * - city: city body only (exclude wards like 札幌市中央区)
 * - ward: wards only (exclude city bodies like 札幌市)
 *
 * Tokyo special wards (千代田区 etc.) are not affected.
 */
export type DesignatedCityMode = "both" | "city" | "ward";

export type ListMunicipalitiesOptions = {
  /** Default: "both" */
  designatedCity?: DesignatedCityMode;
};

export type SearchOptions = {
  prefecture?: string;
  target?: SearchTarget;
  /** Default: "both" */
  matchField?: MatchField;
  /** Default: "both" */
  designatedCity?: DesignatedCityMode;
};

/** Index file (`index.json`) */
export type LocalGovIndexFile = {
  schemaVersion: number;
  source?: string;
  asOf?: string;
  generatedAt?: string;
  counts?: {
    prefectures?: number;
    municipalities?: number;
    designatedCityWardsAdded?: number;
  };
  paths: {
    prefectures: string;
    municipalitiesByPrefecture: string;
  };
  /** 2-digit prefecture codes (`"01"` … `"47"`). */
  prefectureCodes: string[];
};

/** Prefectures-only file (`prefectures.json`) */
export type LocalGovPrefecturesFile = {
  schemaVersion: number;
  asOf?: string;
  prefectures: Prefecture[];
};

/** Per-prefecture municipalities file (`prefectures/{code}.json`) */
export type LocalGovMunicipalitiesFile = {
  schemaVersion: number;
  asOf?: string;
  prefectureCode: string;
  municipalities: Municipality[];
};

/**
 * In-memory / npm dataset passed to `createLocalGovClient({ data })`.
 * Municipalities are resolved via `municipalitiesByCode` and/or `loadMunicipalities`.
 */
export type LocalGovDataset = {
  index: LocalGovIndexFile | unknown;
  prefectures: LocalGovPrefecturesFile | unknown;
  municipalitiesByCode?: Record<string, LocalGovMunicipalitiesFile | unknown>;
  loadMunicipalities?: (
    code: string,
  ) =>
    | LocalGovMunicipalitiesFile
    | unknown
    | Promise<LocalGovMunicipalitiesFile | unknown>;
};

export type CreateLocalGovCacheOptions = {
  /**
   * Whether to use localStorage cache for `url` mode.
   * Default: `true`. Ignored when using `data` (no URL fetch cache).
   */
  cache?: boolean;
  /**
   * Cache TTL in seconds for `url` mode.
   * Default: `31536000` (1 year). Ignored when `cache` is `false` or using `data`.
   */
  cacheTtlSeconds?: number;
};

export type CreateLocalGovOptions =
  | ({ data: LocalGovDataset | unknown; url?: never } & CreateLocalGovCacheOptions)
  | ({ url: string; data?: never } & CreateLocalGovCacheOptions);

export type LocalGovClient = {
  listPrefectures(): Prefecture[];
  getPrefectureByCode(code: string): Prefecture | null;
  /** Returns 2-digit prefecture code (not 地方公共団体コード). */
  getPrefectureCodeByName(name: string): string | null;
  /**
   * Sync count from prefecture `municipalityCounts` (no municipality file load).
   * `pref` accepts code or name. Unknown prefecture → `null`.
   * Default designatedCity: `"both"`.
   */
  getMunicipalityCountByPrefecture(
    pref: string,
    options?: ListMunicipalitiesOptions,
  ): number | null;
  listMunicipalitiesByPrefecture(
    pref: string,
    options?: ListMunicipalitiesOptions,
  ): Promise<Municipality[]>;
  getMunicipalityByCode(code: string): Promise<Municipality | null>;
  getByCode(code: string): Promise<LocalGov | null>;
  searchByText(text: string, options?: SearchOptions): Promise<LocalGov[]>;
  getLocalGovCodeByName(
    name: string,
    options?: SearchOptions,
  ): Promise<string | null>;
};

/** @deprecated Use LocalGovIndexFile / split file types. Kept for export compatibility. */
export type LocalGovDataFile = LocalGovDataset;

/** 2-digit organizational key derived from a prefecture entity code. */
export function prefectureOrgCode(prefecture: Prefecture): string {
  return prefecture.code.slice(0, 2);
}

export function isMunicipality(value: LocalGov): value is Municipality {
  return "prefectureCode" in value;
}

export function isPrefecture(value: LocalGov): value is Prefecture {
  return !("prefectureCode" in value);
}
