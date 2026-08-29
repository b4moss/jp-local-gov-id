import type {
  LocalGovPrefecturesFile,
  MunicipalityCounts,
  Prefecture,
} from "../types";
import {
  BINARY_FORMAT_VERSION,
  DECODED_SCHEMA_VERSION,
  MAGIC_JLPR,
  MAGIC_JLPR_BYTES,
  PREFECTURE_RECORD_SIZE,
} from "./constants";
import { LocalGovBinaryError } from "./errors";
import {
  assertMagic,
  createStringTableBuilder,
  encodeUtf8,
  readCString,
} from "./stringTable";

/** Wire-format prefecture record (pre-normalization). */
export type PrefectureBinRecord = {
  prefCode: number;
  name: string;
  nameKana: string;
  muniCode: number;
  muniCountBoth: number;
  muniCountCity: number;
  muniCountWard: number;
};

export type EncodePrefecturesMeta = {
  version?: number;
  asOf: string;
};

export type DecodedPrefecturesBin = {
  version: number;
  asOf: string;
  records: PrefectureBinRecord[];
};

function requireU8(n: number, field: string): number {
  if (!Number.isInteger(n) || n < 0 || n > 0xff) {
    throw new LocalGovBinaryError(`${field} out of u1 range: ${n}`);
  }
  return n;
}

function requireU32(n: number, field: string): number {
  if (!Number.isInteger(n) || n < 0 || n > 0xffff_ffff) {
    throw new LocalGovBinaryError(`${field} out of u4 range: ${n}`);
  }
  return n;
}

function stringEndExclusive(
  bytes: Uint8Array,
  stringTableOffset: number,
  relativeOffset: number,
  endExclusive: number,
): number {
  readCString(bytes, stringTableOffset, relativeOffset, endExclusive);
  let p = stringTableOffset + relativeOffset;
  while (bytes[p] !== 0) p++;
  return p + 1;
}

function assertPayloadEndsAt(
  label: string,
  expectedEnd: number,
  actualEnd: number,
): void {
  if (expectedEnd !== actualEnd) {
    throw new LocalGovBinaryError(
      `${label}: trailing or unused bytes (expected end ${expectedEnd}, got ${actualEnd})`,
    );
  }
}

export function encodePrefectures(
  records: PrefectureBinRecord[],
  meta: EncodePrefecturesMeta,
): ArrayBuffer {
  const version = meta.version ?? BINARY_FORMAT_VERSION;
  requireU8(version, "version");
  const asOfBytes = encodeUtf8(meta.asOf);
  if (asOfBytes.length > 0xff) {
    throw new LocalGovBinaryError("asOf exceeds u1 length");
  }
  if (records.length > 0xffff) {
    throw new LocalGovBinaryError("record_count exceeds u2");
  }

  const strings = createStringTableBuilder();
  const encoded = records.map((record) => ({
    prefCode: requireU8(record.prefCode, "prefCode"),
    nameOffset: strings.add(record.name),
    nameKanaOffset: strings.add(record.nameKana),
    muniCode: requireU32(record.muniCode, "muniCode"),
    muniCountBoth: requireU8(record.muniCountBoth, "muniCountBoth"),
    muniCountCity: requireU8(record.muniCountCity, "muniCountCity"),
    muniCountWard: requireU8(record.muniCountWard, "muniCountWard"),
  }));

  const headerSize = 4 + 1 + 1 + asOfBytes.length + 2;
  const total =
    headerSize + PREFECTURE_RECORD_SIZE * encoded.length + strings.byteLength;
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

export function decodePrefectures(buffer: ArrayBuffer): DecodedPrefecturesBin {
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

  const records: PrefectureBinRecord[] = [];
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
      stringEndExclusive(bytes, stringTableOffset, nameKanaOffset, end),
    );

    records.push({
      prefCode,
      name,
      nameKana,
      muniCode,
      muniCountBoth,
      muniCountCity,
      muniCountWard,
    });
  }

  if (recordCount === 0) {
    assertPayloadEndsAt("JLPR", stringTableOffset, end);
  } else {
    assertPayloadEndsAt("JLPR", payloadEnd, end);
  }

  return { version, asOf, records };
}

export function prefectureRecordToLocalGov(
  record: PrefectureBinRecord,
): Prefecture {
  const counts: MunicipalityCounts = {
    both: record.muniCountBoth,
    city: record.muniCountCity,
    ward: record.muniCountWard,
  };
  return {
    code: String(record.muniCode).padStart(6, "0"),
    name: record.name,
    nameKana: record.nameKana,
    municipalityCounts: counts,
  };
}

export function toPrefecturesFile(
  decoded: DecodedPrefecturesBin,
): LocalGovPrefecturesFile {
  return {
    schemaVersion: DECODED_SCHEMA_VERSION,
    asOf: decoded.asOf,
    prefectures: decoded.records.map(prefectureRecordToLocalGov),
  };
}

export function decodePrefecturesFile(
  buffer: ArrayBuffer,
): LocalGovPrefecturesFile {
  return toPrefecturesFile(decodePrefectures(buffer));
}
