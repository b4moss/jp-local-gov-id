/**
 * Code-point n-grams for search indexing (#63).
 * Call after `normalizeSearchText` when building from raw names.
 */

/** Split into Unicode code points and emit adjacent 2-grams. Length < 2 → []. */
export function codePointBigrams(text: string): string[] {
  return codePointNgrams(text, 2);
}

/** Adjacent 3-grams. Length < 3 → []. */
export function codePointTrigrams(text: string): string[] {
  return codePointNgrams(text, 3);
}

export function codePointNgrams(text: string, n: number): string[] {
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError("n must be a positive integer");
  }
  const chars = Array.from(text);
  if (chars.length < n) return [];
  const out: string[] = [];
  for (let i = 0; i <= chars.length - n; i++) {
    out.push(chars.slice(i, i + n).join(""));
  }
  return out;
}

/** 3-gram JLIX shard count (#63). */
export const THREE_GRAM_SHARD_COUNT = 3;

/**
 * FNV-1a 32-bit over UTF-8 bytes, then `% shardCount`.
 * Must match generate partitioning for 3-gram shards.
 */
export function gramShardIndex(
  gram: string,
  shardCount: number = THREE_GRAM_SHARD_COUNT,
): number {
  if (!Number.isInteger(shardCount) || shardCount < 1) {
    throw new RangeError("shardCount must be a positive integer");
  }
  const bytes = new TextEncoder().encode(gram);
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i]!;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash % shardCount;
}

/** Decimal shard id string (`0` … `2` for count 3). */
export function gramShardId(
  gram: string,
  shardCount: number = THREE_GRAM_SHARD_COUNT,
): string {
  return String(gramShardIndex(gram, shardCount));
}

export function allThreeGramShardIds(
  shardCount: number = THREE_GRAM_SHARD_COUNT,
): string[] {
  return Array.from({ length: shardCount }, (_, i) => String(i));
}
