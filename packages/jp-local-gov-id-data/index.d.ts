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
  /** Present on prefecture records in decoded `prefectures.bin` only. */
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

export type SearchNgramsPathSpec = {
  twoGram: {
    regions: string[];
    pattern: string;
  };
  threeGram: {
    shardCount: number;
    pattern: string;
  };
};

export type LocalGovIndex = {
  schemaVersion: number;
  source: string;
  asOf: string;
  generatedAt: string;
  counts: {
    prefectures: number;
    municipalities: number;
    designatedCityWardsAdded: number;
  };
  paths: {
    prefectures: string;
    municipalitiesByPrefecture: string;
    searchNgrams: SearchNgramsPathSpec;
  };
  /** 2-digit prefecture codes (`"01"` … `"47"`). */
  prefectureCodes: string[];
};

export type LocalGovPrefectures = {
  schemaVersion: number;
  asOf: string;
  prefectures: Prefecture[];
};

export type LocalGovMunicipalities = {
  schemaVersion: number;
  asOf: string;
  prefectureCode: string;
  municipalities: Municipality[];
};

export declare const index: LocalGovIndex;
export declare const prefectures: LocalGovPrefectures;
export declare const municipalitiesByCode: Record<
  string,
  LocalGovMunicipalities
>;
/** Raw JLIX partition bytes keyed by 2-gram region id or 3-gram shard id. */
export declare const searchNgramShards: Record<string, Uint8Array>;

export declare function loadMunicipalities(
  code: string,
): Promise<LocalGovMunicipalities>;

declare const dataset: {
  index: LocalGovIndex;
  prefectures: LocalGovPrefectures;
  municipalitiesByCode: Record<string, LocalGovMunicipalities>;
  loadMunicipalities: (code: string) => Promise<LocalGovMunicipalities>;
  searchNgramShards: Record<string, Uint8Array>;
};

export default dataset;
