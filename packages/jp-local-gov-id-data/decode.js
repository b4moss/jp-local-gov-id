// packages/jp-local-gov-id/src/binary/errors.ts
var LocalGovBinaryError = class extends Error {
  name = "LocalGovBinaryError";
  constructor(message) {
    super(message);
  }
};

// packages/jp-local-gov-id/src/binary/constants.ts
var BINARY_FORMAT_VERSION = 1;
var MAGIC_JLPR = "JLPR";
var MAGIC_JLDT = "JLDT";
var MAGIC_JLIX = "JLIX";
var MAGIC_JLPR_BYTES = new Uint8Array([74, 76, 80, 82]);
var MAGIC_JLDT_BYTES = new Uint8Array([74, 76, 68, 84]);
var MAGIC_JLIX_BYTES = new Uint8Array([74, 76, 73, 88]);
var PREFECTURE_RECORD_SIZE = 16;
var MUNICIPALITY_RECORD_SIZE = 14;
var NGRAM_POSTING_RECORD_SIZE = 13;
var GRAM_TYPE_NAME = 0;
var GRAM_TYPE_KANA = 1;
var KIND_PREF = 0;
var KIND_MUNI = 1;
var DECODED_SCHEMA_VERSION = 2;

// packages/jp-local-gov-id/src/messages.core.ts
var PLACEHOLDER_RE = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
function createMessageHelpers(catalog) {
  function msg2(key) {
    const value = catalog[key];
    if (value === void 0) {
      throw new Error(`Unknown message key: ${String(key)}`);
    }
    return value;
  }
  function fmt2(key, params) {
    const template = msg2(key);
    const required = /* @__PURE__ */ new Set();
    for (const match of template.matchAll(PLACEHOLDER_RE)) {
      required.add(match[1]);
    }
    for (const name of required) {
      if (!(name in params)) {
        throw new Error(
          `Missing message placeholder "${name}" for key ${String(key)}`
        );
      }
      const value = params[name];
      if (value === null || value === void 0) {
        throw new Error(
          `Message placeholder "${name}" for key ${String(key)} must not be null or undefined`
        );
      }
    }
    return template.replace(
      PLACEHOLDER_RE,
      (_m, name) => String(params[name])
    );
  }
  return { msg: msg2, fmt: fmt2 };
}

// packages/jp-local-gov-id/src/messages.generated.ts
var MESSAGES = {
  "binary.bufferTooShortForMagic": "{label}: buffer too short for magic",
  "binary.fieldMustBe0Or1": "{field} must be 0 or 1: {n}",
  "binary.fieldOutOfU1": "{field} out of u1 range: {n}",
  "binary.fieldOutOfU4": "{field} out of u4 range: {n}",
  "binary.gramTypeMustBe0Or1": "gramType must be 0|1: {n}",
  "binary.invalidMagic": "{label}: invalid magic (expected {expected}, got {magic})",
  "binary.invalidStringOffset": "Invalid string offset: {relativeOffset}",
  "binary.jldt.shortAsOfRecordCount": "JLDT: buffer too short for asOf/record_count",
  "binary.jldt.shortRecords": "JLDT: buffer too short for records",
  "binary.jldt.shortVersionAsOfLen": "JLDT: buffer too short for version/asOfLen",
  "binary.jlix.shortAsOfRecordCount": "JLIX: buffer too short for asOf/record_count",
  "binary.jlix.shortRecords": "JLIX: buffer too short for records",
  "binary.jlix.shortVersionAsOfLen": "JLIX: buffer too short for version/asOfLen",
  "binary.jlpr.shortAsOfRecordCount": "JLPR: buffer too short for asOf/record_count",
  "binary.jlpr.shortRecords": "JLPR: buffer too short for records",
  "binary.jlpr.shortVersionAsOfLen": "JLPR: buffer too short for version/asOfLen",
  "binary.kindMustBe0Or1": "kind must be 0|1: {n}",
  "binary.stringOffsetOutOfRange": "String offset out of range: {relativeOffset}",
  "binary.trailingOrUnusedBytes": "{label}: trailing or unused bytes (expected end {expectedEnd}, got {actualEnd})",
  "binary.unsupportedVersion": "Unsupported version: {version}",
  "binary.unterminatedString": "Unterminated string at offset {relativeOffset}",
  "brotli.unavailable": 'Brotli decompression requires DecompressionStream("brotli"), brotli-wasm, or a Node.js runtime',
  "cache.ttlSeconds": "cacheTtlSeconds must be a finite number greater than or equal to 0",
  "create.cacheTtlSeconds": "cacheTtlSeconds must be a finite number greater than or equal to 0",
  "create.dataOrUrlRequired": "createLocalGovClient requires either `data` or `url`",
  "create.fetchFailed": "Failed to fetch local gov data: {status} {statusText}",
  "create.missingSearchNgramShards": "Dataset is missing searchNgramShards (JLIX partition bytes) required for nationwide string search",
  "create.noMunicipalitiesData": "No municipalities data for prefecture {code}: provide municipalitiesByCode or loadMunicipalities",
  "create.optionsExclusive": "createLocalGovClient accepts either `data` or `url`, not both",
  "create.optionsRequired": "createLocalGovClient requires options with either `data` or `url`",
  "create.parseJsonFailed": "Failed to parse local gov data as JSON from URL",
  "create.readBinaryFailed": "Failed to read local gov binary data from URL",
  "create.unknownPrefectureDecode": "Unknown prefecture code while decoding municipalities: {code}",
  "create.urlParse": '"{url}" cannot be parsed as a URL (pass an absolute URL, or use in a browser)',
  "schema.datasetIndexPrefectures": "Dataset must include index and prefectures (and optionally municipalitiesByCode / loadMunicipalities)",
  "schema.datasetObject": "Dataset must be a non-null object with index and prefectures",
  "schema.indexPathsObject": "Index must include a paths object",
  "schema.indexPathsPrefectures": "Index paths must include string prefectures and municipalitiesByPrefecture",
  "schema.indexPrefectureCodes": "Index must include prefectureCodes as a string array",
  "schema.municipalitiesArray": "Municipalities file must include a municipalities array of Municipality objects",
  "schema.municipalitiesPrefectureCode": "Municipalities file must include string prefectureCode",
  "schema.mustBeObject": "{label} must be a non-null object",
  "schema.prefecturesArray": "Prefectures file must include a prefectures array of Prefecture objects",
  "schema.searchNgramShardsEntry": "Dataset searchNgramShards[{key}] must be ArrayBuffer or Uint8Array",
  "schema.searchNgramShardsRecord": "Dataset searchNgramShards must be a Record of ArrayBuffer or Uint8Array",
  "schema.searchNgramsObject": "Index paths.searchNgrams must be an object with twoGram and threeGram",
  "schema.threeGramMustBeObject": "Index paths.searchNgrams.threeGram must be an object",
  "schema.threeGramPatternShard": "Index paths.searchNgrams.threeGram.pattern must contain {shard}",
  "schema.threeGramShardCount": "Index paths.searchNgrams.threeGram.shardCount must be a positive integer",
  "schema.twoGramMustBeObject": "Index paths.searchNgrams.twoGram must be an object",
  "schema.twoGramPatternRegion": "Index paths.searchNgrams.twoGram.pattern must contain {region}",
  "schema.twoGramRegions": "Index paths.searchNgrams.twoGram.regions must be a non-empty string array",
  "schema.unsupportedVersion": "Unsupported schemaVersion: expected {expected}, got {got}",
  "schema.versionMustBeNumber": "{label}: schemaVersion must be a number",
  "search.jlixAsOfMismatch": "[jp-local-gov-id] JLIX asOf ({searchAsOf}) differs from prefectures asOf ({prefecturesAsOf})",
  "search.missingThreeGramShard": 'Dataset searchNgramShards missing 3-gram shard "{key}"',
  "search.missingTwoGramRegion": 'Dataset searchNgramShards missing 2-gram region "{key}"',
  "search.nPositiveInteger": "n must be a positive integer",
  "search.shardCountPositiveInteger": "shardCount must be a positive integer",
  "search.unrecognizedPath": "Unrecognized search index path for dataset: {relativePath}"
};

// packages/jp-local-gov-id/src/messages.ts
var helpers = createMessageHelpers(MESSAGES);
var msg = helpers.msg;
var fmt = helpers.fmt;

// packages/jp-local-gov-id/src/binary/stringTable.ts
var textEncoder = new TextEncoder();
var textDecoder = new TextDecoder();
function readCString(bytes, stringTableOffset, relativeOffset, endExclusive) {
  if (relativeOffset < 0) {
    throw new LocalGovBinaryError(
      fmt("binary.invalidStringOffset", { relativeOffset })
    );
  }
  const start = stringTableOffset + relativeOffset;
  if (start >= endExclusive) {
    throw new LocalGovBinaryError(
      fmt("binary.stringOffsetOutOfRange", { relativeOffset })
    );
  }
  let end = start;
  while (end < endExclusive && bytes[end] !== 0) end++;
  if (end >= endExclusive) {
    throw new LocalGovBinaryError(
      fmt("binary.unterminatedString", { relativeOffset })
    );
  }
  return textDecoder.decode(bytes.subarray(start, end));
}
function decodeUtf8(bytes) {
  return textDecoder.decode(bytes);
}
function assertMagic(bytes, expected, label) {
  if (bytes.length < 4) {
    throw new LocalGovBinaryError(
      fmt("binary.bufferTooShortForMagic", { label })
    );
  }
  const magic = decodeUtf8(bytes.subarray(0, 4));
  if (magic !== expected) {
    throw new LocalGovBinaryError(
      fmt("binary.invalidMagic", {
        label,
        expected,
        magic: JSON.stringify(magic)
      })
    );
  }
}

// packages/jp-local-gov-id/src/binary/assert.ts
function requireFlag(n, field) {
  if (n !== 0 && n !== 1) {
    throw new LocalGovBinaryError(fmt("binary.fieldMustBe0Or1", { field, n }));
  }
  return n;
}
function stringEndExclusive(bytes, stringTableOffset, relativeOffset, endExclusive) {
  readCString(bytes, stringTableOffset, relativeOffset, endExclusive);
  let p = stringTableOffset + relativeOffset;
  while (bytes[p] !== 0) p++;
  return p + 1;
}
function assertPayloadEndsAt(label, expectedEnd, actualEnd) {
  if (expectedEnd !== actualEnd) {
    throw new LocalGovBinaryError(
      fmt("binary.trailingOrUnusedBytes", { label, expectedEnd, actualEnd })
    );
  }
}

// packages/jp-local-gov-id/src/binary/municipalities.ts
function decodeMunicipalities(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const end = bytes.length;
  assertMagic(bytes, MAGIC_JLDT, "JLDT");
  let pos = 4;
  if (pos + 2 > end) {
    throw new LocalGovBinaryError(msg("binary.jldt.shortVersionAsOfLen"));
  }
  const version = view.getUint8(pos++);
  if (version !== BINARY_FORMAT_VERSION) {
    throw new LocalGovBinaryError(fmt("binary.unsupportedVersion", { version }));
  }
  const asOfLen = view.getUint8(pos++);
  if (pos + asOfLen + 2 > end) {
    throw new LocalGovBinaryError(msg("binary.jldt.shortAsOfRecordCount"));
  }
  const asOf = new TextDecoder().decode(bytes.subarray(pos, pos + asOfLen));
  pos += asOfLen;
  const recordCount = view.getUint16(pos, true);
  pos += 2;
  const recordsByteLength = MUNICIPALITY_RECORD_SIZE * recordCount;
  if (pos + recordsByteLength > end) {
    throw new LocalGovBinaryError(msg("binary.jldt.shortRecords"));
  }
  const stringTableOffset = pos + recordsByteLength;
  const records = [];
  let payloadEnd = stringTableOffset;
  for (let i = 0; i < recordCount; i++) {
    const code = view.getUint32(pos, true);
    pos += 4;
    const nameOffset = view.getUint32(pos, true);
    pos += 4;
    const nameKanaOffset = view.getUint32(pos, true);
    pos += 4;
    const hasWard = requireFlag(view.getUint8(pos++), "hasWard");
    const isWard = requireFlag(view.getUint8(pos++), "isWard");
    const name = readCString(bytes, stringTableOffset, nameOffset, end);
    const nameKana = readCString(bytes, stringTableOffset, nameKanaOffset, end);
    payloadEnd = Math.max(
      payloadEnd,
      stringEndExclusive(bytes, stringTableOffset, nameOffset, end),
      stringEndExclusive(bytes, stringTableOffset, nameKanaOffset, end)
    );
    records.push({ code, name, nameKana, hasWard, isWard });
  }
  if (recordCount === 0) {
    assertPayloadEndsAt("JLDT", stringTableOffset, end);
  } else {
    assertPayloadEndsAt("JLDT", payloadEnd, end);
  }
  return { version, asOf, records };
}
function municipalityRecordToLocalGov(record, pref) {
  const code = String(record.code).padStart(6, "0");
  return {
    code,
    name: record.name,
    nameKana: record.nameKana,
    prefectureCode: pref.prefectureCode,
    prefectureName: pref.prefectureName,
    prefectureNameKana: pref.prefectureNameKana
  };
}
function toMunicipalitiesFile(decoded, pref) {
  return {
    schemaVersion: DECODED_SCHEMA_VERSION,
    asOf: decoded.asOf,
    prefectureCode: pref.prefectureCode,
    municipalities: decoded.records.map(
      (r) => municipalityRecordToLocalGov(r, pref)
    )
  };
}
function decodeMunicipalitiesFile(buffer, pref) {
  return toMunicipalitiesFile(decodeMunicipalities(buffer), pref);
}
function prefectureCodeFromMunicipalityCode(code) {
  const padded = String(code).padStart(6, "0");
  return padded.slice(0, 2);
}

// packages/jp-local-gov-id/src/binary/prefectures.ts
function decodePrefectures(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const end = bytes.length;
  assertMagic(bytes, MAGIC_JLPR, "JLPR");
  let pos = 4;
  if (pos + 2 > end) {
    throw new LocalGovBinaryError(msg("binary.jlpr.shortVersionAsOfLen"));
  }
  const version = view.getUint8(pos++);
  if (version !== BINARY_FORMAT_VERSION) {
    throw new LocalGovBinaryError(fmt("binary.unsupportedVersion", { version }));
  }
  const asOfLen = view.getUint8(pos++);
  if (pos + asOfLen + 2 > end) {
    throw new LocalGovBinaryError(msg("binary.jlpr.shortAsOfRecordCount"));
  }
  const asOf = new TextDecoder().decode(bytes.subarray(pos, pos + asOfLen));
  pos += asOfLen;
  const recordCount = view.getUint16(pos, true);
  pos += 2;
  const recordsByteLength = PREFECTURE_RECORD_SIZE * recordCount;
  if (pos + recordsByteLength > end) {
    throw new LocalGovBinaryError(msg("binary.jlpr.shortRecords"));
  }
  const stringTableOffset = pos + recordsByteLength;
  const records = [];
  let payloadEnd = stringTableOffset;
  for (let i = 0; i < recordCount; i++) {
    const prefCode = view.getUint8(pos);
    pos += 1;
    const nameOffset = view.getUint32(pos, true);
    pos += 4;
    const nameKanaOffset = view.getUint32(pos, true);
    pos += 4;
    const muniCode = view.getUint32(pos, true);
    pos += 4;
    const muniCountBoth = view.getUint8(pos++);
    const muniCountCity = view.getUint8(pos++);
    const muniCountWard = view.getUint8(pos++);
    const name = readCString(bytes, stringTableOffset, nameOffset, end);
    const nameKana = readCString(bytes, stringTableOffset, nameKanaOffset, end);
    payloadEnd = Math.max(
      payloadEnd,
      stringEndExclusive(bytes, stringTableOffset, nameOffset, end),
      stringEndExclusive(bytes, stringTableOffset, nameKanaOffset, end)
    );
    records.push({
      prefCode,
      name,
      nameKana,
      muniCode,
      muniCountBoth,
      muniCountCity,
      muniCountWard
    });
  }
  if (recordCount === 0) {
    assertPayloadEndsAt("JLPR", stringTableOffset, end);
  } else {
    assertPayloadEndsAt("JLPR", payloadEnd, end);
  }
  return { version, asOf, records };
}
function prefectureRecordToLocalGov(record) {
  const counts = {
    both: record.muniCountBoth,
    city: record.muniCountCity,
    ward: record.muniCountWard
  };
  return {
    code: String(record.muniCode).padStart(6, "0"),
    name: record.name,
    nameKana: record.nameKana,
    municipalityCounts: counts
  };
}
function toPrefecturesFile(decoded) {
  return {
    schemaVersion: DECODED_SCHEMA_VERSION,
    asOf: decoded.asOf,
    prefectures: decoded.records.map(prefectureRecordToLocalGov)
  };
}
function decodePrefecturesFile(buffer) {
  return toPrefecturesFile(decodePrefectures(buffer));
}

// packages/jp-local-gov-id/src/binary/searchNgrams.ts
function requireGramType(n) {
  if (n !== GRAM_TYPE_NAME && n !== GRAM_TYPE_KANA) {
    throw new LocalGovBinaryError(fmt("binary.gramTypeMustBe0Or1", { n }));
  }
  return n;
}
function requireKind(n) {
  if (n !== KIND_PREF && n !== KIND_MUNI) {
    throw new LocalGovBinaryError(fmt("binary.kindMustBe0Or1", { n }));
  }
  return n;
}
function comparePostings(a, b) {
  if (a.gram !== b.gram) return a.gram < b.gram ? -1 : 1;
  if (a.gramType !== b.gramType) return a.gramType - b.gramType;
  return a.muniCode - b.muniCode;
}
function sortSearchNgramPostings(records) {
  return [...records].sort(comparePostings);
}
function decodeSearchNgrams(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const end = bytes.length;
  assertMagic(bytes, MAGIC_JLIX, "JLIX");
  let pos = 4;
  if (pos + 2 > end) {
    throw new LocalGovBinaryError(msg("binary.jlix.shortVersionAsOfLen"));
  }
  const version = view.getUint8(pos++);
  if (version !== BINARY_FORMAT_VERSION) {
    throw new LocalGovBinaryError(fmt("binary.unsupportedVersion", { version }));
  }
  const asOfLen = view.getUint8(pos++);
  if (pos + asOfLen + 2 > end) {
    throw new LocalGovBinaryError(msg("binary.jlix.shortAsOfRecordCount"));
  }
  const asOf = new TextDecoder().decode(bytes.subarray(pos, pos + asOfLen));
  pos += asOfLen;
  const recordCount = view.getUint16(pos, true);
  pos += 2;
  const recordsByteLength = NGRAM_POSTING_RECORD_SIZE * recordCount;
  if (pos + recordsByteLength > end) {
    throw new LocalGovBinaryError(msg("binary.jlix.shortRecords"));
  }
  const stringTableOffset = pos + recordsByteLength;
  const records = [];
  let payloadEnd = stringTableOffset;
  for (let i = 0; i < recordCount; i++) {
    const gramOffset = view.getUint32(pos, true);
    pos += 4;
    const gramType = requireGramType(view.getUint8(pos++));
    const kind = requireKind(view.getUint8(pos++));
    const muniCode = view.getUint32(pos, true);
    pos += 4;
    const prefCode = view.getUint8(pos++);
    const hasWard = requireFlag(view.getUint8(pos++), "hasWard");
    const isWard = requireFlag(view.getUint8(pos++), "isWard");
    const gram = readCString(bytes, stringTableOffset, gramOffset, end);
    payloadEnd = Math.max(
      payloadEnd,
      stringEndExclusive(bytes, stringTableOffset, gramOffset, end)
    );
    records.push({
      gram,
      gramType,
      kind,
      muniCode,
      prefCode,
      hasWard,
      isWard
    });
  }
  if (recordCount === 0) {
    assertPayloadEndsAt("JLIX", stringTableOffset, end);
  } else {
    assertPayloadEndsAt("JLIX", payloadEnd, end);
  }
  return { version, asOf, records };
}
export {
  BINARY_FORMAT_VERSION,
  DECODED_SCHEMA_VERSION,
  GRAM_TYPE_KANA,
  GRAM_TYPE_NAME,
  KIND_MUNI,
  KIND_PREF,
  LocalGovBinaryError,
  MAGIC_JLDT,
  MAGIC_JLIX,
  MAGIC_JLPR,
  decodeMunicipalities,
  decodeMunicipalitiesFile,
  decodePrefectures,
  decodePrefecturesFile,
  decodeSearchNgrams,
  municipalityRecordToLocalGov,
  prefectureCodeFromMunicipalityCode,
  prefectureRecordToLocalGov,
  sortSearchNgramPostings,
  toMunicipalitiesFile,
  toPrefecturesFile
};
