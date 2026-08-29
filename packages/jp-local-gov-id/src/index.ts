export type {
  CreateLocalGovCacheOptions,
  CreateLocalGovOptions,
  DesignatedCityMode,
  ListMunicipalitiesOptions,
  LocalGov,
  LocalGovClient,
  LocalGovDataFile,
  LocalGovDataset,
  LocalGovIndexFile,
  LocalGovMunicipalitiesFile,
  LocalGovPrefecturesFile,
  MatchField,
  MunicipalityCounts,
  SearchOptions,
  SearchTarget,
} from "./types";
export { createLocalGovClient } from "./create";
export {
  CACHE_TTL_MS,
  DEFAULT_CACHE_TTL_SECONDS,
} from "./cache";
export {
  LOCAL_GOV_SCHEMA_VERSION,
  LocalGovSchemaError,
} from "./schema";
export { MUNICIPALITY_FETCH_CONCURRENCY } from "./pool";
export {
  BINARY_FORMAT_VERSION,
  DECODED_SCHEMA_VERSION,
  LocalGovBinaryError,
  MAGIC_JLDT,
  MAGIC_JLIX,
  MAGIC_JLPR,
  MUNICIPALITY_RECORD_SIZE,
  NGRAM_POSTING_RECORD_SIZE,
  PREFECTURE_RECORD_SIZE,
  decodeMunicipalities,
  decodeMunicipalitiesFile,
  decodePrefectures,
  decodePrefecturesFile,
  decodeSearchNgrams,
  encodeMunicipalities,
  encodePrefectures,
  encodeSearchNgrams,
  prefectureCodeFromMunicipalityCode,
} from "./binary";
export type {
  MunicipalityBinRecord,
  PrefectureBinRecord,
  PrefectureNameLookup,
  SearchNgramPostingRecord,
} from "./binary";
export { codePointBigrams } from "./searchNgrams";
export { normalizeSearchText } from "./normalize";
export {
  decompressBrotli,
  isBinaryPayloadUrl,
  isBrotliPayloadUrl,
  maybeDecompressPayload,
} from "./brotli";
