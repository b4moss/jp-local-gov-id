// ../packages/jp-local-gov-id/src/binary/constants.ts
var BINARY_FORMAT_VERSION = 1;
var MAGIC_JLPR = "JLPR";
var MAGIC_JLDT = "JLDT";
var MAGIC_JLPR_BYTES = new Uint8Array([74, 76, 80, 82]);
var MAGIC_JLDT_BYTES = new Uint8Array([74, 76, 68, 84]);
var PREFECTURE_RECORD_SIZE = 16;
var MUNICIPALITY_RECORD_SIZE = 14;
var DECODED_SCHEMA_VERSION = 1;

// ../packages/jp-local-gov-id/src/binary/errors.ts
var LocalGovBinaryError = class extends Error {
  name = "LocalGovBinaryError";
  constructor(message) {
    super(message);
  }
};

// ../packages/jp-local-gov-id/src/binary/stringTable.ts
var textEncoder = new TextEncoder();
var textDecoder = new TextDecoder();
function createStringTableBuilder() {
  const chunks = [];
  const offsets = /* @__PURE__ */ new Map();
  let size = 0;
  return {
    add(value) {
      const existing = offsets.get(value);
      if (existing !== void 0) return existing;
      const encoded = textEncoder.encode(value);
      const offset = size;
      chunks.push(encoded);
      offsets.set(value, offset);
      size += encoded.length + 1;
      return offset;
    },
    get byteLength() {
      return size;
    },
    writeTo(bytes, offset) {
      let pos = offset;
      for (const chunk of chunks) {
        bytes.set(chunk, pos);
        pos += chunk.length;
        bytes[pos++] = 0;
      }
      return pos;
    }
  };
}
function readCString(bytes, stringTableOffset, relativeOffset, endExclusive) {
  if (relativeOffset < 0) {
    throw new LocalGovBinaryError(`Invalid string offset: ${relativeOffset}`);
  }
  const start = stringTableOffset + relativeOffset;
  if (start >= endExclusive) {
    throw new LocalGovBinaryError(
      `String offset out of range: ${relativeOffset}`
    );
  }
  let end = start;
  while (end < endExclusive && bytes[end] !== 0) end++;
  if (end >= endExclusive) {
    throw new LocalGovBinaryError(
      `Unterminated string at offset ${relativeOffset}`
    );
  }
  return textDecoder.decode(bytes.subarray(start, end));
}
function encodeUtf8(value) {
  return textEncoder.encode(value);
}
function decodeUtf8(bytes) {
  return textDecoder.decode(bytes);
}
function assertMagic(bytes, expected, label) {
  if (bytes.length < 4) {
    throw new LocalGovBinaryError(`${label}: buffer too short for magic`);
  }
  const magic = decodeUtf8(bytes.subarray(0, 4));
  if (magic !== expected) {
    throw new LocalGovBinaryError(
      `${label}: invalid magic (expected ${expected}, got ${JSON.stringify(magic)})`
    );
  }
}

// ../packages/jp-local-gov-id/src/binary/municipalities.ts
function requireU8Flag(n, field) {
  if (n !== 0 && n !== 1) {
    throw new LocalGovBinaryError(`${field} must be 0 or 1: ${n}`);
  }
  return n;
}
function requireU32(n, field) {
  if (!Number.isInteger(n) || n < 0 || n > 4294967295) {
    throw new LocalGovBinaryError(`${field} out of u4 range: ${n}`);
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
      `${label}: trailing or unused bytes (expected end ${expectedEnd}, got ${actualEnd})`
    );
  }
}
function encodeMunicipalities(records, meta) {
  const version = meta.version ?? BINARY_FORMAT_VERSION;
  if (!Number.isInteger(version) || version < 0 || version > 255) {
    throw new LocalGovBinaryError(`version out of u1 range: ${version}`);
  }
  const asOfBytes = encodeUtf8(meta.asOf);
  if (asOfBytes.length > 255) {
    throw new LocalGovBinaryError("asOf exceeds u1 length");
  }
  if (records.length > 65535) {
    throw new LocalGovBinaryError("record_count exceeds u2");
  }
  const strings = createStringTableBuilder();
  const encoded = records.map((record) => ({
    code: requireU32(record.code, "code"),
    nameOffset: strings.add(record.name),
    nameKanaOffset: strings.add(record.nameKana),
    hasWard: requireU8Flag(record.hasWard, "hasWard"),
    isWard: requireU8Flag(record.isWard, "isWard")
  }));
  const headerSize = 4 + 1 + 1 + asOfBytes.length + 2;
  const total = headerSize + MUNICIPALITY_RECORD_SIZE * encoded.length + strings.byteLength;
  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let pos = 0;
  bytes.set(MAGIC_JLDT_BYTES, pos);
  pos += 4;
  view.setUint8(pos++, version);
  view.setUint8(pos++, asOfBytes.length);
  bytes.set(asOfBytes, pos);
  pos += asOfBytes.length;
  view.setUint16(pos, encoded.length, true);
  pos += 2;
  for (const record of encoded) {
    view.setUint32(pos, record.code, true);
    pos += 4;
    view.setUint32(pos, record.nameOffset, true);
    pos += 4;
    view.setUint32(pos, record.nameKanaOffset, true);
    pos += 4;
    view.setUint8(pos++, record.hasWard);
    view.setUint8(pos++, record.isWard);
  }
  const end = strings.writeTo(bytes, pos);
  if (end !== total) {
    throw new LocalGovBinaryError("Internal encode size mismatch (JLDT)");
  }
  return buffer;
}
function decodeMunicipalities(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const end = bytes.length;
  assertMagic(bytes, MAGIC_JLDT, "JLDT");
  let pos = 4;
  if (pos + 2 > end) {
    throw new LocalGovBinaryError("JLDT: buffer too short for version/asOfLen");
  }
  const version = view.getUint8(pos++);
  if (version !== BINARY_FORMAT_VERSION) {
    throw new LocalGovBinaryError(`Unsupported version: ${version}`);
  }
  const asOfLen = view.getUint8(pos++);
  if (pos + asOfLen + 2 > end) {
    throw new LocalGovBinaryError("JLDT: buffer too short for asOf/record_count");
  }
  const asOf = new TextDecoder().decode(bytes.subarray(pos, pos + asOfLen));
  pos += asOfLen;
  const recordCount = view.getUint16(pos, true);
  pos += 2;
  const recordsByteLength = MUNICIPALITY_RECORD_SIZE * recordCount;
  if (pos + recordsByteLength > end) {
    throw new LocalGovBinaryError("JLDT: buffer too short for records");
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
    const hasWard = requireU8Flag(view.getUint8(pos++), "hasWard");
    const isWard = requireU8Flag(view.getUint8(pos++), "isWard");
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

// ../packages/jp-local-gov-id/src/binary/prefectures.ts
function requireU8(n, field) {
  if (!Number.isInteger(n) || n < 0 || n > 255) {
    throw new LocalGovBinaryError(`${field} out of u1 range: ${n}`);
  }
  return n;
}
function requireU322(n, field) {
  if (!Number.isInteger(n) || n < 0 || n > 4294967295) {
    throw new LocalGovBinaryError(`${field} out of u4 range: ${n}`);
  }
  return n;
}
function stringEndExclusive2(bytes, stringTableOffset, relativeOffset, endExclusive) {
  readCString(bytes, stringTableOffset, relativeOffset, endExclusive);
  let p = stringTableOffset + relativeOffset;
  while (bytes[p] !== 0) p++;
  return p + 1;
}
function assertPayloadEndsAt2(label, expectedEnd, actualEnd) {
  if (expectedEnd !== actualEnd) {
    throw new LocalGovBinaryError(
      `${label}: trailing or unused bytes (expected end ${expectedEnd}, got ${actualEnd})`
    );
  }
}
function encodePrefectures(records, meta) {
  const version = meta.version ?? BINARY_FORMAT_VERSION;
  requireU8(version, "version");
  const asOfBytes = encodeUtf8(meta.asOf);
  if (asOfBytes.length > 255) {
    throw new LocalGovBinaryError("asOf exceeds u1 length");
  }
  if (records.length > 65535) {
    throw new LocalGovBinaryError("record_count exceeds u2");
  }
  const strings = createStringTableBuilder();
  const encoded = records.map((record) => ({
    prefCode: requireU8(record.prefCode, "prefCode"),
    nameOffset: strings.add(record.name),
    nameKanaOffset: strings.add(record.nameKana),
    muniCode: requireU322(record.muniCode, "muniCode"),
    muniCountBoth: requireU8(record.muniCountBoth, "muniCountBoth"),
    muniCountCity: requireU8(record.muniCountCity, "muniCountCity"),
    muniCountWard: requireU8(record.muniCountWard, "muniCountWard")
  }));
  const headerSize = 4 + 1 + 1 + asOfBytes.length + 2;
  const total = headerSize + PREFECTURE_RECORD_SIZE * encoded.length + strings.byteLength;
  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let pos = 0;
  bytes.set(MAGIC_JLPR_BYTES, pos);
  pos += 4;
  view.setUint8(pos++, version);
  view.setUint8(pos++, asOfBytes.length);
  bytes.set(asOfBytes, pos);
  pos += asOfBytes.length;
  view.setUint16(pos, encoded.length, true);
  pos += 2;
  for (const record of encoded) {
    view.setUint8(pos, record.prefCode);
    pos += 1;
    view.setUint32(pos, record.nameOffset, true);
    pos += 4;
    view.setUint32(pos, record.nameKanaOffset, true);
    pos += 4;
    view.setUint32(pos, record.muniCode, true);
    pos += 4;
    view.setUint8(pos++, record.muniCountBoth);
    view.setUint8(pos++, record.muniCountCity);
    view.setUint8(pos++, record.muniCountWard);
  }
  const end = strings.writeTo(bytes, pos);
  if (end !== total) {
    throw new LocalGovBinaryError("Internal encode size mismatch (JLPR)");
  }
  return buffer;
}
function decodePrefectures(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const end = bytes.length;
  assertMagic(bytes, MAGIC_JLPR, "JLPR");
  let pos = 4;
  if (pos + 2 > end) {
    throw new LocalGovBinaryError("JLPR: buffer too short for version/asOfLen");
  }
  const version = view.getUint8(pos++);
  if (version !== BINARY_FORMAT_VERSION) {
    throw new LocalGovBinaryError(`Unsupported version: ${version}`);
  }
  const asOfLen = view.getUint8(pos++);
  if (pos + asOfLen + 2 > end) {
    throw new LocalGovBinaryError("JLPR: buffer too short for asOf/record_count");
  }
  const asOf = new TextDecoder().decode(bytes.subarray(pos, pos + asOfLen));
  pos += asOfLen;
  const recordCount = view.getUint16(pos, true);
  pos += 2;
  const recordsByteLength = PREFECTURE_RECORD_SIZE * recordCount;
  if (pos + recordsByteLength > end) {
    throw new LocalGovBinaryError("JLPR: buffer too short for records");
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
      stringEndExclusive2(bytes, stringTableOffset, nameOffset, end),
      stringEndExclusive2(bytes, stringTableOffset, nameKanaOffset, end)
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
    assertPayloadEndsAt2("JLPR", stringTableOffset, end);
  } else {
    assertPayloadEndsAt2("JLPR", payloadEnd, end);
  }
  return { version, asOf, records };
}
function prefectureRecordToLocalGov(record) {
  const code = String(record.prefCode).padStart(2, "0");
  const counts = {
    both: record.muniCountBoth,
    city: record.muniCountCity,
    ward: record.muniCountWard
  };
  return {
    code,
    name: record.name,
    nameKana: record.nameKana,
    prefectureCode: code,
    prefectureName: record.name,
    prefectureNameKana: record.nameKana,
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
export {
  BINARY_FORMAT_VERSION,
  DECODED_SCHEMA_VERSION,
  LocalGovBinaryError,
  MAGIC_JLDT,
  MAGIC_JLDT_BYTES,
  MAGIC_JLPR,
  MAGIC_JLPR_BYTES,
  MUNICIPALITY_RECORD_SIZE,
  PREFECTURE_RECORD_SIZE,
  decodeMunicipalities,
  decodeMunicipalitiesFile,
  decodePrefectures,
  decodePrefecturesFile,
  encodeMunicipalities,
  encodePrefectures,
  municipalityRecordToLocalGov,
  prefectureCodeFromMunicipalityCode,
  prefectureRecordToLocalGov,
  toMunicipalitiesFile,
  toPrefecturesFile
};
