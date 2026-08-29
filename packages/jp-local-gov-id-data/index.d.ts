export type MunicipalityCounts = {
  both: number;
  city: number;
  ward: number;
};

export type LocalGov = {
  code: string;
  name: string;
  nameKana: string;
  prefectureCode: string;
  prefectureName: string;
  prefectureNameKana: string;
  /** Present on prefecture records in `prefectures.bin` (decoded) only. */
  municipalityCounts?: MunicipalityCounts;
};

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
  prefectureCodes: string[];
};

export type LocalGovPrefectures = {
  schemaVersion: number;
  asOf: string;
  prefectures: LocalGov[];
};

export type LocalGovMunicipalities = {
  schemaVersion: number;
  asOf: string;
  prefectureCode: string;
  municipalities: LocalGov[];
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
