/**
 * Decode-only entry for jp-local-gov-id-data/decode.js (#93).
 * Keeps encode* (and the encode message catalog) out of the data package bundle.
 */
export { LocalGovBinaryError } from "./errors";
export {
  decodeMunicipalities,
  decodeMunicipalitiesFile,
  municipalityRecordToLocalGov,
  prefectureCodeFromMunicipalityCode,
  toMunicipalitiesFile,
  type DecodedMunicipalitiesBin,
  type MunicipalityBinRecord,
  type PrefectureNameLookup,
} from "./municipalities";
export {
  decodePrefectures,
  decodePrefecturesFile,
  prefectureRecordToLocalGov,
  toPrefecturesFile,
  type DecodedPrefecturesBin,
  type PrefectureBinRecord,
} from "./prefectures";
export {
  decodeSearchNgrams,
  sortSearchNgramPostings,
  type DecodedSearchNgramsBin,
  type EntityKind,
  type GramType,
  type SearchNgramPostingRecord,
} from "./searchNgrams";
export {
  BINARY_FORMAT_VERSION,
  DECODED_SCHEMA_VERSION,
  GRAM_TYPE_KANA,
  GRAM_TYPE_NAME,
  KIND_MUNI,
  KIND_PREF,
  MAGIC_JLDT,
  MAGIC_JLIX,
  MAGIC_JLPR,
} from "./constants";
