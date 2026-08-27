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
  /** Present on prefecture records in `prefectures.json` only. */
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

export declare function loadMunicipalities(
  code: string,
): Promise<LocalGovMunicipalities>;

declare const dataset: {
  index: LocalGovIndex;
  prefectures: LocalGovPrefectures;
  municipalitiesByCode: Record<string, LocalGovMunicipalities>;
  loadMunicipalities: (code: string) => Promise<LocalGovMunicipalities>;
};

export default dataset;
