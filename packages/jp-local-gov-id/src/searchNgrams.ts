/**
 * Code-point 2-grams for search indexing (#63).
 * Call after `normalizeSearchText` when building from raw names.
 */

/** Split into Unicode code points and emit adjacent 2-grams. Length < 2 → []. */
export function codePointBigrams(text: string): string[] {
  const chars = Array.from(text);
  if (chars.length < 2) return [];
  const out: string[] = [];
  for (let i = 0; i <= chars.length - 2; i++) {
    out.push(`${chars[i]}${chars[i + 1]}`);
  }
  return out;
}
