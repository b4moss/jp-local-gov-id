import type { LocalGovMunicipalitiesFile, Municipality } from "../types";
import {
  BINARY_FORMAT_VERSION,
  DECODED_SCHEMA_VERSION,
  MAGIC_JLDT,
  MAGIC_JLDT_BYTES,
  MUNICIPALITY_RECORD_SIZE,
} from "./constants";
import { LocalGovBinaryError } from "./errors";
import {
  assertMagic,
  createStringTableBuilder,
  encodeUtf8,
  readCString,
} from "./stringTable";

/** Wire-format municipality record (includes internal flags). */
export type MunicipalityBinRecord = {
  code: number;
  name: string;
  nameKana: string;
  hasWard: 0 | 1;
  isWard: 0 | 1;
};

export type EncodeMunicipalitiesMeta = {
  version?: number;
  asOf: string;
};

export type DecodedMunicipalitiesBin = {
  version: number;
  asOf: string;
  records: MunicipalityBinRecord[];
};

export type PrefectureNameLookup = {
  prefectureCode: string;
  prefectureName: string;
  prefectureNameKana: string;
};

function requireU8Flag(n: number, field: string): 0 | 1 {
  if (n !== 0 && n !== 1) {
    throw new LocalGovBinaryError(`${field} must be 0 or 1: ${n}`);
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

export function encodeMunicipalities(
  records: MunicipalityBinRecord[],
  meta: EncodeMunicipalitiesMeta,
): ArrayBuffer {
  const version = meta.version ?? BINARY_FORMAT_VERSION;
  if (!Number.isInteger(version) || version < 0 || version > 0xff) {
    throw new LocalGovBinaryError(`version out of u1 range: ${version}`);
  }
  const asOfBytes = encodeUtf8(meta.asOf);
  if (asOfBytes.length > 0xff) {
    throw new LocalGovBinaryError("asOf exceeds u1 length");
  }
  if (records.length > 0xffff) {
    throw new LocalGovBinaryError("record_count exceeds u2");
  }

  const strings = createStringTableBuilder();
  const encoded = records.map((record) => ({
    code: requireU32(record.code, "code"),
    nameOffset: strings.add(record.name),
    nameKanaOffset: strings.add(record.nameKana),
    hasWard: requireU8Flag(record.hasWard, "hasWard"),
    isWard: requireU8Flag(record.isWard, "isWard"),
  }));

  const headerSize = 4 + 1 + 1 + asOfBytes.length + 2;
  const total =
    headerSize +
    MUNICIPALITY_RECORD_SIZE * encoded.length +
    strings.byteLength;
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

export function decodeMunicipalities(
  buffer: ArrayBuffer,
): DecodedMunicipalitiesBin {
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

  const records: MunicipalityBinRecord[] = [];
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
      stringEndExclusive(bytes, stringTableOffset, nameKanaOffset, end),
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

export function municipalityRecordToLocalGov(
  record: MunicipalityBinRecord,
  pref: PrefectureNameLookup,
): Municipality {
  const code = String(record.code).padStart(6, "0");
  return {
    code,
    name: record.name,
    nameKana: record.nameKana,
    prefectureCode: pref.prefectureCode,
    prefectureName: pref.prefectureName,
    prefectureNameKana: pref.prefectureNameKana,
  };
}

export function toMunicipalitiesFile(
  decoded: DecodedMunicipalitiesBin,
  pref: PrefectureNameLookup,
): LocalGovMunicipalitiesFile {
  return {
    schemaVersion: DECODED_SCHEMA_VERSION,
    asOf: decoded.asOf,
    prefectureCode: pref.prefectureCode,
    municipalities: decoded.records.map((r) =>
      municipalityRecordToLocalGov(r, pref),
    ),
  };
}

export function decodeMunicipalitiesFile(
  buffer: ArrayBuffer,
  pref: PrefectureNameLookup,
): LocalGovMunicipalitiesFile {
  return toMunicipalitiesFile(decodeMunicipalities(buffer), pref);
}

/** Derive 2-digit prefecture code from a municipality local-gov code. */
export function prefectureCodeFromMunicipalityCode(code: number | string): string {
  const padded = String(code).padStart(6, "0");
  return padded.slice(0, 2);
}
