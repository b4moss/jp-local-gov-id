/** Binary format constants for JLPR / JLDT (Issue #73). */

export const BINARY_FORMAT_VERSION = 1;

export const MAGIC_JLPR = "JLPR";
export const MAGIC_JLDT = "JLDT";

export const MAGIC_JLPR_BYTES = new Uint8Array([0x4a, 0x4c, 0x50, 0x52]);
export const MAGIC_JLDT_BYTES = new Uint8Array([0x4a, 0x4c, 0x44, 0x54]);

/** Prefecture fixed record: u1 + u4 + u4 + u4 + u1 + u1 + u1 */
export const PREFECTURE_RECORD_SIZE = 16;

/** Municipality fixed record: u4 + u4 + u4 + u1 + u1 */
export const MUNICIPALITY_RECORD_SIZE = 14;

/** Logical schemaVersion on decoded envelopes (unchanged from JSON era). */
export const DECODED_SCHEMA_VERSION = 1;
