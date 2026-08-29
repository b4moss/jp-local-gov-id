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

function requireFlag(n: number, field: string): 0 | 1 {
  if (n !== 0 && n !== 1) {
    throw new LocalGovBinaryError(`${field} must be 0 or 1: ${n}`);
  }
  return n;
}

function requireGramType(n: number): GramType {
  if (n !== GRAM_TYPE_NAME && n !== GRAM_TYPE_KANA) {
    throw new LocalGovBinaryError(`gramType must be 0|1: ${n}`);
  }
  return n;
}

function requireKind(n: number): EntityKind {
  if (n !== KIND_PREF && n !== KIND_MUNI) {
    throw new LocalGovBinaryError(`kind must be 0|1: ${n}`);
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

export function encodeSearchNgrams(
  records: SearchNgramPostingRecord[],
  meta: EncodeSearchNgramsMeta,
): ArrayBuffer {
  const version = meta.version ?? BINARY_FORMAT_VERSION;
  requireU8(version, "version");
  const asOfBytes = encodeUtf8(meta.asOf);
  if (asOfBytes.length > 0xff) {
    throw new LocalGovBinaryError("asOf exceeds u1 length");
  }

  const sorted = sortSearchNgramPostings(records);
  if (sorted.length > 0xffff) {
    throw new LocalGovBinaryError("record_count exceeds u2");
  }

  const strings = createStringTableBuilder();
  const encoded = sorted.map((record) => ({
    gramOffset: strings.add(record.gram),
    gramType: requireGramType(record.gramType),
    kind: requireKind(record.kind),
    muniCode: requireU32(record.muniCode, "muniCode"),
    prefCode: requireU8(record.prefCode, "prefCode"),
    hasWard: requireFlag(record.hasWard, "hasWard"),
    isWard: requireFlag(record.isWard, "isWard"),
  }));

  const headerSize = 4 + 1 + 1 + asOfBytes.length + 2;
  const total =
    headerSize + NGRAM_POSTING_RECORD_SIZE * encoded.length + strings.byteLength;
  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  let pos = 0;
  bytes.set(MAGIC_JLIX_BYTES, pos);
  pos += 4;
  view.setUint8(pos++, version);
  view.setUint8(pos++, asOfBytes.length);
  bytes.set(asOfBytes, pos);
  pos += asOfBytes.length;
  view.setUint16(pos, encoded.length, true);
  pos += 2;

  for (const record of encoded) {
    view.setUint32(pos, record.gramOffset, true);
    pos += 4;
    view.setUint8(pos++, record.gramType);
    view.setUint8(pos++, record.kind);
    view.setUint32(pos, record.muniCode, true);
    pos += 4;
    view.setUint8(pos++, record.prefCode);
    view.setUint8(pos++, record.hasWard);
    view.setUint8(pos++, record.isWard);
  }

  const end = strings.writeTo(bytes, pos);
  if (end !== total) {
    throw new LocalGovBinaryError("Internal encode size mismatch (JLIX)");
  }
  return buffer;
}

export function decodeSearchNgrams(buffer: ArrayBuffer): DecodedSearchNgramsBin {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const end = bytes.length;

  assertMagic(bytes, MAGIC_JLIX, "JLIX");
  let pos = 4;

  if (pos + 2 > end) {
    throw new LocalGovBinaryError("JLIX: buffer too short for version/asOfLen");
  }
  const version = view.getUint8(pos++);
  if (version !== BINARY_FORMAT_VERSION) {
    throw new LocalGovBinaryError(`Unsupported version: ${version}`);
  }
  const asOfLen = view.getUint8(pos++);
  if (pos + asOfLen + 2 > end) {
    throw new LocalGovBinaryError("JLIX: buffer too short for asOf/record_count");
  }
  const asOf = new TextDecoder().decode(bytes.subarray(pos, pos + asOfLen));
  pos += asOfLen;
  const recordCount = view.getUint16(pos, true);
  pos += 2;

  const recordsByteLength = NGRAM_POSTING_RECORD_SIZE * recordCount;
  if (pos + recordsByteLength > end) {
    throw new LocalGovBinaryError("JLIX: buffer too short for records");
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
