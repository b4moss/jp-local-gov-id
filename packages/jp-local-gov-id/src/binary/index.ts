export {
  BINARY_FORMAT_VERSION,
  DECODED_SCHEMA_VERSION,
  MAGIC_JLDT,
  MAGIC_JLDT_BYTES,
  MAGIC_JLPR,
  MAGIC_JLPR_BYTES,
  MUNICIPALITY_RECORD_SIZE,
  PREFECTURE_RECORD_SIZE,
} from "./constants";
export { LocalGovBinaryError } from "./errors";
export {
  decodeMunicipalities,
  decodeMunicipalitiesFile,
  encodeMunicipalities,
  municipalityRecordToLocalGov,
  prefectureCodeFromMunicipalityCode,
  toMunicipalitiesFile,
  type DecodedMunicipalitiesBin,
  type EncodeMunicipalitiesMeta,
  type MunicipalityBinRecord,
  type PrefectureNameLookup,
} from "./municipalities";
export {
  decodePrefectures,
  decodePrefecturesFile,
  encodePrefectures,
  prefectureRecordToLocalGov,
  toPrefecturesFile,
  type DecodedPrefecturesBin,
  type EncodePrefecturesMeta,
  type PrefectureBinRecord,
} from "./prefectures";
