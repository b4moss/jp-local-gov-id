import {
  BINARY_FORMAT_VERSION,
  MAGIC_JLDT_BYTES,
  MUNICIPALITY_RECORD_SIZE,
} from "./constants";
import { LocalGovBinaryError } from "./errors";
import { createStringTableBuilder, encodeUtf8 } from "./stringTable";
import { requireFlag, requireU32 } from "./assert";
import { fmt as encodeFmt, msg as encodeMsg } from "../messages.encode";
import type {
  EncodeMunicipalitiesMeta,
  MunicipalityBinRecord,
} from "./municipalities";

export function encodeMunicipalities(
  records: MunicipalityBinRecord[],
  meta: EncodeMunicipalitiesMeta,
): ArrayBuffer {
  const version = meta.version ?? BINARY_FORMAT_VERSION;
  if (!Number.isInteger(version) || version < 0 || version > 0xff) {
    throw new LocalGovBinaryError(
      encodeFmt("binary.versionOutOfU1", { version }),
    );
  }
  const asOfBytes = encodeUtf8(meta.asOf);
  if (asOfBytes.length > 0xff) {
    throw new LocalGovBinaryError(encodeMsg("binary.asOfExceedsU1"));
  }
  if (records.length > 0xffff) {
    throw new LocalGovBinaryError(encodeMsg("binary.recordCountExceedsU2"));
  }

  const strings = createStringTableBuilder();
  const encoded = records.map((record) => ({
    code: requireU32(record.code, "code"),
    nameOffset: strings.add(record.name),
    nameKanaOffset: strings.add(record.nameKana),
    hasWard: requireFlag(record.hasWard, "hasWard"),
    isWard: requireFlag(record.isWard, "isWard"),
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
    throw new LocalGovBinaryError(encodeMsg("binary.jldt.encodeSizeMismatch"));
  }
  return buffer;
}
