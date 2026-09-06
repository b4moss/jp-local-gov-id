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
import { fmt, msg } from "../messages";
import {
  assertPayloadEndsAt,
  requireFlag,
  requireU32,
  stringEndExclusive,
} from "./assert";

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





export function decodeMunicipalities(
  buffer: ArrayBuffer,
): DecodedMunicipalitiesBin {
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

  const records: MunicipalityBinRecord[] = [];
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
