import {
  BINARY_FORMAT_VERSION,
  GRAM_TYPE_KANA,
  GRAM_TYPE_NAME,
  KIND_MUNI,
  KIND_PREF,
  MAGIC_JLIX,
  MAGIC_JLIX_BYTES,
  NGRAM_POSTING_RECORD_SIZE,
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
  requireU8,
  requireU32,
  stringEndExclusive,
} from "./assert";

export type GramType = typeof GRAM_TYPE_NAME | typeof GRAM_TYPE_KANA;
export type EntityKind = typeof KIND_PREF | typeof KIND_MUNI;

/** Wire-format 2-gram posting record (Issue #63 JLIX). */
export type SearchNgramPostingRecord = {
  gram: string;
  gramType: GramType;
  kind: EntityKind;
  muniCode: number;
  prefCode: number;
  hasWard: 0 | 1;
  isWard: 0 | 1;
};

export type EncodeSearchNgramsMeta = {
  version?: number;
  asOf: string;
};

export type DecodedSearchNgramsBin = {
  version: number;
  asOf: string;
  records: SearchNgramPostingRecord[];
};




function requireGramType(n: number): GramType {
  if (n !== GRAM_TYPE_NAME && n !== GRAM_TYPE_KANA) {
    throw new LocalGovBinaryError(fmt("binary.gramTypeMustBe0Or1", { n }));
  }
  return n;
}

function requireKind(n: number): EntityKind {
  if (n !== KIND_PREF && n !== KIND_MUNI) {
    throw new LocalGovBinaryError(fmt("binary.kindMustBe0Or1", { n }));
  }
  return n;
}

function comparePostings(
  a: SearchNgramPostingRecord,
  b: SearchNgramPostingRecord,
): number {
  if (a.gram !== b.gram) return a.gram < b.gram ? -1 : 1;
  if (a.gramType !== b.gramType) return a.gramType - b.gramType;
  return a.muniCode - b.muniCode;
}

/** Deterministic sort: gram → gramType → muniCode. */
export function sortSearchNgramPostings(
  records: readonly SearchNgramPostingRecord[],
): SearchNgramPostingRecord[] {
  return [...records].sort(comparePostings);
}



export function decodeSearchNgrams(buffer: ArrayBuffer): DecodedSearchNgramsBin {
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

  const records: SearchNgramPostingRecord[] = [];
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
      stringEndExclusive(bytes, stringTableOffset, gramOffset, end),
    );

    records.push({
      gram,
      gramType,
      kind,
      muniCode,
      prefCode,
      hasWard,
      isWard,
    });
  }

  if (recordCount === 0) {
    assertPayloadEndsAt("JLIX", stringTableOffset, end);
  } else {
    assertPayloadEndsAt("JLIX", payloadEnd, end);
  }

  return { version, asOf, records };
}
