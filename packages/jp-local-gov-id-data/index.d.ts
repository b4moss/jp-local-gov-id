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
    searchNgrams: string;
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
/** Raw JLIX bytes (`search-ngrams.bin`). */
export declare const searchNgrams: Uint8Array;

export declare function loadMunicipalities(
  code: string,
): Promise<LocalGovMunicipalities>;

declare const dataset: {
  index: LocalGovIndex;
  prefectures: LocalGovPrefectures;
  municipalitiesByCode: Record<string, LocalGovMunicipalities>;
  loadMunicipalities: (code: string) => Promise<LocalGovMunicipalities>;
  searchNgrams: Uint8Array;
};

export default dataset;
