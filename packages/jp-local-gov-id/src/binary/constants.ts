/** Binary format constants for JLPR / JLDT / JLIX (Issues #73 / #63). */

export const BINARY_FORMAT_VERSION = 1;

export const MAGIC_JLPR = "JLPR";
export const MAGIC_JLDT = "JLDT";
export const MAGIC_JLIX = "JLIX";

export const MAGIC_JLPR_BYTES = new Uint8Array([0x4a, 0x4c, 0x50, 0x52]);
export const MAGIC_JLDT_BYTES = new Uint8Array([0x4a, 0x4c, 0x44, 0x54]);
export const MAGIC_JLIX_BYTES = new Uint8Array([0x4a, 0x4c, 0x49, 0x58]);

/** Prefecture fixed record: u1 + u4 + u4 + u4 + u1 + u1 + u1 */
export const PREFECTURE_RECORD_SIZE = 16;

/** Municipality fixed record: u4 + u4 + u4 + u1 + u1 */
export const MUNICIPALITY_RECORD_SIZE = 14;

/** Search n-gram posting: u4 + u1 + u1 + u4 + u1 + u1 + u1 */
export const NGRAM_POSTING_RECORD_SIZE = 13;

export const GRAM_TYPE_NAME = 0;
export const GRAM_TYPE_KANA = 1;
export const KIND_PREF = 0;
export const KIND_MUNI = 1;

/** Logical schemaVersion on decoded envelopes (unchanged from JSON era). */
export const DECODED_SCHEMA_VERSION = 1;
