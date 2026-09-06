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
import { fmt, msg } from "../messages";
import {
  assertPayloadEndsAt,
  requireU8,
  requireU32,
  stringEndExclusive,
} from "./assert";

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





export function decodePrefectures(buffer: ArrayBuffer): DecodedPrefecturesBin {
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
