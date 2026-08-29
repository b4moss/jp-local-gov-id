import {
  GRAM_TYPE_KANA,
  GRAM_TYPE_NAME,
  KIND_MUNI,
  type SearchNgramPostingRecord,
} from "./binary";
import type { DesignatedCityMode, MatchField } from "./types";

export type SearchIndex = {
  version: number;
  asOf: string;
  /** gram → postings (all gramTypes / kinds mixed; filter at query time) */
  byGram: ReadonlyMap<string, readonly SearchNgramPostingRecord[]>;
};

export function buildSearchIndex(decoded: {
  version: number;
  asOf: string;
  records: SearchNgramPostingRecord[];
}): SearchIndex {
  const byGram = new Map<string, SearchNgramPostingRecord[]>();
  for (const record of decoded.records) {
    const list = byGram.get(record.gram);
    if (list) list.push(record);
    else byGram.set(record.gram, [record]);
  }
  return {
    version: decoded.version,
    asOf: decoded.asOf,
    byGram,
  };
}

/** Merge partition indexes; concatenate posting lists for the same gram. */
export function mergeSearchIndexes(parts: readonly SearchIndex[]): SearchIndex {
  if (parts.length === 0) {
    return { version: 0, asOf: "", byGram: new Map() };
  }
  if (parts.length === 1) return parts[0]!;

  const byGram = new Map<string, SearchNgramPostingRecord[]>();
  for (const part of parts) {
    for (const [gram, list] of part.byGram) {
      const existing = byGram.get(gram);
      if (existing) existing.push(...list);
      else byGram.set(gram, [...list]);
    }
  }
  return {
    version: parts[0]!.version,
    asOf: parts[0]!.asOf,
    byGram,
  };
}

/** Union hits by muniCode (first wins for prefCode). */
export function unionSearchHits(
  groups: readonly SearchIndexHit[][],
): SearchIndexHit[] {
  const map = new Map<string, SearchIndexHit>();
  for (const group of groups) {
    for (const hit of group) {
      if (!map.has(hit.muniCode)) map.set(hit.muniCode, hit);
    }
  }
  return [...map.values()];
}

function gramTypesFor(matchField: MatchField): ReadonlySet<number> {
  if (matchField === "name") return new Set([GRAM_TYPE_NAME]);
  if (matchField === "nameKana") return new Set([GRAM_TYPE_KANA]);
  // both: mix name/kana postings (Issue #63 decision)
  return new Set([GRAM_TYPE_NAME, GRAM_TYPE_KANA]);
}

function passesDesignatedCity(
  record: SearchNgramPostingRecord,
  mode: DesignatedCityMode,
): boolean {
  if (mode === "both") return true;
  if (mode === "city") return record.isWard === 0;
  // ward: drop designated-city bodies (hasWard=1)
  return record.hasWard === 0;
}

export type SearchIndexQuery = {
  grams: readonly string[];
  matchField: MatchField;
  designatedCity: DesignatedCityMode;
};

export type SearchIndexHit = {
  muniCode: string;
  prefCode: string;
};

/**
 * Intersect posting lists for all grams. Returns empty if any gram is missing.
 * Only municipality postings (`kind=muni`) — prefectures use linear search.
 */
export function querySearchIndex(
  index: SearchIndex,
  query: SearchIndexQuery,
): SearchIndexHit[] {
  if (query.grams.length === 0) return [];

  const types = gramTypesFor(query.matchField);
  let intersection: Set<number> | null = null;
  const meta = new Map<number, { prefCode: number }>();

  for (const gram of query.grams) {
    const postings = index.byGram.get(gram);
    if (!postings || postings.length === 0) return [];

    const codes = new Set<number>();
    for (const p of postings) {
      if (p.kind !== KIND_MUNI) continue;
      if (!types.has(p.gramType)) continue;
      if (!passesDesignatedCity(p, query.designatedCity)) continue;
      codes.add(p.muniCode);
      if (!meta.has(p.muniCode)) {
        meta.set(p.muniCode, { prefCode: p.prefCode });
      }
    }

    if (codes.size === 0) return [];
    if (intersection === null) {
      intersection = codes;
    } else {
      for (const code of [...intersection]) {
        if (!codes.has(code)) intersection.delete(code);
      }
      if (intersection.size === 0) return [];
    }
  }

  if (!intersection) return [];

  const hits: SearchIndexHit[] = [];
  for (const muniCode of intersection) {
    const info = meta.get(muniCode);
    if (!info) continue;
    hits.push({
      muniCode: String(muniCode).padStart(6, "0"),
      prefCode: String(info.prefCode).padStart(2, "0"),
    });
  }
  return hits;
}

export function warnSearchIndexAsOfMismatch(
  searchAsOf: string | undefined,
  prefecturesAsOf: string | undefined,
): void {
  if (!searchAsOf || !prefecturesAsOf) return;
  if (searchAsOf === prefecturesAsOf) return;
  console.warn(
    `[jp-local-gov-id] JLIX asOf (${searchAsOf}) differs from prefectures asOf (${prefecturesAsOf})`,
  );
}

export function toArrayBuffer(
  bytes: ArrayBuffer | Uint8Array,
): ArrayBuffer {
  if (bytes instanceof ArrayBuffer) return bytes;
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
