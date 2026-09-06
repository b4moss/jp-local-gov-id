import {
  BINARY_FORMAT_VERSION,
  MAGIC_JLPR_BYTES,
  PREFECTURE_RECORD_SIZE,
} from "./constants";
import { LocalGovBinaryError } from "./errors";
import { createStringTableBuilder, encodeUtf8 } from "./stringTable";
import { requireU8, requireU32 } from "./assert";
import { msg as encodeMsg } from "../messages.encode";
import type { EncodePrefecturesMeta, PrefectureBinRecord } from "./prefectures";

export function encodePrefectures(
  records: PrefectureBinRecord[],
  meta: EncodePrefecturesMeta,
): ArrayBuffer {
  const version = meta.version ?? BINARY_FORMAT_VERSION;
  requireU8(version, "version");
  const asOfBytes = encodeUtf8(meta.asOf);
  if (asOfBytes.length > 0xff) {
    throw new LocalGovBinaryError(encodeMsg("binary.asOfExceedsU1"));
  }
  if (records.length > 0xffff) {
    throw new LocalGovBinaryError(encodeMsg("binary.recordCountExceedsU2"));
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
    throw new LocalGovBinaryError(encodeMsg("binary.jlpr.encodeSizeMismatch"));
  }
  return buffer;
}
