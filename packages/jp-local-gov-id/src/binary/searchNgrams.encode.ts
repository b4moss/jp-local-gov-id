import {
  BINARY_FORMAT_VERSION,
  GRAM_TYPE_KANA,
  GRAM_TYPE_NAME,
  KIND_MUNI,
  KIND_PREF,
  MAGIC_JLIX_BYTES,
  NGRAM_POSTING_RECORD_SIZE,
} from "./constants";
import { LocalGovBinaryError } from "./errors";
import { createStringTableBuilder, encodeUtf8 } from "./stringTable";
import { requireFlag, requireU8, requireU32 } from "./assert";
import { msg as encodeMsg } from "../messages.encode";
import { fmt } from "../messages";
import {
  sortSearchNgramPostings,
  type EncodeSearchNgramsMeta,
  type EntityKind,
  type GramType,
  type SearchNgramPostingRecord,
} from "./searchNgrams";

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

export function encodeSearchNgrams(
  records: SearchNgramPostingRecord[],
  meta: EncodeSearchNgramsMeta,
): ArrayBuffer {
  const version = meta.version ?? BINARY_FORMAT_VERSION;
  requireU8(version, "version");
  const asOfBytes = encodeUtf8(meta.asOf);
  if (asOfBytes.length > 0xff) {
    throw new LocalGovBinaryError(encodeMsg("binary.asOfExceedsU1"));
  }

  const sorted = sortSearchNgramPostings(records);
  if (sorted.length > 0xffff) {
    throw new LocalGovBinaryError(encodeMsg("binary.recordCountExceedsU2"));
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
    throw new LocalGovBinaryError(encodeMsg("binary.jlix.encodeSizeMismatch"));
  }
  return buffer;
}
